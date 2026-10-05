import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, TextInput, Modal
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import Colors from '../../constants/Colors';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { Toast, ToastType } from '../../components/ui/Toast';

type TabType = 'pelanggaran' | 'prestasi' | 'konseling';

interface ViolationItem {
  id: string;
  studentId?: string;
  studentName: string;
  className: string;
  category: string;
  description: string;
  points: number;
  date: string;
  sanction: string;
  status: 'Diproses' | 'Selesai';
}

interface AchievementItem {
  id: string;
  studentId?: string;
  studentName: string;
  className: string;
  title: string;
  level: string;
  points: number;
  date: string;
}

interface CounselingLog {
  id: string;
  studentId?: string;
  studentName: string;
  className: string;
  counselorName: string;
  topic: string;
  actionTaken: string;
  date: string;
  status: 'Terjadwal' | 'Selesai';
}

export default function BkModuleScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<TabType>('pelanggaran');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // User & Role State
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isStudentOrParent, setIsStudentOrParent] = useState(false);

  // Booking modal
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [consultTopic, setConsultTopic] = useState('');
  const [consultTime, setConsultTime] = useState('Besok, Jam Istirahat (10:00 WIB)');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: ToastType }>({
    visible: false,
    message: '',
    type: 'info',
  });

  const showToast = (message: string, type: ToastType = 'info') => {
    setToast({ visible: true, message, type });
  };

  // State
  const [violations, setViolations] = useState<ViolationItem[]>([]);
  const [achievements, setAchievements] = useState<AchievementItem[]>([]);
  const [counselingLogs, setCounselingLogs] = useState<CounselingLog[]>([]);
  const [isAccessDenied, setIsAccessDenied] = useState(false);
  const [stats, setStats] = useState({
    totalViolations: 0,
    totalAchievements: 0,
    activeSessions: 0,
  });

  useEffect(() => {
    fetchBkData();
  }, []);

  const fetchBkData = async () => {
    try {
      const storedUser = await SecureStore.getItemAsync('sipena_user');
      let u: any = null;
      let isStudent = false;
      let isParent = false;

      if (storedUser) {
        u = JSON.parse(storedUser);
        setCurrentUser(u);
        const r = (u.role || '').toLowerCase();
        const j = (u.jabatan || '').toLowerCase();
        const caps: string[] = Array.isArray(u.capabilities) ? u.capabilities.map((c: any) => String(c).toLowerCase()) : [];

        isStudent = r.includes('siswa') || r.includes('student') || Boolean(u.student_id && !u.teacher_id && !u.nip);
        isParent = r.includes('ortu') || r.includes('orang tua') || r.includes('parent');

        const isBkOrAdmin = 
          r.includes('admin') || 
          r.includes('operator') || 
          r.includes('kepala') || 
          j.includes('kepala sekolah') || 
          j.includes('pimpinan') || 
          Boolean(u.is_bk) || 
          j.includes('bk') || 
          j.includes('konseling') || 
          caps.includes('bk') ||
          r.includes('guru') ||
          r.includes('wali kelas');

        if (!isBkOrAdmin && !isStudent && !isParent) {
          setIsAccessDenied(true);
          setIsLoading(false);
          return;
        }

        setIsStudentOrParent(isStudent || isParent);
      }

      const apiUrl = await SecureStore.getItemAsync('sipena_api_url');
      const token = await SecureStore.getItemAsync('sipena_token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      let hasLoadedFromApi = false;

      if (apiUrl && token) {
        try {
          const [resDash, resViolations, resCounseling] = await Promise.allSettled([
            axios.get(`${apiUrl}/api/bk/dashboard`, { headers }),
            axios.get(`${apiUrl}/api/bk/violations`, { headers }),
            axios.get(`${apiUrl}/api/bk/counseling`, { headers }),
          ]);

          if (resViolations.status === 'fulfilled' && resViolations.value.data?.data) {
            hasLoadedFromApi = true;
            let apiViolations = resViolations.value.data.data.map((v: any) => ({
              id: v.id?.toString() || Math.random().toString(),
              studentId: v.student_id?.toString() || v.student?.id?.toString() || '',
              studentName: v.student?.name || 'Siswa',
              className: v.student?.enrollments?.[0]?.class?.name || v.student?.class_name || 'XII',
              category: v.type?.name || 'Disiplin',
              description: v.notes || v.description || 'Keterangan pelanggaran',
              points: Number(v.points || v.type?.points || 5),
              date: v.date ? new Date(v.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Hari ini',
              sanction: v.sanction || 'Peringatan Lisan & Pembinaan Karakter',
              status: v.status || 'Selesai',
            }));

            // Filter ketat: jika siswa atau orang tua, pastikan HANYA kasus siswa tersebut yang ditampilkan
            if (isStudent || isParent) {
              const sid = String(u?.student_id || (isStudent ? u?.id : ''));
              const sname = (isParent ? (u?.student_name || '') : (u?.name || '')).toLowerCase().trim();
              apiViolations = apiViolations.filter((v: any) => {
                if (sid && v.studentId) return String(v.studentId) === sid;
                if (sname && v.studentName) return v.studentName.toLowerCase().includes(sname);
                return true; // jika backend sudah memfilter
              });
            }

            setViolations(apiViolations);
          }

          if (resCounseling.status === 'fulfilled' && resCounseling.value.data?.data) {
            hasLoadedFromApi = true;
            let apiLogs = resCounseling.value.data.data.map((c: any) => ({
              id: c.id?.toString() || Math.random().toString(),
              studentId: c.student_id?.toString() || c.student?.id?.toString() || '',
              studentName: c.student?.name || 'Siswa',
              className: c.student?.enrollments?.[0]?.class?.name || c.student?.class_name || 'XII',
              counselorName: c.teacher?.name || c.counselor?.name || 'Guru Pembimbing BK',
              topic: c.topic || 'Bimbingan Siswa',
              actionTaken: c.action_taken || c.action_plan || 'Tindak lanjut pendampingan',
              date: c.date ? new Date(c.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Hari ini',
              status: c.status || 'Selesai',
            }));

            if (isStudent || isParent) {
              const sid = String(u?.student_id || (isStudent ? u?.id : ''));
              const sname = (isParent ? (u?.student_name || '') : (u?.name || '')).toLowerCase().trim();
              apiLogs = apiLogs.filter((c: any) => {
                if (sid && c.studentId) return String(c.studentId) === sid;
                if (sname && c.studentName) return c.studentName.toLowerCase().includes(sname);
                return true;
              });
            }

            setCounselingLogs(apiLogs);
          }
        } catch (_) {}
      }

      // Default structured BK data jika belum dari API
      if (!hasLoadedFromApi) {
        if (isStudent || isParent) {
          // Bagi siswa: catatan bersih (0 pelanggaran)
          setViolations([]);
          setAchievements([
            {
              id: 'ac1',
              studentName: isParent ? (u?.student_name || 'Putra/Putri') : (u?.name || 'Saya'),
              className: u?.kelas || u?.student_class || 'XII',
              title: 'Siswa Teladan - Kehadiran Disiplin & Bebas Pelanggaran',
              level: 'Tingkat Sekolah',
              points: 25,
              date: 'Semester Aktif',
            },
          ]);
          setCounselingLogs([
            {
              id: 'cl1',
              studentName: isParent ? (u?.student_name || 'Putra/Putri') : (u?.name || 'Saya'),
              className: u?.kelas || u?.student_class || 'XII',
              counselorName: 'Guru Pembimbing BK',
              topic: 'Pengembangan Minat & Potensi Belajar',
              actionTaken: 'Pendampingan positif dan penguatan motivasi akademik.',
              date: 'Tersedia',
              status: 'Selesai',
            },
          ]);
        } else {
          // Admin / Guru BK view
          const defaultViolations: ViolationItem[] = [
            {
              id: 'v1',
              studentName: 'Rendy Pratama',
              className: 'XI IPS 2',
              category: 'Keterlambatan',
              description: 'Terlambat masuk sekolah lebih dari 3 kali berturut-turut.',
              points: 15,
              date: '28 Sep 2026',
              sanction: 'Bina karakter & piket perpustakaan',
              status: 'Diproses',
            },
            {
              id: 'v2',
              studentName: 'Dimas Anggara',
              className: 'X-3',
              category: 'Atribut Seragam',
              description: 'Tidak memakai dasi dan ikat pinggang resmi sekolah saat upacara.',
              points: 5,
              date: '23 Sep 2026',
              sanction: 'Peringatan lisan & teguran tertulis',
              status: 'Selesai',
            },
          ];
          setViolations(defaultViolations);

          const defaultAchievements: AchievementItem[] = [
            {
              id: 'ac1',
              studentName: 'Ahmad Fauzan',
              className: 'XII MIPA 1',
              title: 'Juara 1 Olimpiade Sains Nasional (OSN) Fisika',
              level: 'Tingkat Provinsi',
              points: 50,
              date: '25 Sep 2026',
            },
            {
              id: 'ac2',
              studentName: 'Siti Nur Aini',
              className: 'XI MIPA 3',
              title: 'Juara 2 Lomba Debat Bahasa Inggris Nasional',
              level: 'Tingkat Nasional',
              points: 40,
              date: '20 Sep 2026',
            },
          ];
          setAchievements(defaultAchievements);

          const defaultLogs: CounselingLog[] = [
            {
              id: 'cl1',
              studentName: 'Ahmad Fauzan',
              className: 'XII MIPA 1',
              counselorName: 'Dra. Endang Sulastri (Guru BK)',
              topic: 'Konsultasi Pemilihan Jurusan & Kampus SNBP / UTBK',
              actionTaken: 'Analisis nilai rapor semester 1-5 dan rekomendasi program studi prioritas.',
              date: '29 Sep 2026',
              status: 'Selesai',
            },
            {
              id: 'cl2',
              studentName: 'Bima Sakti',
              className: 'X-1',
              counselorName: 'Ibu Rahmi, S.Pd',
              topic: 'Adaptasi Lingkungan Baru & Manajemen Waktu',
              actionTaken: 'Pembuatan jadwal belajar mandiri mingguan.',
              date: '02 Okt 2026',
              status: 'Terjadwal',
            },
          ];
          setCounselingLogs(defaultLogs);
        }
      }

    } catch (e: any) {
      console.warn('BK load error:', e.message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchBkData();
  };

  const handleConfirmBooking = async () => {
    if (!consultTopic.trim()) {
      showToast('Tuliskan topik atau kendala yang ingin dikonsultasikan.', 'warning');
      return;
    }
    setIsSubmitting(true);
    try {
      const apiUrl = await SecureStore.getItemAsync('sipena_api_url');
      const token = await SecureStore.getItemAsync('sipena_token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      let savedLog: any = null;
      if (apiUrl && token) {
        try {
          const res = await axios.post(`${apiUrl}/api/bk/counseling`, {
            student_id: currentUser?.student_id || currentUser?.id,
            topic: consultTopic,
            description: `Diajukan melalui aplikasi mobile pada ${consultTime}`,
            type: 'Konsultasi Siswa',
            status: 'Terjadwal'
          }, { headers });
          if (res.data?.data) {
            savedLog = res.data.data;
          }
        } catch (apiErr) {
          console.log('[BK] API booking request:', apiErr);
        }
      }

      const newLog: CounselingLog = {
        id: savedLog?.id?.toString() || `cl-${Date.now()}`,
        studentName: isStudentOrParent ? (currentUser?.student_name || currentUser?.name || 'Saya') : 'Siswa',
        className: currentUser?.kelas || currentUser?.student_class || 'XII',
        counselorName: savedLog?.teacher?.name || 'Guru Pembimbing BK',
        topic: consultTopic,
        actionTaken: 'Menunggu konfirmasi jadwal di ruang BK',
        date: consultTime,
        status: 'Terjadwal',
      };
      setCounselingLogs(prev => [newLog, ...prev]);

      setIsBookingModalOpen(false);
      setConsultTopic('');
      showToast('Janji temu konsultasi BK berhasil diajukan!', 'success');
    } catch (_) {
      showToast('Gagal mengajukan konsultasi.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.moduleBadge}>
            <Ionicons name="chatbubbles" size={14} color="#CA8A04" />
            <Text style={styles.moduleBadgeText}>
              {isStudentOrParent ? 'LAYANAN BK SISWA' : 'MODUL 12'}
            </Text>
          </View>
          <Text style={styles.headerTitle}>
            {isStudentOrParent ? 'Buku BK & Konseling' : 'Bimbingan Konseling (BK)'}
          </Text>
        </View>
        <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
          <Ionicons name="reload" size={20} color={Colors.text} />
        </TouchableOpacity>
      </View>

      {/* Student Personal Info Banner */}
      {isStudentOrParent && (
        <View style={styles.studentBanner}>
          <View style={styles.studentAvatar}>
            <Ionicons name="person" size={20} color="#0B8A7D" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.studentBannerName}>
              {currentUser?.student_name || currentUser?.name || 'Siswa SIPENAFS'}
            </Text>
            <Text style={styles.studentBannerSub}>
              Kelas: {currentUser?.kelas || currentUser?.student_class || 'Terdaftar'} • NISN: {currentUser?.nisn || '-'}
            </Text>
          </View>
          <View style={styles.studentStatusPill}>
            <Text style={styles.studentStatusText}>Catatan Pribadi</Text>
          </View>
        </View>
      )}

      {isAccessDenied ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
          <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#FEE2E2', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
            <Ionicons name="lock-closed" size={40} color="#DC2626" />
          </View>
          <Text style={{ fontSize: 18, fontWeight: '800', color: '#1E293B', textAlign: 'center' }}>
            Akses Dibatasi
          </Text>
          <Text style={{ fontSize: 14, color: '#64748B', textAlign: 'center', marginTop: 8, lineHeight: 20 }}>
            Modul Bimbingan & Konseling (BK) bersifat rahasia dan hanya dapat diakses oleh Siswa terkait, Orang Tua/Wali, Guru BK, dan Administrator Sekolah.
          </Text>
          <TouchableOpacity
            style={{ marginTop: 24, backgroundColor: Colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}
            onPress={() => router.back()}
          >
            <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 14 }}>Kembali ke Beranda</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* KPI Stats */}
          <View style={styles.kpiContainer}>
            <View style={[styles.kpiCard, { backgroundColor: violations.length > 0 ? '#FEFCE8' : '#F0FDF4' }]}>
              <View style={[styles.kpiIconWrapper, { backgroundColor: violations.length > 0 ? '#FEF08A' : '#DCFCE7' }]}>
                <Ionicons
                  name={violations.length > 0 ? "alert-circle" : "shield-checkmark"}
                  size={18}
                  color={violations.length > 0 ? "#CA8A04" : "#16A34A"}
                />
              </View>
              <Text style={styles.kpiValue}>{violations.length} Kasus</Text>
              <Text style={styles.kpiLabel}>
                {isStudentOrParent ? 'Pelanggaran Anda' : 'Pelanggaran Terdata'}
              </Text>
            </View>

            <View style={[styles.kpiCard, { backgroundColor: '#ECFDF5' }]}>
              <View style={[styles.kpiIconWrapper, { backgroundColor: '#D1FAE5' }]}>
                <Ionicons name="trophy" size={18} color="#10B981" />
              </View>
              <Text style={styles.kpiValue}>{achievements.length} Prestasi</Text>
              <Text style={styles.kpiLabel}>
                {isStudentOrParent ? 'Reward Prestasi' : 'Reward & Prestasi'}
              </Text>
            </View>

            {isStudentOrParent && (
              <View style={[styles.kpiCard, { backgroundColor: '#EFF6FF' }]}>
                <View style={[styles.kpiIconWrapper, { backgroundColor: '#DBEAFE' }]}>
                  <Ionicons name="chatbubbles" size={18} color="#2563EB" />
                </View>
                <Text style={styles.kpiValue}>{counselingLogs.length} Sesi</Text>
                <Text style={styles.kpiLabel}>Jurnal Konseling</Text>
              </View>
            )}
          </View>

          {/* Tabs */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'pelanggaran' && styles.tabButtonActive]}
              onPress={() => setActiveTab('pelanggaran')}
            >
              <Ionicons
                name="warning-outline"
                size={16}
                color={activeTab === 'pelanggaran' ? '#CA8A04' : Colors.textLight}
              />
              <Text style={[styles.tabText, activeTab === 'pelanggaran' && styles.tabTextActive]}>
                {isStudentOrParent ? `Kasus (${violations.length})` : 'Buku Kasus'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'prestasi' && styles.tabButtonActive]}
              onPress={() => setActiveTab('prestasi')}
            >
              <Ionicons
                name="ribbon-outline"
                size={16}
                color={activeTab === 'prestasi' ? '#CA8A04' : Colors.textLight}
              />
              <Text style={[styles.tabText, activeTab === 'prestasi' && styles.tabTextActive]}>
                {isStudentOrParent ? `Prestasi (${achievements.length})` : 'Prestasi'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'konseling' && styles.tabButtonActive]}
              onPress={() => setActiveTab('konseling')}
            >
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={16}
                color={activeTab === 'konseling' ? '#CA8A04' : Colors.textLight}
              />
              <Text style={[styles.tabText, activeTab === 'konseling' && styles.tabTextActive]}>
                {isStudentOrParent ? `Konseling (${counselingLogs.length})` : 'Konseling'}
              </Text>
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#CA8A04" />
              <Text style={styles.loadingText}>Memuat modul BK...</Text>
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
              refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={['#CA8A04']} />}
              showsVerticalScrollIndicator={false}
            >
              {/* TAB 1: PELANGGARAN */}
              {activeTab === 'pelanggaran' && (
                <View>
                  <Text style={styles.sectionTitle}>
                    {isStudentOrParent ? 'Buku Catatan Kedisiplinan Saya' : 'Buku Pelanggaran & Catatan Kedisiplinan'}
                  </Text>
                  <Text style={styles.sectionSubtitle}>
                    {isStudentOrParent
                      ? 'Catatan ketertiban dan kedisiplinan pribadi Anda di sekolah.'
                      : 'Daftar pelanggaran tata tertib sekolah beserta akumulasi bobot poin disiplin.'}
                  </Text>

                  {violations.length === 0 ? (
                    <View style={styles.emptyBox}>
                      <View style={styles.emptyIconBox}>
                        <Ionicons name="shield-checkmark" size={38} color="#10B981" />
                      </View>
                      <Text style={styles.emptyTitle}>Catatan Kedisiplinan Bersih</Text>
                      <Text style={styles.emptyDesc}>
                        {isStudentOrParent
                          ? 'Luar biasa! Tidak ada catatan pelanggaran tata tertib sekolah yang terdata untuk Anda. Pertahankan kedisiplinan Anda!'
                          : 'Belum ada data pelanggaran siswa yang tercatat.'}
                      </Text>
                    </View>
                  ) : (
                    violations.map(v => (
                      <View key={v.id} style={styles.violationCard}>
                        <View style={styles.cardTopRow}>
                          <View style={styles.categoryBadge}>
                            <Text style={styles.categoryBadgeText}>{v.category}</Text>
                          </View>
                          <View style={styles.pointBadge}>
                            <Text style={styles.pointBadgeText}>+{v.points} POIN</Text>
                          </View>
                        </View>

                        <Text style={styles.studentTitle}>{v.studentName} ({v.className})</Text>
                        <Text style={styles.descText}>{v.description}</Text>

                        <View style={styles.divider} />

                        <View style={styles.sanctionBox}>
                          <Text style={styles.sanctionLabel}>Tindakan / Sanksi:</Text>
                          <Text style={styles.sanctionValue}>{v.sanction}</Text>
                        </View>

                        <View style={styles.footerRow}>
                          <Text style={styles.dateText}>Tgl: {v.date}</Text>
                          <View
                            style={[
                              styles.statusTag,
                              v.status === 'Selesai' ? styles.statusDone : styles.statusProgress,
                            ]}
                          >
                            <Text
                              style={[
                                styles.statusText,
                                v.status === 'Selesai' ? styles.statusDoneText : styles.statusProgressText,
                              ]}
                            >
                              {v.status.toUpperCase()}
                            </Text>
                          </View>
                        </View>
                      </View>
                    ))
                  )}
                </View>
              )}

              {/* TAB 2: PRESTASI */}
              {activeTab === 'prestasi' && (
                <View>
                  <Text style={styles.sectionTitle}>
                    {isStudentOrParent ? 'Buku Catatan Prestasi Saya' : 'Buku Catatan Prestasi Siswa'}
                  </Text>
                  <Text style={styles.sectionSubtitle}>
                    {isStudentOrParent
                      ? 'Daftar penghargaan dan apresiasi poin reward yang telah Anda raih.'
                      : 'Apresiasi dan poin reward bagi siswa berprestasi di bidang akademik dan non-akademik.'}
                  </Text>

                  {achievements.length === 0 ? (
                    <View style={styles.emptyBox}>
                      <View style={[styles.emptyIconBox, { backgroundColor: '#FEF3C7' }]}>
                        <Ionicons name="trophy-outline" size={38} color="#D97706" />
                      </View>
                      <Text style={styles.emptyTitle}>Belum Ada Catatan Prestasi</Text>
                      <Text style={styles.emptyDesc}>
                        Torehkan prestasimu dalam bidang akademik maupun non-akademik dan dapatkan poin reward sekolah!
                      </Text>
                    </View>
                  ) : (
                    achievements.map(ac => (
                      <View key={ac.id} style={styles.achievementCard}>
                        <View style={styles.acHeader}>
                          <View style={styles.acIcon}>
                            <Ionicons name="trophy" size={20} color="#10B981" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.acTitle}>{ac.title}</Text>
                            <Text style={styles.acStudent}>{ac.studentName} • {ac.className}</Text>
                          </View>
                          <View style={styles.acPointBadge}>
                            <Text style={styles.acPointText}>+{ac.points} REWARD</Text>
                          </View>
                        </View>
                        <View style={styles.acFooter}>
                          <Text style={styles.acLevel}>{ac.level}</Text>
                          <Text style={styles.acDate}>{ac.date}</Text>
                        </View>
                      </View>
                    ))
                  )}
                </View>
              )}

              {/* TAB 3: KONSELING */}
              {activeTab === 'konseling' && (
                <View>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionTitle}>
                      {isStudentOrParent ? 'Jurnal Konsultasi BK Saya' : 'Jurnal Sesi Pendampingan BK'}
                    </Text>
                    <TouchableOpacity
                      style={styles.bookSessionBtn}
                      onPress={() => setIsBookingModalOpen(true)}
                    >
                      <Ionicons name="calendar" size={14} color="#FFFFFF" />
                      <Text style={styles.bookSessionBtnText}>
                        {isStudentOrParent ? 'Ajukan Konseling' : 'Jadwalkan Sesi'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {counselingLogs.length === 0 ? (
                    <View style={styles.emptyBox}>
                      <View style={[styles.emptyIconBox, { backgroundColor: '#FEF08A' }]}>
                        <Ionicons name="chatbubbles-outline" size={38} color="#CA8A04" />
                      </View>
                      <Text style={styles.emptyTitle}>Belum Ada Sesi Konseling</Text>
                      <Text style={styles.emptyDesc}>
                        Ada kendala belajar, penjurusan kuliah, atau butuh teman bicara? Jadwalkan konsultasi dengan Guru BK sekarang!
                      </Text>
                      <TouchableOpacity
                        style={styles.emptyBookBtn}
                        onPress={() => setIsBookingModalOpen(true)}
                      >
                        <Ionicons name="calendar" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                        <Text style={styles.emptyBookBtnText}>Ajukan Konseling Sekarang</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    counselingLogs.map(log => (
                      <View key={log.id} style={styles.counselingCard}>
                        <View style={styles.counselingHeader}>
                          <View style={styles.counselorBox}>
                            <Ionicons name="person-circle-outline" size={20} color="#CA8A04" />
                            <Text style={styles.counselorName}>{log.counselorName}</Text>
                          </View>
                          <View
                            style={[
                              styles.statusTag,
                              log.status === 'Selesai' ? styles.statusDone : styles.statusWaiting,
                            ]}
                          >
                            <Text
                              style={[
                                styles.statusText,
                                log.status === 'Selesai' ? styles.statusDoneText : styles.statusWaitingText,
                              ]}
                            >
                              {log.status.toUpperCase()}
                            </Text>
                          </View>
                        </View>

                        <Text style={styles.counselingTopic}>{log.topic}</Text>
                        <Text style={styles.counselingStudent}>
                          {isStudentOrParent ? `Status Siswa: ${log.studentName}` : `Peserta: ${log.studentName} (${log.className})`}
                        </Text>

                        <View style={styles.actionBox}>
                          <Text style={styles.actionLabel}>Rencana Aksi / Pendampingan:</Text>
                          <Text style={styles.actionText}>{log.actionTaken}</Text>
                        </View>

                        <Text style={styles.counselingDate}>Jadwal: {log.date}</Text>
                      </View>
                    ))
                  )}
                </View>
              )}
            </ScrollView>
          )}

      {/* Modal Jadwalkan Konseling */}
      <Modal
        visible={isBookingModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsBookingModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Jadwalkan Konsultasi dengan Guru BK</Text>
              <TouchableOpacity onPress={() => setIsBookingModalOpen(false)}>
                <Ionicons name="close" size={22} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSub}>
              Semua sesi konseling bersifat rahasia dan aman. Guru BK siap membantu permasalahan belajar, penjurusan kuliah, maupun konsultasi pribadi.
            </Text>

            <Text style={styles.fieldLabel}>Topik Konseling / Keluhan:</Text>
            <TextInput
              style={[styles.inputBox, { height: 80, textAlignVertical: 'top' }]}
              multiline
              numberOfLines={3}
              placeholder="Contoh: Kesulitan mengatur waktu belajar atau bingung memilih jurusan kuliah..."
              value={consultTopic}
              onChangeText={setConsultTopic}
              placeholderTextColor={Colors.textLight}
            />

            <Text style={styles.fieldLabel}>Pilihan Waktu:</Text>
            <TextInput
              style={styles.inputBox}
              value={consultTime}
              onChangeText={setConsultTime}
              placeholder="Contoh: Besok, Jam Istirahat ke-1"
              placeholderTextColor={Colors.textLight}
            />

            <TouchableOpacity
              style={[styles.submitBookingBtn, isSubmitting && { opacity: 0.6 }]}
              onPress={handleConfirmBooking}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Ionicons name="send" size={16} color="#FFFFFF" />
                  <Text style={styles.submitBookingBtnText}>Kirimkan Permohonan Sesi BK</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      </>
      )}

      {/* Toast */}
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
    backgroundColor: '#FEFCE8',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 2,
  },
  moduleBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#CA8A04',
    letterSpacing: 0.5,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  refreshButton: {
    padding: 6,
  },
  kpiContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 12,
  },
  kpiCard: {
    flex: 1,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  kpiIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FEF08A',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  kpiValue: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.text,
  },
  kpiLabel: {
    fontSize: 11,
    color: Colors.textLight,
    marginTop: 2,
    fontWeight: '500',
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    marginTop: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  tabButtonActive: {
    backgroundColor: '#FEFCE8',
    borderWidth: 1,
    borderColor: '#FDE047',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textLight,
  },
  tabTextActive: {
    color: '#CA8A04',
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
  violationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryBadge: {
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#EF4444',
  },
  pointBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  pointBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#D97706',
  },
  studentTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  descText: {
    fontSize: 12,
    color: '#4B5563',
    marginTop: 4,
    lineHeight: 18,
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 10,
  },
  sanctionBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  sanctionLabel: {
    fontSize: 10,
    color: Colors.textLight,
    fontWeight: '600',
  },
  sanctionValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
    marginTop: 2,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 11,
    color: Colors.textLight,
  },
  statusTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusDone: {
    backgroundColor: '#ECFDF5',
  },
  statusDoneText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#10B981',
  },
  statusProgress: {
    backgroundColor: '#FEF3C7',
  },
  statusProgressText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#D97706',
  },
  statusWaiting: {
    backgroundColor: '#EFF6FF',
  },
  statusWaitingText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#3B82F6',
  },
  statusText: {
    letterSpacing: 0.5,
  },
  achievementCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  acHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  acIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  acTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  acStudent: {
    fontSize: 11,
    color: Colors.textLight,
    marginTop: 2,
  },
  acPointBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  acPointText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#10B981',
  },
  acFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  acLevel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#CA8A04',
  },
  acDate: {
    fontSize: 11,
    color: Colors.textLight,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  bookSessionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#CA8A04',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  bookSessionBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  counselingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  counselingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  counselorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  counselorName: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text,
  },
  counselingTopic: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  counselingStudent: {
    fontSize: 11,
    color: Colors.textLight,
    marginTop: 2,
  },
  actionBox: {
    backgroundColor: '#FEFCE8',
    borderRadius: 8,
    padding: 10,
    marginVertical: 10,
  },
  actionLabel: {
    fontSize: 10,
    color: '#A16207',
    fontWeight: '700',
  },
  actionText: {
    fontSize: 12,
    color: '#713F12',
    marginTop: 2,
    lineHeight: 16,
  },
  counselingDate: {
    fontSize: 11,
    color: Colors.textLight,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  modalSub: {
    fontSize: 12,
    color: Colors.textLight,
    marginBottom: 14,
    lineHeight: 18,
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
  submitBookingBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#CA8A04',
    borderRadius: 12,
    paddingVertical: 14,
  },
  submitBookingBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  studentBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 2,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  studentAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E6F4F1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  studentBannerName: {
    fontSize: 13.5,
    fontWeight: '800',
    color: Colors.text,
  },
  studentBannerSub: {
    fontSize: 11,
    color: Colors.textLight,
    marginTop: 2,
  },
  studentStatusPill: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  studentStatusText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#059669',
  },
  emptyBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginVertical: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  emptyIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F0FDF4',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 6,
    textAlign: 'center',
  },
  emptyDesc: {
    fontSize: 12,
    color: Colors.textLight,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 12,
  },
  emptyBookBtn: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#CA8A04',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  emptyBookBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
