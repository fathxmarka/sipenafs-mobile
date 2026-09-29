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

type TabType = 'tugas' | 'materi' | 'kuis';

interface AssignmentItem {
  id: string;
  title: string;
  subjectName: string;
  teacherName: string;
  deadline: string;
  description: string;
  totalSubmissions?: number;
  myStatus: 'submitted' | 'pending' | 'graded';
  score?: number;
}

interface MaterialItem {
  id: string;
  title: string;
  subjectName: string;
  teacherName: string;
  type: 'PDF' | 'VIDEO' | 'SLIDE' | 'DOC';
  size: string;
  uploadDate: string;
  description: string;
}

interface ExamItem {
  id: string;
  title: string;
  subjectName: string;
  durationMinutes: number;
  totalQuestions: number;
  startTime: string;
  status: 'upcoming' | 'ongoing' | 'completed';
  score?: number;
}

export default function ElearningModuleScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<TabType>('tugas');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Selected item modals
  const [selectedAssignment, setSelectedAssignment] = useState<AssignmentItem | null>(null);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [submissionText, setSubmissionText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [selectedExam, setSelectedExam] = useState<ExamItem | null>(null);

  // Toast
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: ToastType }>({
    visible: false,
    message: '',
    type: 'info',
  });

  const showToast = (message: string, type: ToastType = 'info') => {
    setToast({ visible: true, message, type });
  };

  // State lists
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [exams, setExams] = useState<ExamItem[]>([]);

  useEffect(() => {
    fetchElearningData();
  }, []);

  const fetchElearningData = async () => {
    try {
      const apiUrl = await SecureStore.getItemAsync('sipena_api_url');
      const token = await SecureStore.getItemAsync('sipena_token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      if (apiUrl && token) {
        try {
          const [resExams] = await Promise.allSettled([
            axios.get(`${apiUrl}/api/exams`, { headers }),
          ]);

          if (resExams.status === 'fulfilled' && resExams.value.data?.data) {
            const apiExams = resExams.value.data.data.map((e: any) => ({
              id: e.id?.toString() || Math.random().toString(),
              title: e.title || 'Ujian Penilaian Harian',
              subjectName: e.subject?.name || 'Mata Pelajaran',
              durationMinutes: Number(e.duration || 60),
              totalQuestions: Number(e.question_count || 30),
              startTime: e.start_time || 'Hari ini, 08:00 WIB',
              status: e.status || 'upcoming',
              score: e.score !== undefined ? Number(e.score) : undefined,
            }));
            setExams(apiExams);
          }
        } catch (_) {}
      }

      // Default high-fidelity LMS data
      const defaultAssignments: AssignmentItem[] = [
        {
          id: 'a1',
          title: 'Analisis Gelombang Elektromagnetik & Optik',
          subjectName: 'Fisika Peminatan',
          teacherName: 'Dr. Hendra Gunawan, M.Si',
          deadline: 'Besok, 23:59 WIB',
          description: 'Selesaikan 5 studi kasus aplikasi gelombang mikro pada telekomunikasi dan sertakan rumusan penurunan frekuensi.',
          totalSubmissions: 28,
          myStatus: 'pending',
        },
        {
          id: 'a2',
          title: 'Resensi Novel Sastra Periode Balai Pustaka',
          subjectName: 'Bahasa Indonesia',
          teacherName: 'Ibu Ratna Dewi, M.Pd',
          deadline: '03 Okt 2026, 17:00 WIB',
          description: 'Buat resensi minimal 500 kata dengan menganalisis unsur intrinsik, ekstrinsik, dan amanat moral.',
          totalSubmissions: 34,
          myStatus: 'submitted',
          score: 88,
        },
        {
          id: 'a3',
          title: 'Integral Parsial dan Terapan Luas Bidang',
          subjectName: 'Matematika Tingkat Lanjut',
          teacherName: 'Bambang Kusuma, S.Pd',
          deadline: '05 Okt 2026, 12:00 WIB',
          description: 'Kerjakan LKS Mandiri halaman 45-48 nomor 1 sampai 10 lengkap beserta grafik kurva perpotongan.',
          totalSubmissions: 15,
          myStatus: 'pending',
        },
      ];
      setAssignments(defaultAssignments);

      const defaultMaterials: MaterialItem[] = [
        {
          id: 'm1',
          title: 'Modul Bab 4: Stoikiometri Larutan & Redoks',
          subjectName: 'Kimia Mandiri',
          teacherName: 'Siti Nurhaliza, S.Si',
          type: 'PDF',
          size: '3.4 MB',
          uploadDate: '28 Sep 2026',
          description: 'Ringkasan materi rumus molaritas, penentuan zat pereaksi pembatas, serta latihan soal UTBK.',
        },
        {
          id: 'm2',
          title: 'Video Pembelajaran: Dynamic Routing OSPF & BGP',
          subjectName: 'Teknik Komputer & Jaringan',
          teacherName: 'Arya Wibowo, S.Kom',
          type: 'VIDEO',
          size: '48.2 MB',
          uploadDate: '26 Sep 2026',
          description: 'Tutorial konfigurasi router Cisco menggunakan Packet Tracer untuk simulasi jaringan enterprise.',
        },
        {
          id: 'm3',
          title: 'Slide Presentasi: Kebijakan Moneter & Inflasi',
          subjectName: 'Ekonomi Terapan',
          teacherName: 'Sri Mulyani, M.E',
          type: 'SLIDE',
          size: '5.1 MB',
          uploadDate: '24 Sep 2026',
          description: 'Bahan tayang pertemuan ke-5 tentang instrumen Bank Sentral dalam menjaga kestabilan rupiah.',
        },
      ];
      setMaterials(defaultMaterials);

      const defaultExams: ExamItem[] = [
        {
          id: 'e1',
          title: 'Penilaian Tengah Semester (PTS) Ganjil CBT',
          subjectName: 'Bahasa Inggris Lanjutan',
          durationMinutes: 90,
          totalQuestions: 40,
          startTime: '02 Okt 2026, 08:00 WIB',
          status: 'upcoming',
        },
        {
          id: 'e2',
          title: 'Kuis Harian Logika Algoritma & Struktur Data',
          subjectName: 'Informatika',
          durationMinutes: 45,
          totalQuestions: 25,
          startTime: 'Hari ini, 13:00 WIB',
          status: 'ongoing',
        },
        {
          id: 'e3',
          title: 'Tryout Asesmen Nasional Berbasis Komputer (ANBK)',
          subjectName: 'Literasi & Numerasi',
          durationMinutes: 120,
          totalQuestions: 50,
          startTime: '25 Sep 2026',
          status: 'completed',
          score: 92,
        },
      ];
      setExams(prev => (prev.length > 0 ? prev : defaultExams));

    } catch (e: any) {
      console.warn('LMS fetch error:', e.message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchElearningData();
  };

  const handleSubmitTask = (task: AssignmentItem) => {
    setSelectedAssignment(task);
    setSubmissionText('');
    setIsSubmitModalOpen(true);
  };

  const handleConfirmSubmit = async () => {
    if (!submissionText.trim()) {
      showToast('Tuliskan link atau ringkasan tugas sebelum mengirim.', 'warning');
      return;
    }
    setIsSubmitting(true);
    try {
      await new Promise(r => setTimeout(r, 600));

      setAssignments(prev =>
        prev.map(a =>
          a.id === selectedAssignment?.id
            ? { ...a, myStatus: 'submitted', totalSubmissions: (a.totalSubmissions || 0) + 1 }
            : a
        )
      );

      setIsSubmitModalOpen(false);
      showToast('Tugas berhasil dikumpulkan ke portal guru!', 'success');
    } catch (_) {
      showToast('Gagal mengirimkan tugas.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'PDF':
        return { name: 'document-text' as const, color: '#EF4444', bg: '#FEF2F2' };
      case 'VIDEO':
        return { name: 'videocam' as const, color: '#3B82F6', bg: '#EFF6FF' };
      case 'SLIDE':
        return { name: 'easel' as const, color: '#F59E0B', bg: '#FFFBEB' };
      default:
        return { name: 'folder' as const, color: '#6366F1', bg: '#EEF2FF' };
    }
  };

  const filteredAssignments = assignments.filter(a =>
    a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.subjectName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.moduleBadge}>
            <Ionicons name="book" size={14} color="#6366F1" />
            <Text style={styles.moduleBadgeText}>MODUL 08</Text>
          </View>
          <Text style={styles.headerTitle}>E-Learning & LMS</Text>
        </View>
        <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
          <Ionicons name="reload" size={20} color={Colors.text} />
        </TouchableOpacity>
      </View>

      {/* KPI Cards */}
      <View style={styles.kpiContainer}>
        <View style={[styles.kpiCard, { backgroundColor: '#EEF2FF' }]}>
          <View style={styles.kpiIconWrapper}>
            <Ionicons name="pencil" size={18} color="#6366F1" />
          </View>
          <Text style={styles.kpiValue}>
            {assignments.filter(a => a.myStatus === 'pending').length} Tugas
          </Text>
          <Text style={styles.kpiLabel}>Perlu Diselesaikan</Text>
        </View>
        <View style={[styles.kpiCard, { backgroundColor: '#F0FDF4' }]}>
          <View style={[styles.kpiIconWrapper, { backgroundColor: '#DCFCE7' }]}>
            <Ionicons name="layers" size={18} color="#16A34A" />
          </View>
          <Text style={styles.kpiValue}>{materials.length} Bahan</Text>
          <Text style={styles.kpiLabel}>Materi Tersedia</Text>
        </View>
      </View>

      {/* Tab Selectors */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'tugas' && styles.tabButtonActive]}
          onPress={() => setActiveTab('tugas')}
        >
          <Ionicons
            name="clipboard-outline"
            size={16}
            color={activeTab === 'tugas' ? '#6366F1' : Colors.textLight}
          />
          <Text style={[styles.tabText, activeTab === 'tugas' && styles.tabTextActive]}>
            Tugas & PR
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'materi' && styles.tabButtonActive]}
          onPress={() => setActiveTab('materi')}
        >
          <Ionicons
            name="library-outline"
            size={16}
            color={activeTab === 'materi' ? '#6366F1' : Colors.textLight}
          />
          <Text style={[styles.tabText, activeTab === 'materi' && styles.tabTextActive]}>
            Bahan Ajar
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'kuis' && styles.tabButtonActive]}
          onPress={() => setActiveTab('kuis')}
        >
          <Ionicons
            name="laptop-outline"
            size={16}
            color={activeTab === 'kuis' ? '#6366F1' : Colors.textLight}
          />
          <Text style={[styles.tabText, activeTab === 'kuis' && styles.tabTextActive]}>
            Kuis & CBT
          </Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.loadingText}>Memuat konten e-learning...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={['#6366F1']} />}
          showsVerticalScrollIndicator={false}
        >
          {/* TAB 1: TUGAS & PR */}
          {activeTab === 'tugas' && (
            <View>
              {/* Search */}
              <View style={styles.searchBox}>
                <Ionicons name="search" size={18} color={Colors.textLight} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Cari tugas mata pelajaran..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholderTextColor={Colors.textLight}
                />
              </View>

              {filteredAssignments.map(task => (
                <View key={task.id} style={styles.taskCard}>
                  <View style={styles.taskCardHeader}>
                    <View style={styles.subjectBadge}>
                      <Ionicons name="school" size={12} color="#6366F1" />
                      <Text style={styles.subjectBadgeText}>{task.subjectName}</Text>
                    </View>
                    <View
                      style={[
                        styles.taskStatusTag,
                        task.myStatus === 'submitted'
                          ? styles.statusSubmitted
                          : styles.statusPending,
                      ]}
                    >
                      <Text
                        style={[
                          styles.taskStatusText,
                          task.myStatus === 'submitted'
                            ? styles.statusSubmittedText
                            : styles.statusPendingText,
                        ]}
                      >
                        {task.myStatus === 'submitted' ? 'SUDAH KUMPUL' : 'BELUM KUMPUL'}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.taskTitle}>{task.title}</Text>
                  <Text style={styles.taskTeacher}>Guru: {task.teacherName}</Text>
                  <Text style={styles.taskDesc}>{task.description}</Text>

                  <View style={styles.taskDivider} />

                  <View style={styles.taskFooter}>
                    <View>
                      <Text style={styles.deadlinelabel}>Batas Waktu Pengumpulan:</Text>
                      <Text style={styles.deadlineValue}>{task.deadline}</Text>
                    </View>

                    {task.myStatus === 'pending' ? (
                      <TouchableOpacity
                        style={styles.submitTaskBtn}
                        onPress={() => handleSubmitTask(task)}
                      >
                        <Ionicons name="cloud-upload-outline" size={16} color="#FFFFFF" />
                        <Text style={styles.submitTaskBtnText}>Kumpul Tugas</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.scoreBadge}>
                        <Ionicons name="ribbon-outline" size={16} color="#16A34A" />
                        <Text style={styles.scoreText}>
                          {task.score !== undefined ? `Nilai: ${task.score}/100` : 'Menunggu Nilai'}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* TAB 2: BAHAN AJAR */}
          {activeTab === 'materi' && (
            <View>
              <Text style={styles.sectionTitle}>Modul Pembelajaran & Dokumen Kelas</Text>
              <Text style={styles.sectionSubtitle}>
                Unduh dan pelajari materi ajar yang dibagikan guru kelas secara daring.
              </Text>

              {materials.map(mat => {
                const iconInfo = getFileIcon(mat.type);
                return (
                  <View key={mat.id} style={styles.materialCard}>
                    <View style={[styles.fileIconWrapper, { backgroundColor: iconInfo.bg }]}>
                      <Ionicons name={iconInfo.name} size={24} color={iconInfo.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.materialTitle}>{mat.title}</Text>
                      <Text style={styles.materialMeta}>
                        {mat.subjectName} • {mat.teacherName}
                      </Text>
                      <Text style={styles.materialDesc}>{mat.description}</Text>
                      <View style={styles.materialFooterRow}>
                        <Text style={styles.fileSizeText}>{mat.size} • {mat.uploadDate}</Text>
                        <TouchableOpacity
                          style={styles.downloadBtn}
                          onPress={() => showToast(`Mengunduh materi ${mat.title}...`, 'info')}
                        >
                          <Ionicons name="download-outline" size={14} color="#6366F1" />
                          <Text style={styles.downloadBtnText}>Unduh File</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* TAB 3: KUIS & CBT */}
          {activeTab === 'kuis' && (
            <View>
              <Text style={styles.sectionTitle}>Jadwal Asesmen & Ujian Berbasis Komputer</Text>
              <Text style={styles.sectionSubtitle}>
                Ikuti ujian berkala secara online sesuai jadwal dan batas waktu pengerjaan.
              </Text>

              {exams.map(exam => (
                <View key={exam.id} style={styles.examCard}>
                  <View style={styles.examCardTop}>
                    <View style={styles.examBadge}>
                      <Ionicons name="time" size={12} color="#F59E0B" />
                      <Text style={styles.examBadgeText}>{exam.durationMinutes} Menit</Text>
                    </View>
                    <View
                      style={[
                        styles.examStatusBadge,
                        exam.status === 'ongoing' ? styles.statusOngoing : styles.statusUpcoming,
                      ]}
                    >
                      <Text
                        style={[
                          styles.examStatusText,
                          exam.status === 'ongoing' ? styles.statusOngoingText : styles.statusUpcomingText,
                        ]}
                      >
                        {exam.status === 'ongoing' ? 'SEDANG AKTIF' : exam.status === 'completed' ? 'SELESAI' : 'TERJADWAL'}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.examTitle}>{exam.title}</Text>
                  <Text style={styles.examSubject}>Mata Pelajaran: {exam.subjectName}</Text>

                  <View style={styles.examInfoGrid}>
                    <View style={styles.examInfoItem}>
                      <Ionicons name="help-circle-outline" size={16} color={Colors.textLight} />
                      <Text style={styles.examInfoText}>{exam.totalQuestions} Butir Soal</Text>
                    </View>
                    <View style={styles.examInfoItem}>
                      <Ionicons name="calendar-outline" size={16} color={Colors.textLight} />
                      <Text style={styles.examInfoText}>{exam.startTime}</Text>
                    </View>
                  </View>

                  <View style={styles.examDivider} />

                  <View style={styles.examFooter}>
                    {exam.status === 'completed' ? (
                      <View style={styles.examResultBox}>
                        <Text style={styles.examResultLabel}>Hasil Ujian:</Text>
                        <Text style={styles.examResultScore}>{exam.score || 85} / 100</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={[
                          styles.startExamBtn,
                          exam.status === 'upcoming' && { backgroundColor: '#4F46E5' },
                        ]}
                        onPress={() =>
                          showToast(`Memulai sesi ujian ${exam.title}. Pastikan koneksi stabil.`, 'info')
                        }
                      >
                        <Ionicons name="play" size={16} color="#FFFFFF" />
                        <Text style={styles.startExamBtnText}>
                          {exam.status === 'ongoing' ? 'Lanjutkan Ujian' : 'Masuk Ruang Ujian'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {/* Modal Kumpul Tugas */}
      <Modal
        visible={isSubmitModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsSubmitModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Kumpulkan Lembar Jawaban Tugas</Text>
              <TouchableOpacity onPress={() => setIsSubmitModalOpen(false)}>
                <Ionicons name="close" size={22} color={Colors.text} />
              </TouchableOpacity>
            </View>

            {selectedAssignment && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.taskBriefBox}>
                  <Text style={styles.taskBriefTitle}>{selectedAssignment.title}</Text>
                  <Text style={styles.taskBriefSubject}>{selectedAssignment.subjectName}</Text>
                  <Text style={styles.taskBriefDeadline}>Batas: {selectedAssignment.deadline}</Text>
                </View>

                <Text style={styles.fieldLabel}>Tautan Dokumen / Google Drive / Ringkasan:</Text>
                <TextInput
                  style={styles.textInputArea}
                  multiline
                  numberOfLines={4}
                  placeholder="Ketikkan jawaban atau tempelkan link Google Drive / PDF tugas Anda di sini..."
                  value={submissionText}
                  onChangeText={setSubmissionText}
                  placeholderTextColor={Colors.textLight}
                />

                <TouchableOpacity
                  style={styles.attachmentButton}
                  onPress={() => showToast('File dokumen dipilih dari perangkat.', 'info')}
                >
                  <Ionicons name="attach" size={20} color="#6366F1" />
                  <Text style={styles.attachmentButtonText}>Pilih File dari HP (PDF / Gambar)</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.confirmSubmitBtn, isSubmitting && { opacity: 0.6 }]}
                  onPress={handleConfirmSubmit}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                      <Text style={styles.confirmSubmitBtnText}>Kirimkan Tugas Sekarang</Text>
                    </>
                  )}
                </TouchableOpacity>
              </ScrollView>
            )}
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
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 2,
  },
  moduleBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6366F1',
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
    backgroundColor: '#E0E7FF',
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
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textLight,
  },
  tabTextActive: {
    color: '#6366F1',
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
  taskCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  taskCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  subjectBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  subjectBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6366F1',
  },
  taskStatusTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusSubmitted: {
    backgroundColor: '#ECFDF5',
  },
  statusSubmittedText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#10B981',
  },
  statusPending: {
    backgroundColor: '#FFFBEB',
  },
  statusPendingText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#D97706',
  },
  taskStatusText: {
    letterSpacing: 0.5,
  },
  taskTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  taskTeacher: {
    fontSize: 12,
    color: Colors.textLight,
    marginTop: 2,
  },
  taskDesc: {
    fontSize: 12,
    color: '#4B5563',
    marginTop: 6,
    lineHeight: 18,
  },
  taskDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 12,
  },
  taskFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deadlinelabel: {
    fontSize: 10,
    color: Colors.textLight,
  },
  deadlineValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#EF4444',
    marginTop: 2,
  },
  submitTaskBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#6366F1',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  submitTaskBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  scoreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  scoreText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#16A34A',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: Colors.textLight,
    marginBottom: 14,
    lineHeight: 18,
  },
  materialCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 12,
  },
  fileIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  materialTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  materialMeta: {
    fontSize: 11,
    color: '#6366F1',
    marginTop: 2,
    fontWeight: '600',
  },
  materialDesc: {
    fontSize: 12,
    color: Colors.textLight,
    marginTop: 4,
    lineHeight: 16,
  },
  materialFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  fileSizeText: {
    fontSize: 10,
    color: '#9CA3AF',
  },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  downloadBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6366F1',
  },
  examCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  examCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  examBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  examBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D97706',
  },
  examStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  examStatusText: {
    letterSpacing: 0.5,
  },
  statusOngoing: {
    backgroundColor: '#DCFCE7',
  },
  statusOngoingText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#16A34A',
  },
  statusUpcoming: {
    backgroundColor: '#EFF6FF',
  },
  statusUpcomingText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#3B82F6',
  },
  examTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  examSubject: {
    fontSize: 12,
    color: Colors.textLight,
    marginTop: 2,
  },
  examInfoGrid: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 10,
  },
  examInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  examInfoText: {
    fontSize: 11,
    color: Colors.textLight,
  },
  examDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 12,
  },
  examFooter: {
    alignItems: 'flex-end',
  },
  startExamBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#6366F1',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  startExamBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  examResultBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  examResultLabel: {
    fontSize: 12,
    color: Colors.textLight,
  },
  examResultScore: {
    fontSize: 16,
    fontWeight: '800',
    color: '#16A34A',
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
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  taskBriefBox: {
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  taskBriefTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  taskBriefSubject: {
    fontSize: 12,
    color: '#6366F1',
    fontWeight: '600',
    marginTop: 2,
  },
  taskBriefDeadline: {
    fontSize: 11,
    color: '#EF4444',
    marginTop: 4,
    fontWeight: '600',
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 6,
  },
  textInputArea: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 12,
    fontSize: 13,
    color: Colors.text,
    minHeight: 90,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  attachmentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    borderStyle: 'dashed',
    borderRadius: 10,
    padding: 12,
    justifyContent: 'center',
    backgroundColor: '#EEF2FF',
    marginBottom: 16,
  },
  attachmentButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6366F1',
  },
  confirmSubmitBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#6366F1',
    borderRadius: 12,
    paddingVertical: 14,
  },
  confirmSubmitBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
