import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Platform, ActivityIndicator, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Colors from '../../constants/Colors';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { useRouter } from 'expo-router';

const MENU_ITEMS = [
  { id: '1', title: '1. Pengaturan\nSistem', icon: 'shield-checkmark-outline', type: 'Ionicons', color: '#0B8A7D', bg: '#E6F4F1', route: '/modules/system', allowedRoles: ['admin', 'kepala sekolah', 'wakil kepala sekolah', 'operator'] },
  { id: '2', title: '2. Kesiswaan', icon: 'people-outline', type: 'Ionicons', color: '#10B981', bg: '#ECFDF5', route: '/modules/kesiswaan', allowedRoles: ['admin', 'tata usaha', 'kepala sekolah', 'wakil kepala sekolah', 'operator'] },
  { id: '3', title: '3. SDM & Guru', icon: 'person-outline', type: 'Ionicons', color: '#3B82F6', bg: '#EFF6FF', route: '/modules/sdm', allowedRoles: ['admin', 'tata usaha', 'kepala sekolah', 'wakil kepala sekolah'] },
  { id: '4', title: '4. Kurikulum &\nJadwal', icon: 'calendar-outline', type: 'Ionicons', color: '#F59E0B', bg: '#FFFBEB', route: '/modules/kurikulum', allowedRoles: ['admin', 'guru', 'tata usaha', 'kepala sekolah', 'wakil kepala sekolah'] },
  { id: '5', title: '5. Presensi &\nDisiplin', icon: 'clipboard-outline', type: 'Ionicons', color: '#F97316', bg: '#FFF7ED', route: '/modules/presensi', allowedRoles: ['admin', 'guru', 'tata usaha', 'kepala sekolah', 'wakil kepala sekolah', 'siswa'] },
  { id: '6', title: '6. E-Rapor', icon: 'school-outline', type: 'Ionicons', color: '#0EA5E9', bg: '#F0F9FF', route: '/modules/erapor', allowedRoles: ['admin', 'guru', 'tata usaha', 'kepala sekolah', 'wakil kepala sekolah', 'siswa'] },
  { id: '7', title: '7. Billing &\nSPP', icon: 'card-outline', type: 'Ionicons', color: '#EF4444', bg: '#FEF2F2', route: '/modules/billing', allowedRoles: ['admin', 'tata usaha', 'operator', 'kepala sekolah', 'siswa'] },
  { id: '8', title: '8. E-Learning\n(LMS)', icon: 'book-outline', type: 'Ionicons', color: '#6366F1', bg: '#EEF2FF', route: '/modules/elearning', allowedRoles: ['admin', 'guru', 'tata usaha', 'kepala sekolah', 'wakil kepala sekolah', 'siswa'] },
  { id: '9', title: '9. Portal\nOrang Tua', icon: 'heart-outline', type: 'Ionicons', color: '#EC4899', bg: '#FDF2F8', route: '/modules/ortu', allowedRoles: ['admin', 'guru', 'tata usaha', 'kepala sekolah', 'wakil kepala sekolah', 'orang tua'] },
  { id: '10', title: '10. Inventaris &\nPerpus', icon: 'library-outline', type: 'Ionicons', color: '#64748B', bg: '#F8FAFC', route: '/modules/sarpras', allowedRoles: ['admin', 'tata usaha', 'kepala sekolah'] },
  { id: '11', title: '11. E-Voting &\nPemilu', icon: 'checkbox-outline', type: 'Ionicons', color: '#D946EF', bg: '#FDF4FF', route: '/modules/voting', allowedRoles: ['admin', 'guru', 'tata usaha', 'kepala sekolah', 'wakil kepala sekolah', 'siswa'] },
  { id: '12', title: '12. Modul BK', icon: 'chatbubbles-outline', type: 'Ionicons', color: '#EAB308', bg: '#FEFCE8', route: '/modules/bk', allowedRoles: ['admin', 'guru', 'kepala sekolah', 'wakil kepala sekolah', 'bk'] },
  { id: '13', title: '13. WA\nBroadcast', icon: 'megaphone-outline', type: 'Ionicons', color: '#22C55E', bg: '#F0FDF4', route: '/modules/broadcast', allowedRoles: ['admin', 'kepala sekolah', 'operator', 'tata usaha'] },
  { id: '14', title: '14. Administrasi\nSurat', icon: 'document-text-outline', type: 'Ionicons', color: '#6366F1', bg: '#EEF2FF', route: '/modules/surat', allowedRoles: ['admin', 'tata usaha', 'kepala sekolah'] },
];

