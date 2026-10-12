import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, TextInput, Modal, Dimensions
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import Colors from '../../constants/Colors';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { Toast, ToastType } from '../../components/ui/Toast';
import { CameraView, useCameraPermissions } from 'expo-camera';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type TabType = 'perpus' | 'pinjam' | 'sarpras' | 'maintenance';

interface BookItem {
  id: string;
  title: string;
  author: string;
  category: string;
  isbn?: string;
  availableStock: number;
  isDigital: boolean;
  filePdf?: string;
}

interface BorrowingItem {
  id: string;
  bookTitle: string;
  borrowerName: string;
  borrowDate: string;
  dueDate: string;
  status: 'active' | 'overdue' | 'returned';
}

interface AssetItem {
  id: string;
  name: string;
  roomName: string;
  code: string;
  condition: 'Baik' | 'Rusak Ringan' | 'Rusak Berat';
  quantity: number;
  serial_numbers?: Array<{ sn: string; status?: string }>;
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

  const [activeTab, setActiveTab] = useState<TabType>('perpus');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [selectedBook, setSelectedBook] = useState<BookItem | null>(null);
  const [isBorrowModalOpen, setIsBorrowModalOpen] = useState(false);
  const [isDamageReportOpen, setIsDamageReportOpen] = useState(false);
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

