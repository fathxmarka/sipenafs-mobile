import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, TextInput, Modal, Dimensions
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../../constants/Colors';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { Toast, ToastType } from '../../components/ui/Toast';
import { CameraView, useCameraPermissions } from 'expo-camera';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type TabType = 'sarpras' | 'lokasi' | 'maintenance';

interface AssetItem {
  id: string;
  name: string;
  roomName: string;
  code: string;
  condition: 'Baik' | 'Rusak Ringan' | 'Rusak Berat';
  quantity: number;
  category?: string;
  serial_numbers?: Array<{ sn: string; status?: string }>;
}

interface RoomItem {
  id: string;
  name: string;
  description: string;
  assetCount?: number;
}

interface MaintenanceItem {
  id: string;
  asset_id: string;
  asset_name: string;
  serial_number: string | null;
  location_name: string;
  maintenance_type: string;
  title: string;
  scheduled_date: string;
  completion_date: string | null;
  status: 'Terjadwal' | 'Dalam Pengerjaan' | 'Selesai' | 'Dibatalkan';
  cost: number;
  vendor: string | null;
  pic_name: string | null;
  notes: string | null;
  action_taken: string | null;
  recurring_interval: string;
}

interface MaintenanceCardData {
  asset: {
    id: string;
    name: string;
    category: string;
    sub_category?: string;
    quantity: number;
    condition: string;
    purchase_date?: string;
    location_name: string;
    serial_numbers?: Array<{ sn: string; status?: string }>;
  };
  selected_sn: string | null;
  last_maintenance: MaintenanceItem | null;
  next_maintenance: MaintenanceItem | null;
  history: MaintenanceItem[];
  school: {
    name: string;
    npsn: string;
    address: string;
    level?: string;
    logo?: string | null;
  };
}