const NOTIFICATIONS = [
  { id: '1', title: 'Selamat Datang di SIPENAFS', time: 'Baru Saja', type: 'success', icon: 'checkmark-circle-outline' },
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
    kehadiran: '0%'
  });
  const [mgmtStats, setMgmtStats] = useState<any>(null);
  const [assetStats, setAssetStats] = useState<any>(null);
  const [bantuanStats, setBantuanStats] = useState<any>(null);
  const [noticeModule, setNoticeModule] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // 1. Ambil Data dari SecureStore (Hasil Login)
      const storedUser = await SecureStore.getItemAsync('sipena_user');
      const storedSchool = await SecureStore.getItemAsync('sipena_school_name');
      const apiUrl = await SecureStore.getItemAsync('sipena_api_url');
      const token = await SecureStore.getItemAsync('sipena_token');

      if (storedUser) setUserData(JSON.parse(storedUser));
      if (storedSchool) setSchoolName(storedSchool);

      // 2. Ambil Statistik dari Server berdasarkan Role
      if (apiUrl && token && storedUser) {
        const userObj = JSON.parse(storedUser);
        const headers = { Authorization: `Bearer ${token}` };
        const roleStr = (userObj.role || '').toLowerCase();

        // Fetch dashboard sesuai role
        if (roleStr.includes('admin') || roleStr.includes('operator') || roleStr.includes('kepala')) {
          try {
            const [resMgmt, resStudents, resClasses] = await Promise.all([
              axios.get(`${apiUrl}/api/dashboard/management`, { headers }),
              axios.get(`${apiUrl}/api/students?perPage=1`, { headers }),
              axios.get(`${apiUrl}/api/classes`, { headers })
            ]);

            const mData = resMgmt.data?.data || {};
            const studentTotal = resStudents.data?.total || 0;
            const classTotal = resClasses.data?.data?.length || 0;

            setMgmtStats(mData);
            setStats(prev => ({
              ...prev,
              guru: mData.hr?.teachers || 0,
              siswa: studentTotal, 
              kelas: classTotal,
              kehadiran: '95%' // Dummy until added to backend
            }));

            // Fetch Asset & Bantuan Stats secara aman (tidak crash jika belum ada aset)
            try {
              const [resAssets, resBantuan] = await Promise.allSettled([
                axios.get(`${apiUrl}/api/assets/stats`, { headers }),
                axios.get(`${apiUrl}/api/dashboard/prioritas-bantuan`, { headers })
              ]);
              if (resAssets.status === 'fulfilled' && resAssets.value.data?.success) {
                setAssetStats(resAssets.value.data.data);
              }
              if (resBantuan.status === 'fulfilled' && resBantuan.value.data?.success) {
                setBantuanStats(resBantuan.value.data.data);
              }
            } catch (_) {}
          } catch (e: any) {
            console.warn("Fetch management stats error:", e.message);
            if (e.response?.status === 401) {
              // Token expired, clear storage and redirect
              await SecureStore.deleteItemAsync('sipena_token');
              await SecureStore.deleteItemAsync('sipena_user');
              router.replace('/login');
            }
          }
        } else if (roleStr.includes('guru')) {
          try {
            const res = await axios.get(`${apiUrl}/api/dashboard/teacher`, { headers });
            if (res.data && res.data.success) {
              const tData = res.data.data;
              setStats({
                siswa: tData.totalStudents || 0,
                kelas: tData.totalClasses || 0,
                guru: 1, 
                kehadiran: '100%' 
              });
            }
          } catch (e) {
            console.error("Fetch teacher stats error:", e);
          }
        }
      }
    } catch (error) {
      console.error("Gagal memuat data dashboard:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const renderIcon = (type: string, name: any, color: string) => {
    if (type === 'Ionicons') return <Ionicons name={name} size={24} color={color} />;
    if (type === 'MaterialCommunityIcons') return <MaterialCommunityIcons name={name} size={24} color={color} />;
    return <Feather name={name} size={24} color={color} />;
  };

  // Filter Menu Berdasarkan Role
  const filteredMenus = MENU_ITEMS.filter(item => {
    if (!userData) return false;
    const roleStr = (userData.role || '').toLowerCase();

    if (roleStr.includes('admin') || roleStr.includes('operator') || roleStr.includes('kepala')) return true; // Admin/Kepala/Operator melihat semua modul

    if (item.allowedRoles && item.allowedRoles.length > 0) {
      return item.allowedRoles.some((r: string) => roleStr.includes(r.toLowerCase()));
    }
    
    return true;
  });

  const handleOpenModule = (item: any) => {
    if (item.route === '/modules/system') {
      router.push('/modules/system' as any);
    } else if (item.route === '/modules/kesiswaan') {
      router.push('/modules/kesiswaan' as any);
    } else if (item.route === '/modules/sdm') {
      router.push('/modules/sdm' as any);
    } else if (item.route === '/modules/kurikulum') {
      router.push('/modules/kurikulum' as any);
    } else if (item.route === '/modules/presensi') {
      router.push('/modules/presensi' as any);
    } else if (item.route === '/modules/erapor') {
      router.push('/modules/erapor' as any);
    } else {
      setNoticeModule(item.title.replace('\n', ' '));
    }
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
            <Feather name="chevron-down" size={16} color={Colors.secondary} style={{ marginLeft: 4 }} />
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
          <TouchableOpacity style={styles.iconButton}>
            <Feather name="bell" size={20} color={Colors.secondary} />
            <View style={styles.notificationDot} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        
        {/* Greeting Section */}
        <View style={styles.greetingSection}>
          <View style={styles.greetingLeft}>
            <Text style={styles.greetingText}>Selamat Datang 👋</Text>
            <Text style={styles.userName}>{userData?.name || 'User'}</Text>
            <Text style={styles.userRole}>
              {userData?.jabatan || userData?.role || 'User'}
            </Text>
          </View>
          <View style={styles.avatarContainer}>
            <Image 
              source={{ uri: 'https://i.pravatar.cc/150?img=11' }} 
              style={styles.avatar} 
            />
          </View>
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

        {/* Ringkasan Eksekutif (Khusus Admin / Manajemen) */}
        {mgmtStats && (
          <View style={styles.execSection}>
            <Text style={[styles.sectionTitle, { paddingHorizontal: 20 }]}>Ringkasan Eksekutif</Text>
            
            {/* Horizontal Cards */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 14 }}>
              
              {/* 1. Waspada Pensiun */}
              <View style={styles.execCard}>
                <View style={styles.execHeader}>
                  <Text style={styles.execTitle}>Waspada Pensiun</Text>
                  <View style={[styles.execIconBg, { backgroundColor: '#FFF3E0' }]}>
                    <Ionicons name="warning-outline" size={18} color="#F57C00" />
                  </View>
                </View>
                <Text style={styles.execValue}>{mgmtStats.retirement?.thisYear || 0} <Text style={styles.execSubtitle}>Orang</Text></Text>
                <Text style={styles.execSubDetail}>Purna tugas tahun ini</Text>
              </View>

              {/* 2. Mutasi Masuk/Keluar */}
              <View style={styles.execCard}>
                <View style={styles.execHeader}>
                  <Text style={styles.execTitle}>Mutasi Masuk/Keluar</Text>
                  <View style={[styles.execIconBg, { backgroundColor: '#E3F2FD' }]}>
                    <Ionicons name="swap-horizontal-outline" size={18} color="#1976D2" />
                  </View>
                </View>
                <Text style={styles.execValue}>{mgmtStats.mutations?.pending || 0} <Text style={styles.execSubtitle}>Pending</Text></Text>
                <Text style={styles.execSubDetail}>Menunggu persetujuan</Text>
              </View>

              {/* 3. SDM: Guru & Staf */}
              <View style={styles.execCard}>
                <View style={styles.execHeader}>
                  <Text style={styles.execTitle}>SDM Guru & Staf</Text>
                  <View style={[styles.execIconBg, { backgroundColor: '#E8F5E9' }]}>
                    <Ionicons name="people-outline" size={18} color="#388E3C" />
                  </View>
                </View>
                <Text style={styles.execValue}>{mgmtStats.hr?.total || 0} <Text style={styles.execSubtitle}>Pegawai</Text></Text>
                <Text style={styles.execSubDetail}>{mgmtStats.hr?.teachers || 0} Guru / {mgmtStats.hr?.staff || 0} Staf</Text>
              </View>

              {/* 4. Total Sarpras (Aset) */}
              <View style={styles.execCard}>
                <View style={styles.execHeader}>
                  <Text style={styles.execTitle}>Total Unit Sarpras</Text>
                  <View style={[styles.execIconBg, { backgroundColor: '#E0F2F1' }]}>
                    <Ionicons name="checkmark-done-circle-outline" size={18} color="#00796B" />
                  </View>
                </View>
                <Text style={styles.execValue}>{assetStats?.total_assets !== undefined ? assetStats.total_assets : 0} <Text style={styles.execSubtitle}>Unit</Text></Text>
                <Text style={styles.execSubDetail}>Terdiri dari {Object.keys(assetStats?.breakdown || {}).length} barang</Text>
              </View>

              {/* 5. Valuasi Nilai Buku */}
              <View style={styles.execCard}>
                <View style={styles.execHeader}>
                  <Text style={styles.execTitle}>Nilai Buku (Valuasi)</Text>
                  <View style={[styles.execIconBg, { backgroundColor: '#F3E5F5' }]}>
                    <Ionicons name="trending-down-outline" size={18} color="#7B1FA2" />
                  </View>
                </View>
                <Text style={styles.execValueSmall}>
                  {assetStats?.total_current_value ? 'Rp ' + Number(assetStats.total_current_value).toLocaleString('id-ID') : 'Rp 0'}
                </Text>
                <Text style={styles.execSubDetail}>Penyusutan real-time aktif</Text>
              </View>

              {/* 6. Prioritas Bantuan */}
              <View style={styles.execCard}>
                <View style={styles.execHeader}>
                  <Text style={styles.execTitle}>Prioritas Bantuan</Text>
                  <View style={[styles.execIconBg, { backgroundColor: '#FFF8E1' }]}>
                    <Ionicons name="card-outline" size={18} color="#FFA000" />
                  </View>
                </View>
                <Text style={styles.execValue}>{bantuanStats?.total !== undefined ? bantuanStats.total : 0} <Text style={styles.execSubtitle}>Siswa</Text></Text>
                <Text style={styles.execSubDetail}>Kandidat penerima</Text>
              </View>

            </ScrollView>

            {/* Pengingat Pimpinan (Alert Box) */}
            <View style={styles.alertCard}>
              <View style={styles.alertHeader}>
                <View style={styles.alertIconBg}>
                  <Feather name="shield" size={15} color="#D97706" />
                </View>
                <Text style={styles.alertTitle}>Pengingat Pimpinan</Text>
              </View>
              <View style={styles.alertList}>
                <View style={styles.alertItem}>
                  <View style={styles.alertBadge}>
                    <Text style={styles.alertBadgeText}>!</Text>
                  </View>
                  <Text style={styles.alertText}>
                    Segera tinjau <Text style={{ fontWeight: '700' }}>{mgmtStats.mutations?.pending || 0}</Text> permintaan mutasi yang masuk.
                  </Text>
                </View>
                <View style={styles.alertItem}>
                  <View style={styles.alertBadge}>
                    <Text style={styles.alertBadgeText}>!</Text>
                  </View>
                  <Text style={styles.alertText}>
                    <Text style={{ fontWeight: '700' }}>{mgmtStats.retirement?.thisYear || 0}</Text> pegawai akan pensiun tahun ini, siapkan usulan pengganti.
                  </Text>
                </View>
              </View>
            </View>

            {/* Proyeksi Pensiun 5 Tahun (Sipena Intelligence Chart) */}
            {mgmtStats.retirement?.projection && (
              <View style={styles.chartCard}>
                <View style={styles.chartHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.chartTitle}>Proyeksi Pensiun 5 Tahun</Text>
                    <Text style={styles.chartSubtitle}>Estimasi jumlah pegawai purna tugas per tahun</Text>
                  </View>
                  <View style={styles.intelligenceBadge}>
                    <Ionicons name="sparkles" size={12} color={Colors.primary} />
                    <Text style={styles.intelligenceText}>Sipena Intelligence</Text>
                  </View>
                </View>

                <View style={styles.barsContainer}>
                  {mgmtStats.retirement.projection.map((p: any, idx: number) => {
                    const currentYear = new Date().getFullYear();
                    const isThisYear = p.year === currentYear;
                    const counts = mgmtStats.retirement.projection.map((x: any) => x.count || 0);
                    const maxVal = Math.max(...counts, 4);
                    const maxHeight = 85;
                    const barHeight = Math.max(8, (p.count / maxVal) * maxHeight);

                    return (
                      <View key={idx} style={styles.barCol}>
                        <Text style={[styles.barCountText, isThisYear && styles.barCountActive]}>
                          {p.count}
                        </Text>
                        <View style={styles.barTrack}>
                          <View 
                            style={[
                              styles.barFill, 
                              { height: barHeight },
                              isThisYear ? styles.barFillActive : styles.barFillInactive
                            ]} 
                          >
                            {isThisYear && <View style={styles.barDot} />}
                          </View>
                        </View>
                        <Text style={[styles.barYearText, isThisYear && styles.barYearActive]}>
                          {p.year}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Sebaran Gender Pegawai */}
            {mgmtStats.hr?.gender && (
              <View style={styles.genderCard}>
                <View style={styles.genderHeader}>
                  <View style={styles.genderIconBg}>
                    <Feather name="bar-chart-2" size={15} color="#1565C0" />
                  </View>
                  <Text style={styles.genderTitle}>Sebaran Gender Pegawai</Text>
                </View>

                {(() => {
                  const male = mgmtStats.hr.gender.male || 0;
                  const female = mgmtStats.hr.gender.female || 0;
                  const total = male + female || 1;
                  const malePercent = Math.round((male / total) * 100);
                  const femalePercent = Math.round((female / total) * 100);

                  return (
                    <View style={styles.genderContent}>
                      {/* Laki-laki */}
                      <View style={styles.genderRow}>
                        <View style={styles.genderLabelRow}>
                          <View style={[styles.genderDot, { backgroundColor: '#1976D2' }]} />
                          <Text style={styles.genderLabel}>Laki-laki</Text>
                          <Text style={styles.genderValue}>
                            {male} <Text style={styles.genderPercent}>({malePercent}%)</Text>
                          </Text>
                        </View>
                        <View style={styles.progressBarBg}>
                          <View style={[styles.progressBarFill, { width: `${malePercent}%`, backgroundColor: '#1976D2' }]} />
                        </View>
                      </View>

                      {/* Perempuan */}
                      <View style={[styles.genderRow, { marginTop: 14 }]}>
                        <View style={styles.genderLabelRow}>
                          <View style={[styles.genderDot, { backgroundColor: '#E91E63' }]} />
                          <Text style={styles.genderLabel}>Perempuan</Text>
                          <Text style={styles.genderValue}>
                            {female} <Text style={styles.genderPercent}>({femalePercent}%)</Text>
                          </Text>
                        </View>
                        <View style={styles.progressBarBg}>
                          <View style={[styles.progressBarFill, { width: `${femalePercent}%`, backgroundColor: '#E91E63' }]} />
                        </View>
                      </View>
                    </View>
                  );
                })()}
              </View>
            )}

          </View>
        )}

        {/* Menu Utama (14 Modul SIPENAFS) */}
        <View style={styles.menuSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>14 Modul SIPENAFS</Text>
            <View style={styles.officialBadge}>
              <Text style={styles.officialBadgeText}>Ekosistem Terintegrasi</Text>
            </View>
          </View>
          <View style={styles.menuGrid}>
            {filteredMenus.map((item) => (
              <TouchableOpacity 
                key={item.id} 
                style={styles.menuItem}
                onPress={() => handleOpenModule(item)}
                activeOpacity={0.7}
              >
                <View style={[styles.menuIconContainer, { backgroundColor: item.bg }]}>
                  {renderIcon(item.type, item.icon, item.color)}
                  {(item.id === '1' || item.id === '2' || item.id === '3' || item.id === '4' || item.id === '5' || item.id === '6') && (
                    <View style={styles.activeTag}>
                      <Text style={styles.activeTagText}>AKTIF</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.menuText} numberOfLines={2}>
                  {item.title}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Notifications */}
        <View style={styles.notificationSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Notifikasi Terbaru</Text>
            <TouchableOpacity>
              <Text style={styles.seeAllText}>Lihat Semua {'>'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.notificationList}>
            {NOTIFICATIONS.map((notif) => (
              <View key={notif.id} style={styles.notificationCard}>
                <View style={styles.notifIconWrapper}>
                  <Ionicons 
                    name={notif.icon as any} 
                    size={24} 
                    color={
                      notif.type === 'success' ? Colors.success :
                      notif.type === 'warning' ? Colors.warning : Colors.danger
                    } 
                  />
                </View>
                <View style={styles.notifContent}>
                  <Text style={styles.notifTitle}>{notif.title}</Text>
                  <Text style={styles.notifTime}>{notif.time}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

      </ScrollView>

      {/* Notice Modal untuk modul yang dalam antrean */}
      <Modal visible={!!noticeModule} transparent animationType="fade">
        <View style={styles.noticeOverlay}>
          <View style={styles.noticeCard}>
            <View style={styles.noticeIconCircle}>
              <Feather name="clock" size={26} color="#D97706" />
            </View>
            <Text style={styles.noticeTitle}>Modul Dalam Antrean</Text>
            <Text style={styles.noticeSubtitle}>
              <Text style={{ fontWeight: '700', color: Colors.secondary }}>{noticeModule}</Text> saat ini dalam antrean pengerjaan berurutan (1 s.d. 14).
            </Text>
            <Text style={styles.noticeDesc}>
              Modul 1 (Pengaturan Sistem) sudah aktif penuh dan siap digunakan. Modul berikutnya akan dihubungkan secara bertahap.
            </Text>
            <TouchableOpacity 
              style={styles.noticeCloseBtn}
              onPress={() => setNoticeModule(null)}
              activeOpacity={0.8}
            >
              <Text style={styles.noticeCloseText}>Mengerti</Text>
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
    paddingVertical: 15,
    backgroundColor: '#FFF',
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
  greetingSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 20,
  },
  greetingLeft: {
    flex: 1,
  },
  greetingText: {
    fontSize: 16,
    color: Colors.secondary,
    marginBottom: 4,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.secondary,
    marginBottom: 4,
  },
  userRole: {
    fontSize: 14,
    color: Colors.textLight,
  },
  avatarContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#E0E0E0',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#FFF',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8 },
      android: { elevation: 4 },
    }),
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  statsCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    marginHorizontal: 20,
    marginTop: 25,
    paddingVertical: 20,
    paddingHorizontal: 15,
    borderRadius: 20,
    ...Platform.select({
      ios: { shadowColor: Colors.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 12 },
      android: { elevation: 8, shadowColor: Colors.primary },
    }),
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 8,
    marginBottom: 2,
  },
  statLabel: {
    color: '#E0F2F1',
    fontSize: 11,
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  menuSection: {
    marginTop: 30,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.secondary,
    marginBottom: 15,
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  menuItem: {
    width: '25%', // 4 kolom tepat (100% / 4)
    alignItems: 'center',
    marginBottom: 20,
  },
  menuIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  menuText: {
    fontSize: 11,
    color: Colors.secondary,
    fontWeight: '500',
    textAlign: 'center',
  },
  notificationSection: {
    marginTop: 10,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  seeAllText: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '600',
  },
  notificationList: {
    gap: 12,
  },
  notificationCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 16,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  notifIconWrapper: {
    marginRight: 12,
    marginTop: 2,
  },
  notifContent: {
    flex: 1,
  },
  notifTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.secondary,
    lineHeight: 20,
    marginBottom: 4,
  },
  notifTime: {
    fontSize: 11,
    color: Colors.textLight,
  },
  execSection: {
    marginTop: 25,
  },
  execCard: {
    backgroundColor: '#FFF',
    padding: 15,
    borderRadius: 16,
    width: 200,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 },
      android: { elevation: 2 },
    }),
  },
  execHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  execTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textLight,
    flex: 1,
  },
  execIconBg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  execValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.secondary,
  },
  execSubtitle: {
    fontSize: 11,
    fontWeight: '400',
    color: Colors.textLight,
  },
  execSubDetail: {
    fontSize: 11,
    color: Colors.textLight,
    marginTop: 4,
  },
  execValueSmall: {
    fontSize: 17,
    fontWeight: 'bold',
    color: Colors.secondary,
  },
  alertCard: {
    marginHorizontal: 20,
    marginTop: 20,
    backgroundColor: '#FEFCE8',
    borderWidth: 1,
    borderColor: '#FEF08A',
    borderRadius: 16,
    padding: 16,
    ...Platform.select({
      ios: { shadowColor: '#EAB308', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 6 },
      android: { elevation: 2 },
    }),
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  alertIconBg: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FEF08A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#854D0E',
  },
  alertList: {
    gap: 10,
  },
  alertItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  alertBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#EAB308',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 1,
  },
  alertBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#FFF',
  },
  alertText: {
    fontSize: 12,
    color: '#713F12',
    flex: 1,
    lineHeight: 18,
  },
  chartCard: {
    marginHorizontal: 20,
    marginTop: 18,
    backgroundColor: '#FFF',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 },
      android: { elevation: 2 },
    }),
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.secondary,
    marginBottom: 2,
  },
  chartSubtitle: {
    fontSize: 11,
    color: Colors.textLight,
  },
  intelligenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E6F4F1',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(11, 138, 125, 0.15)',
  },
  intelligenceText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0B8A7D',
  },
  barsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 130,
    paddingTop: 10,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  barCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    marginBottom: 6,
  },
  barCountActive: {
    color: '#0B8A7D',
    fontWeight: '800',
  },
  barTrack: {
    width: '60%',
    maxWidth: 36,
    height: 85,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  barFill: {
    width: '100%',
    borderRadius: 8,
    position: 'relative',
  },
  barFillActive: {
    backgroundColor: '#0B8A7D',
  },
  barFillInactive: {
    backgroundColor: '#E2E8F0',
  },
  barDot: {
    position: 'absolute',
    top: -3,
    alignSelf: 'center',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  barYearText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
    marginTop: 8,
  },
  barYearActive: {
    color: '#0B8A7D',
    fontWeight: '800',
  },
  genderCard: {
    marginHorizontal: 20,
    marginTop: 18,
    backgroundColor: '#FFF',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 },
      android: { elevation: 2 },
    }),
  },
  genderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  genderIconBg: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  genderTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.secondary,
  },
  genderContent: {},
  genderRow: {},
  genderLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  genderDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  genderLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    flex: 1,
  },
  genderValue: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.secondary,
  },
  genderPercent: {
    fontSize: 11,
    fontWeight: '400',
    color: Colors.textLight,
  },
  progressBarBg: {
    height: 7,
    backgroundColor: '#F1F5F9',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  officialBadge: {
    backgroundColor: '#E6F4F1',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  officialBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0B8A7D',
  },
  activeTag: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#10B981',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
  },
  activeTagText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#FFF',
  },
  noticeOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  noticeCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12 },
      android: { elevation: 6 },
    }),
  },
  noticeIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  noticeTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.secondary,
    marginBottom: 8,
  },
  noticeSubtitle: {
    fontSize: 13,
    color: Colors.secondary,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 8,
  },
  noticeDesc: {
    fontSize: 12,
    color: Colors.textLight,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  noticeCloseBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 14,
    width: '100%',
    alignItems: 'center',
  },
  noticeCloseText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
});