  // Maintenance Filter
  const [maintenanceFilter, setMaintenanceFilter] = useState<string>('all');

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
  const [books, setBooks] = useState<BookItem[]>([]);
  const [borrowings, setBorrowings] = useState<BorrowingItem[]>([]);
  const [assets, setAssets] = useState<AssetItem[]>([]);
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
            axios.get(`${apiUrl}/api/elibrary/books`, { headers }),
            axios.get(`${apiUrl}/api/elibrary/borrowings`, { headers }),
          ];
          if (isManagement) {
            apiCalls.push(axios.get(`${apiUrl}/api/assets`, { headers }));
            apiCalls.push(axios.get(`${apiUrl}/api/assets/maintenances`, { headers }));
          }

          const results = await Promise.allSettled(apiCalls);
          const resBooks = results[0];
          const resBorrowings = results[1];
          const resAssets = isManagement ? results[2] : null;
          const resMaintenances = isManagement ? results[3] : null;

          if (resBooks && resBooks.status === 'fulfilled' && resBooks.value.data?.data) {
            const apiBooks = resBooks.value.data.data.map((b: any) => ({
              id: b.id?.toString() || Math.random().toString(),
              title: b.title || 'Buku Referensi',
              author: b.author || 'Tim Penulis',
              category: b.category?.name || 'Umum',
              isbn: b.isbn || '-',
              availableStock: Number(b.stock || 5),
              isDigital: Boolean(b.file_url || b.is_digital),
            }));
            setBooks(apiBooks);
          }

          if (resBorrowings && resBorrowings.status === 'fulfilled' && resBorrowings.value.data?.data) {
            const apiBorrowings = resBorrowings.value.data.data.map((bw: any) => ({
              id: bw.id?.toString() || Math.random().toString(),
              bookTitle: bw.book?.title || 'Judul Buku',
              borrowerName: bw.student?.name || bw.user?.name || 'Siswa',
              borrowDate: bw.borrow_date || 'Hari ini',
              dueDate: bw.due_date || '7 hari lagi',
              status: bw.status === 'returned' ? 'returned' : 'active',
            }));
            setBorrowings(apiBorrowings);
          }

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
                code: (parsedSNs.length > 0 && parsedSNs[0].sn) ? parsedSNs[0].sn : (a.code || 'AST-001'),
                condition: a.condition || 'Baik',
                quantity: Number(a.quantity || 1),
                serial_numbers: parsedSNs,
              };
            });
            setAssets(apiAssets);
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
      const defaultBooks: BookItem[] = [
        { id: 'b1', title: 'Fisika Kuantum & Relativitas untuk SMA', author: 'Prof. Bambang Subagyo', category: 'Sains & Fisika', availableStock: 12, isDigital: true },
        { id: 'b2', title: 'Algoritma Pemrograman & Jaringan Modern', author: 'Dr. Ir. Rian Hidayat', category: 'Teknologi & IT', availableStock: 8, isDigital: true },
        { id: 'b3', title: 'Laskar Pelangi (Edisi Khusus Sastra)', author: 'Andrea Hirata', category: 'Sastra & Novel', availableStock: 5, isDigital: false },
        { id: 'b4', title: 'Ensiklopedia Sejarah Kemerdekaan Indonesia', author: 'Pusat Kurikulum Kemendikbud', category: 'Sejarah & Budaya', availableStock: 14, isDigital: true },
      ];
      setBooks(prev => (prev.length > 0 ? prev : defaultBooks));

      const defaultBorrowings: BorrowingItem[] = [
        { id: 'bw1', bookTitle: 'Fisika Kuantum & Relativitas untuk SMA', borrowerName: 'Ahmad Fauzan (XII MIPA 1)', borrowDate: '24 Sep 2026', dueDate: '01 Okt 2026', status: 'active' },
        { id: 'bw2', bookTitle: 'Biologi Sel & Genetika Molekuler', borrowerName: 'Ahmad Fauzan (XII MIPA 1)', borrowDate: '10 Sep 2026', dueDate: '17 Sep 2026', status: 'returned' },
      ];
      setBorrowings(prev => (prev.length > 0 ? prev : defaultBorrowings));

      const defaultAssets: AssetItem[] = [
        { id: 'ast1', name: 'PC All-in-One Core i7 16GB', roomName: 'Laboratorium Komputer 1', code: 'LAB-KOMP-014', condition: 'Baik', quantity: 32 },
        { id: 'ast2', name: 'Proyektor Epson LCD HD', roomName: 'Ruang Kelas XII MIPA 1', code: 'PRJ-XII-003', condition: 'Baik', quantity: 1 },
        { id: 'ast3', name: 'Mikroskop Binokuler Optik', roomName: 'Laboratorium Biologi', code: 'MIC-BIO-008', condition: 'Rusak Ringan', quantity: 2 },
        { id: 'ast4', name: 'AC Split Daikin 2 PK', roomName: 'Perpustakaan Digital', code: 'AC-LBR-002', condition: 'Baik', quantity: 4 },
      ];
      setAssets(prev => (prev.length > 0 ? prev : defaultAssets));

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

  const handleOpenBorrow = (book: BookItem) => {
    setSelectedBook(book);
    setIsBorrowModalOpen(true);
  };

  const handleConfirmBorrow = () => {
    if (!selectedBook) return;
    const newBorrowing: BorrowingItem = {
      id: `bw-${Date.now()}`,
      bookTitle: selectedBook.title,
      borrowerName: 'Saya (Peminjaman Baru)',
      borrowDate: 'Hari ini',
      dueDate: '7 Hari Kedepan',
      status: 'active',
    };
    setBorrowings(prev => [newBorrowing, ...prev]);
    setIsBorrowModalOpen(false);
    showToast(`Buku "${selectedBook.title}" berhasil dipinjam! Ambil di perpustakaan.`, 'success');
  };

  const handleReportDamage = () => {
    if (!damageNotes.trim()) {
      showToast('Harap isi deskripsi kendala / kerusakan aset.', 'warning');
      return;
    }
    setIsDamageReportOpen(false);
    setDamageNotes('');
    showToast('Laporan kerusakan fasilitas telah diteruskan ke Bagian Sarpras TU!', 'success');
  };

  const filteredBooks = books.filter(b =>
    b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.category.toLowerCase().includes(searchQuery.toLowerCase())
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

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.moduleBadge}>
            <Ionicons name="library" size={14} color="#0284C7" />
            <Text style={styles.moduleBadgeText}>MODUL 10</Text>
          </View>
          <Text style={styles.headerTitle}>Sarpras & Pemeliharaan</Text>
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

      {/* KPI Overview */}
      <View style={styles.kpiContainer}>
        <View style={[styles.kpiCard, { backgroundColor: '#F0F9FF' }]}>
          <View style={styles.kpiIconWrapper}>
            <Ionicons name="book" size={18} color="#0284C7" />
          </View>
          <Text style={styles.kpiValue}>{books.length} Judul</Text>
          <Text style={styles.kpiLabel}>Katalog E-Perpus</Text>
        </View>

        {isManagement ? (
          <>
            <View style={[styles.kpiCard, { backgroundColor: '#F8FAFC' }]}>
              <View style={[styles.kpiIconWrapper, { backgroundColor: '#E2E8F0' }]}>
                <Ionicons name="cube" size={18} color="#475569" />
              </View>
              <Text style={styles.kpiValue}>{assets.length} Sarpras</Text>
              <Text style={styles.kpiLabel}>Aset Terinventaris</Text>
            </View>

            <View style={[styles.kpiCard, { backgroundColor: '#FFF7ED' }]}>
              <View style={[styles.kpiIconWrapper, { backgroundColor: '#FFEDD5' }]}>
                <Ionicons name="construct" size={18} color="#EA580C" />
              </View>
              <Text style={styles.kpiValue}>{maintenances.filter(m => m.status === 'Terjadwal').length}</Text>
              <Text style={styles.kpiLabel}>Jadwal Servis</Text>
            </View>
          </>
        ) : (
          <View style={[styles.kpiCard, { backgroundColor: '#F0FDF4' }]}>
            <View style={[styles.kpiIconWrapper, { backgroundColor: '#DCFCE7' }]}>
              <Ionicons name="swap-horizontal" size={18} color="#16A34A" />
            </View>
            <Text style={styles.kpiValue}>{borrowings.filter(b => b.status === 'active').length} Buku</Text>
            <Text style={styles.kpiLabel}>Sedang Dipinjam</Text>
          </View>
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'perpus' && styles.tabButtonActive]}
          onPress={() => setActiveTab('perpus')}
        >
          <Ionicons name="book-outline" size={15} color={activeTab === 'perpus' ? '#0284C7' : Colors.textLight} />
          <Text style={[styles.tabText, activeTab === 'perpus' && styles.tabTextActive]}>Katalog</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'pinjam' && styles.tabButtonActive]}
          onPress={() => setActiveTab('pinjam')}
        >
          <Ionicons name="swap-horizontal-outline" size={15} color={activeTab === 'pinjam' ? '#0284C7' : Colors.textLight} />
          <Text style={[styles.tabText, activeTab === 'pinjam' && styles.tabTextActive]}>Pinjam</Text>
        </TouchableOpacity>

        {isManagement && (
          <>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'sarpras' && styles.tabButtonActive]}
              onPress={() => setActiveTab('sarpras')}
            >
              <Ionicons name="cube-outline" size={15} color={activeTab === 'sarpras' ? '#0284C7' : Colors.textLight} />
              <Text style={[styles.tabText, activeTab === 'sarpras' && styles.tabTextActive]}>Aset</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'maintenance' && styles.tabButtonActive]}
              onPress={() => setActiveTab('maintenance')}
            >
              <Ionicons name="construct-outline" size={15} color={activeTab === 'maintenance' ? '#EA580C' : Colors.textLight} />
              <Text style={[styles.tabText, activeTab === 'maintenance' && { color: '#EA580C' }]}>Maintenance</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0284C7" />
          <Text style={styles.loadingText}>Memuat sarpras & pemeliharaan...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={['#0284C7']} />}
          showsVerticalScrollIndicator={false}
        >
          {/* TAB 1: KATALOG BUKU */}
          {activeTab === 'perpus' && (
            <View>
              <View style={styles.searchBox}>
                <Ionicons name="search" size={18} color={Colors.textLight} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Cari judul buku, penulis, atau kategori..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholderTextColor={Colors.textLight}
                />
              </View>

              {filteredBooks.map(book => (
                <View key={book.id} style={styles.bookCard}>
                  <View style={styles.bookCoverPlaceholder}>
                    <Ionicons name="book" size={32} color="#0284C7" />
                    {book.isDigital && (
                      <View style={styles.pdfBadge}>
                        <Text style={styles.pdfBadgeText}>E-BOOK</Text>
                      </View>
                    )}
                  </View>

                  <View style={{ flex: 1 }}>
                    <View style={styles.bookCategoryBadge}>
                      <Text style={styles.bookCategoryText}>{book.category}</Text>
                    </View>
                    <Text style={styles.bookTitle}>{book.title}</Text>
                    <Text style={styles.bookAuthor}>Penulis: {book.author}</Text>
                    <Text style={styles.bookStock}>Tersedia: {book.availableStock} Eksemplar</Text>

                    <View style={styles.bookActionRow}>
                      {book.isDigital ? (
                        <TouchableOpacity
                          style={styles.readBtn}
                          onPress={() => showToast(`Membuka E-Book ${book.title}...`, 'info')}
                        >
                          <Ionicons name="eye" size={14} color="#FFFFFF" />
                          <Text style={styles.readBtnText}>Baca E-Book</Text>
                        </TouchableOpacity>
                      ) : null}

                      <TouchableOpacity
                        style={styles.borrowBtn}
                        onPress={() => handleOpenBorrow(book)}
                      >
                        <Ionicons name="bookmark-outline" size={14} color="#0284C7" />
                        <Text style={styles.borrowBtnText}>Pinjam Fisik</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* TAB 2: PEMINJAMAN */}
          {activeTab === 'pinjam' && (
            <View>
              <Text style={styles.sectionTitle}>Sirkulasi & Peminjaman Saya</Text>
              <Text style={styles.sectionSubtitle}>
                Daftar buku fisik yang sedang dalam masa peminjaman oleh akun Anda.
              </Text>

              {borrowings.map(item => (
                <View key={item.id} style={styles.borrowCard}>
                  <View style={styles.borrowHeader}>
                    <Text style={styles.borrowBookTitle}>{item.bookTitle}</Text>
                    <View
                      style={[
                        styles.borrowStatusTag,
                        item.status === 'active' ? styles.statusActive : styles.statusReturned,
                      ]}
                    >
                      <Text
                        style={[
                          styles.borrowStatusText,
                          item.status === 'active' ? styles.statusActiveText : styles.statusReturnedText,
                        ]}
                      >
                        {item.status === 'active' ? 'DIPINJAM' : 'DIKEMBALIKAN'}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.borrower}>{item.borrowerName}</Text>
                  <View style={styles.borrowDateRow}>
                    <Text style={styles.borrowDate}>Tgl Pinjam: {item.borrowDate}</Text>
                    <Text style={styles.dueDate}>Batas: {item.dueDate}</Text>
                  </View>

                  {item.status === 'active' && (
                    <TouchableOpacity
                      style={styles.returnButton}
                      onPress={() => {
                        setBorrowings(prev =>
                          prev.map(b => (b.id === item.id ? { ...b, status: 'returned' } : b))
                        );
                        showToast(`Buku ${item.bookTitle} berhasil dikembalikan!`, 'success');
                      }}
                    >
                      <Ionicons name="checkmark-done" size={16} color="#0284C7" />
                      <Text style={styles.returnButtonText}>Kembalikan ke Petugas</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* TAB 3: SARPRAS & RUANGAN (Khusus Management Sekolah) */}
          {isManagement && activeTab === 'sarpras' && (
            <View>
              <View style={styles.sectionHeaderRow}>
                <View>
                  <Text style={styles.sectionTitle}>Daftar Fasilitas & Aset</Text>
                  <Text style={{ fontSize: 11, color: Colors.textLight }}>Kelola identitas & kartu kendali unit</Text>
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
                    onPress={() => setIsDamageReportOpen(true)}
                  >
                    <Ionicons name="warning-outline" size={14} color="#EF4444" />
                    <Text style={styles.reportDamageText}>Lapor</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {assets.map(asset => (
                <View key={asset.id} style={styles.assetCard}>
                  <View style={styles.assetHeader}>
                    <View style={styles.assetIcon}>
                      <Ionicons name="hardware-chip-outline" size={20} color="#0284C7" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.assetName}>{asset.name}</Text>
                      <Text style={styles.assetCode}>SN: {asset.code} • {asset.quantity} Unit</Text>
                      <Text style={styles.assetRoom}>Lokasi: {asset.roomName}</Text>
                    </View>
                    <View
                      style={[
                        styles.conditionTag,
                        asset.condition === 'Baik'
                          ? styles.condGood
                          : styles.condWarning,
                      ]}
                    >
                      <Text
                        style={[
                          styles.conditionText,
                          asset.condition === 'Baik' ? styles.condGoodText : styles.condWarningText,
                        ]}
                      >
                        {asset.condition}
                      </Text>
                    </View>
                  </View>

                  {/* Tombol Kartu Kendali & QR pada setiap aset */}
                  <View style={styles.assetActionRow}>
                    <TouchableOpacity
                      style={styles.cardDetailBtn}
                      onPress={() => fetchAndOpenCard(asset.id, asset.code)}
                    >
                      <Ionicons name="qr-code-outline" size={15} color="#0284C7" />
                      <Text style={styles.cardDetailBtnText}>Kartu Kendali & Riwayat Servis</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* TAB 4: JADWAL & LOG PEMELIHARAAN */}
          {isManagement && activeTab === 'maintenance' && (
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
                <View style={{ backgroundColor: '#FFFFFF', padding: 24, borderRadius: 12, alignItems: 'center', marginTop: 10 }}>
                  <Ionicons name="construct-outline" size={36} color="#CBD5E1" />
                  <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.text, marginTop: 8 }}>Tidak ada agenda pemeliharaan</Text>
                  <Text style={{ fontSize: 11, color: Colors.textLight, marginTop: 2 }}>Semua jadwal pemeliharaan terkendali.</Text>
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

                      {item.status !== 'Selesai' && (
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
                Data pemeliharaan terakhir dan jadwal unit akan muncul otomatis
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
                  <Text style={styles.schoolKopName}>{cardData.school?.name || 'SD NEGERI SIPENA'}</Text>
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

      {/* Modal Pinjam Buku */}
      <Modal
        visible={isBorrowModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsBorrowModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Konfirmasi Pinjam Buku</Text>
              <TouchableOpacity onPress={() => setIsBorrowModalOpen(false)}>
                <Ionicons name="close" size={22} color={Colors.text} />
              </TouchableOpacity>
            </View>

            {selectedBook && (
              <View>
                <View style={styles.selectedBookBox}>
                  <Text style={styles.selectedBookTitle}>{selectedBook.title}</Text>
                  <Text style={styles.selectedBookAuthor}>Oleh: {selectedBook.author}</Text>
                  <Text style={styles.selectedBookCat}>Kategori: {selectedBook.category}</Text>
                </View>

                <View style={styles.termBox}>
                  <Ionicons name="information-circle-outline" size={18} color="#0284C7" />
                  <Text style={styles.termText}>
                    Durasi peminjaman buku perpustakaan adalah 7 hari. Harap kembalikan buku tepat waktu dalam kondisi utuh.
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.confirmBorrowBtn}
                  onPress={handleConfirmBorrow}
                >
                  <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                  <Text style={styles.confirmBorrowBtnText}>Proses Peminjaman Buku</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal Lapor Kerusakan */}
      <Modal
        visible={isDamageReportOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsDamageReportOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Laporan Kerusakan Sarpras</Text>
              <TouchableOpacity onPress={() => setIsDamageReportOpen(false)}>
                <Ionicons name="close" size={22} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Deskripsi Fasilitas & Kerusakan:</Text>
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
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  kpiIconWrapper: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#E0F2FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  kpiValue: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text,
  },
  kpiLabel: {
    fontSize: 10,
    color: Colors.textLight,
    marginTop: 2,
    fontWeight: '500',
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
    paddingVertical: 7,
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
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 8,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: Colors.text,
  },
  bookCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 12,
  },
  bookCoverPlaceholder: {
    width: 64,
    height: 90,
    backgroundColor: '#F0F9FF',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#E0F2FE',
  },
  pdfBadge: {
    position: 'absolute',
    bottom: 4,
    backgroundColor: '#EF4444',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  pdfBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  bookCategoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 4,
  },
  bookCategoryText: {
    fontSize: 10,
    color: '#475569',
    fontWeight: '700',
  },
  bookTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  bookAuthor: {
    fontSize: 11,
    color: Colors.textLight,
    marginTop: 2,
  },
  bookStock: {
    fontSize: 11,
    color: '#0284C7',
    fontWeight: '600',
    marginTop: 2,
  },
  bookActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  readBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0284C7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  readBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  borrowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  borrowBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284C7',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: Colors.textLight,
    marginBottom: 14,
    lineHeight: 18,
  },
  borrowCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  borrowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  borrowBookTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    flex: 1,
  },
  borrowStatusTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusActive: {
    backgroundColor: '#FEF3C7',
  },
  statusActiveText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#D97706',
  },
  statusReturned: {
    backgroundColor: '#ECFDF5',
  },
  statusReturnedText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#10B981',
  },
  borrowStatusText: {
    letterSpacing: 0.5,
  },
  borrower: {
    fontSize: 12,
    color: Colors.textLight,
  },
  borrowDateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  borrowDate: {
    fontSize: 11,
    color: Colors.textLight,
  },
  dueDate: {
    fontSize: 11,
    fontWeight: '700',
    color: '#EF4444',
  },
  returnButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F0F9FF',
    borderRadius: 8,
    paddingVertical: 8,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  returnButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284C7',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
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
  assetActionRow: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  cardDetailBtn: {
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
  filterPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  maintenanceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
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
    color: '#0369A1',
    letterSpacing: 0.5,
  },
  historyRowItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  closeCardBtn: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  closeCardBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  completeInfoBox: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  confirmCompleteBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#16A34A',
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 10,
  },
  confirmCompleteBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  selectedBookBox: {
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  selectedBookTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  selectedBookAuthor: {
    fontSize: 12,
    color: Colors.textLight,
    marginTop: 2,
  },
  selectedBookCat: {
    fontSize: 11,
    color: '#0284C7',
    fontWeight: '600',
    marginTop: 4,
  },
  termBox: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  termText: {
    fontSize: 11,
    color: Colors.textLight,
    flex: 1,
    lineHeight: 16,
  },
  confirmBorrowBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0284C7',
    borderRadius: 12,
    paddingVertical: 14,
  },
  confirmBorrowBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 6,
  },
  inputBox: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 12,
    fontSize: 13,
    color: Colors.text,
    marginBottom: 14,
  },
  attachPhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderStyle: 'dashed',
    borderRadius: 10,
    padding: 12,
    backgroundColor: '#FEF2F2',
    marginBottom: 16,
  },
  attachPhotoText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#EF4444',
  },
  submitDamageBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EF4444',
    borderRadius: 12,
    paddingVertical: 14,
  },
  submitDamageBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