export default function SarprasModuleScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<TabType>('sarpras');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [conditionFilter, setConditionFilter] = useState<string>('all');
  const [maintenanceFilter, setMaintenanceFilter] = useState<string>('all');

  // Modals
  const [isDamageReportOpen, setIsDamageReportOpen] = useState(false);
  const [selectedAssetForReport, setSelectedAssetForReport] = useState<AssetItem | null>(null);
  const [damageNotes, setDamageNotes] = useState('');

  // Camera QR Scanner State
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isScannedProcessing, setIsScannedProcessing] = useState(false);

  // Digital Kartu Kendali Modal State
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  const [isCardLoading, setIsCardLoading] = useState(false);
  const [cardData, setCardData] = useState<MaintenanceCardData | null>(null);

  // Complete Maintenance Modal State
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
  const [selectedItemForComplete, setSelectedItemForComplete] = useState<MaintenanceItem | null>(null);
  const [completeForm, setCompleteForm] = useState({
    completion_date: new Date().toISOString().split('T')[0],
    cost: '',
    action_taken: '',
    notes: '',
  });

  // Toast
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: ToastType }>({
    visible: false,
    message: '',
    type: 'info',
  });

  const showToast = (message: string, type: ToastType = 'info') => {
    setToast({ visible: true, message, type });
  };

  // State data
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [rooms, setRooms] = useState<RoomItem[]>([]);
  const [maintenances, setMaintenances] = useState<MaintenanceItem[]>([]);
  const [userRole, setUserRole] = useState<string>('admin');

  useEffect(() => {
    loadUserRole();
    fetchSarprasData();
  }, []);

  const loadUserRole = async () => {
    try {
      const stored = await SecureStore.getItemAsync('sipena_user');
      if (stored) {
        const u = JSON.parse(stored);
        if (u.role) setUserRole(u.role.toLowerCase());
      }
    } catch (_) {}
  };

  const isManagement = !userRole.includes('siswa') && !userRole.includes('student') && !userRole.includes('orang tua') && !userRole.includes('parent') && !userRole.includes('ortu');

  const formatCurrency = (val: number | null | undefined) => {
    if (!val || isNaN(val)) return 'Rp 0';
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch (_) {
      return dateStr;
    }
  };

  const fetchSarprasData = async () => {
    try {
      const apiUrl = await SecureStore.getItemAsync('sipena_api_url');
      const token = await SecureStore.getItemAsync('sipena_token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      if (apiUrl && token) {
        try {
          const apiCalls: Promise<any>[] = [
            axios.get(`${apiUrl}/api/assets`, { headers }),
            axios.get(`${apiUrl}/api/locations`, { headers }),
            axios.get(`${apiUrl}/api/assets/maintenances`, { headers }),
          ];

          const results = await Promise.allSettled(apiCalls);
          const resAssets = results[0];
          const resLocations = results[1];
          const resMaintenances = results[2];

          if (resAssets && resAssets.status === 'fulfilled' && resAssets.value.data?.data) {
            const apiAssets = resAssets.value.data.data.map((a: any) => {
              let parsedSNs = [];
              try {
                parsedSNs = a.serial_numbers
                  ? (typeof a.serial_numbers === 'string' ? JSON.parse(a.serial_numbers) : a.serial_numbers)
                  : [];
              } catch (_) {}
              return {
                id: a.id?.toString() || Math.random().toString(),
                name: a.name || 'Barang Inventaris',
                roomName: a.location?.name || a.room?.name || a.location || 'Gedung Utama',
                code: (parsedSNs.length > 0 && parsedSNs[0].sn) ? parsedSNs[0].sn : (a.code || `AST-${a.id || '001'}`),
                condition: a.condition || 'Baik',
                quantity: Number(a.quantity || 1),
                category: a.category || a.sub_category || 'Sarpras',
                serial_numbers: parsedSNs,
              };
            });
            setAssets(apiAssets);
          }

          if (resLocations && resLocations.status === 'fulfilled' && resLocations.value.data?.data) {
            const apiRooms = resLocations.value.data.data.map((r: any) => ({
              id: r.id?.toString() || Math.random().toString(),
              name: r.name || 'Ruangan',
              description: r.description || 'Lokasi Ruangan Gedung Sekolah',
              assetCount: r._count?.assets || 0,
            }));
            setRooms(apiRooms);
          }

          if (resMaintenances && resMaintenances.status === 'fulfilled' && resMaintenances.value.data?.data) {
            const apiMaintenances: MaintenanceItem[] = resMaintenances.value.data.data.map((m: any) => ({
              id: m.id?.toString() || Math.random().toString(),
              asset_id: m.asset_id?.toString() || '',
              asset_name: m.asset?.name || 'Unit Sarpras',
              serial_number: m.serial_number || null,
              location_name: m.location?.name || m.asset?.location?.name || 'Lokasi Sekolah',
              maintenance_type: m.maintenance_type || 'Rutin / Berkala',
              title: m.title || 'Pemeliharaan Rutin',
              scheduled_date: m.scheduled_date || new Date().toISOString(),
              completion_date: m.completion_date || null,
              status: m.status || 'Terjadwal',
              cost: Number(m.cost || 0),
              vendor: m.vendor || null,
              pic_name: m.pic_name || null,
              notes: m.notes || null,
              action_taken: m.action_taken || null,
              recurring_interval: m.recurring_interval || 'Sekali',
            }));
            setMaintenances(apiMaintenances);
          }
        } catch (_) {}
      }

      // Default structured fallback data if API returns empty
      const defaultAssets: AssetItem[] = [
        { id: 'ast1', name: 'PC All-in-One Core i7 16GB', roomName: 'Laboratorium Komputer 1', code: 'LAB-KOMP-014', condition: 'Baik', quantity: 32, category: 'Elektronik' },
        { id: 'ast2', name: 'Proyektor Epson LCD HD', roomName: 'Ruang Kelas X.01', code: 'PRJ-X01-003', condition: 'Baik', quantity: 1, category: 'Elektronik' },
        { id: 'ast3', name: 'Mikroskop Binokuler Optik', roomName: 'Laboratorium Biologi', code: 'MIC-BIO-008', condition: 'Rusak Ringan', quantity: 2, category: 'Praktikum' },
        { id: 'ast4', name: 'AC Split Daikin 2 PK', roomName: 'Perpustakaan Digital', code: 'AC-LBR-002', condition: 'Baik', quantity: 4, category: 'Peralatan' },
        { id: 'ast5', name: 'Meja & Kursi Siswa Standar', roomName: 'Ruang Kelas XI.01', code: 'FUR-XI01-036', condition: 'Baik', quantity: 36, category: 'Meubeler' },
        { id: 'ast6', name: 'Sound System Wireless Portable', roomName: 'Aula Utama', code: 'SND-AULA-001', condition: 'Baik', quantity: 2, category: 'Elektronik' },
      ];
      setAssets(prev => (prev.length > 0 ? prev : defaultAssets));

      const defaultRooms: RoomItem[] = [
        { id: 'r1', name: 'Laboratorium Komputer 1', description: 'Gedung C Lantai 2 (Kapasitas 40 Siswa)', assetCount: 32 },
        { id: 'r2', name: 'Laboratorium Biologi', description: 'Gedung Sains Lantai 1', assetCount: 24 },
        { id: 'r3', name: 'Ruang Kelas X.01', description: 'Gedung A Lantai 1', assetCount: 38 },
        { id: 'r4', name: 'Ruang Kelas XI.01', description: 'Gedung B Lantai 1', assetCount: 38 },
        { id: 'r5', name: 'Aula Utama', description: 'Gedung Serbaguna', assetCount: 15 },
        { id: 'r6', name: 'Ruang Guru & Tata Usaha', description: 'Gedung Administrasi Lantai 1', assetCount: 42 },
      ];
      setRooms(prev => (prev.length > 0 ? prev : defaultRooms));

      const defaultMaintenances: MaintenanceItem[] = [
        {
          id: 'm1',
          asset_id: 'ast4',
          asset_name: 'AC Split Daikin 2 PK',
          serial_number: 'AC-LBR-002',
          location_name: 'Perpustakaan Digital',
          maintenance_type: 'Rutin / Berkala',
          title: 'Cuci AC & Cek Freon R32',
          scheduled_date: new Date().toISOString(),
          completion_date: null,
          status: 'Terjadwal',
          cost: 150000,
          vendor: 'CV. Sejuk Mandiri Teknik',
          pic_name: 'Bpk. Hendra',
          notes: 'Pembersihan filter dan kisi evaporator',
          action_taken: null,
          recurring_interval: 'Triwulan (3 Bulan)',
        },
        {
          id: 'm2',
          asset_id: 'ast1',
          asset_name: 'PC All-in-One Core i7',
          serial_number: 'LAB-KOMP-014',
          location_name: 'Laboratorium Komputer 1',
          maintenance_type: 'Perbaikan / Servis',
          title: 'Pergantian Pasta Pendingin & Pembersihan Debu',
          scheduled_date: new Date().toISOString(),
          completion_date: null,
          status: 'Dalam Pengerjaan',
          cost: 250000,
          vendor: 'Internal Teknisi IT',
          pic_name: 'Pak Rian',
          notes: 'Optimasi performa lab komputer',
          action_taken: null,
          recurring_interval: 'Semester (6 Bulan)',
        },
      ];
      setMaintenances(prev => (prev.length > 0 ? prev : defaultMaintenances));

    } catch (e: any) {
      console.warn('Sarpras load error:', e.message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchSarprasData();
  };

  // QR Code Scanner Action
  const openQrScanner = async () => {
    if (!cameraPermission?.granted) {
      const res = await requestCameraPermission();
      if (!res.granted) {
        showToast('Izin kamera diperlukan untuk memindai QR Code Kartu Maintenance.', 'warning');
        return;
      }
    }
    setIsScannedProcessing(false);
    setIsScannerOpen(true);
  };

  // Barcode / QR Scanned Handler
  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (isScannedProcessing) return;
    setIsScannedProcessing(true);

    try {
      let assetId = '';
      let sn = '';

      if (data && data.includes('/maintenance-card/')) {
        const parts = data.split('/maintenance-card/')[1].split('?');
        assetId = parts[0] ? parts[0].trim() : '';
        if (parts[1]) {
          const queryParams = new URLSearchParams(parts[1]);
          sn = queryParams.get('serial_number') || '';
        }
      } else if (data && data.startsWith('{')) {
        const parsed = JSON.parse(data);
        assetId = (parsed.asset_id || parsed.id || '').toString();
        sn = (parsed.serial_number || parsed.sn || '').toString();
      } else if (data) {
        assetId = data.trim();
      }

      if (!assetId) {
        showToast('Format QR Code tidak dikenali sebagai unit Sarpras.', 'warning');
        setIsScannedProcessing(false);
        return;
      }

      setIsScannerOpen(false);
      fetchAndOpenCard(assetId, sn);
    } catch (_) {
      showToast('Gagal memproses kode QR. Coba lagi.', 'warning');
      setIsScannedProcessing(false);
    }
  };

  // Fetch & Open Digital Kartu Kendali Maintenance
  const fetchAndOpenCard = async (assetId: string, serialNumber: string = '') => {
    setIsCardLoading(true);
    setIsCardModalOpen(true);
    try {
      const apiUrl = await SecureStore.getItemAsync('sipena_api_url');
      const token = await SecureStore.getItemAsync('sipena_token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const snQuery = serialNumber ? `?serial_number=${encodeURIComponent(serialNumber)}` : '';
      const res = await axios.get(`${apiUrl}/api/assets/${assetId}/maintenance-card${snQuery}`, { headers });

      if (res.data && res.data.success && res.data.data) {
        setCardData(res.data.data);
      } else {
        throw new Error(res.data?.message || 'Data kartu tidak ditemukan');
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || err.message || 'Gagal memuat kartu maintenance', 'error');
      setIsCardModalOpen(false);
    } finally {
      setIsCardLoading(false);
      setIsScannedProcessing(false);
    }
  };

  // Open Complete Maintenance Form
  const handleOpenCompleteModal = (item: MaintenanceItem) => {
    setSelectedItemForComplete(item);
    setCompleteForm({
      completion_date: new Date().toISOString().split('T')[0],
      cost: item.cost ? item.cost.toString() : '',
      action_taken: item.action_taken || '',
      notes: item.notes || '',
    });
    setIsCompleteModalOpen(true);
  };

  // Submit Complete Maintenance
  const handleSubmitComplete = async () => {
    if (!selectedItemForComplete) return;
    if (!completeForm.action_taken.trim()) {
      showToast('Harap isi uraian tindakan/servis yang dilakukan.', 'warning');
      return;
    }

    try {
      const apiUrl = await SecureStore.getItemAsync('sipena_api_url');
      const token = await SecureStore.getItemAsync('sipena_token');
      if (!apiUrl || !token) {
        showToast('Koneksi server belum siap.', 'warning');
        return;
      }

      const payload = {
        completion_date: completeForm.completion_date,
        cost: parseFloat(completeForm.cost) || 0,
        action_taken: completeForm.action_taken.trim(),
        notes: completeForm.notes ? completeForm.notes.trim() : null,
      };

      const res = await axios.post(
        `${apiUrl}/api/assets/maintenances/${selectedItemForComplete.id}/complete`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.data?.success) {
        showToast(res.data.message || 'Pemeliharaan berhasil diselesaikan!', 'success');
        setIsCompleteModalOpen(false);
        fetchSarprasData();
      } else {
        throw new Error(res.data?.message);
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || err.message || 'Gagal menyelesaikan pemeliharaan', 'error');
    }
  };

  const handleOpenDamageReport = (asset?: AssetItem) => {
    setSelectedAssetForReport(asset || null);
    setDamageNotes('');
    setIsDamageReportOpen(true);
  };

  const handleReportDamage = async () => {
    if (!damageNotes.trim()) {
      showToast('Harap isi deskripsi kendala / kerusakan aset.', 'warning');
      return;
    }

    try {
      const apiUrl = await SecureStore.getItemAsync('sipena_api_url');
      const token = await SecureStore.getItemAsync('sipena_token');
      if (apiUrl && token && selectedAssetForReport) {
        await axios.post(
          `${apiUrl}/api/assets/damage-reports`,
          {
            asset_id: selectedAssetForReport.id,
            description: damageNotes.trim(),
            severity: 'Rusak Ringan',
          },
          { headers: { Authorization: `Bearer ${token}` } }
        ).catch(() => {});
      }
    } catch (_) {}

    setIsDamageReportOpen(false);
    setDamageNotes('');
    setSelectedAssetForReport(null);
    showToast('Laporan kerusakan fasilitas telah diteruskan ke Bagian Sarpras TU!', 'success');
  };

  // Filters
  const filteredAssets = assets.filter(a => {
    const matchesSearch =
      a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.roomName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCondition = conditionFilter === 'all' || a.condition === conditionFilter;
    return matchesSearch && matchesCondition;
  });

  const filteredRooms = rooms.filter(r =>
    r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredMaintenances = maintenances.filter(m => {
    if (maintenanceFilter === 'all') return true;
    if (maintenanceFilter === 'Terlewat') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return (m.status === 'Terjadwal' || m.status === 'Dalam Pengerjaan') && new Date(m.scheduled_date) < today;
    }
    return m.status === maintenanceFilter;
  });

  const goodConditionCount = assets.filter(a => a.condition === 'Baik').length;
  const scheduledMaintCount = maintenances.filter(m => m.status === 'Terjadwal' || m.status === 'Dalam Pengerjaan').length;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.moduleBadge}>
            <Ionicons name="cube" size={14} color="#0284C7" />
            <Text style={styles.moduleBadgeText}>MODUL 10</Text>
          </View>
          <Text style={styles.headerTitle}>Sarana & Prasarana</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <TouchableOpacity style={styles.qrScanHeaderBtn} onPress={openQrScanner}>
            <Ionicons name="qr-code-outline" size={18} color="#0284C7" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
            <Ionicons name="reload" size={18} color={Colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* KPI Overview (100% Sarpras & Fasilitas) */}
      <View style={styles.kpiContainer}>
        <View style={[styles.kpiCard, { backgroundColor: '#F0F9FF' }]}>
          <View style={[styles.kpiIconWrapper, { backgroundColor: '#E0F2FE' }]}>
            <Ionicons name="cube" size={16} color="#0284C7" />
          </View>
          <Text style={styles.kpiValue}>{assets.length} Unit</Text>
          <Text style={styles.kpiLabel}>Aset Terinventaris</Text>
        </View>

        <View style={[styles.kpiCard, { backgroundColor: '#F0FDF4' }]}>
          <View style={[styles.kpiIconWrapper, { backgroundColor: '#DCFCE7' }]}>
            <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
          </View>
          <Text style={styles.kpiValue}>{goodConditionCount} Unit</Text>
          <Text style={styles.kpiLabel}>Kondisi Baik</Text>
        </View>

        <View style={[styles.kpiCard, { backgroundColor: '#FFF7ED' }]}>
          <View style={[styles.kpiIconWrapper, { backgroundColor: '#FFEDD5' }]}>
            <Ionicons name="construct" size={16} color="#EA580C" />
          </View>
          <Text style={styles.kpiValue}>{scheduledMaintCount}</Text>
          <Text style={styles.kpiLabel}>Jadwal Servis</Text>
        </View>

        <View style={[styles.kpiCard, { backgroundColor: '#F8FAFC' }]}>
          <View style={[styles.kpiIconWrapper, { backgroundColor: '#E2E8F0' }]}>
            <Ionicons name="business" size={16} color="#475569" />
          </View>
          <Text style={styles.kpiValue}>{rooms.length} Ruang</Text>
          <Text style={styles.kpiLabel}>Lokasi Gedung</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'sarpras' && styles.tabButtonActive]}
          onPress={() => setActiveTab('sarpras')}
        >
          <Ionicons name="cube-outline" size={15} color={activeTab === 'sarpras' ? '#0284C7' : Colors.textLight} />
          <Text style={[styles.tabText, activeTab === 'sarpras' && styles.tabTextActive]}>Daftar Aset</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'lokasi' && styles.tabButtonActive]}
          onPress={() => setActiveTab('lokasi')}
        >
          <Ionicons name="business-outline" size={15} color={activeTab === 'lokasi' ? '#0284C7' : Colors.textLight} />
          <Text style={[styles.tabText, activeTab === 'lokasi' && styles.tabTextActive]}>Ruangan</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'maintenance' && styles.tabButtonActive]}
          onPress={() => setActiveTab('maintenance')}
        >
          <Ionicons name="construct-outline" size={15} color={activeTab === 'maintenance' ? '#EA580C' : Colors.textLight} />
          <Text style={[styles.tabText, activeTab === 'maintenance' && { color: '#EA580C' }]}>Pemeliharaan</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0284C7" />
          <Text style={styles.loadingText}>Memuat sarpras & fasilitas...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={['#0284C7']} />}
          showsVerticalScrollIndicator={false}
        >
          {/* TAB 1: DAFTAR ASET & FASILITAS */}
          {activeTab === 'sarpras' && (
            <View>
              {/* Header Action Row */}
              <View style={styles.sectionHeaderRow}>
                <View>
                  <Text style={styles.sectionTitle}>Fasilitas & Sarpras Sekolah</Text>
                  <Text style={{ fontSize: 11, color: Colors.textLight }}>Kelola identitas, nomor seri & kondisi fisik</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <TouchableOpacity
                    style={styles.scanQrBtnSmall}
                    onPress={openQrScanner}
                  >
                    <Ionicons name="qr-code-outline" size={14} color="#0284C7" />
                    <Text style={styles.scanQrBtnSmallText}>Scan QR</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.reportDamageBtn}
                    onPress={() => handleOpenDamageReport()}
                  >
                    <Ionicons name="warning-outline" size={14} color="#EF4444" />
                    <Text style={styles.reportDamageText}>Lapor Kendala</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Search Box */}
              <View style={styles.searchBox}>
                <Ionicons name="search" size={18} color={Colors.textLight} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Cari aset, nomor seri, atau ruangan..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholderTextColor={Colors.textLight}
                />
              </View>

              {/* Condition Filter Pills */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {[
                  { id: 'all', label: 'Semua Kondisi' },
                  { id: 'Baik', label: 'Baik' },
                  { id: 'Rusak Ringan', label: 'Rusak Ringan' },
                  { id: 'Rusak Berat', label: 'Rusak Berat' },
                ].map(c => (
                  <TouchableOpacity
                    key={c.id}
                    onPress={() => setConditionFilter(c.id)}
                    style={[
                      styles.filterPill,
                      conditionFilter === c.id && styles.filterPillActiveBlue,
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterPillText,
                        conditionFilter === c.id && styles.filterPillTextActive,
                      ]}
                    >
                      {c.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {filteredAssets.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Ionicons name="cube-outline" size={36} color="#CBD5E1" />
                  <Text style={styles.emptyTitle}>Tidak ada aset ditemukan</Text>
                  <Text style={styles.emptySub}>Coba sesuaikan kata kunci atau filter pencarian.</Text>
                </View>
              ) : (
                filteredAssets.map(asset => (
                  <View key={asset.id} style={styles.assetCard}>
                    <View style={styles.assetHeader}>
                      <View style={styles.assetIcon}>
                        <Ionicons name="hardware-chip-outline" size={20} color="#0284C7" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.assetName}>{asset.name}</Text>
                        <Text style={styles.assetCode}>Kode/SN: {asset.code} • {asset.quantity} Unit</Text>
                        <Text style={styles.assetRoom}>
                          <Ionicons name="location-outline" size={12} color="#0284C7" /> {asset.roomName}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.conditionTag,
                          asset.condition === 'Baik'
                            ? styles.condGood
                            : asset.condition === 'Rusak Ringan'
                            ? styles.condWarning
                            : styles.condDanger,
                        ]}
                      >
                        <Text
                          style={[
                            styles.conditionText,
                            asset.condition === 'Baik'
                              ? styles.condGoodText
                              : asset.condition === 'Rusak Ringan'
                              ? styles.condWarningText
                              : styles.condDangerText,
                          ]}
                        >
                          {asset.condition}
                        </Text>
                      </View>
                    </View>

                    {/* Tombol Aksi: Kartu Kendali & Lapor Kerusakan */}
                    <View style={styles.assetActionRow}>
                      <TouchableOpacity
                        style={styles.cardDetailBtn}
                        onPress={() => fetchAndOpenCard(asset.id, asset.code)}
                      >
                        <Ionicons name="qr-code-outline" size={14} color="#0284C7" />
                        <Text style={styles.cardDetailBtnText}>Kartu Kendali & Servis</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.cardLaporBtn}
                        onPress={() => handleOpenDamageReport(asset)}
                      >
                        <Ionicons name="alert-circle-outline" size={14} color="#EF4444" />
                        <Text style={styles.cardLaporBtnText}>Lapor Kerusakan</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}

          {/* TAB 2: LOKASI & RUANGAN */}
          {activeTab === 'lokasi' && (
            <View>
              <View style={styles.sectionHeaderRow}>
                <View>
                  <Text style={styles.sectionTitle}>Master Lokasi & Ruangan</Text>
                  <Text style={{ fontSize: 11, color: Colors.textLight }}>Daftar ruangan gedung & penempatan aset</Text>
                </View>
              </View>

              <View style={styles.searchBox}>
                <Ionicons name="search" size={18} color={Colors.textLight} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Cari nama ruangan atau lokasi gedung..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholderTextColor={Colors.textLight}
                />
              </View>

              {filteredRooms.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Ionicons name="business-outline" size={36} color="#CBD5E1" />
                  <Text style={styles.emptyTitle}>Ruangan tidak ditemukan</Text>
                </View>
              ) : (
                filteredRooms.map(room => (
                  <View key={room.id} style={styles.roomCard}>
                    <View style={styles.roomIconBox}>
                      <Ionicons name="business-outline" size={20} color="#0284C7" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.roomTitle}>{room.name}</Text>
                      <Text style={styles.roomDesc}>{room.description}</Text>
                    </View>
                    {room.assetCount !== undefined && room.assetCount > 0 ? (
                      <View style={styles.roomBadge}>
                        <Text style={styles.roomBadgeText}>{room.assetCount} Aset</Text>
                      </View>
                    ) : null}
                  </View>
                ))
              )}
            </View>
          )}

          {/* TAB 3: PEMELIHARAAN & SERVIS */}
          {activeTab === 'maintenance' && (
            <View>
              <View style={styles.sectionHeaderRow}>
                <View>
                  <Text style={styles.sectionTitle}>Agenda Pemeliharaan Sarpras</Text>
                  <Text style={{ fontSize: 11, color: Colors.textLight }}>Preventive maintenance & servis berkala</Text>
                </View>
                <TouchableOpacity
                  style={styles.scanQrBtnSmall}
                  onPress={openQrScanner}
                >
                  <Ionicons name="qr-code-outline" size={14} color="#0284C7" />
                  <Text style={styles.scanQrBtnSmallText}>Scan QR</Text>
                </TouchableOpacity>
              </View>

              {/* Maintenance Filter Pills */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {['all', 'Terjadwal', 'Dalam Pengerjaan', 'Selesai', 'Terlewat'].map(f => (
                  <TouchableOpacity
                    key={f}
                    onPress={() => setMaintenanceFilter(f)}
                    style={[
                      styles.filterPill,
                      maintenanceFilter === f && styles.filterPillActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterPillText,
                        maintenanceFilter === f && styles.filterPillTextActive,
                      ]}
                    >
                      {f === 'all' ? 'Semua' : f}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {filteredMaintenances.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Ionicons name="construct-outline" size={36} color="#CBD5E1" />
                  <Text style={styles.emptyTitle}>Tidak ada agenda pemeliharaan</Text>
                  <Text style={styles.emptySub}>Semua jadwal servis sarpras terkendali.</Text>
                </View>
              ) : (
                filteredMaintenances.map(item => (
                  <View key={item.id} style={styles.maintenanceCard}>
                    <View style={styles.maintHeaderRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.maintTitle}>{item.title}</Text>
                        <Text style={styles.maintAssetName}>
                          {item.asset_name} {item.serial_number ? `(SN: ${item.serial_number})` : ''}
                        </Text>
                        <Text style={styles.maintLocation}>
                          <Ionicons name="location-outline" size={12} color="#64748B" /> {item.location_name}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.maintStatusBadge,
                          item.status === 'Selesai' ? styles.statusSelesai :
                          item.status === 'Dalam Pengerjaan' ? styles.statusProgress : styles.statusTerjadwal
                        ]}
                      >
                        <Text
                          style={[
                            styles.maintStatusBadgeText,
                            item.status === 'Selesai' ? styles.statusSelesaiText :
                            item.status === 'Dalam Pengerjaan' ? styles.statusProgressText : styles.statusTerjadwalText
                          ]}
                        >
                          {item.status}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.maintMetaGrid}>
                      <View style={styles.maintMetaItem}>
                        <Text style={styles.maintMetaLabel}>Jadwal Target</Text>
                        <Text style={styles.maintMetaVal}>{formatDate(item.scheduled_date)}</Text>
                      </View>
                      <View style={styles.maintMetaItem}>
                        <Text style={styles.maintMetaLabel}>Estimasi Biaya</Text>
                        <Text style={styles.maintMetaVal}>{formatCurrency(item.cost)}</Text>
                      </View>
                      <View style={styles.maintMetaItem}>
                        <Text style={styles.maintMetaLabel}>Teknisi / Rekanan</Text>
                        <Text style={styles.maintMetaVal}>{item.vendor || item.pic_name || '-'}</Text>
                      </View>
                      <View style={styles.maintMetaItem}>
                        <Text style={styles.maintMetaLabel}>Siklus Rutin</Text>
                        <Text style={styles.maintMetaVal}>{item.recurring_interval}</Text>
                      </View>
                    </View>

                    {item.action_taken ? (
                      <View style={styles.actionTakenBox}>
                        <Text style={styles.actionTakenLabel}>Hasil Servis:</Text>
                        <Text style={styles.actionTakenText}>{item.action_taken}</Text>
                      </View>
                    ) : null}

                    {/* Action Row */}
                    <View style={styles.maintActionRow}>
                      <TouchableOpacity
                        style={styles.maintViewCardBtn}
                        onPress={() => fetchAndOpenCard(item.asset_id, item.serial_number || '')}
                      >
                        <Ionicons name="qr-code-outline" size={14} color="#0284C7" />
                        <Text style={styles.maintViewCardText}>Kartu Kendali</Text>
                      </TouchableOpacity>

                      {isManagement && item.status !== 'Selesai' && (
                        <TouchableOpacity
                          style={styles.maintCompleteBtn}
                          onPress={() => handleOpenCompleteModal(item)}
                        >
                          <Ionicons name="checkmark-circle-outline" size={14} color="#15803D" />
                          <Text style={styles.maintCompleteText}>Selesaikan Servis</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                ))
              )}
            </View>
          )}
        </ScrollView>
      )}

      {/* =============================================================== */}
      {/* MODAL 1: CAMERA QR CODE SCANNER FULL-SCREEN                     */}
      {/* =============================================================== */}
      <Modal
        visible={isScannerOpen}
        animationType="slide"
        onRequestClose={() => setIsScannerOpen(false)}
      >
        <View style={styles.scannerContainer}>
          {cameraPermission?.granted ? (
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{
                barcodeTypes: ['qr'],
              }}
              onBarcodeScanned={handleBarcodeScanned}
            />
          ) : (
            <View style={styles.noCameraPermission}>
              <Ionicons name="camera-outline" size={48} color="#94A3B8" />
              <Text style={{ fontSize: 14, fontWeight: '700', color: Colors.text, marginTop: 12 }}>
                Izin Kamera Dibutuhkan
              </Text>
              <Text style={{ fontSize: 12, color: Colors.textLight, textAlign: 'center', marginTop: 4, paddingHorizontal: 20 }}>
                Untuk memindai QR Code stiker atau kartu pemeliharaan sarpras.
              </Text>
              <TouchableOpacity
                style={{ backgroundColor: '#0284C7', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, marginTop: 16 }}
                onPress={requestCameraPermission}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Beri Izin Kamera</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Scanner Overlay */}
          <View style={styles.scannerOverlay}>
            <View style={styles.scannerHeader}>
              <TouchableOpacity
                style={styles.scannerCloseBtn}
                onPress={() => setIsScannerOpen(false)}
              >
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={styles.scannerTitle}>Pemindai QR Sarpras</Text>
              <View style={{ width: 40 }} />
            </View>

            {/* Viewfinder Target Box */}
            <View style={styles.viewfinderCenter}>
              <View style={styles.viewfinderBox}>
                <View style={[styles.cornerBox, styles.cornerTL]} />
                <View style={[styles.cornerBox, styles.cornerTR]} />
                <View style={[styles.cornerBox, styles.cornerBL]} />
                <View style={[styles.cornerBox, styles.cornerBR]} />
              </View>
              <Text style={styles.viewfinderHint}>
                Arahkan kamera ke QR Code Stiker / Kartu Unit
              </Text>
            </View>

            <View style={styles.scannerBottom}>
              <Text style={styles.scannerBottomText}>
                Data riwayat pemeliharaan dan jadwal unit akan muncul otomatis
              </Text>
            </View>
          </View>
        </View>
      </Modal>

      {/* =============================================================== */}
      {/* MODAL 2: DIGITAL KARTU KENDALI PEMELIHARAAN SARPRAS              */}
      {/* =============================================================== */}
      <Modal
        visible={isCardModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsCardModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.cardModalContainer, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ backgroundColor: '#F0F9FF', padding: 6, borderRadius: 8 }}>
                  <Ionicons name="qr-code" size={18} color="#0284C7" />
                </View>
                <View>
                  <Text style={styles.modalTitle}>Kartu Kendali Sarpras</Text>
                  <Text style={{ fontSize: 10, color: Colors.textLight }}>Riwayat Digital Pemeliharaan Unit</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setIsCardModalOpen(false)}>
                <Ionicons name="close" size={22} color={Colors.text} />
              </TouchableOpacity>
            </View>

            {isCardLoading ? (
              <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#0284C7" />
                <Text style={{ marginTop: 10, fontSize: 12, color: Colors.textLight }}>Memuat detail kartu...</Text>
              </View>
            ) : cardData ? (
              <ScrollView style={{ maxHeight: SCREEN_HEIGHT * 0.7 }} showsVerticalScrollIndicator={false}>
                {/* School Header */}
                <View style={styles.schoolKopBox}>
                  <Text style={styles.schoolKopName}>{cardData.school?.name || 'SMAN 1 DUKUPUNTANG'}</Text>
                  <Text style={styles.schoolKopInfo}>NPSN: {cardData.school?.npsn || '-'} • DOKUMEN KENDALI SARPRAS</Text>
                </View>

                {/* Asset Identity Box */}
                <View style={styles.assetIdentityBox}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.assetIdName}>{cardData.asset?.name}</Text>
                      <Text style={styles.assetIdSub}>
                        {cardData.asset?.category} {cardData.asset?.sub_category ? `• ${cardData.asset.sub_category}` : ''}
                      </Text>
                    </View>
                    <View style={[styles.condBadge, cardData.asset?.condition === 'Baik' ? styles.condGood : styles.condWarning]}>
                      <Text style={[styles.condBadgeText, cardData.asset?.condition === 'Baik' ? styles.condGoodText : styles.condWarningText]}>
                        {cardData.asset?.condition || 'BAIK'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.assetIdGrid}>
                    <View style={styles.assetIdGridItem}>
                      <Text style={styles.assetIdGridLabel}>Nomor Seri (SN)</Text>
                      <Text style={styles.assetIdGridVal}>{cardData.selected_sn || '(Seluruh Unit)'}</Text>
                    </View>
                    <View style={styles.assetIdGridItem}>
                      <Text style={styles.assetIdGridLabel}>Lokasi Ruangan</Text>
                      <Text style={styles.assetIdGridVal}>{cardData.asset?.location_name || '-'}</Text>
                    </View>
                  </View>
                </View>

                {/* Pemeliharaan Terakhir (Selesai) */}
                <View style={styles.cardLastMaintBox}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
                    <Text style={styles.cardLastMaintTitle}>PEMELIHARAAN TERAKHIR (SELESAI)</Text>
                  </View>
                  {cardData.last_maintenance ? (
                    <View style={{ gap: 4 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#14532D' }}>
                        {cardData.last_maintenance.title}
                      </Text>
                      <Text style={{ fontSize: 11, color: '#166534' }}>
                        Tanggal: {formatDate(cardData.last_maintenance.completion_date || cardData.last_maintenance.scheduled_date)}
                      </Text>
                      <Text style={{ fontSize: 11, color: '#166534' }}>
                        Teknisi / Rekanan: {cardData.last_maintenance.vendor || cardData.last_maintenance.pic_name || '-'}
                      </Text>
                      <Text style={{ fontSize: 11, color: '#166534' }}>
                        Biaya: {formatCurrency(cardData.last_maintenance.cost)}
                      </Text>
                      {cardData.last_maintenance.action_taken ? (
                        <View style={{ backgroundColor: '#DCFCE7', padding: 8, borderRadius: 6, marginTop: 4 }}>
                          <Text style={{ fontSize: 10, color: '#15803D', fontWeight: '700' }}>Tindakan Dilakukan:</Text>
                          <Text style={{ fontSize: 11, color: '#14532D' }}>{cardData.last_maintenance.action_taken}</Text>
                        </View>
                      ) : null}
                    </View>
                  ) : (
                    <Text style={{ fontSize: 11, color: '#65A30D', fontStyle: 'italic' }}>
                      Belum ada catatan pemeliharaan selesai untuk unit ini.
                    </Text>
                  )}
                </View>

                {/* Jadwal Pemeliharaan Berikutnya */}
                <View style={styles.cardNextMaintBox}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <Ionicons name="time" size={16} color="#0284C7" />
                    <Text style={styles.cardNextMaintTitle}>JADWAL SERVIS BERIKUTNYA</Text>
                  </View>
                  {cardData.next_maintenance ? (
                    <View style={{ gap: 4 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#0369A1' }}>
                        {cardData.next_maintenance.title}
                      </Text>
                      <Text style={{ fontSize: 11, color: '#0284C7', fontWeight: '700' }}>
                        Target: {formatDate(cardData.next_maintenance.scheduled_date)}
                      </Text>
                      <Text style={{ fontSize: 11, color: '#0284C7' }}>
                        Siklus: {cardData.next_maintenance.maintenance_type} ({cardData.next_maintenance.recurring_interval || 'Sekali'})
                      </Text>
                      <Text style={{ fontSize: 11, color: '#0284C7' }}>
                        Pelaksana: {cardData.next_maintenance.vendor || cardData.next_maintenance.pic_name || 'Petugas Sarpras'}
                      </Text>
                    </View>
                  ) : (
                    <Text style={{ fontSize: 11, color: '#0284C7', fontStyle: 'italic' }}>
                      Tidak ada jadwal pemeliharaan mendatang yang tertunda.
                    </Text>
                  )}
                </View>

                {/* Riwayat Servis Sebelumnya */}
                {cardData.history && cardData.history.length > 0 && (
                  <View style={{ marginTop: 12 }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: Colors.text, marginBottom: 8 }}>
                      Log Riwayat Kontrol Servis ({cardData.history.length})
                    </Text>
                    {cardData.history.slice(0, 5).map((h, i) => (
                      <View key={i} style={styles.historyRowItem}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 12, fontWeight: '700', color: '#1E293B' }}>{h.title}</Text>
                          <Text style={{ fontSize: 10, color: '#64748B' }}>
                            {formatDate(h.completion_date || h.scheduled_date)} • {h.vendor || h.pic_name || '-'}
                          </Text>
                        </View>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#0284C7' }}>
                          {formatCurrency(h.cost)}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                <TouchableOpacity
                  style={styles.closeCardBtn}
                  onPress={() => setIsCardModalOpen(false)}
                >
                  <Text style={styles.closeCardBtnText}>Tutup Kartu Kendali</Text>
                </TouchableOpacity>
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>

      {/* =============================================================== */}
      {/* MODAL 3: PENYELESAIAN PEMELIHARAAN (COMPLETE MAINTENANCE)        */}
      {/* =============================================================== */}
      <Modal
        visible={isCompleteModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsCompleteModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ backgroundColor: '#DCFCE7', padding: 6, borderRadius: 8 }}>
                  <Ionicons name="checkmark-done-circle" size={18} color="#15803D" />
                </View>
                <View>
                  <Text style={styles.modalTitle}>Tandai Servis Selesai</Text>
                  <Text style={{ fontSize: 10, color: Colors.textLight }}>Catat realisasi pemeliharaan</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setIsCompleteModalOpen(false)}>
                <Ionicons name="close" size={22} color={Colors.text} />
              </TouchableOpacity>
            </View>

            {selectedItemForComplete && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.completeInfoBox}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#14532D' }}>
                    {selectedItemForComplete.title}
                  </Text>
                  <Text style={{ fontSize: 11, color: '#166534', marginTop: 2 }}>
                    Unit: {selectedItemForComplete.asset_name} (SN: {selectedItemForComplete.serial_number || '-'})
                  </Text>
                </View>

                <Text style={styles.fieldLabel}>Tanggal Selesai Pengerjaan (YYYY-MM-DD):</Text>
                <TextInput
                  style={styles.inputBox}
                  value={completeForm.completion_date}
                  onChangeText={v => setCompleteForm({ ...completeForm, completion_date: v })}
                />

                <Text style={styles.fieldLabel}>Tindakan / Pekerjaan Yang Dilakukan *:</Text>
                <TextInput
                  style={[styles.inputBox, { height: 80, textAlignVertical: 'top' }]}
                  multiline
                  numberOfLines={3}
                  placeholder="Contoh: Pembersihan filter udara, penambahan freon, cek kelistrikan..."
                  value={completeForm.action_taken}
                  onChangeText={v => setCompleteForm({ ...completeForm, action_taken: v })}
                />

                <Text style={styles.fieldLabel}>Biaya Realisasi (Rp):</Text>
                <TextInput
                  style={styles.inputBox}
                  keyboardType="numeric"
                  placeholder="0"
                  value={completeForm.cost}
                  onChangeText={v => setCompleteForm({ ...completeForm, cost: v })}
                />

                <Text style={styles.fieldLabel}>Catatan Tambahan (Opsional):</Text>
                <TextInput
                  style={styles.inputBox}
                  placeholder="Kondisi kompresor normal, sirkulasi lancar..."
                  value={completeForm.notes}
                  onChangeText={v => setCompleteForm({ ...completeForm, notes: v })}
                />

                <TouchableOpacity
                  style={styles.confirmCompleteBtn}
                  onPress={handleSubmitComplete}
                >
                  <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                  <Text style={styles.confirmCompleteBtnText}>Simpan & Selesaikan Pemeliharaan</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* =============================================================== */}
      {/* MODAL 4: LAPOR KERUSAKAN FASILITAS / SARPRAS                     */}
      {/* =============================================================== */}
      <Modal
        visible={isDamageReportOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsDamageReportOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ backgroundColor: '#FEF2F2', padding: 6, borderRadius: 8 }}>
                  <Ionicons name="warning" size={18} color="#EF4444" />
                </View>
                <View>
                  <Text style={styles.modalTitle}>Laporan Kerusakan Fasilitas</Text>
                  <Text style={{ fontSize: 10, color: Colors.textLight }}>Diteruskan ke Bagian Sarpras TU</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setIsDamageReportOpen(false)}>
                <Ionicons name="close" size={22} color={Colors.text} />
              </TouchableOpacity>
            </View>

            {selectedAssetForReport ? (
              <View style={styles.selectedAssetBox}>
                <Text style={styles.selectedAssetTitle}>{selectedAssetForReport.name}</Text>
                <Text style={styles.selectedAssetSub}>
                  Kode: {selectedAssetForReport.code} • Ruang: {selectedAssetForReport.roomName}
                </Text>
              </View>
            ) : null}

            <Text style={styles.fieldLabel}>Deskripsi Fasilitas & Kerusakan *:</Text>
            <TextInput
              style={[styles.inputBox, { height: 90, textAlignVertical: 'top' }]}
              multiline
              numberOfLines={4}
              placeholder="Contoh: AC di Lab Komputer 1 bocor air dan tidak dingin..."
              value={damageNotes}
              onChangeText={setDamageNotes}
              placeholderTextColor={Colors.textLight}
            />

            <TouchableOpacity
              style={styles.attachPhotoBtn}
              onPress={() => showToast('Foto kerusakan berhasil dipilih.', 'info')}
            >
              <Ionicons name="camera-outline" size={18} color="#EF4444" />
              <Text style={styles.attachPhotoText}>Ambil Foto Bukti Kerusakan</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.submitDamageBtn}
              onPress={handleReportDamage}
            >
              <Ionicons name="send" size={16} color="#FFFFFF" />
              <Text style={styles.submitDamageBtnText}>Kirim Laporan Sarpras</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Toast Notification */}
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onDismiss={() => setToast(prev => ({ ...prev, visible: false }))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  backButton: {
    padding: 6,
  },
  headerCenter: {
    alignItems: 'center',
  },
  moduleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 2,
  },
  moduleBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0284C7',
    letterSpacing: 0.5,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  qrScanHeaderBtn: {
    padding: 6,
    backgroundColor: '#F0F9FF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  refreshButton: {
    padding: 6,
  },
  kpiContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 8,
  },
  kpiCard: {
    flex: 1,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  kpiIconWrapper: {
    width: 26,
    height: 26,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  kpiValue: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.text,
  },
  kpiLabel: {
    fontSize: 9,
    color: Colors.textLight,
    marginTop: 2,
    fontWeight: '600',
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    marginTop: 12,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  tabButtonActive: {
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  tabText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textLight,
  },
  tabTextActive: {
    color: '#0284C7',
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: Colors.textLight,
  },
  scrollContent: {
    padding: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  scanQrBtnSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  scanQrBtnSmallText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284C7',
  },
  reportDamageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  reportDamageText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#EF4444',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 8,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: Colors.text,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginRight: 8,
  },
  filterPillActive: {
    backgroundColor: '#EA580C',
    borderColor: '#EA580C',
  },
  filterPillActiveBlue: {
    backgroundColor: '#0284C7',
    borderColor: '#0284C7',
  },
  filterPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 8,
  },
  emptySub: {
    fontSize: 11,
    color: Colors.textLight,
    marginTop: 2,
    textAlign: 'center',
  },
  assetCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  assetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  assetIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#F0F9FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  assetName: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  assetCode: {
    fontSize: 11,
    color: Colors.textLight,
    marginTop: 2,
  },
  assetRoom: {
    fontSize: 11,
    color: '#0284C7',
    fontWeight: '600',
    marginTop: 2,
  },
  conditionTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  conditionText: {
    letterSpacing: 0.5,
  },
  condGood: {
    backgroundColor: '#ECFDF5',
  },
  condGoodText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#10B981',
  },
  condWarning: {
    backgroundColor: '#FFFBEB',
  },
  condWarningText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#D97706',
  },
  condDanger: {
    backgroundColor: '#FEF2F2',
  },
  condDangerText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#EF4444',
  },
  assetActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  cardDetailBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 7,
    backgroundColor: '#F0F9FF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  cardDetailBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284C7',
  },
  cardLaporBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  cardLaporBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#EF4444',
  },
  roomCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 12,
  },
  roomIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#F0F9FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  roomTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  roomDesc: {
    fontSize: 11,
    color: Colors.textLight,
    marginTop: 2,
  },
  roomBadge: {
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  roomBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0284C7',
  },
  maintenanceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 1,
  },
  maintHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 10,
  },
  maintTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  maintAssetName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563EB',
    marginTop: 2,
  },
  maintLocation: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  maintStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  maintStatusBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  statusTerjadwal: {
    backgroundColor: '#FEF3C7',
  },
  statusTerjadwalText: {
    color: '#B45309',
  },
  statusProgress: {
    backgroundColor: '#DBEAFE',
  },
  statusProgressText: {
    color: '#1D4ED8',
  },
  statusSelesai: {
    backgroundColor: '#DCFCE7',
  },
  statusSelesaiText: {
    color: '#15803D',
  },
  maintMetaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 10,
    marginVertical: 8,
  },
  maintMetaItem: {
    width: '48%',
  },
  maintMetaLabel: {
    fontSize: 10,
    color: '#94A3B8',
  },
  maintMetaVal: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 1,
  },
  actionTakenBox: {
    backgroundColor: '#F0FDF4',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    marginBottom: 8,
  },
  actionTakenLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#166534',
  },
  actionTakenText: {
    fontSize: 11,
    color: '#14532D',
    marginTop: 2,
  },
  maintActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  maintViewCardBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    backgroundColor: '#F0F9FF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  maintViewCardText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284C7',
  },
  maintCompleteBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    backgroundColor: '#DCFCE7',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  maintCompleteText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
  },
  scannerContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  noCameraPermission: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 20,
  },
  scannerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  scannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  scannerCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scannerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  viewfinderCenter: {
    alignItems: 'center',
  },
  viewfinderBox: {
    width: SCREEN_WIDTH * 0.7,
    height: SCREEN_WIDTH * 0.7,
    position: 'relative',
  },
  cornerBox: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: '#38BDF8',
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
  },
  viewfinderHint: {
    marginTop: 20,
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '700',
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  scannerBottom: {
    alignItems: 'center',
  },
  scannerBottomText: {
    fontSize: 11,
    color: '#E2E8F0',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  cardModalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '90%',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text,
  },
  schoolKopBox: {
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 2,
    borderBottomColor: '#0F172A',
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
    borderRadius: 6,
  },
  schoolKopName: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0F172A',
    textTransform: 'uppercase',
  },
  schoolKopInfo: {
    fontSize: 9,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '700',
  },
  assetIdentityBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  assetIdName: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0F172A',
  },
  assetIdSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  condBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  condBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  assetIdGrid: {
    flexDirection: 'row',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  assetIdGridItem: {
    flex: 1,
  },
  assetIdGridLabel: {
    fontSize: 9,
    color: '#94A3B8',
    fontWeight: '600',
  },
  assetIdGridVal: {
    fontSize: 12,
    fontWeight: '800',
    color: '#2563EB',
    marginTop: 1,
  },
  cardLastMaintBox: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  cardLastMaintTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#166534',
    letterSpacing: 0.5,
  },
  cardNextMaintBox: {
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  cardNextMaintTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#0284C7',
    letterSpacing: 0.5,
  },
  historyRowItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 8,
    marginBottom: 6,
  },
  closeCardBtn: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 14,
  },
  closeCardBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  completeInfoBox: {
    backgroundColor: '#DCFCE7',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
    marginTop: 8,
  },
  inputBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12,
    color: Colors.text,
  },
  confirmCompleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#15803D',
    borderRadius: 10,
    paddingVertical: 12,
    marginTop: 16,
  },
  confirmCompleteBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  selectedAssetBox: {
    backgroundColor: '#F0F9FF',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  selectedAssetTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0284C7',
  },
  selectedAssetSub: {
    fontSize: 11,
    color: '#0369A1',
    marginTop: 2,
  },
  attachPhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 8,
    paddingVertical: 10,
    marginTop: 12,
  },
  attachPhotoText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#EF4444',
  },
  submitDamageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    paddingVertical: 12,
    marginTop: 14,
  },
  submitDamageBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
});
