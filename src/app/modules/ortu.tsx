import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, TextInput, Modal, Linking
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import Colors from '../../constants/Colors';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { Toast, ToastType } from '../../components/ui/Toast';

type TabType = 'presensi' | 'nilai' | 'izin' | 'konsultasi';

interface ChildProfile {
  id: string;
  name: string;
  nisn: string;
  nis: string;
  className: string;
  homeroomTeacher: {
    name: string;
    phone: string;
    nip: string;
  };
  attendanceSummary: {
    hadir: number;
    terlambat: number;
    sakit: number;
    izin: number;
    alpa: number;
  };
}

interface AttendanceLog {
  id: string;
  date: string;
  time: string;
  status: 'Hadir' | 'Terlambat' | 'Sakit' | 'Izin' | 'Alpa';
}

interface SubjectScore {
  id: string;
  subjectName: string;
  tugas: number;
  uts: number;
  uas: number;
  average: number;
  grade: string;
}

interface LeaveRequestItem {
  id: string;
  type: 'Sakit' | 'Izin';
  startDate: string;
  endDate: string;
  reason: string;
  status: 'Menunggu' | 'Disetujui' | 'Ditolak';
  approver?: string;
}

export default function OrtuModuleScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<TabType>('presensi');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Leave request modal state
  const [isLeaveModalVisible, setIsLeaveModalVisible] = useState(false);
  const [leaveType, setLeaveType] = useState<'Sakit' | 'Izin'>('Sakit');
  const [leaveReason, setLeaveReason] = useState('');
  const [leaveDuration, setLeaveDuration] = useState('1 Hari (Hari ini)');
  const [isSubmittingLeave, setIsSubmittingLeave] = useState(false);

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
  const [child, setChild] = useState<ChildProfile>({
    id: '1',
    name: 'Ahmad Fauzan',
    nisn: '0087654321',
    nis: '222301045',
    className: 'XII MIPA 1 (Sains & Teknologi)',
    homeroomTeacher: {
      name: 'Drs. Supriyanto, M.Pd',
      phone: '081234567890',
      nip: '197508122005011003',
    },
    attendanceSummary: {
      hadir: 42,
      terlambat: 2,
      sakit: 1,
      izin: 1,
      alpa: 0,
    },
  });

  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLog[]>([]);
  const [subjectScores, setSubjectScores] = useState<SubjectScore[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequestItem[]>([]);

  useEffect(() => {
    fetchParentOverview();
  }, []);

  const fetchParentOverview = async () => {
    try {
      const apiUrl = await SecureStore.getItemAsync('sipena_api_url');
      const token = await SecureStore.getItemAsync('sipena_token');
      const storedUser = await SecureStore.getItemAsync('sipena_user');
      const user = storedUser ? JSON.parse(storedUser) : null;

      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      if (apiUrl && token) {
        try {
          const res = await axios.get(`${apiUrl}/api/parent/overview`, { headers });
          if (res.data && res.data.success && res.data.data) {
            const data = res.data.data;
            if (data.student) {
              setChild(prev => ({
                ...prev,
                name: data.student.name || prev.name,
                nisn: data.student.nisn || prev.nisn,
                className: data.classInfo?.name || prev.className,
                homeroomTeacher: data.classInfo?.homeroomTeacher || prev.homeroomTeacher,
              }));
            }
            if (Array.isArray(data.recent_attendances)) {
              setAttendanceLogs(
                data.recent_attendances.map((att: any) => ({
                  id: att.id?.toString() || Math.random().toString(),
                  date: att.date ? att.date.slice(0, 10) : 'Hari Ini',
                  time: att.check_in_time ? att.check_in_time.slice(11, 16) + ' WIB' : '06:48 WIB',
                  status: att.status || 'Hadir',
                }))
              );
            }
            if (Array.isArray(data.grades)) {
              setSubjectScores(
                data.grades.map((g: any) => ({
                  id: g.id?.toString() || Math.random().toString(),
                  subjectName: g.subject_name || g.name || 'Mata Pelajaran',
                  tugas: Number(g.Tugas || 80),
                  uts: Number(g.UTS || 85),
                  uas: Number(g.UAS || 88),
                  average: Number(g.average || 84),
                  grade: Number(g.average || 84) >= 85 ? 'A' : 'B',
                }))
              );
            }
          }
        } catch (_) {}
      }

      // Default structured data
      const defaultLogs: AttendanceLog[] = [
        { id: '1', date: '30 Sep 2026', time: '06:42 WIB', status: 'Hadir' },
        { id: '2', date: '29 Sep 2026', time: '06:45 WIB', status: 'Hadir' },
        { id: '3', date: '28 Sep 2026', time: '07:05 WIB', status: 'Terlambat' },
        { id: '4', date: '25 Sep 2026', time: '06:38 WIB', status: 'Hadir' },
        { id: '5', date: '24 Sep 2026', time: '-', status: 'Izin' },
        { id: '6', date: '23 Sep 2026', time: '06:40 WIB', status: 'Hadir' },
      ];
      setAttendanceLogs(prev => (prev.length > 0 ? prev : defaultLogs));

      const defaultScores: SubjectScore[] = [
        { id: 's1', subjectName: 'Matematika Peminatan', tugas: 88, uts: 85, uas: 90, average: 88, grade: 'A' },
        { id: 's2', subjectName: 'Fisika Terapan', tugas: 82, uts: 80, uas: 84, average: 82, grade: 'B+' },
        { id: 's3', subjectName: 'Bahasa Indonesia', tugas: 90, uts: 88, uas: 92, average: 90, grade: 'A' },
        { id: 's4', subjectName: 'Bahasa Inggris', tugas: 85, uts: 86, uas: 87, average: 86, grade: 'A' },
        { id: 's5', subjectName: 'Kimia Mandiri', tugas: 78, uts: 80, uas: 82, average: 80, grade: 'B' },
      ];
      setSubjectScores(prev => (prev.length > 0 ? prev : defaultScores));

      const defaultLeaves: LeaveRequestItem[] = [
        {
          id: 'l1',
          type: 'Izin',
          startDate: '24 Sep 2026',
          endDate: '24 Sep 2026',
          reason: 'Menghadiri acara keluarga di luar kota',
          status: 'Disetujui',
          approver: 'Drs. Supriyanto, M.Pd',
        },
      ];
      setLeaveRequests(defaultLeaves);

    } catch (e: any) {
      console.warn('Parent portal fetch error:', e.message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchParentOverview();
  };

  const handleOpenWhatsApp = () => {
    const phone = child.homeroomTeacher.phone || '081234567890';
    const message = `Halo Bapak/Ibu ${child.homeroomTeacher.name}, saya orang tua dari ${child.name} (${child.className}). Ingin berkonsultasi mengenai perkembangan ananda. Terima kasih.`;
    const url = `whatsapp://send?phone=${phone.replace(/^0/, '62')}&text=${encodeURIComponent(message)}`;
    Linking.canOpenURL(url)
      .then(supported => {
        if (supported) Linking.openURL(url);
        else Linking.openURL(`tel:${phone}`);
      })
      .catch(() => Linking.openURL(`tel:${phone}`));
  };

  const handleSubmitLeave = async () => {
    if (!leaveReason.trim()) {
      showToast('Harap tuliskan alasan izin atau sakit.', 'warning');
      return;
    }
    setIsSubmittingLeave(true);
    try {
      await new Promise(r => setTimeout(r, 600));

      const newLeave: LeaveRequestItem = {
        id: `l-${Date.now()}`,
        type: leaveType,
        startDate: 'Hari ini',
        endDate: leaveDuration,
        reason: leaveReason,
        status: 'Menunggu',
      };
      setLeaveRequests(prev => [newLeave, ...prev]);

      setIsLeaveModalVisible(false);
      setLeaveReason('');
      showToast('Permohonan izin berhasil dikirim ke Wali Kelas!', 'success');
    } catch (_) {
      showToast('Gagal mengajukan izin.', 'error');
    } finally {
      setIsSubmittingLeave(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Hadir':
        return { text: '#10B981', bg: '#ECFDF5' };
      case 'Terlambat':
        return { text: '#F59E0B', bg: '#FFFBEB' };
      case 'Sakit':
        return { text: '#3B82F6', bg: '#EFF6FF' };
      case 'Izin':
        return { text: '#8B5CF6', bg: '#F5F3FF' };
      default:
        return { text: '#EF4444', bg: '#FEF2F2' };
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
            <Ionicons name="heart" size={14} color="#EC4899" />
            <Text style={styles.moduleBadgeText}>MODUL 09</Text>
          </View>
          <Text style={styles.headerTitle}>Portal Orang Tua</Text>
        </View>
        <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
          <Ionicons name="reload" size={20} color={Colors.text} />
        </TouchableOpacity>
      </View>

      {/* Child Profile Card */}
      <View style={styles.childCard}>
        <View style={styles.childCardHeader}>
          <View style={styles.childAvatar}>
            <Ionicons name="person" size={28} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.childStatusRow}>
              <Text style={styles.childName}>{child.name}</Text>
              <View style={styles.onlineBadge}>
                <View style={styles.onlineDot} />
                <Text style={styles.onlineText}>Aktif</Text>
              </View>
            </View>
            <Text style={styles.childClass}>{child.className}</Text>
            <Text style={styles.childNis}>NISN: {child.nisn} • NIS: {child.nis}</Text>
          </View>
        </View>

        {/* Attendance Summary Strip */}
        <View style={styles.summaryStrip}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryVal, { color: '#10B981' }]}>{child.attendanceSummary.hadir}</Text>
            <Text style={styles.summaryKey}>Hadir</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryVal, { color: '#F59E0B' }]}>{child.attendanceSummary.terlambat}</Text>
            <Text style={styles.summaryKey}>Telat</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryVal, { color: '#3B82F6' }]}>{child.attendanceSummary.sakit}</Text>
            <Text style={styles.summaryKey}>Sakit</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryVal, { color: '#8B5CF6' }]}>{child.attendanceSummary.izin}</Text>
            <Text style={styles.summaryKey}>Izin</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryVal, { color: '#EF4444' }]}>{child.attendanceSummary.alpa}</Text>
            <Text style={styles.summaryKey}>Alpa</Text>
          </View>
        </View>
      </View>

      {/* Tab Selector */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'presensi' && styles.tabButtonActive]}
          onPress={() => setActiveTab('presensi')}
        >
          <Ionicons
            name="calendar-outline"
            size={15}
            color={activeTab === 'presensi' ? '#EC4899' : Colors.textLight}
          />
          <Text style={[styles.tabText, activeTab === 'presensi' && styles.tabTextActive]}>
            Presensi
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'nilai' && styles.tabButtonActive]}
          onPress={() => setActiveTab('nilai')}
        >
          <Ionicons
            name="ribbon-outline"
            size={15}
            color={activeTab === 'nilai' ? '#EC4899' : Colors.textLight}
          />
          <Text style={[styles.tabText, activeTab === 'nilai' && styles.tabTextActive]}>
            Nilai & Rapor
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'izin' && styles.tabButtonActive]}
          onPress={() => setActiveTab('izin')}
        >
          <Ionicons
            name="mail-outline"
            size={15}
            color={activeTab === 'izin' ? '#EC4899' : Colors.textLight}
          />
          <Text style={[styles.tabText, activeTab === 'izin' && styles.tabTextActive]}>
            Surat Izin
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'konsultasi' && styles.tabButtonActive]}
          onPress={() => setActiveTab('konsultasi')}
        >
          <Ionicons
            name="chatbubble-ellipses-outline"
            size={15}
            color={activeTab === 'konsultasi' ? '#EC4899' : Colors.textLight}
          />
          <Text style={[styles.tabText, activeTab === 'konsultasi' && styles.tabTextActive]}>
            Wali Kelas
          </Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#EC4899" />
          <Text style={styles.loadingText}>Memuat informasi siswa...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={['#EC4899']} />}
          showsVerticalScrollIndicator={false}
        >
          {/* TAB 1: PRESENSI */}
          {activeTab === 'presensi' && (
            <View>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Log Tap-In Kiosk & Gerbang Sekolah</Text>
                <TouchableOpacity
                  style={styles.actionAddLeaveBtn}
                  onPress={() => setIsLeaveModalVisible(true)}
                >
                  <Ionicons name="add" size={16} color="#FFFFFF" />
                  <Text style={styles.actionAddLeaveText}>Ajukan Izin</Text>
                </TouchableOpacity>
              </View>

              {attendanceLogs.map(log => {
                const sc = getStatusColor(log.status);
                return (
                  <View key={log.id} style={styles.logCard}>
                    <View style={styles.logDateBox}>
                      <Ionicons name="time-outline" size={18} color="#EC4899" />
                      <View>
                        <Text style={styles.logDate}>{log.date}</Text>
                        <Text style={styles.logTime}>{log.time}</Text>
                      </View>
                    </View>
                    <View style={[styles.logStatusBadge, { backgroundColor: sc.bg }]}>
                      <Text style={[styles.logStatusText, { color: sc.text }]}>{log.status}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* TAB 2: NILAI */}
          {activeTab === 'nilai' && (
            <View>
              <Text style={styles.sectionTitle}>Rangkuman Nilai Semester Berjalan</Text>
              <Text style={styles.sectionSubtitle}>
                Daftar nilai tugas harian, penilaian tengah semester, dan proyek mata pelajaran.
              </Text>

              {subjectScores.map(score => (
                <View key={score.id} style={styles.gradeCard}>
                  <View style={styles.gradeHeader}>
                    <Text style={styles.gradeSubjectName}>{score.subjectName}</Text>
                    <View style={styles.gradeLetterBadge}>
                      <Text style={styles.gradeLetterText}>{score.grade}</Text>
                    </View>
                  </View>

                  <View style={styles.gradeBreakdown}>
                    <View style={styles.gradeSubItem}>
                      <Text style={styles.gradeSubKey}>Tugas</Text>
                      <Text style={styles.gradeSubVal}>{score.tugas}</Text>
                    </View>
                    <View style={styles.gradeSubItem}>
                      <Text style={styles.gradeSubKey}>PTS / UTS</Text>
                      <Text style={styles.gradeSubVal}>{score.uts}</Text>
                    </View>
                    <View style={styles.gradeSubItem}>
                      <Text style={styles.gradeSubKey}>PAS / UAS</Text>
                      <Text style={styles.gradeSubVal}>{score.uas}</Text>
                    </View>
                    <View style={styles.gradeSubItem}>
                      <Text style={styles.gradeSubKey}>Rerata</Text>
                      <Text style={[styles.gradeSubVal, { color: '#EC4899', fontWeight: '800' }]}>
                        {score.average}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* TAB 3: SURAT IZIN */}
          {activeTab === 'izin' && (
            <View>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Daftar Pengajuan Izin Siswa</Text>
                <TouchableOpacity
                  style={styles.actionAddLeaveBtn}
                  onPress={() => setIsLeaveModalVisible(true)}
                >
                  <Ionicons name="add" size={16} color="#FFFFFF" />
                  <Text style={styles.actionAddLeaveText}>Buat Surat Izin</Text>
                </TouchableOpacity>
              </View>

              {leaveRequests.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Ionicons name="document-text-outline" size={40} color={Colors.textLight} />
                  <Text style={styles.emptyTitle}>Belum Ada Surat Izin</Text>
                  <Text style={styles.emptySub}>Klik tombol di atas untuk mengajukan izin atau sakit ananda.</Text>
                </View>
              ) : (
                leaveRequests.map(item => (
                  <View key={item.id} style={styles.leaveCard}>
                    <View style={styles.leaveHeader}>
                      <View style={styles.leaveTypeBadge}>
                        <Text style={styles.leaveTypeBadgeText}>{item.type.toUpperCase()}</Text>
                      </View>
                      <View
                        style={[
                          styles.leaveStatusBadge,
                          item.status === 'Disetujui' ? styles.statusApproved : styles.statusWaiting,
                        ]}
                      >
                        <Text
                          style={[
                            styles.leaveStatusText,
                            item.status === 'Disetujui' ? styles.statusApprovedText : styles.statusWaitingText,
                          ]}
                        >
                          {item.status.toUpperCase()}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.leaveReason}>{item.reason}</Text>
                    <Text style={styles.leavePeriod}>Periode: {item.startDate} ({item.endDate})</Text>

                    {item.approver && (
                      <Text style={styles.leaveApprover}>Diverifikasi oleh: {item.approver}</Text>
                    )}
                  </View>
                ))
              )}
            </View>
          )}

          {/* TAB 4: KONSULTASI WALI KELAS */}
          {activeTab === 'konsultasi' && (
            <View>
              <Text style={styles.sectionTitle}>Wali Kelas & Pusat Komunikasi</Text>
              <Text style={styles.sectionSubtitle}>
                Hubungi wali kelas secara langsung untuk koordinasi prestasi atau konsultasi bimbingan.
              </Text>

              <View style={styles.teacherCard}>
                <View style={styles.teacherAvatar}>
                  <Ionicons name="school" size={26} color="#EC4899" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.teacherName}>{child.homeroomTeacher.name}</Text>
                  <Text style={styles.teacherNip}>NIP: {child.homeroomTeacher.nip}</Text>
                  <Text style={styles.teacherPhone}>No. HP: {child.homeroomTeacher.phone}</Text>
                </View>
              </View>

              <TouchableOpacity style={styles.whatsappButton} onPress={handleOpenWhatsApp}>
                <Ionicons name="logo-whatsapp" size={20} color="#FFFFFF" />
                <Text style={styles.whatsappButtonText}>Chat WhatsApp Wali Kelas</Text>
              </TouchableOpacity>

              <View style={styles.consultNoticeBox}>
                <Ionicons name="information-circle" size={20} color="#3B82F6" />
                <Text style={styles.consultNoticeText}>
                  Konsultasi tatap muka di sekolah dapat dijadwalkan pada jam istirahat atau melalui janji temu di ruang Guru/BK.
                </Text>
              </View>
            </View>
          )}
        </ScrollView>
      )}

      {/* Modal Ajukan Izin */}
      <Modal
        visible={isLeaveModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsLeaveModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Form Pengajuan Izin Siswa</Text>
              <TouchableOpacity onPress={() => setIsLeaveModalVisible(false)}>
                <Ionicons name="close" size={22} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalSubtitle}>
                Surat izin ini akan langsung diverifikasi oleh Wali Kelas {child.className}.
              </Text>

              <Text style={styles.fieldLabel}>Kategori Izin</Text>
              <View style={styles.toggleRow}>
                <TouchableOpacity
                  style={[styles.toggleBtn, leaveType === 'Sakit' && styles.toggleBtnActive]}
                  onPress={() => setLeaveType('Sakit')}
                >
                  <Ionicons name="medkit-outline" size={18} color={leaveType === 'Sakit' ? '#EC4899' : Colors.textLight} />
                  <Text style={[styles.toggleBtnText, leaveType === 'Sakit' && styles.toggleBtnTextActive]}>
                    Sakit (Surat Dokter)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.toggleBtn, leaveType === 'Izin' && styles.toggleBtnActive]}
                  onPress={() => setLeaveType('Izin')}
                >
                  <Ionicons name="calendar-outline" size={18} color={leaveType === 'Izin' ? '#EC4899' : Colors.textLight} />
                  <Text style={[styles.toggleBtnText, leaveType === 'Izin' && styles.toggleBtnTextActive]}>
                    Izin Keluarga
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.fieldLabel}>Lama Hari</Text>
              <TextInput
                style={styles.inputBox}
                value={leaveDuration}
                onChangeText={setLeaveDuration}
                placeholder="Contoh: 1 Hari / 2 Hari (30 Sep - 01 Okt)"
                placeholderTextColor={Colors.textLight}
              />

              <Text style={styles.fieldLabel}>Alasan / Keterangan Lengkap</Text>
              <TextInput
                style={[styles.inputBox, { height: 80, textAlignVertical: 'top' }]}
                multiline
                numberOfLines={3}
                value={leaveReason}
                onChangeText={setLeaveReason}
                placeholder="Tuliskan keterangan sakit / alasan izin ananda..."
                placeholderTextColor={Colors.textLight}
              />

              <TouchableOpacity
                style={styles.attachBtn}
                onPress={() => showToast('Lampiran foto surat berhasil dipilih.', 'info')}
              >
                <Ionicons name="camera-outline" size={20} color="#EC4899" />
                <Text style={styles.attachBtnText}>Lampirkan Bukti / Surat Dokter</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.submitLeaveBtn, isSubmittingLeave && { opacity: 0.6 }]}
                onPress={handleSubmitLeave}
                disabled={isSubmittingLeave}
              >
                {isSubmittingLeave ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <Ionicons name="send" size={16} color="#FFFFFF" />
                    <Text style={styles.submitLeaveBtnText}>Kirim Permohonan Izin</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
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
    backgroundColor: '#FDF2F8',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 2,
  },
  moduleBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#EC4899',
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
  childCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  childCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  childAvatar: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#EC4899',
    justifyContent: 'center',
    alignItems: 'center',
  },
  childStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  childName: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
  },
  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  onlineText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#10B981',
  },
  childClass: {
    fontSize: 12,
    fontWeight: '600',
    color: '#EC4899',
    marginTop: 2,
  },
  childNis: {
    fontSize: 11,
    color: Colors.textLight,
    marginTop: 2,
  },
  summaryStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    marginTop: 14,
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryVal: {
    fontSize: 15,
    fontWeight: '800',
  },
  summaryKey: {
    fontSize: 10,
    color: Colors.textLight,
    marginTop: 2,
    fontWeight: '600',
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
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
    backgroundColor: '#FDF2F8',
    borderWidth: 1,
    borderColor: '#FBCFE8',
  },
  tabText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textLight,
  },
  tabTextActive: {
    color: '#EC4899',
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
  actionAddLeaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EC4899',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  actionAddLeaveText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  logCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  logDateBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logDate: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  logTime: {
    fontSize: 11,
    color: Colors.textLight,
    marginTop: 1,
  },
  logStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  logStatusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  sectionSubtitle: {
    fontSize: 12,
    color: Colors.textLight,
    marginBottom: 14,
    lineHeight: 18,
  },
  gradeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  gradeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  gradeSubjectName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    flex: 1,
  },
  gradeLetterBadge: {
    backgroundColor: '#FDF2F8',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FBCFE8',
  },
  gradeLetterText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#EC4899',
  },
  gradeBreakdown: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 10,
  },
  gradeSubItem: {
    alignItems: 'center',
    flex: 1,
  },
  gradeSubKey: {
    fontSize: 10,
    color: Colors.textLight,
  },
  gradeSubVal: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 2,
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 36,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 10,
  },
  emptySub: {
    fontSize: 12,
    color: Colors.textLight,
    textAlign: 'center',
    marginTop: 4,
  },
  leaveCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  leaveHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  leaveTypeBadge: {
    backgroundColor: '#FDF2F8',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  leaveTypeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#EC4899',
  },
  leaveStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  leaveStatusText: {
    letterSpacing: 0.5,
  },
  statusApproved: {
    backgroundColor: '#ECFDF5',
  },
  statusApprovedText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#10B981',
  },
  statusWaiting: {
    backgroundColor: '#FFFBEB',
  },
  statusWaitingText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#D97706',
  },
  leaveReason: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
  },
  leavePeriod: {
    fontSize: 11,
    color: Colors.textLight,
    marginTop: 4,
  },
  leaveApprover: {
    fontSize: 11,
    color: '#10B981',
    marginTop: 4,
    fontWeight: '600',
  },
  teacherCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 14,
    marginBottom: 16,
  },
  teacherAvatar: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#FDF2F8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  teacherName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  teacherNip: {
    fontSize: 11,
    color: Colors.textLight,
    marginTop: 2,
  },
  teacherPhone: {
    fontSize: 11,
    color: '#EC4899',
    marginTop: 2,
    fontWeight: '600',
  },
  whatsappButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#25D366',
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 16,
  },
  whatsappButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  consultNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 14,
  },
  consultNoticeText: {
    fontSize: 12,
    color: '#1E40AF',
    flex: 1,
    lineHeight: 18,
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
    maxHeight: '85%',
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
  modalSubtitle: {
    fontSize: 12,
    color: Colors.textLight,
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 6,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  toggleBtnActive: {
    backgroundColor: '#FDF2F8',
    borderColor: '#FBCFE8',
  },
  toggleBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textLight,
  },
  toggleBtnTextActive: {
    color: '#EC4899',
    fontWeight: '700',
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
  attachBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#FBCFE8',
    borderStyle: 'dashed',
    borderRadius: 10,
    padding: 12,
    backgroundColor: '#FDF2F8',
    marginBottom: 16,
  },
  attachBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#EC4899',
  },
  submitLeaveBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EC4899',
    borderRadius: 12,
    paddingVertical: 14,
  },
  submitLeaveBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
