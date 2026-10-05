import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image,
  Platform, ActivityIndicator, Modal, Linking
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Colors from '../../constants/Colors';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { useRouter } from 'expo-router';

type RoleViewType = 'auto' | 'admin' | 'guru' | 'siswa' | 'ortu';

const MENU_ITEMS: Array<{
  id: string;
  title: string;
  icon: any;
  type: string;
  color: string;
  bg: string;
  route?: string;
  allowedRoles?: string[];
  active?: boolean;
  disabled?: boolean;
}> = [
  { id: '1', title: 'Pengaturan\nSistem', icon: 'shield-checkmark-outline', type: 'Ionicons', color: '#0B8A7D', bg: '#E6F4F1', route: '/modules/system', allowedRoles: ['admin', 'kepala sekolah', 'wakil kepala sekolah', 'operator'], active: true },
  { id: '2', title: 'Kesiswaan', icon: 'people-outline', type: 'Ionicons', color: '#10B981', bg: '#ECFDF5', route: '/modules/kesiswaan', allowedRoles: ['admin', 'tata usaha', 'kepala sekolah', 'wakil kepala sekolah', 'operator', 'kesiswaan'], active: true },
  { id: '3', title: 'SDM & Guru', icon: 'person-outline', type: 'Ionicons', color: '#3B82F6', bg: '#EFF6FF', route: '/modules/sdm', allowedRoles: ['admin', 'tata usaha', 'kepala sekolah', 'wakil kepala sekolah'], active: true },
  { id: '4', title: 'Kurikulum &\nJadwal', icon: 'calendar-outline', type: 'Ionicons', color: '#F59E0B', bg: '#FFFBEB', route: '/modules/kurikulum', allowedRoles: ['admin', 'guru', 'tata usaha', 'kepala sekolah', 'wakil kepala sekolah', 'siswa', 'orang tua', 'ortu'], active: true },
  { id: '5', title: 'Presensi &\nDisiplin', icon: 'clipboard-outline', type: 'Ionicons', color: '#F97316', bg: '#FFF7ED', route: '/modules/presensi', allowedRoles: ['admin', 'guru', 'tata usaha', 'kepala sekolah', 'wakil kepala sekolah', 'siswa', 'orang tua', 'ortu'], active: true },
  { id: '6', title: 'E-Rapor', icon: 'school-outline', type: 'Ionicons', color: '#0EA5E9', bg: '#F0F9FF', route: '/modules/erapor', allowedRoles: ['admin', 'wali kelas', 'kepala sekolah', 'wakil kepala sekolah', 'kurikulum'], active: true },
  { id: '7', title: 'Billing &\nSPP', icon: 'card-outline', type: 'Ionicons', color: '#EF4444', bg: '#FEF2F2', route: '/modules/billing', allowedRoles: ['admin', 'tata usaha', 'operator', 'kepala sekolah', 'siswa', 'orang tua', 'ortu'], active: true },
  { id: '8', title: 'E-Learning\n(LMS)', icon: 'book-outline', type: 'Ionicons', color: '#6366F1', bg: '#EEF2FF', route: '/modules/elearning', allowedRoles: ['admin', 'guru', 'tata usaha', 'kepala sekolah', 'wakil kepala sekolah', 'siswa', 'orang tua', 'ortu'], active: true },
  { id: '9', title: 'Portal\nOrang Tua', icon: 'heart-outline', type: 'Ionicons', color: '#EC4899', bg: '#FDF2F8', route: '/modules/ortu', allowedRoles: ['admin', 'orang tua', 'ortu'], active: true },
  { id: '10', title: 'Inventaris &\nPerpus', icon: 'library-outline', type: 'Ionicons', color: '#64748B', bg: '#F8FAFC', route: '/modules/sarpras', allowedRoles: ['admin', 'tata usaha', 'kepala sekolah', 'wakil kepala sekolah', 'operator', 'guru'], active: true },
  { id: '11', title: 'E-Voting &\nPemilu', icon: 'checkbox-outline', type: 'Ionicons', color: '#D946EF', bg: '#FDF4FF', route: '/modules/voting', allowedRoles: ['admin', 'guru', 'tata usaha', 'kepala sekolah', 'wakil kepala sekolah', 'siswa'], active: true },
  { id: '12', title: 'Modul BK', icon: 'chatbubbles-outline', type: 'Ionicons', color: '#EAB308', bg: '#FEFCE8', route: '/modules/bk', allowedRoles: ['admin', 'guru bk', 'bk', 'kepala sekolah', 'siswa', 'student', 'orang tua', 'ortu'], active: true },
  { id: '13', title: 'WA Broadcast', icon: 'megaphone-outline', type: 'Ionicons', color: '#22C55E', bg: '#F0FDF4', route: '/modules/broadcast', allowedRoles: ['admin', 'kepala sekolah', 'operator', 'tata usaha', 'guru'], active: true },
  { id: '14', title: 'Administrasi\nSurat', icon: 'document-text-outline', type: 'Ionicons', color: '#6366F1', bg: '#EEF2FF', route: '/modules/surat', allowedRoles: ['admin', 'tata usaha', 'kepala sekolah', 'wakil kepala sekolah', 'operator', 'guru'], active: true },
  { id: '15', title: 'Perangkat\nAjar AI', icon: 'sparkles-outline', type: 'Ionicons', color: '#0EA5E9', bg: '#F0F9FF', route: '/modules/perangkat-ai', allowedRoles: ['admin', 'guru', 'kepala sekolah', 'wakil kepala sekolah', 'kurikulum'], active: true },
  { id: '16', title: 'CBT &\nUjian Online', icon: 'desktop-outline', type: 'Ionicons', color: '#8B5CF6', bg: '#F5F3FF', route: '/modules/cbt', allowedRoles: ['admin', 'guru', 'siswa', 'kepala sekolah', 'operator'], active: true },
];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [userData, setUserData] = useState<any>(null);
  const [schoolName, setSchoolName] = useState<string>('Memuat Sekolah...');

  const [stats, setStats] = useState({
    siswa: 0,
    guru: 0,
    kelas: 0,
    kehadiran: '100%',
  });

  const [mgmtStats, setMgmtStats] = useState<any>(null);
  const [assetStats, setAssetStats] = useState<any>(null);
  const [bantuanStats, setBantuanStats] = useState<any>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [noticeModule, setNoticeModule] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [todaySchedules, setTodaySchedules] = useState<any[]>([]);
  const [apiUrl, setApiUrl] = useState<string>('');
  const [imgError, setImgError] = useState(false);
  const [selectedExecDetail, setSelectedExecDetail] = useState<any>(null);
  const [showExecModal, setShowExecModal] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // 1. Ambil Data dari SecureStore (Hasil Login)
      const storedUser = await SecureStore.getItemAsync('sipena_user');
      const storedSchool = await SecureStore.getItemAsync('sipena_school_name');
      const apiUrlStored = await SecureStore.getItemAsync('sipena_api_url');
      const token = await SecureStore.getItemAsync('sipena_token');

      if (storedUser) setUserData(JSON.parse(storedUser));
      if (storedSchool) setSchoolName(storedSchool);
      if (apiUrlStored) setApiUrl(apiUrlStored);

      const apiUrl = apiUrlStored;

      if (apiUrl && token) {
        try {
          const resNotif = await axios.get(`${apiUrl}/api/announcements`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (resNotif.data && resNotif.data.success && Array.isArray(resNotif.data.data)) {
            setNotifications(resNotif.data.data.slice(0, 3).map((item: any, idx: number) => ({
              id: item.id?.toString() || idx.toString(),
              title: item.title || 'Pengumuman Sekolah',
              time: item.created_at ? new Date(item.created_at).toLocaleDateString('id-ID') : 'Baru saja',
              type: 'success',
              icon: 'information-circle-outline',
            })));
          }
        } catch (_) {}
      }

      // 2. Ambil Statistik dari Server berdasarkan Role
      if (apiUrl && token && storedUser) {
        const userObj = JSON.parse(storedUser);
        const headers = { Authorization: `Bearer ${token}` };
        const roleStr = (userObj.role || '').toLowerCase();

        if (roleStr.includes('admin') || roleStr.includes('operator') || roleStr.includes('kepala')) {
          try {
            const [resMgmt, resStudents, resClasses] = await Promise.allSettled([
              axios.get(`${apiUrl}/api/dashboard/management`, { headers }),
              axios.get(`${apiUrl}/api/students?perPage=1`, { headers }),
              axios.get(`${apiUrl}/api/classes`, { headers }),
            ]);

            if (resMgmt.status === 'fulfilled' && resMgmt.value.data?.data) {
              const mData = resMgmt.value.data.data;
              setMgmtStats(mData);
              setStats(prev => ({
                ...prev,
                guru: mData.hr?.teachers || prev.guru,
                kehadiran: '96%',
              }));
            }
            if (resStudents.status === 'fulfilled' && resStudents.value.data?.total) {
              setStats(prev => ({ ...prev, siswa: resStudents.value.data.total }));
            }
            if (resClasses.status === 'fulfilled' && resClasses.value.data?.data) {
              setStats(prev => ({ ...prev, kelas: resClasses.value.data.data.length }));
            }

            try {
              const [resAssets, resBantuan] = await Promise.allSettled([
                axios.get(`${apiUrl}/api/assets/stats`, { headers }),
                axios.get(`${apiUrl}/api/dashboard/prioritas-bantuan`, { headers }),
              ]);
              if (resAssets.status === 'fulfilled' && resAssets.value.data?.success) {
                setAssetStats(resAssets.value.data.data);
              }
              if (resBantuan.status === 'fulfilled' && resBantuan.value.data?.success) {
                setBantuanStats(resBantuan.value.data.data);
              }
            } catch (_) {}
          } catch (e: any) {
            console.warn('Fetch management stats error:', e.message);
          }
        } else if (roleStr.includes('guru')) {
          try {
            const [resDash, resSched] = await Promise.allSettled([
              axios.get(`${apiUrl}/api/dashboard/teacher`, { headers }),
              axios.get(`${apiUrl}/api/schedules`, { headers })
            ]);
            
            if (resDash.status === 'fulfilled' && resDash.value.data && resDash.value.data.success) {
              const tData = resDash.value.data.data;
              setStats({
                siswa: tData.totalStudents || 142,
                kelas: tData.totalClasses || 4,
                guru: 1,
                kehadiran: '100%',
              });
            }
            
            if (resSched.status === 'fulfilled' && resSched.value.data?.data) {
              let scheds = resSched.value.data.data;
              if (userObj.teacher_id) {
                scheds = scheds.filter((s: any) => String(s.teacher_id) === String(userObj.teacher_id));
              }
              // Simulasi ambil jadwal hari Senin/hari ini (misal hari ini Senin = 'Senin')
              const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
              const currentDay = days[new Date().getDay()];
              
              // Filter by today, or fallback to any day if testing, let's just use currentDay
              let today = scheds.filter((s: any) => s.day_of_week === currentDay);
              
              // If empty (weekend testing etc), fallback to Senin
              if (today.length === 0) {
                 today = scheds.filter((s: any) => s.day_of_week === 'Senin');
              }
              
              // Sort by start_time
              today.sort((a: any, b: any) => (a.start_time || '').localeCompare(b.start_time || ''));
              setTodaySchedules(today.slice(0, 3)); // show max 3 on dashboard
            }
          } catch (e) {
            console.warn('Fetch teacher stats error:', e);
          }
        }
      }
    } catch (error) {
      console.warn('Gagal memuat data dashboard:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getPhotoUrl = (photoPath?: string) => {
    if (!photoPath) return null;
    if (photoPath.startsWith('http://') || photoPath.startsWith('https://')) {
      return photoPath;
    }
    const cleanBase = (apiUrl || '').replace(/\/+$/, '');
    const cleanPath = photoPath.startsWith('/') ? photoPath : `/${photoPath}`;
    return cleanBase ? `${cleanBase}${cleanPath}` : null;
  };

  const getInitials = (name?: string) => {
    if (!name) return 'SP';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
  };

  const renderUserAvatar = (
    size = 46,
    borderColor = '#FFFFFF',
    fallbackIcon: any = 'person-outline',
    bgColor = Colors.primary
  ) => {
    const photo = userData?.photo || userData?.photo_url || userData?.avatar;
    const photoUrl = getPhotoUrl(photo);

    if (photoUrl && !imgError) {
      return (
        <View style={[styles.avatarContainer, { width: size, height: size, borderRadius: size / 2, borderColor, borderWidth: 2 }]}>
          <Image
            source={{ uri: photoUrl }}
            style={{ width: '100%', height: '100%', borderRadius: size / 2 }}
            resizeMode="cover"
            onError={() => setImgError(true)}
          />
        </View>
      );
    }

    if (userData?.name) {
      return (
        <View style={[styles.avatarContainer, { width: size, height: size, borderRadius: size / 2, backgroundColor: bgColor, borderColor, borderWidth: 2 }]}>
          <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: Math.max(11, Math.round(size * 0.36)) }}>
            {getInitials(userData.name)}
          </Text>
        </View>
      );
    }

    return (
      <View style={[styles.avatarContainer, { width: size, height: size, borderRadius: size / 2, backgroundColor: '#F1F5F9', borderColor, borderWidth: 2 }]}>
        <Ionicons name={fallbackIcon} size={Math.round(size * 0.5)} color={bgColor} />
      </View>
    );
  };

  const openExecDetail = (type: 'retirement' | 'mutation' | 'sarpras' | 'bantuan') => {
    if (type === 'retirement') {
      setSelectedExecDetail({
        type: 'retirement',
        title: 'Waspada Pensiun (Purna Tugas)',
        subtitle: 'Proyeksi batas usia pensiun GTK tahun ini & 5 tahun ke depan',
        badge: 'Manajemen Kepegawaian',
        badgeColor: '#F57C00',
        statNumber: mgmtStats?.retirement?.thisYear ?? 0,
        statUnit: 'Pegawai Purna Tugas Tahun Ini',
        description: 'Menampilkan data tenaga pendidik dan kependidikan yang memasuki batas usia pensiun (BUP). Segera siapkan usulan formasi baru atau rekrutmen pengganti ke dinas terkait.',
        highlights: [
          { label: 'Batas Usia Pensiun Guru', value: `${mgmtStats?.retirement?.settings?.teacher ?? 60} Tahun` },
          { label: 'Batas Usia Pensiun Staf', value: `${mgmtStats?.retirement?.settings?.staff ?? 58} Tahun` },
          { label: 'Total Guru Aktif', value: `${mgmtStats?.hr?.teachers ?? stats.guru} Guru`, color: '#0B8A7D' },
          { label: 'Total Staf / Tendik', value: `${mgmtStats?.hr?.staff ?? 0} Staf`, color: '#3B82F6' },
        ],
        actionTitle: 'Buka Modul SDM & Guru',
        actionRoute: '/modules/sdm'
      });
    } else if (type === 'mutation') {
      setSelectedExecDetail({
        type: 'mutation',
        title: 'Mutasi Siswa & Pegawai',
        subtitle: 'Status usulan perpindahan masuk dan keluar sekolah',
        badge: 'Verifikasi Berkas',
        badgeColor: '#1976D2',
        statNumber: mgmtStats?.mutations?.pending ?? 0,
        statUnit: 'Permohonan Menunggu',
        description: 'Daftar permohonan mutasi peserta didik atau pegawai yang sedang menunggu validasi pimpinan dan sinkronisasi data ke dinas pendidikan.',
        highlights: [
          { label: 'Status Menunggu Persetujuan', value: `${mgmtStats?.mutations?.pending ?? 0} Berkas`, color: '#EF4444' },
          { label: 'Verifikasi Kelengkapan', value: 'Surat Rekomendasi, Rapor, Buku Induk' },
          { label: 'Integrasi Dapodik', value: 'Tersinkronisasi Otomatis', color: '#10B981' }
        ],
        actionTitle: 'Buka Modul Kesiswaan',
        actionRoute: '/modules/kesiswaan'
      });
    } else if (type === 'sarpras') {
      setSelectedExecDetail({
        type: 'sarpras',
        title: 'Inventaris Sarana & Prasarana',
        subtitle: 'Rekapitulasi fasilitas, ruangan, dan perlengkapan sekolah',
        badge: 'Inventarisasi Aset',
        badgeColor: '#00796B',
        statNumber: assetStats?.total_assets !== undefined ? assetStats.total_assets : 0,
        statUnit: 'Total Aset Terdaftar',
        description: 'Pemantauan kondisi sarpras sekolah untuk menjamin standar kenyamanan dan keamanan ruang belajar siswa serta laboratorium.',
        highlights: [
          { label: 'Kondisi Baik', value: `${assetStats?.good_condition ?? assetStats?.total_assets ?? 0} Unit`, color: '#10B981' },
          { label: 'Kondisi Rusak / Perlu Servis', value: `${assetStats?.damaged_condition ?? 0} Unit`, color: '#F59E0B' },
          { 
            label: 'Estimasi Nilai Perolehan', 
            value: assetStats?.total_purchase_price 
              ? `Rp ${Number(assetStats.total_purchase_price).toLocaleString('id-ID')}` 
              : 'Rp 0',
            color: '#0B8A7D'
          }
        ],
        actionTitle: 'Buka Modul Sarpras & Perpus',
        actionRoute: '/modules/sarpras'
      });
    } else if (type === 'bantuan') {
      setSelectedExecDetail({
        type: 'bantuan',
        title: 'Prioritas Bantuan Pendidikan',
        subtitle: 'Penerima manfaat PIP, KIP, dan program afirmasi siswa',
        badge: 'Afirmasi Pendidikan',
        badgeColor: '#7C3AED',
        statNumber: bantuanStats?.total_prioritas ?? bantuanStats?.total_pip ?? 0,
        statUnit: 'Siswa Penerima Bantuan',
        description: 'Pendataan terpadu penerima bantuan Program Indonesia Pintar (PIP) dan afirmasi ekonomi guna mencegah putus sekolah.',
        highlights: [
          { label: 'Penerima PIP Aktif', value: `${bantuanStats?.total_pip ?? 0} Siswa`, color: '#7C3AED' },
          { label: 'Pemegang KIP', value: `${bantuanStats?.total_kip ?? 0} Siswa`, color: '#2563EB' },
          { label: 'Validasi DTKS & Dapodik', value: 'Terverifikasi Sekolah', color: '#10B981' }
        ],
        actionTitle: 'Buka Modul Kesiswaan',
        actionRoute: '/modules/kesiswaan'
      });
    }
    setShowExecModal(true);
  };

  const renderIcon = (type: string, name: any, color: string) => {
    if (type === 'Ionicons') return <Ionicons name={name} size={24} color={color} />;
    if (type === 'MaterialCommunityIcons') return <MaterialCommunityIcons name={name} size={24} color={color} />;
    return <Feather name={name} size={24} color={color} />;
  };

  // Determine effective role strictly from logged in user profile
  const detectedRole = (userData?.role || 'admin').toLowerCase();
  let effectiveRole: 'admin' | 'guru' | 'siswa' | 'ortu' = 'admin';

  if (detectedRole.includes('guru') || detectedRole.includes('teacher')) effectiveRole = 'guru';
  else if (detectedRole.includes('siswa') || detectedRole.includes('student')) effectiveRole = 'siswa';
  else if (detectedRole.includes('orang tua') || detectedRole.includes('parent') || detectedRole.includes('wali') || detectedRole.includes('ortu')) effectiveRole = 'ortu';
  else effectiveRole = 'admin';

  // Deteksi peran & tugas tambahan Guru / Tenaga Pendidik
  const userJabatan = (userData?.jabatan || '').toLowerCase();
  const userCapabilities: string[] = Array.isArray(userData?.capabilities)
    ? userData.capabilities.map((c: any) => String(c).toLowerCase())
    : [];

  const isBkUser = Boolean(
    userData?.is_bk ||
    userJabatan.includes('bk') ||
    userJabatan.includes('konseling') ||
    userCapabilities.includes('bk')
  );

  const isWaliKelas = Boolean(
    userData?.is_walikelas ||
    userJabatan.includes('wali kelas') ||
    userCapabilities.includes('walikelas') ||
    userCapabilities.includes('wali_kelas')
  );

  const isKesiswaan = Boolean(
    userJabatan.includes('kesiswaan') ||
    userCapabilities.includes('kesiswaan')
  );

  const isKurikulum = Boolean(
    userJabatan.includes('kurikulum') ||
    userCapabilities.includes('kurikulum')
  );

  const isPimpinan = Boolean(
    userJabatan.includes('kepala sekolah') ||
    userJabatan.includes('wakil kepala') ||
    userJabatan.includes('wakasek') ||
    userJabatan.includes('pimpinan') ||
    detectedRole.includes('kepala')
  );

  // Filter Menu Berdasarkan Hak Akses & Role Pengguna
  const filteredMenus = MENU_ITEMS.filter(item => {
    // Admin / Operator / Superadmin selalu memiliki akses penuh ke semua modul
    if (effectiveRole === 'admin' || detectedRole.includes('admin') || detectedRole.includes('operator')) {
      return true;
    }

    // Role Siswa
    if (effectiveRole === 'siswa') {
      return item.allowedRoles?.some(r => ['siswa', 'student'].includes(r.toLowerCase())) ?? false;
    }

    // Role Orang Tua
    if (effectiveRole === 'ortu') {
      return item.id === '9' || (item.allowedRoles && item.allowedRoles.some(r => ['ortu', 'orang tua', 'parent', 'wali'].includes(r.toLowerCase())));
    }

    // Role Guru: Pembatasan ketat sesuai peran & tugas (Guru biasa tidak boleh lihat Kesiswaan, SDM, E-Rapor, Modul BK)
    if (effectiveRole === 'guru') {
      // 1. Kesiswaan (id: 2) -> HANYA untuk Wakasek Kesiswaan / Pimpinan
      if (item.id === '2') {
        return isPimpinan || isKesiswaan;
      }

      // 2. SDM & Guru (id: 3) -> HANYA untuk Pimpinan / Kepala Sekolah
      if (item.id === '3') {
        return isPimpinan;
      }

      // 3. E-Rapor (id: 6) -> HANYA untuk Wali Kelas, Kurikulum, atau Pimpinan
      if (item.id === '6') {
        return isWaliKelas || isKurikulum || isPimpinan;
      }

      // 4. Modul BK (id: 12) -> HANYA untuk Guru BK atau Pimpinan (Privasi konseling)
      if (item.id === '12') {
        return isBkUser || isPimpinan;
      }

      // 5. Pengaturan Sistem (id: 1) -> HANYA Pimpinan
      if (item.id === '1') {
        return isPimpinan;
      }

      // 6. WA Broadcast (id: 13) -> HANYA Pimpinan atau Humas
      if (item.id === '13') {
        return isPimpinan || userJabatan.includes('humas') || userCapabilities.includes('humas') || userJabatan.includes('kesiswaan');
      }

      // Modul KBM reguler lainnya (Kurikulum, Presensi, LMS, Sarpras, Voting, Administrasi Surat)
      return item.allowedRoles?.some(r => r.toLowerCase() === 'guru') ?? false;
    }

    return false;
  });

  const handleOpenModule = (item: any) => {
    if (item.active === false || item.disabled) {
      setNoticeModule(`${(item.title || '').replace(/^\d+\.\s*/, '').replace('\n', ' ')} saat ini sedang dinonaktifkan atau dalam pemeliharaan.`);
      return;
    }
    if (item.route) {
      router.push(item.route as any);
    } else {
      setNoticeModule((item.title || '').replace(/^\d+\.\s*/, '').replace('\n', ' '));
    }
  };

  const handleOpenWhatsAppHomeroom = () => {
    const phone = '6281234567890';
    const message = `Halo Bapak/Ibu Wali Kelas, saya orang tua dari ${userData?.student_name || 'Ahmad Fauzan'}. Ingin berkonsultasi mengenai ananda. Terima kasih.`;
    Linking.openURL(`whatsapp://send?phone=${phone}&text=${encodeURIComponent(message)}`).catch(() => {
      Linking.openURL(`tel:081234567890`);
    });
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Top Header */}
      <View style={styles.topHeader}>
        <View>
          <Text style={styles.brandTitle}>SIPENAFS</Text>
          <View style={styles.schoolSelector}>
            <Text style={styles.schoolName}>{schoolName}</Text>
            <Feather name="chevron-down" size={14} color={Colors.secondary} style={{ marginLeft: 4 }} />
          </View>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => router.push('/modules/system' as any)}
            activeOpacity={0.7}
          >
            <Feather name="settings" size={20} color={Colors.secondary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => router.push('/(tabs)/notifikasi' as any)}
          >
            <Feather name="bell" size={20} color={Colors.secondary} />
            <View style={styles.notificationDot} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerAvatarBtn}
            onPress={() => router.push('/(tabs)/profil' as any)}
            activeOpacity={0.8}
          >
            {renderUserAvatar(34, Colors.primary, 'person-outline', Colors.primary)}
            <View style={styles.headerOnlineBadge} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>
        {/* ======================================================== */}
        {/* ROLE 1: DASHBOARD GURU                                    */}
        {/* ======================================================== */}
        {effectiveRole === 'guru' && (
          <View style={styles.roleDashboardWrapper}>
            {/* Greeting Guru */}
            <View style={[styles.greetingSection, { backgroundColor: '#F0FDF4', marginHorizontal: 16, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#BBF7D0' }]}>
              <View style={styles.greetingLeft}>
                <Text style={[styles.greetingText, { color: '#16A34A', fontWeight: '700' }]}>Halo Guru Hebat 👋</Text>
                <Text style={styles.userName}>{userData?.name || 'Drs. Supriyanto, M.Pd'}</Text>
                <Text style={styles.userRole}>NIP: {userData?.nip || '-'} • {userData?.jabatan?.name || 'Guru'}</Text>
              </View>
              <TouchableOpacity
                onPress={() => router.push('/(tabs)/profil' as any)}
                activeOpacity={0.8}
              >
                {renderUserAvatar(52, '#16A34A', 'school', '#16A34A')}
              </TouchableOpacity>
            </View>

            {/* Guru Stats Strip */}
            <View style={styles.kpiRow}>
              <View style={[styles.kpiRoleCard, { backgroundColor: '#F0FDF4' }]}>
                <Text style={[styles.kpiRoleVal, { color: '#16A34A' }]}>4 Kelas</Text>
                <Text style={styles.kpiRoleKey}>Total Rombel</Text>
              </View>
              <View style={[styles.kpiRoleCard, { backgroundColor: '#EFF6FF' }]}>
                <Text style={[styles.kpiRoleVal, { color: '#2563EB' }]}>24 JP</Text>
                <Text style={styles.kpiRoleKey}>Tatap Muka/Mgg</Text>
              </View>
              <View style={[styles.kpiRoleCard, { backgroundColor: '#FEF3C7' }]}>
                <Text style={[styles.kpiRoleVal, { color: '#D97706' }]}>2 Tugas</Text>
                <Text style={styles.kpiRoleKey}>Perlu Dinilai</Text>
              </View>
            </View>

            {/* Jadwal Mengajar Hari Ini */}
            <View style={styles.cardSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Jadwal Mengajar Hari Ini</Text>
                <View style={styles.liveBadge}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>Aktif</Text>
                </View>
              </View>

              {todaySchedules.length === 0 ? (
                <Text style={{ textAlign: 'center', marginTop: 20, color: '#64748B', fontSize: 13 }}>Belum ada jadwal KBM hari ini.</Text>
              ) : (
                todaySchedules.map((sched: any, index: number) => {
                  const subjectName = sched.subject?.name || 'Mata Pelajaran';
                  const className = sched.class?.name || 'Kelas';
                  const isFilled = sched.is_filled;
                  const timeStr = `${(sched.start_time || '').substring(0,5)} - ${(sched.end_time || '').substring(0,5)} WIB`;
                  
                  return (
                    <View key={sched.id || index} style={[styles.classScheduleCard, index > 0 && { marginTop: 10 }]}>
                      <View style={styles.classSchedTop}>
                        <View style={[styles.classTimeBadge, { backgroundColor: '#EFF6FF' }]}>
                          <Ionicons name="time" size={12} color="#2563EB" />
                          <Text style={[styles.classTimeText, { color: '#2563EB' }]}>{timeStr}</Text>
                        </View>
                        <Text style={styles.roomTag}>{sched.room_name || '-'}</Text>
                      </View>

                      <Text style={styles.classSubject}>{subjectName}</Text>
                      <Text style={styles.classTarget}>{className} • {(sched.class?.students || []).length} Siswa</Text>

                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                        <TouchableOpacity
                          style={[styles.journalActionBtn, { flex: 1, marginTop: 0, backgroundColor: isFilled ? '#10B981' : '#2563EB' }]}
                          onPress={() => router.push({
                            pathname: '/modules/jurnal',
                            params: {
                              subject: subjectName,
                              class_name: className,
                              time: timeStr,
                              room: sched.room_name,
                              autoOpen: 'true'
                            }
                          } as any)}
                          activeOpacity={0.82}
                        >
                          <Ionicons name={isFilled ? "checkmark-circle-outline" : "create-outline"} size={16} color="#FFFFFF" />
                          <Text style={styles.journalActionBtnText}>{isFilled ? 'Sudah Diisi' : 'Isi Jurnal'}</Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity
                          style={[styles.journalActionBtn, { flex: 1, marginTop: 0, backgroundColor: '#0EA5E9' }]}
                          onPress={() => router.push({
                            pathname: '/modules/perangkat-ai',
                            params: { mapel: subjectName }
                          } as any)}
                          activeOpacity={0.82}
                        >
                          <Ionicons name="sparkles" size={16} color="#FFFFFF" />
                          <Text style={styles.journalActionBtnText}>Bahan Ajar AI</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              )}
            </View>

            {/* Quick Actions Guru */}
            <View style={styles.cardSection}>
              <Text style={[styles.sectionTitle, { marginBottom: 12 }]}>Aksi Cepat Guru</Text>
              <View style={styles.quickActionGrid}>
                <TouchableOpacity
                  style={styles.qaItem}
                  onPress={() => router.push('/modules/jurnal' as any)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.qaIcon, { backgroundColor: '#FFFBEB' }]}>
                    <Ionicons name="calendar" size={20} color="#D97706" />
                  </View>
                  <Text style={styles.qaText}>Jurnal Guru</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.qaItem}
                  onPress={() => {
                    if (isWaliKelas || isKurikulum || isPimpinan || detectedRole.includes('admin')) {
                      router.push('/modules/erapor' as any);
                    } else {
                      router.push('/modules/elearning' as any);
                    }
                  }}
                >
                  <View style={[styles.qaIcon, { backgroundColor: '#F0F9FF' }]}>
                    <Ionicons name="school" size={20} color="#0284C7" />
                  </View>
                  <Text style={styles.qaText}>Input Nilai</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.qaItem}
                  onPress={() => router.push('/modules/presensi' as any)}
                >
                  <View style={[styles.qaIcon, { backgroundColor: '#FFF7ED' }]}>
                    <Ionicons name="scan" size={20} color="#EA580C" />
                  </View>
                  <Text style={styles.qaText}>Presensi Guru</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.qaItem}
                  onPress={() => router.push('/modules/elearning' as any)}
                >
                  <View style={[styles.qaIcon, { backgroundColor: '#EEF2FF' }]}>
                    <Ionicons name="book" size={20} color="#6366F1" />
                  </View>
                  <Text style={styles.qaText}>Tugas LMS</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* ======================================================== */}
        {/* ROLE 2: DASHBOARD SISWA                                   */}
        {/* ======================================================== */}
        {effectiveRole === 'siswa' && (
          <View style={styles.roleDashboardWrapper}>
            {/* Greeting Siswa */}
            <View style={[styles.greetingSection, { backgroundColor: '#EFF6FF', marginHorizontal: 16, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#BFDBFE' }]}>
              <View style={styles.greetingLeft}>
                <Text style={[styles.greetingText, { color: '#2563EB', fontWeight: '700' }]}>Semangat Belajar, Juara! 🎓</Text>
                <Text style={styles.userName}>{userData?.name || 'Ahmad Fauzan'}</Text>
                <Text style={styles.userRole}>NISN: {userData?.nisn || '0087654321'} • Kelas XII MIPA 1</Text>
              </View>
              <TouchableOpacity
                onPress={() => router.push('/(tabs)/profil' as any)}
                activeOpacity={0.8}
              >
                {renderUserAvatar(52, '#2563EB', 'person', '#2563EB')}
              </TouchableOpacity>
            </View>

            {/* Status Presensi Hari Ini */}
            <View style={styles.cardSection}>
              <View style={styles.studentAttendanceCard}>
                <View style={styles.attIconWrapper}>
                  <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.attStatusTitle}>Presensi Masuk Tercatat</Text>
                  <Text style={styles.attStatusTime}>Tap-in Kiosk Gerbang Utama • 06:42 WIB</Text>
                  <Text style={styles.attStatusNote}>Status: Hadir Tepat Waktu</Text>
                </View>
                <TouchableOpacity
                  style={styles.attActionBtn}
                  onPress={() => router.push('/modules/presensi' as any)}
                >
                  <Text style={styles.attActionBtnText}>Detail</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Jadwal Pelajaran Hari Ini */}
            <View style={styles.cardSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Pelajaran Hari Ini (Senin)</Text>
                <TouchableOpacity onPress={() => router.push('/(tabs)/akademik' as any)}>
                  <Text style={styles.seeAllText}>Semua Hari {'>'}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.scheduleItemStudent}>
                <Text style={styles.schedTimeStudent}>07:30 - 09:00</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.schedSubjStudent}>Matematika Peminatan</Text>
                  <Text style={styles.schedTeachStudent}>Bambang Kusuma, S.Pd • R.12-A</Text>
                </View>
              </View>

              <View style={styles.scheduleItemStudent}>
                <Text style={styles.schedTimeStudent}>09:15 - 10:45</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.schedSubjStudent}>Fisika Terapan</Text>
                  <Text style={styles.schedTeachStudent}>Dr. Hendra Gunawan • Lab Fisika</Text>
                </View>
              </View>
            </View>

            {/* Tugas Mendatang */}
            <View style={styles.cardSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Tugas LMS Perlu Diselesaikan</Text>
                <TouchableOpacity onPress={() => router.push('/modules/elearning' as any)}>
                  <Text style={styles.seeAllText}>Buka LMS {'>'}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.taskAlertCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.taskAlertTitle}>Analisis Gelombang Elektromagnetik</Text>
                  <Text style={styles.taskAlertMeta}>Fisika Peminatan • Batas: Besok 23:59 WIB</Text>
                </View>
                <TouchableOpacity
                  style={styles.submitTaskQuickBtn}
                  onPress={() => router.push('/modules/elearning' as any)}
                >
                  <Text style={styles.submitTaskQuickText}>Kirim</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* ======================================================== */}
        {/* ROLE 3: DASHBOARD ORANG TUA                               */}
        {/* ======================================================== */}
        {effectiveRole === 'ortu' && (
          <View style={styles.roleDashboardWrapper}>
            {/* Greeting Ortu */}
            <View style={[styles.greetingSection, { backgroundColor: '#FDF2F8', marginHorizontal: 16, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#FBCFE8' }]}>
              <View style={styles.greetingLeft}>
                <Text style={[styles.greetingText, { color: '#EC4899', fontWeight: '700' }]}>Selamat Datang Bapak/Ibu Wali 👨‍👩‍👧‍👦</Text>
                <Text style={styles.userName}>{userData?.name || 'Orang Tua / Wali'}</Text>
                <Text style={styles.userRole}>Wali Murid dari: {userData?.student_name || 'Ahmad Fauzan (XII MIPA 1)'}</Text>
              </View>
              <TouchableOpacity
                onPress={() => router.push('/(tabs)/profil' as any)}
                activeOpacity={0.8}
              >
                {renderUserAvatar(52, '#EC4899', 'heart', '#EC4899')}
              </TouchableOpacity>
            </View>

            {/* Pantau Kehadiran Anak */}
            <View style={styles.cardSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Presensi Ananda Hari Ini</Text>
                <TouchableOpacity onPress={() => router.push('/modules/ortu' as any)}>
                  <Text style={[styles.seeAllText, { color: '#EC4899' }]}>Log Lengkap {'>'}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.parentAttCard}>
                <View style={styles.parentAttIcon}>
                  <Ionicons name="checkmark-done" size={22} color="#10B981" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.parentAttTitle}>Ananda Telah Tiba di Sekolah</Text>
                  <Text style={styles.parentAttSub}>Terverifikasi di Pintu Kiosk jam 06:42 WIB</Text>
                  <Text style={styles.parentAttRecap}>Rekap Bulan Ini: 22 Hadir • 1 Sakit • 0 Alpa (96%)</Text>
                </View>
              </View>
            </View>

            {/* Status SPP & Keuangan */}
            <View style={styles.cardSection}>
              <View style={styles.parentFinanceCard}>
                <View>
                  <Text style={styles.parentFinLabel}>Tagihan SPP Bulan Oktober 2026</Text>
                  <Text style={styles.parentFinAmount}>Rp 250.000</Text>
                  <Text style={styles.parentFinDue}>Jatuh tempo: 10 Oktober 2026</Text>
                </View>
                <TouchableOpacity
                  style={styles.parentPayBtn}
                  onPress={() => router.push('/modules/billing' as any)}
                >
                  <Text style={styles.parentPayBtnText}>Bayar SPP</Text>
                  <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Fast Action Ortu */}
            <View style={styles.cardSection}>
              <Text style={[styles.sectionTitle, { marginBottom: 12 }]}>Komunikasi & Layanan</Text>
              <View style={styles.parentActionRow}>
                <TouchableOpacity
                  style={styles.parentActionItem}
                  onPress={handleOpenWhatsAppHomeroom}
                >
                  <Ionicons name="logo-whatsapp" size={22} color="#25D366" />
                  <Text style={styles.parentActionText}>Chat Wali Kelas</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.parentActionItem}
                  onPress={() => router.push('/modules/ortu' as any)}
                >
                  <Ionicons name="mail" size={22} color="#EC4899" />
                  <Text style={styles.parentActionText}>Ajukan Izin/Sakit</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.parentActionItem}
                  onPress={() => router.push('/modules/erapor' as any)}
                >
                  <Ionicons name="ribbon" size={22} color="#3B82F6" />
                  <Text style={styles.parentActionText}>Rapor Ananda</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* ======================================================== */}
        {/* ROLE 4: DASHBOARD ADMIN & KEPALA SEKOLAH                  */}
        {/* ======================================================== */}
        {effectiveRole === 'admin' && (
          <View>
            {/* Greeting Admin */}
            <View style={styles.greetingSection}>
              <View style={styles.greetingLeft}>
                <Text style={styles.greetingText}>Selamat Datang Pimpinan 👋</Text>
                <Text style={styles.userName}>{userData?.name || 'Administrator'}</Text>
                <Text style={styles.userRole}>{userData?.jabatan || userData?.role || 'Administrator'}</Text>
              </View>
              <TouchableOpacity
                onPress={() => router.push('/(tabs)/profil' as any)}
                activeOpacity={0.8}
              >
                {renderUserAvatar(52, Colors.primary, 'shield-checkmark', Colors.primary)}
              </TouchableOpacity>
            </View>

            {/* Stats Card */}
            <View style={styles.statsCard}>
              <View style={styles.statItem}>
                <Ionicons name="people-outline" size={24} color="#FFF" />
                <Text style={styles.statValue}>{stats.siswa}</Text>
                <Text style={styles.statLabel}>Siswa</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Ionicons name="person-outline" size={24} color="#FFF" />
                <Text style={styles.statValue}>{stats.guru}</Text>
                <Text style={styles.statLabel}>Guru</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <MaterialCommunityIcons name="google-classroom" size={24} color="#FFF" />
                <Text style={styles.statValue}>{stats.kelas}</Text>
                <Text style={styles.statLabel}>Kelas</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Ionicons name="checkmark-circle-outline" size={24} color="#FFF" />
                <Text style={styles.statValue}>{stats.kehadiran}</Text>
                <Text style={styles.statLabel}>Kehadiran</Text>
              </View>
            </View>

            {/* Executive Ringkasan */}
            <View style={styles.execSection}>
              <View style={[styles.sectionHeader, { paddingHorizontal: 20, marginBottom: 12 }]}>
                <Text style={styles.sectionTitle}>Ringkasan Eksekutif Pimpinan</Text>
                <Text style={{ fontSize: 11, color: Colors.primary, fontWeight: '700' }}>Ketuk untuk Detail</Text>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 14 }}>
                <TouchableOpacity
                  style={styles.execCard}
                  onPress={() => openExecDetail('retirement')}
                  activeOpacity={0.8}
                >
                  <View style={styles.execHeader}>
                    <Text style={styles.execTitle}>Waspada Pensiun</Text>
                    <View style={[styles.execIconBg, { backgroundColor: '#FFF3E0' }]}>
                      <Ionicons name="warning-outline" size={18} color="#F57C00" />
                    </View>
                  </View>
                  <Text style={styles.execValue}>{mgmtStats?.retirement?.thisYear ?? 0} <Text style={styles.execSubtitle}>Orang</Text></Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                    <Text style={styles.execSubDetail}>Purna tugas tahun ini</Text>
                    <Ionicons name="chevron-forward" size={12} color="#F57C00" />
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.execCard}
                  onPress={() => openExecDetail('mutation')}
                  activeOpacity={0.8}
                >
                  <View style={styles.execHeader}>
                    <Text style={styles.execTitle}>Mutasi Siswa</Text>
                    <View style={[styles.execIconBg, { backgroundColor: '#E3F2FD' }]}>
                      <Ionicons name="swap-horizontal-outline" size={18} color="#1976D2" />
                    </View>
                  </View>
                  <Text style={styles.execValue}>{mgmtStats?.mutations?.pending ?? 0} <Text style={styles.execSubtitle}>Pending</Text></Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                    <Text style={styles.execSubDetail}>Menunggu persetujuan</Text>
                    <Ionicons name="chevron-forward" size={12} color="#1976D2" />
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.execCard}
                  onPress={() => openExecDetail('sarpras')}
                  activeOpacity={0.8}
                >
                  <View style={styles.execHeader}>
                    <Text style={styles.execTitle}>Total Sarpras</Text>
                    <View style={[styles.execIconBg, { backgroundColor: '#E0F2F1' }]}>
                      <Ionicons name="checkmark-done-circle-outline" size={18} color="#00796B" />
                    </View>
                  </View>
                  <Text style={styles.execValue}>{assetStats?.total_assets !== undefined ? assetStats.total_assets : 0} <Text style={styles.execSubtitle}>Unit</Text></Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                    <Text style={styles.execSubDetail}>Terinventarisasi sistem</Text>
                    <Ionicons name="chevron-forward" size={12} color="#00796B" />
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.execCard}
                  onPress={() => openExecDetail('bantuan')}
                  activeOpacity={0.8}
                >
                  <View style={styles.execHeader}>
                    <Text style={styles.execTitle}>Prioritas Bantuan</Text>
                    <View style={[styles.execIconBg, { backgroundColor: '#F3E8FF' }]}>
                      <Ionicons name="gift-outline" size={18} color="#7C3AED" />
                    </View>
                  </View>
                  <Text style={styles.execValue}>{(bantuanStats?.total_prioritas ?? bantuanStats?.total_pip ?? 0)} <Text style={styles.execSubtitle}>Siswa</Text></Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                    <Text style={styles.execSubDetail}>Penerima PIP / Afirmasi</Text>
                    <Ionicons name="chevron-forward" size={12} color="#7C3AED" />
                  </View>
                </TouchableOpacity>
              </ScrollView>
            </View>

            {/* ======================================================== */}
            {/* GRAFIK DASHBOARD PIMPINAN (SEPERTI DI WEB)                */}
            {/* ======================================================== */}
            <View style={styles.chartSection}>
              {/* Card 1: Proyeksi Pensiun 5 Tahun (Bar Chart) */}
              <View style={styles.chartCard}>
                <View style={styles.chartHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.chartTitle}>Proyeksi Pensiun 5 Tahun</Text>
                    <Text style={styles.chartSubtitle}>Estimasi jumlah pegawai purna tugas per tahun</Text>
                  </View>
                  <View style={styles.intelligenceBadge}>
                    <Ionicons name="sparkles" size={12} color="#0B8A7D" />
                    <Text style={styles.intelligenceBadgeText}>Sipena Intelligence</Text>
                  </View>
                </View>

                {/* Bar Chart Bars */}
                <View style={styles.barChartContainer}>
                  {(() => {
                    const currentYear = new Date().getFullYear();
                    const projection = (mgmtStats?.retirement?.projection && Array.isArray(mgmtStats.retirement.projection) && mgmtStats.retirement.projection.length > 0)
                      ? mgmtStats.retirement.projection
                      : [
                          { year: currentYear, count: mgmtStats?.retirement?.thisYear ?? 0 },
                          { year: currentYear + 1, count: 0 },
                          { year: currentYear + 2, count: 1 },
                          { year: currentYear + 3, count: 0 },
                          { year: currentYear + 4, count: 2 },
                        ];
                    const maxVal = Math.max(...projection.map((p: any) => Number(p.count) || 0), 4);
                    const maxHeight = 100;

                    return projection.map((p: any, idx: number) => {
                      const isThisYear = p.year === currentYear;
                      const count = Number(p.count) || 0;
                      const height = Math.max(12, Math.round((count / maxVal) * maxHeight));

                      return (
                        <TouchableOpacity
                          key={p.year || idx}
                          style={styles.barCol}
                          onPress={() => openExecDetail('retirement')}
                          activeOpacity={0.7}
                        >
                          <Text style={[
                            styles.barCount,
                            isThisYear ? { color: '#0B8A7D', fontWeight: '800' } : (count > 0 ? { color: '#475569', fontWeight: '700' } : { color: '#CBD5E1' })
                          ]}>
                            {count}
                          </Text>
                          <View style={[
                            styles.barPillar,
                            { height },
                            isThisYear
                              ? { backgroundColor: '#0B8A7D', borderWidth: 1, borderColor: '#056359' }
                              : (count > 0 ? { backgroundColor: '#CBD5E1' } : { backgroundColor: '#F1F5F9' })
                          ]}>
                            {isThisYear && <View style={styles.barActiveIndicator} />}
                          </View>
                          <Text style={[
                            styles.barYear,
                            isThisYear ? { color: '#0B8A7D', fontWeight: '800' } : { color: '#94A3B8' }
                          ]}>
                            {p.year}
                          </Text>
                        </TouchableOpacity>
                      );
                    });
                  })()}
                </View>
              </View>

              {/* Card 2: Sebaran Gender Pendidik & Tendik */}
              <View style={styles.chartCard}>
                <View style={styles.chartCardTitleRow}>
                  <View style={[styles.chartCardIconBg, { backgroundColor: '#EFF6FF' }]}>
                    <Ionicons name="bar-chart-outline" size={16} color="#2563EB" />
                  </View>
                  <Text style={styles.chartCardTitle}>Sebaran Gender Pendidik & Staf</Text>
                </View>

                {(() => {
                  const hrTotal = mgmtStats?.hr?.total || (stats.guru + (mgmtStats?.hr?.staff || 0)) || 1;
                  const maleCount = mgmtStats?.hr?.gender?.male ?? Math.round(hrTotal * 0.45);
                  const femaleCount = mgmtStats?.hr?.gender?.female ?? (hrTotal - maleCount);
                  const malePct = Math.min(100, Math.max(0, Math.round((maleCount / Math.max(1, hrTotal)) * 100)));
                  const femalePct = Math.max(0, 100 - malePct);

                  return (
                    <View style={{ gap: 14, marginTop: 12 }}>
                      {/* Laki-laki */}
                      <View>
                        <View style={styles.genderLabelRow}>
                          <View style={styles.genderDotLabel}>
                            <View style={[styles.genderDot, { backgroundColor: '#2563EB' }]} />
                            <Text style={styles.genderLabelText}>Laki-laki</Text>
                          </View>
                          <Text style={styles.genderValueText}>{maleCount} <Text style={{ fontSize: 11, color: '#94A3B8', fontWeight: '500' }}>({malePct}%)</Text></Text>
                        </View>
                        <View style={styles.genderTrack}>
                          <View style={[styles.genderFill, { width: `${malePct}%`, backgroundColor: '#2563EB' }]} />
                        </View>
                      </View>

                      {/* Perempuan */}
                      <View>
                        <View style={styles.genderLabelRow}>
                          <View style={styles.genderDotLabel}>
                            <View style={[styles.genderDot, { backgroundColor: '#EC4899' }]} />
                            <Text style={styles.genderLabelText}>Perempuan</Text>
                          </View>
                          <Text style={styles.genderValueText}>{femaleCount} <Text style={{ fontSize: 11, color: '#94A3B8', fontWeight: '500' }}>({femalePct}%)</Text></Text>
                        </View>
                        <View style={styles.genderTrack}>
                          <View style={[styles.genderFill, { width: `${femalePct}%`, backgroundColor: '#EC4899' }]} />
                        </View>
                      </View>
                    </View>
                  );
                })()}
              </View>

              {/* Card 3: Pengingat Pimpinan */}
              <View style={styles.execReminderCard}>
                <View style={styles.execReminderHeader}>
                  <View style={styles.execReminderIconBg}>
                    <Ionicons name="shield-checkmark" size={15} color="#D97706" />
                  </View>
                  <Text style={styles.execReminderTitle}>Pengingat Pimpinan</Text>
                </View>
                <View style={styles.execReminderList}>
                  <View style={styles.execReminderItem}>
                    <View style={styles.execReminderBullet}>
                      <Text style={styles.execReminderBulletText}>!</Text>
                    </View>
                    <Text style={styles.execReminderText}>
                      Segera tinjau <Text style={{ fontWeight: '800' }}>{mgmtStats?.mutations?.pending ?? 0} permintaan mutasi</Text> yang masuk.
                    </Text>
                  </View>
                  <View style={styles.execReminderItem}>
                    <View style={styles.execReminderBullet}>
                      <Text style={styles.execReminderBulletText}>!</Text>
                    </View>
                    <Text style={styles.execReminderText}>
                      <Text style={{ fontWeight: '800' }}>{mgmtStats?.retirement?.thisYear ?? 0} pegawai</Text> akan pensiun tahun ini, siapkan usulan pengganti.
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* ======================================================== */}
        {/* MODUL SIPENAFS                                            */}
        {/* ======================================================== */}
        <View style={styles.menuSection}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>
                {effectiveRole === 'admin' 
                  ? 'Modul SIPENAFS' 
                  : effectiveRole === 'siswa'
                  ? 'Modul Pembelajaran Siswa'
                  : effectiveRole === 'guru'
                  ? 'Modul Kerja Guru'
                  : 'Modul Portal Orang Tua'}
              </Text>
              <Text style={styles.sectionSubTitle}>
                {effectiveRole === 'admin'
                  ? 'Ekosistem Terintegrasi Seluruh Modul'
                  : effectiveRole === 'siswa'
                  ? 'Akses Layanan Akademik & Aktivitas Siswa'
                  : effectiveRole === 'guru'
                  ? 'Layanan Manajemen KBM & Akademik'
                  : 'Pantau Kehadiran & Akademik Ananda'}
              </Text>
            </View>
            <View style={styles.officialBadge}>
              <Ionicons name="grid-outline" size={12} color="#0B8A7D" />
              <Text style={styles.officialBadgeText}>
                {`${filteredMenus.length} Layanan`}
              </Text>
            </View>
          </View>

          <View style={styles.menuGrid}>
            {filteredMenus.map(item => {
              const isInactive = item.active === false || item.disabled;
              const displayTitle = (item.title || '').replace(/^\d+\.\s*/, '');
              return (
                <TouchableOpacity
                  key={item.id}
                  style={styles.menuItem}
                  onPress={() => handleOpenModule(item)}
                  activeOpacity={isInactive ? 0.9 : 0.7}
                >
                  <View
                    style={[
                      styles.menuIconContainer,
                      { backgroundColor: isInactive ? '#F1F5F9' : item.bg },
                    ]}
                  >
                    {renderIcon(item.type, item.icon, isInactive ? '#94A3B8' : item.color)}
                  </View>
                  <Text
                    style={[styles.menuText, isInactive && styles.menuTextDisabled]}
                    numberOfLines={2}
                  >
                    {displayTitle}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Notifikasi Cepat */}
        <View style={styles.notificationSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Notifikasi Terbaru</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/notifikasi' as any)}>
              <Text style={styles.seeAllText}>Lihat Semua {'>'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.notificationList}>
            {notifications.length === 0 ? (
              <View style={[styles.notificationCard, { justifyContent: 'center', alignItems: 'center', paddingVertical: 18 }]}>
                <Ionicons name="notifications-outline" size={24} color="#94A3B8" />
                <Text style={{ fontSize: 13, color: '#94A3B8', marginTop: 6 }}>Belum ada pengumuman terbaru</Text>
              </View>
            ) : (
              notifications.map((notif: any) => (
                <View key={notif.id} style={styles.notificationCard}>
                  <View style={styles.notifIconWrapper}>
                    <Ionicons
                      name={notif.icon as any}
                      size={22}
                      color="#0B8A7D"
                    />
                  </View>
                  <View style={styles.notifContent}>
                    <Text style={styles.notifTitle}>{notif.title}</Text>
                    <Text style={styles.notifTime}>{notif.time}</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        </View>
      </ScrollView>

      {/* Executive Detail Modal */}
      <Modal
        visible={showExecModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowExecModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContentCard}>
            {/* Modal Header */}
            <View style={styles.modalTopHeader}>
              <View style={[styles.modalBadge, { backgroundColor: (selectedExecDetail?.badgeColor || '#0B8A7D') + '18' }]}>
                <Text style={[styles.modalBadgeText, { color: selectedExecDetail?.badgeColor || '#0B8A7D' }]}>
                  {selectedExecDetail?.badge || 'Data Eksekutif'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setShowExecModal(false)}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Modal Title & Subtitle */}
            <Text style={styles.modalDetailTitle}>{selectedExecDetail?.title}</Text>
            <Text style={styles.modalDetailSubtitle}>{selectedExecDetail?.subtitle}</Text>

            {/* Big Stat Box */}
            <View style={styles.modalStatBox}>
              <Text style={[styles.modalStatNumber, { color: selectedExecDetail?.badgeColor || Colors.primary }]}>
                {selectedExecDetail?.statNumber}
              </Text>
              <Text style={styles.modalStatUnit}>{selectedExecDetail?.statUnit}</Text>
            </View>

            {/* Description */}
            <Text style={styles.modalDetailDesc}>{selectedExecDetail?.description}</Text>

            {/* Highlight Metric Rows */}
            <View style={styles.modalHighlightCard}>
              {(selectedExecDetail?.highlights || []).map((h: any, idx: number) => (
                <View
                  key={idx}
                  style={[
                    styles.modalHighlightRow,
                    idx > 0 && { borderTopWidth: 1, borderTopColor: '#F1F5F9' }
                  ]}
                >
                  <Text style={styles.modalHighlightKey}>{h.label}</Text>
                  <Text style={[styles.modalHighlightVal, h.color ? { color: h.color } : {}]}>
                    {h.value}
                  </Text>
                </View>
              ))}
            </View>

            {/* Action Buttons */}
            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowExecModal(false)}
              >
                <Text style={styles.modalCancelBtnText}>Tutup</Text>
              </TouchableOpacity>
              {selectedExecDetail?.actionRoute && (
                <TouchableOpacity
                  style={[styles.modalConfirmBtn, { backgroundColor: selectedExecDetail.badgeColor || Colors.primary }]}
                  onPress={() => {
                    setShowExecModal(false);
                    router.push(selectedExecDetail.actionRoute as any);
                  }}
                >
                  <Text style={styles.modalConfirmBtnText}>{selectedExecDetail.actionTitle || 'Buka Modul'}</Text>
                  <Ionicons name="arrow-forward" size={14} color="#FFF" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Notice Modal */}
      <Modal visible={!!noticeModule} transparent animationType="fade">
        <View style={styles.noticeOverlay}>
          <View style={styles.noticeCard}>
            <View style={styles.noticeIconCircle}>
              <Feather name="clock" size={26} color="#D97706" />
            </View>
            <Text style={styles.noticeTitle}>Informasi Modul</Text>
            <Text style={styles.noticeSubtitle}>
              <Text style={{ fontWeight: '700', color: Colors.secondary }}>{noticeModule}</Text>
            </Text>
            <TouchableOpacity
              style={styles.noticeCloseBtn}
              onPress={() => setNoticeModule(null)}
              activeOpacity={0.8}
            >
              <Text style={styles.noticeCloseText}>Tutup</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: 0.5,
  },
  schoolSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  schoolName: {
    fontSize: 13,
    color: Colors.secondary,
    fontWeight: '500',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  iconButton: {
    position: 'relative',
    padding: 4,
  },
  notificationDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.danger,
    borderWidth: 1,
    borderColor: '#FFF',
  },
  roleViewBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F1F5F9',
    gap: 8,
  },
  roleViewLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  rolePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  rolePillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  rolePillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  rolePillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  roleDashboardWrapper: {
    marginTop: 12,
  },
  greetingSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 16,
  },
  greetingLeft: {
    flex: 1,
  },
  greetingText: {
    fontSize: 14,
    color: Colors.secondary,
    marginBottom: 2,
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.secondary,
    marginBottom: 2,
  },
  userRole: {
    fontSize: 12,
    color: Colors.textLight,
  },
  avatarContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    marginTop: 12,
  },
  kpiRoleCard: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
    alignItems: 'center',
  },
  kpiRoleVal: {
    fontSize: 16,
    fontWeight: '800',
  },
  kpiRoleKey: {
    fontSize: 10,
    color: Colors.textLight,
    marginTop: 2,
  },
  cardSection: {
    paddingHorizontal: 16,
    marginTop: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.secondary,
  },
  sectionSubTitle: {
    fontSize: 11,
    color: Colors.textLight,
    marginTop: 1,
  },
  seeAllText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '600',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  liveText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#10B981',
  },
  classScheduleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  classSchedTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  classTimeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E6F4F1',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  classTimeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0B8A7D',
  },
  roomTag: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textLight,
  },
  classSubject: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  classTarget: {
    fontSize: 12,
    color: Colors.textLight,
    marginTop: 2,
  },
  journalActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#0B8A7D',
    borderRadius: 10,
    paddingVertical: 10,
    marginTop: 12,
  },
  journalActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  quickActionGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  qaItem: {
    alignItems: 'center',
    flex: 1,
  },
  qaIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  qaText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.text,
  },
  studentAttendanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },
  attIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#D1FAE5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  attStatusTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#065F46',
  },
  attStatusTime: {
    fontSize: 11,
    color: '#047857',
    marginTop: 2,
  },
  attStatusNote: {
    fontSize: 10,
    color: '#059669',
    marginTop: 2,
    fontWeight: '600',
  },
  attActionBtn: {
    backgroundColor: '#10B981',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  attActionBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  scheduleItemStudent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 12,
  },
  schedTimeStudent: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 6,
  },
  schedSubjStudent: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  schedTeachStudent: {
    fontSize: 11,
    color: Colors.textLight,
  },
  taskAlertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  taskAlertTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  taskAlertMeta: {
    fontSize: 11,
    color: '#EF4444',
    marginTop: 2,
  },
  submitTaskQuickBtn: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  submitTaskQuickText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  parentAttCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 12,
  },
  parentAttIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  parentAttTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  parentAttSub: {
    fontSize: 11,
    color: '#10B981',
    marginTop: 2,
    fontWeight: '600',
  },
  parentAttRecap: {
    fontSize: 10,
    color: Colors.textLight,
    marginTop: 2,
  },
  parentFinanceCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 16,
  },
  parentFinLabel: {
    fontSize: 11,
    color: '#94A3B8',
  },
  parentFinAmount: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 2,
  },
  parentFinDue: {
    fontSize: 10,
    color: '#FCA5A5',
    marginTop: 2,
  },
  parentPayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EF4444',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  parentPayBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  parentActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  parentActionItem: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  parentActionText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: Colors.primary,
    borderRadius: 16,
    marginHorizontal: 20,
    marginTop: 20,
    paddingVertical: 18,
    paddingHorizontal: 10,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 4,
  },
  statLabel: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 11,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: '60%',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  execSection: {
    marginTop: 20,
  },
  execCard: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 14,
    width: 155,
    borderWidth: 1,
    borderColor: '#EFEFEF',
  },
  execHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  execTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textLight,
  },
  execIconBg: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  execValue: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.secondary,
  },
  execSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.textLight,
  },
  execSubDetail: {
    fontSize: 10,
    color: Colors.textLight,
    marginTop: 4,
  },
  menuSection: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  officialBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E6F4F1',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  officialBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0B8A7D',
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    marginTop: 12,
  },
  menuItem: {
    width: '25%',
    alignItems: 'center',
    marginBottom: 18,
    paddingHorizontal: 2,
  },
  menuIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  menuText: {
    fontSize: 11,
    textAlign: 'center',
    color: Colors.secondary,
    fontWeight: '600',
    lineHeight: 14,
  },
  menuTextDisabled: {
    color: '#94A3B8',
    fontWeight: '400',
  },
  notificationSection: {
    paddingHorizontal: 20,
    marginTop: 16,
  },
  notificationList: {
    marginTop: 10,
  },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  notifIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notifContent: {
    flex: 1,
  },
  notifTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.secondary,
    marginBottom: 2,
  },
  notifTime: {
    fontSize: 11,
    color: Colors.textLight,
  },
  noticeOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  noticeCard: {
    width: '100%',
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  noticeIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  noticeTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.secondary,
    marginBottom: 8,
  },
  noticeSubtitle: {
    fontSize: 13,
    color: Colors.textLight,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  noticeCloseBtn: {
    backgroundColor: '#F3F4F6',
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 10,
  },
  noticeCloseText: {
    color: Colors.secondary,
    fontWeight: '600',
    fontSize: 13,
  },
  headerAvatarBtn: {
    position: 'relative',
    marginLeft: 2,
  },
  headerOnlineBadge: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#10B981',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  chartSection: {
    paddingHorizontal: 20,
    marginTop: 16,
    gap: 16,
  },
  chartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EFEFEF',
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.secondary,
  },
  chartSubtitle: {
    fontSize: 11,
    color: Colors.textLight,
    marginTop: 2,
  },
  intelligenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E6F4F1',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  intelligenceBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0B8A7D',
  },
  barChartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 140,
    paddingTop: 10,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: '100%',
  },
  barCount: {
    fontSize: 12,
    marginBottom: 6,
  },
  barPillar: {
    width: 32,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    position: 'relative',
  },
  barActiveIndicator: {
    position: 'absolute',
    top: -4,
    left: '50%',
    marginLeft: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0B8A7D',
  },
  barYear: {
    fontSize: 11,
    marginTop: 8,
    fontWeight: '600',
  },
  chartCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  chartCardIconBg: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chartCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.secondary,
  },
  genderLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  genderDotLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  genderDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  genderLabelText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.secondary,
  },
  genderValueText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.secondary,
  },
  genderTrack: {
    height: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 4,
    overflow: 'hidden',
  },
  genderFill: {
    height: '100%',
    borderRadius: 4,
  },
  execReminderCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  execReminderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  execReminderIconBg: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  execReminderTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#92400E',
  },
  execReminderList: {
    gap: 8,
  },
  execReminderItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  execReminderBullet: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#F59E0B',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 1,
  },
  execReminderBulletText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
  execReminderText: {
    flex: 1,
    fontSize: 12,
    color: '#92400E',
    lineHeight: 17,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContentCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
  },
  modalTopHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  modalBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalDetailTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.secondary,
    marginTop: 4,
  },
  modalDetailSubtitle: {
    fontSize: 12,
    color: Colors.textLight,
    marginTop: 2,
    marginBottom: 14,
  },
  modalStatBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modalStatNumber: {
    fontSize: 32,
    fontWeight: '900',
  },
  modalStatUnit: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textLight,
    marginTop: 2,
  },
  modalDetailDesc: {
    fontSize: 12,
    color: Colors.secondary,
    lineHeight: 18,
    marginBottom: 14,
  },
  modalHighlightCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 18,
  },
  modalHighlightRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  modalHighlightKey: {
    fontSize: 12,
    color: Colors.textLight,
  },
  modalHighlightVal: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.secondary,
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.secondary,
  },
  modalConfirmBtn: {
    flex: 1.5,
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  modalConfirmBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
