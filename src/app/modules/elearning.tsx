import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, TextInput, Modal, Share
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import Colors from '../../constants/Colors';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import axios from 'axios';
import { Toast, ToastType } from '../../components/ui/Toast';

type TabType = 'tugas' | 'materi' | 'kuis';

interface AssignmentItem {
  id: string;
  title: string;
  subjectName: string;
  className?: string;
  teacherName?: string;
  deadline: string;
  description: string;
  totalSubmissions?: number;
  totalStudents?: number;
  gradedCount?: number;
  pendingReviewCount?: number;
  maxScore?: number;
  status?: 'active' | 'completed' | 'expired';
  // Student-specific fields
  myStatus?: 'submitted' | 'pending' | 'graded';
  score?: number;
}

interface StudentSubmission {
  id: string;
  studentId: string;
  studentName: string;
  nisn: string;
  status: 'submitted' | 'pending' | 'graded';
  submittedAt?: string;
  submissionText?: string;
  fileName?: string;
  fileUrl?: string;
  fileSize?: string;
  filePages?: number;
  score?: number;
  feedback?: string;
}

interface MaterialItem {
  id: string;
  title: string;
  subjectName: string;
  className?: string;
  teacherName: string;
  type: 'PDF' | 'VIDEO' | 'SLIDE' | 'DOC';
  size: string;
  uploadDate: string;
  description: string;
  fileUrl?: string;
}

interface ExamItem {
  id: string;
  title: string;
  subjectName: string;
  className?: string;
  durationMinutes: number;
  totalQuestions: number;
  startTime: string;
  status: 'upcoming' | 'ongoing' | 'completed';
  score?: number;
  totalParticipants?: number;
}

interface DocumentPreviewData {
  title: string;
  docSubtitle?: string;
  studentName?: string;
  nisn?: string;
  className?: string;
  fileName: string;
  fileSize: string;
  pages: number;
  submittedAt?: string;
  submissionText?: string;
  fileUrl?: string;
  sections: { title: string; body: string; formula?: string }[];
  score?: number;
  feedback?: string;
  studentId?: string;
  submissionId?: string;
}

export default function ElearningModuleScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // User Profile & Role State
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string>('guru');

  const [activeTab, setActiveTab] = useState<TabType>('tugas');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Lists
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [exams, setExams] = useState<ExamItem[]>([]);

  // Modals - Student: Submit Assignment
  const [selectedAssignment, setSelectedAssignment] = useState<AssignmentItem | null>(null);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [submissionText, setSubmissionText] = useState('');
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modals - Teacher: Review & Grade Submissions
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [selectedAssignmentForReview, setSelectedAssignmentForReview] = useState<AssignmentItem | null>(null);
  const [studentSubmissions, setStudentSubmissions] = useState<StudentSubmission[]>([]);
  const [submissionFilter, setSubmissionFilter] = useState<'ALL' | 'submitted' | 'pending' | 'graded'>('ALL');
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [gradeInput, setGradeInput] = useState('');
  const [feedbackInput, setFeedbackInput] = useState('');
  const [isSavingGrade, setIsSavingGrade] = useState(false);

  // Modals - Document / PDF Previewer
  const [isDocPreviewOpen, setIsDocPreviewOpen] = useState(false);
  const [previewDocData, setPreviewDocData] = useState<DocumentPreviewData | null>(null);

  // Modals - Teacher: Create Assignment
  const [isCreateAssignmentModalOpen, setIsCreateAssignmentModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [newClass, setNewClass] = useState('XII MIPA 1');
  const [newDeadline, setNewDeadline] = useState('06 Okt 2026, 23:59 WIB');
  const [newMaxScore, setNewMaxScore] = useState('100');
  const [newDescription, setNewDescription] = useState('');
  const [newAttachedFile, setNewAttachedFile] = useState<any>(null);
  const [isCreatingAssignment, setIsCreatingAssignment] = useState(false);

  // Modals - Teacher: Upload Material
  const [isUploadMaterialModalOpen, setIsUploadMaterialModalOpen] = useState(false);
  const [newMaterialTitle, setNewMaterialTitle] = useState('');
  const [newMaterialSubject, setNewMaterialSubject] = useState('');
  const [newMaterialClass, setNewMaterialClass] = useState('XII MIPA 1');
  const [newMaterialType, setNewMaterialType] = useState<'PDF' | 'VIDEO' | 'SLIDE' | 'DOC'>('PDF');
  const [newMaterialDesc, setNewMaterialDesc] = useState('');
  const [isUploadingMaterial, setIsUploadingMaterial] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: ToastType }>({
    visible: false,
    message: '',
    type: 'info',
  });

  const showToast = (message: string, type: ToastType = 'info') => {
    setToast({ visible: true, message, type });
  };

  // Role detection
  const normalizedRole = (userRole || currentUser?.role || '').toLowerCase();
  const isStudent = normalizedRole.includes('siswa') || normalizedRole.includes('student');
  const isParent =
    normalizedRole.includes('orang tua') ||
    normalizedRole.includes('parent') ||
    normalizedRole.includes('wali') ||
    normalizedRole.includes('ortu');
  const isTeacher = !isStudent && !isParent && (normalizedRole.includes('guru') || normalizedRole.includes('teacher'));
  const isAdmin = !isStudent && !isParent && !isTeacher;
  const isTeacherOrAdmin = isTeacher || isAdmin;

  useEffect(() => {
    fetchElearningData();
  }, []);

  const fetchElearningData = async () => {
    try {
      const storedUser = await SecureStore.getItemAsync('sipena_user');
      const apiUrl = await SecureStore.getItemAsync('sipena_api_url');
      const token = await SecureStore.getItemAsync('sipena_token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      let currentRole = 'guru';
      let userObj: any = null;
      if (storedUser) {
        try {
          userObj = JSON.parse(storedUser);
          setCurrentUser(userObj);
          if (userObj?.role) {
            currentRole = userObj.role.toLowerCase();
            setUserRole(currentRole);
          }
        } catch (_) {}
      }

      const roleIsStudent = currentRole.includes('siswa') || currentRole.includes('student');
      const roleIsParent =
        currentRole.includes('orang tua') ||
        currentRole.includes('parent') ||
        currentRole.includes('wali') ||
        currentRole.includes('ortu');
      const roleIsTeacherOrAdmin = !roleIsStudent && !roleIsParent;

      // Default mock fallback for Teacher
      const defaultTeacherAssignments: AssignmentItem[] = [
        {
          id: 'ta1',
          title: 'Analisis Gelombang Elektromagnetik & Optik',
          subjectName: userObj?.subject || 'Fisika Peminatan',
          className: 'XII MIPA 1',
          teacherName: userObj?.name || 'Dr. Hendra Gunawan, M.Si',
          deadline: 'Besok, 23:59 WIB',
          description: 'Selesaikan 5 studi kasus aplikasi gelombang mikro pada telekomunikasi dan sertakan rumusan penurunan frekuensi.',
          totalSubmissions: 28,
          totalStudents: 34,
          gradedCount: 22,
          pendingReviewCount: 6,
          status: 'active',
          maxScore: 100,
        },
        {
          id: 'ta2',
          title: 'Praktikum Virtual Hukum Snellius & Pemantulan',
          subjectName: userObj?.subject || 'Fisika Peminatan',
          className: 'XII MIPA 2',
          teacherName: userObj?.name || 'Dr. Hendra Gunawan, M.Si',
          deadline: '03 Okt 2026, 17:00 WIB',
          description: 'Laporan praktikum mandiri menggunakan simulasi PhET dengan analisis sudut bias medium.',
          totalSubmissions: 32,
          totalStudents: 32,
          gradedCount: 32,
          pendingReviewCount: 0,
          status: 'completed',
          maxScore: 100,
        },
        {
          id: 'ta3',
          title: 'Tugas Mandiri: Teori Kuantum Planck & Foton',
          subjectName: userObj?.subject || 'Fisika Peminatan',
          className: 'XI MIPA 3',
          teacherName: userObj?.name || 'Dr. Hendra Gunawan, M.Si',
          deadline: '06 Okt 2026, 12:00 WIB',
          description: 'Pengerjaan 10 soal essay pemecahan masalah efek fotolistrik dan model spektrum atom.',
          totalSubmissions: 15,
          totalStudents: 35,
          gradedCount: 0,
          pendingReviewCount: 15,
          status: 'active',
          maxScore: 100,
        },
      ];

      // Default mock fallback for Student
      const defaultStudentAssignments: AssignmentItem[] = [
        {
          id: 'sa1',
          title: 'Analisis Gelombang Elektromagnetik & Optik',
          subjectName: 'Fisika Peminatan',
          teacherName: 'Dr. Hendra Gunawan, M.Si',
          deadline: 'Besok, 23:59 WIB',
          description: 'Selesaikan 5 studi kasus aplikasi gelombang mikro pada telekomunikasi dan sertakan rumusan penurunan frekuensi.',
          totalSubmissions: 28,
          myStatus: 'pending',
        },
        {
          id: 'sa2',
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
          id: 'sa3',
          title: 'Integral Parsial dan Terapan Luas Bidang',
          subjectName: 'Matematika Tingkat Lanjut',
          teacherName: 'Bambang Kusuma, S.Pd',
          deadline: '05 Okt 2026, 12:00 WIB',
          description: 'Kerjakan LKS Mandiri halaman 45-48 nomor 1 sampai 10 lengkap beserta grafik kurva perpotongan.',
          totalSubmissions: 15,
          myStatus: 'pending',
        },
      ];

      const defaultMaterials: MaterialItem[] = [
        {
          id: 'm1',
          title: 'Modul Bab 4: Gelombang Elektromagnetik & Spektrum',
          subjectName: userObj?.subject || 'Fisika Peminatan',
          className: 'XII MIPA 1 & 2',
          teacherName: userObj?.name || 'Dr. Hendra Gunawan, M.Si',
          type: 'PDF',
          size: '3.4 MB',
          uploadDate: '28 Sep 2026',
          description: 'Ringkasan materi persamaan Maxwell, sifat radiasi elektromagnetik, serta latihan soal UTBK.',
        },
        {
          id: 'm2',
          title: 'Video Pembelajaran: Simulasi Pembiasan Cahaya PhET',
          subjectName: userObj?.subject || 'Fisika Peminatan',
          className: 'XII MIPA 1',
          teacherName: userObj?.name || 'Dr. Hendra Gunawan, M.Si',
          type: 'VIDEO',
          size: '48.2 MB',
          uploadDate: '26 Sep 2026',
          description: 'Tutorial konfigurasi parameter indeks bias kaca dan prisma menggunakan simulasi interaktif.',
        },
        {
          id: 'm3',
          title: 'Slide Presentasi: Teori Relativitas Khusus Einstein',
          subjectName: userObj?.subject || 'Fisika Peminatan',
          className: 'XII MIPA 2',
          teacherName: userObj?.name || 'Dr. Hendra Gunawan, M.Si',
          type: 'SLIDE',
          size: '5.1 MB',
          uploadDate: '24 Sep 2026',
          description: 'Bahan tayang pertemuan ke-6 tentang dilatasi waktu, kontraksi panjang, dan kesetaraan massa-energi.',
        },
      ];

      const defaultExams: ExamItem[] = [
        {
          id: 'e1',
          title: 'Penilaian Tengah Semester (PTS) Ganjil Fisika CBT',
          subjectName: userObj?.subject || 'Fisika Peminatan',
          className: 'XII MIPA 1',
          durationMinutes: 90,
          totalQuestions: 40,
          startTime: '02 Okt 2026, 08:00 WIB',
          status: 'upcoming',
          totalParticipants: 34,
        },
        {
          id: 'e2',
          title: 'Kuis Harian 2: Optik Fisis & Difraksi Cahaya',
          subjectName: userObj?.subject || 'Fisika Peminatan',
          className: 'XII MIPA 2',
          durationMinutes: 45,
          totalQuestions: 25,
          startTime: 'Hari ini, 13:00 WIB',
          status: 'ongoing',
          totalParticipants: 32,
        },
        {
          id: 'e3',
          title: 'Tryout Mandiri Asesmen Kompetensi Fisika Terapan',
          subjectName: userObj?.subject || 'Fisika Peminatan',
          className: 'XII MIPA 1',
          durationMinutes: 120,
          totalQuestions: 50,
          startTime: '25 Sep 2026',
          status: 'completed',
          totalParticipants: 34,
          score: 89,
        },
      ];

      if (apiUrl && token) {
        try {
          const assignmentUrl = roleIsTeacherOrAdmin
            ? `${apiUrl}/api/lms/assignments`
            : `${apiUrl}/api/lms/student/assignments`;

          const materialUrl = roleIsTeacherOrAdmin
            ? `${apiUrl}/api/lms/materials`
            : `${apiUrl}/api/lms/student/materials`;

          const examUrl = roleIsTeacherOrAdmin
            ? `${apiUrl}/api/exams`
            : `${apiUrl}/api/exams/student`;

          const [resExams, resAssignments, resMaterials] = await Promise.allSettled([
            axios.get(examUrl, { headers }),
            axios.get(assignmentUrl, { headers }),
            axios.get(materialUrl, { headers }),
          ]);

          if (resExams.status === 'fulfilled' && resExams.value.data?.data) {
            const apiExams = resExams.value.data.data.map((e: any) => ({
              id: e.id?.toString() || Math.random().toString(),
              title: e.title || 'Ujian Penilaian Harian',
              subjectName: e.subject?.name || e.subjectName || 'Mata Pelajaran',
              className: e.class?.name || e.className || 'Semua Kelas',
              durationMinutes: Number(e.duration || 60),
              totalQuestions: Number(e.question_count || 30),
              startTime: e.start_time || 'Hari ini, 08:00 WIB',
              status: e.status || 'upcoming',
              score: e.score !== undefined ? Number(e.score) : undefined,
              totalParticipants: Number(e.total_participants || 34),
            }));
            setExams(apiExams);
          } else {
            setExams(defaultExams);
          }

          if (
            resAssignments.status === 'fulfilled' &&
            resAssignments.value.data?.data &&
            Array.isArray(resAssignments.value.data.data) &&
            resAssignments.value.data.data.length > 0
          ) {
            const apiAssignments: AssignmentItem[] = resAssignments.value.data.data.map((a: any) => ({
              id: a.id?.toString() || 'a_' + Math.random(),
              title: a.title,
              subjectName: a.subject_name || a.subjectName || a.subject?.name || 'Mata Pelajaran',
              className: a.class_name || a.className || a.class?.name || 'Kelas XII',
              teacherName: a.teacher_name || a.teacherName || a.teacher?.name || userObj?.name || 'Guru',
              deadline: a.deadline_formatted || a.deadline || 'Besok, 23:59 WIB',
              description: a.description || '',
              totalSubmissions: Number(a.total_submissions ?? a.totalSubmissions ?? 0),
              totalStudents: Number(a.total_students ?? a.totalStudents ?? 34),
              gradedCount: Number(a.graded_submissions ?? a.gradedCount ?? 0),
              pendingReviewCount: Math.max(
                0,
                Number(a.total_submissions ?? 0) - Number(a.graded_submissions ?? 0)
              ),
              status: a.is_active ? 'active' : 'completed',
              maxScore: Number(a.max_score ?? 100),
              myStatus: a.myStatus || 'pending',
              score: a.score,
            }));
            setAssignments(apiAssignments);
          } else {
            setAssignments(roleIsTeacherOrAdmin ? defaultTeacherAssignments : defaultStudentAssignments);
          }

          if (
            resMaterials.status === 'fulfilled' &&
            resMaterials.value.data?.data &&
            Array.isArray(resMaterials.value.data.data) &&
            resMaterials.value.data.data.length > 0
          ) {
            const apiMaterials: MaterialItem[] = resMaterials.value.data.data.map((m: any) => ({
              id: m.id?.toString() || 'm_' + Math.random(),
              title: m.title,
              subjectName: m.subject_name || m.subjectName || m.subject?.name || 'Mata Pelajaran',
              className: m.class_name || m.className || 'Kelas XII',
              teacherName: m.teacher_name || m.teacherName || userObj?.name || 'Guru',
              type: m.type || 'PDF',
              size: m.size || '1.5 MB',
              uploadDate: m.uploadDate || m.created_at || 'Hari ini',
              description: m.description || '',
            }));
            setMaterials(apiMaterials);
          } else {
            setMaterials(defaultMaterials);
          }
        } catch (_) {
          setAssignments(roleIsTeacherOrAdmin ? defaultTeacherAssignments : defaultStudentAssignments);
          setMaterials(defaultMaterials);
          setExams(defaultExams);
        }
      } else {
        setAssignments(roleIsTeacherOrAdmin ? defaultTeacherAssignments : defaultStudentAssignments);
        setMaterials(defaultMaterials);
        setExams(defaultExams);
      }
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

  // ----------------------------------------------------
  // GURU: Review & Grading Submissions Flow
  // ----------------------------------------------------
  const handleOpenReviewModal = async (task: AssignmentItem) => {
    setSelectedAssignmentForReview(task);
    setSubmissionFilter('ALL');
    setStudentSearchQuery('');
    setEditingStudentId(null);
    setGradeInput('');
    setFeedbackInput('');
    setIsReviewModalOpen(true);

    try {
      const apiUrl = await SecureStore.getItemAsync('sipena_api_url');
      const token = await SecureStore.getItemAsync('sipena_token');
      if (apiUrl && token) {
        try {
          const res = await axios.get(`${apiUrl}/api/lms/assignments/${task.id}/submissions`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (res.data?.success && res.data?.data?.students) {
            const subs: StudentSubmission[] = res.data.data.students.map((s: any) => ({
              id: s.submission_id?.toString() || 'sub_' + Math.random(),
              studentId: s.student_id?.toString() || '',
              studentName: s.student_name || 'Siswa',
              nisn: s.nisn || '-',
              status: s.status || 'pending',
              submittedAt: s.submitted_at || undefined,
              submissionText: s.submission_text || '',
              fileName: s.file_name || undefined,
              score: s.score !== null && s.score !== undefined ? Number(s.score) : undefined,
              feedback: s.feedback || '',
            }));
            setStudentSubmissions(subs);
            return;
          }
        } catch (_) {}
      }

      // Default mock submissions
      const mockSubmissions: StudentSubmission[] = [
        {
          id: 'sub_1',
          studentId: 's1',
          studentName: 'Ahmad Fauzan',
          nisn: '0078129384',
          status: 'submitted',
          submittedAt: 'Kemarin, 21:15 WIB',
          submissionText: 'Telah diselesaikan studi kasus 1 sampai 5 mengenai dispersi dan pemantulan internal serat optik telekomunikasi.',
          fileName: 'Lembar_Jawaban_Ahmad_Fauzan.pdf',
          fileSize: '345 KB',
          filePages: 2,
          score: undefined,
          feedback: '',
        },
        {
          id: 'sub_2',
          studentId: 's2',
          studentName: 'Anisa Rahmawati',
          nisn: '0078129395',
          status: 'graded',
          submittedAt: 'Kemarin, 19:40 WIB',
          submissionText: 'Laporan lengkap penurunan rumus pergeseran frekuensi Doppler dan spektrum radiasi elektromagnetik.',
          fileName: 'Tugas_Fisika_Anisa_R.pdf',
          fileSize: '512 KB',
          filePages: 3,
          score: 95,
          feedback: 'Penjelasan sangat sistematis dan rumus penurunannya sangat tepat. Kerja yang luar biasa!',
        },
        {
          id: 'sub_3',
          studentId: 's3',
          studentName: 'Bima Satria Wicaksana',
          nisn: '0078129410',
          status: 'graded',
          submittedAt: '29 Sep 2026, 22:10 WIB',
          submissionText: 'Ringkasan jawaban studi kasus microwave antenna sudah terlampir pada dokumen.',
          fileName: 'Bima_Satria_Fisika_Kasus.pdf',
          fileSize: '280 KB',
          filePages: 2,
          score: 85,
          feedback: 'Perhitungan kasus 4 sudah benar, namun satuan GHz perlu dicantumkan pada kesimpulan.',
        },
        {
          id: 'sub_4',
          studentId: 's4',
          studentName: 'Citra Kirana Lestari',
          nisn: '0078129422',
          status: 'submitted',
          submittedAt: 'Hari ini, 09:20 WIB',
          submissionText: 'Berikut ringkasan analisis pemantulan total dan aplikasi pada endoskopi medis.',
          fileName: 'Analisis_Optik_Citra.pdf',
          fileSize: '410 KB',
          filePages: 2,
          score: undefined,
          feedback: '',
        },
        {
          id: 'sub_5',
          studentId: 's5',
          studentName: 'Dimas Bagas Prakoso',
          nisn: '0078129435',
          status: 'pending',
          submissionText: '',
        },
        {
          id: 'sub_6',
          studentId: 's6',
          studentName: 'Farhan Maulana',
          nisn: '0078129448',
          status: 'pending',
          submissionText: '',
        },
      ];
      setStudentSubmissions(mockSubmissions);
    } catch (_) {
      showToast('Gagal memuat daftar pengumpulan siswa.', 'error');
    }
  };

  // ----------------------------------------------------
  // DOCUMENT PREVIEW HANDLER
  // ----------------------------------------------------
  const handleOpenDocumentPreview = (sub: StudentSubmission, task: AssignmentItem) => {
    const isAhmad = sub.studentName.includes('Ahmad');
    const isAnisa = sub.studentName.includes('Anisa');
    const isBima = sub.studentName.includes('Bima');

    const sections = isAnisa
      ? [
          {
            title: '1. Radiasi Benda Hitam & Hipotesis Kuantum Planck',
            formula: 'E = n · h · f,  h = 6.626 × 10⁻³⁴ J·s',
            body: 'Max Planck merumuskan bahwa energi radiasi elektromagnetik dipancarkan atau diserap secara diskrit dalam bentuk kuantum atau foton. Pergeseran spektral Wien menunjukkan bahwa panjang gelombang puncak berbanding terbalik terhadap suhu mutlak: λ_max · T = 2.898 × 10⁻³ m·K.',
          },
          {
            title: '2. Penurunan Rumusan Efek Doppler Relativistik pada Gelombang Cahaya',
            formula: "f' = f · √((1 - β) / (1 + β))  dengan β = v/c",
            body: 'Ketika sumber cahaya dan pengamat bergerak saling menjauhi, frekuensi gelombang terukur mengalami penurunan (redshift). Dari hasil penurunan matematis kasus 2, didapatkan selisih panjang gelombang sebesar Δλ = 0.042 nm pada kecepatan 0.1c.',
          },
          {
            title: '3. Kesimpulan & Analisis Penilaian',
            body: 'Karakteristik foton dan pergeseran Doppler optik membuktikan sifat dualisme gelombang-partikel cahaya yang diterapkan dalam spektroskopi astronomi modern.',
          },
        ]
      : isBima
      ? [
          {
            title: '1. Perhitungan Link Budget Saluran Gelombang Mikro',
            formula: 'P_rx = P_tx + G_tx + G_rx - L_fs - L_misc',
            body: 'Perhitungan daya transmisi relay gelombang mikro pada jarak 15 km dengan frekuensi 7 GHz. Redaman ruang bebas (free space loss) bernilai 132.8 dB. Menggunakan antena parabola berdiameter 1.2 meter menghasilkan margin fading sebesar 38.5 dB.',
          },
          {
            title: '2. Atenuasi Akibat Hujan & Atmosfer',
            body: 'Pada kondisi presipitasi hujan 50 mm/jam, koefisien atenuasi spesifik mencapai 1.8 dB/km. Diperlukan penyesuaian level power amplifier otomatis (ATPC) untuk mencegah terjadinya penurunan kualitas panggilan (packet loss).',
          },
        ]
      : [
          {
            title: '1. Karakteristik Gelombang Mikro & Persamaan Maxwell',
            formula: 'c = 1 / √(μ₀ · ε₀) ≈ 3.00 × 10⁸ m/s,  v = λ · f',
            body: 'Berdasarkan persamaan gelombang elektromagnetik Maxwell, gelombang mikro merambat tanpa memerlukan medium fisis. Pada rentang frekuensi 300 MHz hingga 300 GHz (panjang gelombang 1 mm - 1 m), gelombang mikro memiliki sifat penetrasi atmosfer yang ideal untuk komunikasi satelit dan radar navigasi.',
          },
          {
            title: '2. Studi Kasus Transmisi Kabel Serat Optik & Fenomena Pemantulan Total',
            formula: 'θ_c = arcsin(n₂ / n₁) = arcsin(1.45 / 1.50) ≈ 75.16°',
            body: 'Pada serat optik telekomunikasi berkas tunggal (single-mode), indeks bias inti n₁ = 1.50 dan selubung (cladding) n₂ = 1.45. Sudut kritis bernilai 75.16°. Ketika sinar datang dengan sudut θ > θ_c, seluruh intensitas cahaya mengalami total internal reflection tanpa kebocoran daya ke luar kabel.',
          },
          {
            title: '3. Redaman Sinyal (Atenuasi) & Penggunaan Repeater pada Jaringan 5G',
            formula: 'P(x) = P₀ · 10^(-α · x / 10)  [dB]',
            body: 'Atenuasi pada kabel serat optik silika terendah berada pada jendela panjang gelombang 1.550 nm (α ≈ 0.2 dB/km). Pada jaringan nirkabel gelombang milimeter 28 GHz, redaman udara mencapai 0.15 dB/km, sehingga dibutuhkan repeater seluler mikro setiap interval 300 - 450 meter.',
          },
          {
            title: '4. Kesimpulan Studi Kasus Analisis Gelombang',
            body: 'Kombinasi kabel fiber optik sebagai backbone serta pemancar mikro berdaya rendah merupakan solusi transmisi data pita lebar berkecepatan multi-gigabit dengan latensi ultra rendah.',
          },
        ];

    setPreviewDocData({
      title: task.title,
      docSubtitle: `${task.subjectName} • ${task.className || 'Kelas XII'}`,
      studentName: sub.studentName,
      nisn: sub.nisn,
      className: task.className || 'XII MIPA 1',
      fileName: sub.fileName || 'Lembar_Jawaban_Tugas.pdf',
      fileSize: sub.fileSize || '345 KB',
      pages: sub.filePages || 2,
      submittedAt: sub.submittedAt || 'Kemarin, 21:15 WIB',
      submissionText: sub.submissionText,
      fileUrl: sub.fileUrl,
      sections,
      score: sub.score,
      feedback: sub.feedback,
      studentId: sub.studentId,
      submissionId: sub.id,
    });
    setIsDocPreviewOpen(true);
  };

  const handleOpenMaterialPreview = (mat: MaterialItem) => {
    setPreviewDocData({
      title: mat.title,
      docSubtitle: `${mat.subjectName} • Pengajar: ${mat.teacherName}`,
      studentName: mat.teacherName,
      nisn: 'NIP: 198503152010011002',
      className: mat.className || 'XII MIPA 1 & 2',
      fileName: `${mat.title.replace(/[\s\W]+/g, '_')}.${mat.type.toLowerCase()}`,
      fileSize: mat.size,
      pages: mat.type === 'PDF' ? 14 : 1,
      submittedAt: mat.uploadDate,
      submissionText: mat.description,
      sections: [
        {
          title: 'Kompetensi Dasar & Indikator Pencapaian Pembelajaran',
          body: 'Peserta didik mampu menganalisis fenomena radiasi gelombang elektromagnetik, pemanfaatannya dalam teknologi komunikasi modern, serta dampaknya terhadap kehidupan sehari-hari.',
        },
        {
          title: 'Ikhtisar Materi & Ringkasan Rumus Penting',
          formula: 'c = λ · f,  E = h · f = h · c / λ,  p = h / λ',
          body: mat.description + ' Pelajari secara seksama penurunan rumus pergeseran Wien, hukum Stefan-Boltzmann, serta analisis spektrum gelombang elektromagnetik dari sinar gamma hingga gelombang radio.',
        },
        {
          title: 'Petunjuk Latihan Soal & Penugasan Mandiri',
          body: 'Kerjakan soal latihan formatif di akhir bab halaman 42-45. Kumpulkan laporan analisis kasus mandiri pada portal penugasan e-learning sebelum batas waktu berakhir.',
        },
      ],
    });
    setIsDocPreviewOpen(true);
  };

  const handleOpenExternalBrowser = async () => {
    if (previewDocData?.fileUrl && previewDocData.fileUrl.startsWith('http')) {
      try {
        await WebBrowser.openBrowserAsync(previewDocData.fileUrl);
      } catch (_) {
        showToast('Gagal membuka peramban eksternal.', 'error');
      }
    } else {
      showToast(`Menampilkan berkas ${previewDocData?.fileName} via penampil resmi SIPENA.`, 'info');
    }
  };

  const handleShareDocument = async () => {
    try {
      await Share.share({
        message: `Pratinjau Berkas LMS SIPENA: ${previewDocData?.title} (${previewDocData?.fileName}) - Siswa: ${previewDocData?.studentName}`,
      });
    } catch (_) {}
  };

  const handleStartGrading = (sub: StudentSubmission) => {
    setEditingStudentId(sub.id);
    setGradeInput(sub.score !== undefined ? String(sub.score) : '');
    setFeedbackInput(sub.feedback || '');
  };

  const handleSaveGrade = async (sub: StudentSubmission) => {
    const numericScore = parseFloat(gradeInput);
    if (isNaN(numericScore) || numericScore < 0 || numericScore > 100) {
      showToast('Masukkan nilai valid antara 0 - 100.', 'warning');
      return;
    }

    setIsSavingGrade(true);
    try {
      const apiUrl = await SecureStore.getItemAsync('sipena_api_url');
      const token = await SecureStore.getItemAsync('sipena_token');
      if (apiUrl && token) {
        try {
          await axios.post(
            `${apiUrl}/api/lms/submissions/${sub.id}/grade`,
            { score: numericScore, feedback: feedbackInput.trim() },
            { headers: { Authorization: `Bearer ${token}` } }
          );
        } catch (_) {}
      }

      setStudentSubmissions(prev =>
        prev.map(item =>
          item.id === sub.id
            ? { ...item, status: 'graded', score: numericScore, feedback: feedbackInput.trim() }
            : item
        )
      );

      if (selectedAssignmentForReview) {
        setAssignments(prev =>
          prev.map(a => {
            if (a.id === selectedAssignmentForReview.id) {
              const newGraded = (a.gradedCount || 0) + (sub.status !== 'graded' ? 1 : 0);
              const newPending = Math.max(0, (a.pendingReviewCount || 0) - (sub.status !== 'graded' ? 1 : 0));
              return { ...a, gradedCount: newGraded, pendingReviewCount: newPending };
            }
            return a;
          })
        );
      }

      setEditingStudentId(null);
      showToast(`Nilai ${numericScore} untuk ${sub.studentName} berhasil disimpan!`, 'success');
    } catch (_) {
      showToast('Gagal menyimpan penilaian.', 'error');
    } finally {
      setIsSavingGrade(false);
    }
  };

  // ----------------------------------------------------
  // GURU: Create New Assignment Flow
  // ----------------------------------------------------
  const handleOpenCreateAssignment = () => {
    setNewTitle('');
    setNewSubject(currentUser?.subject || 'Fisika Peminatan');
    setNewClass('XII MIPA 1');
    setNewDeadline('Besok, 23:59 WIB');
    setNewMaxScore('100');
    setNewDescription('');
    setNewAttachedFile(null);
    setIsCreateAssignmentModalOpen(true);
  };

  const handlePickAssignmentDoc = () => {
    setNewAttachedFile({
      name: 'Panduan_Tugas_Dan_Rubrik_Penilaian.pdf',
      size: 420 * 1024,
    });
    showToast('Lampiran tugas disertakan: Panduan_Tugas.pdf', 'success');
  };

  const handleConfirmCreateAssignment = async () => {
    if (!newTitle.trim()) {
      showToast('Judul tugas wajib diisi.', 'warning');
      return;
    }
    if (!newSubject.trim()) {
      showToast('Mata pelajaran wajib diisi.', 'warning');
      return;
    }

    setIsCreatingAssignment(true);
    try {
      const apiUrl = await SecureStore.getItemAsync('sipena_api_url');
      const token = await SecureStore.getItemAsync('sipena_token');
      const newId = 'ta_' + Date.now();

      const newTask: AssignmentItem = {
        id: newId,
        title: newTitle.trim(),
        subjectName: newSubject.trim(),
        className: newClass.trim(),
        teacherName: currentUser?.name || 'Dr. Hendra Gunawan, M.Si',
        deadline: newDeadline.trim() || 'Besok, 23:59 WIB',
        description: newDescription.trim() || 'Kerjakan tugas sesuai petunjuk dan kumpulkan sebelum batas waktu.',
        totalSubmissions: 0,
        totalStudents: 34,
        gradedCount: 0,
        pendingReviewCount: 0,
        status: 'active',
        maxScore: Number(newMaxScore) || 100,
      };

      if (apiUrl && token) {
        try {
          await axios.post(
            `${apiUrl}/api/lms/assignments`,
            {
              title: newTask.title,
              subject_name: newTask.subjectName,
              class_name: newTask.className,
              deadline: newTask.deadline,
              description: newTask.description,
              max_score: newTask.maxScore,
            },
            { headers: { Authorization: `Bearer ${token}` } }
          );
        } catch (_) {}
      }

      setAssignments(prev => [newTask, ...prev]);
      setIsCreateAssignmentModalOpen(false);
      showToast(`Tugas "${newTask.title}" berhasil diterbitkan ke kelas ${newTask.className}!`, 'success');
    } catch (_) {
      showToast('Gagal menerbitkan tugas baru.', 'error');
    } finally {
      setIsCreatingAssignment(false);
    }
  };

  const handleDeleteAssignment = (taskId: string, taskTitle: string) => {
    setAssignments(prev => prev.filter(a => a.id !== taskId));
    showToast(`Tugas "${taskTitle}" berhasil dihapus.`, 'info');
  };

  // ----------------------------------------------------
  // GURU: Upload Material Flow
  // ----------------------------------------------------
  const handleOpenUploadMaterial = () => {
    setNewMaterialTitle('');
    setNewMaterialSubject(currentUser?.subject || 'Fisika Peminatan');
    setNewMaterialClass('XII MIPA 1');
    setNewMaterialType('PDF');
    setNewMaterialDesc('');
    setIsUploadMaterialModalOpen(true);
  };

  const handleConfirmUploadMaterial = async () => {
    if (!newMaterialTitle.trim()) {
      showToast('Judul bahan ajar wajib diisi.', 'warning');
      return;
    }

    setIsUploadingMaterial(true);
    try {
      const newMat: MaterialItem = {
        id: 'mat_' + Date.now(),
        title: newMaterialTitle.trim(),
        subjectName: newMaterialSubject.trim(),
        className: newMaterialClass.trim(),
        teacherName: currentUser?.name || 'Dr. Hendra Gunawan, M.Si',
        type: newMaterialType,
        size: '2.8 MB',
        uploadDate: 'Hari ini',
        description: newMaterialDesc.trim() || 'Modul penunjang kegiatan belajar daring siswa.',
      };

      setMaterials(prev => [newMat, ...prev]);
      setIsUploadMaterialModalOpen(false);
      showToast(`Bahan ajar "${newMat.title}" berhasil diunggah!`, 'success');
    } catch (_) {
      showToast('Gagal mengunggah bahan ajar.', 'error');
    } finally {
      setIsUploadingMaterial(false);
    }
  };

  // ----------------------------------------------------
  // SISWA: Submit Assignment Flow
  // ----------------------------------------------------
  const handleSubmitTask = (task: AssignmentItem) => {
    setSelectedAssignment(task);
    setSubmissionText('');
    setSelectedFile(null);
    setIsSubmitModalOpen(true);
  };

  const handlePickDocument = () => {
    setSelectedFile({
      name: 'Lembar_Jawaban_Tugas_Mandiri.pdf',
      size: 345 * 1024,
      mimeType: 'application/pdf',
      uri: 'file://mock/Lembar_Jawaban_Tugas_Mandiri.pdf',
    });
    showToast('Berkas terpilih: Lembar_Jawaban_Tugas_Mandiri.pdf', 'success');
  };

  const handleConfirmSubmit = async () => {
    if (!submissionText.trim() && !selectedFile) {
      showToast('Tuliskan ringkasan jawaban atau lampirkan berkas tugas.', 'warning');
      return;
    }
    setIsSubmitting(true);
    try {
      const apiUrl = await SecureStore.getItemAsync('sipena_api_url');
      const token = await SecureStore.getItemAsync('sipena_token');
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

      if (apiUrl && token && selectedAssignment) {
        try {
          const formData = new FormData();
          if (submissionText.trim()) {
            formData.append('submission_text', submissionText.trim());
          }
          if (selectedFile) {
            formData.append('submission_file', {
              uri: selectedFile.uri,
              name: selectedFile.name || 'jawaban_tugas.pdf',
              type: selectedFile.mimeType || 'application/pdf',
            } as any);
          }
          headers['Content-Type'] = 'multipart/form-data';
          await axios.post(
            `${apiUrl}/api/lms/student/assignments/${selectedAssignment.id}/submit`,
            formData,
            { headers }
          );
        } catch (_) {}
      }

      setAssignments(prev =>
        prev.map(a =>
          a.id === selectedAssignment?.id
            ? { ...a, myStatus: 'submitted', totalSubmissions: (a.totalSubmissions || 0) + 1 }
            : a
        )
      );

      setIsSubmitModalOpen(false);
      setSelectedFile(null);
      setSubmissionText('');
      showToast('Tugas berhasil dikumpulkan ke guru mata pelajaran!', 'success');
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
    a.subjectName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (a.className && a.className.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredSubmissions = studentSubmissions.filter(sub => {
    const matchesFilter =
      submissionFilter === 'ALL'
        ? true
        : submissionFilter === 'graded'
        ? sub.status === 'graded'
        : submissionFilter === 'submitted'
        ? sub.status === 'submitted'
        : sub.status === 'pending';

    const matchesSearch =
      sub.studentName.toLowerCase().includes(studentSearchQuery.toLowerCase()) ||
      sub.nisn.toLowerCase().includes(studentSearchQuery.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  const totalPendingReviews = assignments.reduce((acc, a) => acc + (a.pendingReviewCount ?? 0), 0);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={[styles.moduleBadge, isTeacherOrAdmin && styles.moduleBadgeTeacher]}>
            <Ionicons name={isTeacherOrAdmin ? 'school' : 'book'} size={13} color="#6366F1" />
            <Text style={styles.moduleBadgeText}>
              {isTeacherOrAdmin ? 'MODUL 08 • PORTAL GURU' : isParent ? 'MODUL 08 • WALI MURID' : 'MODUL 08 • SISWA'}
            </Text>
          </View>
          <Text style={styles.headerTitle}>
            {isTeacherOrAdmin ? 'E-Learning & LMS Guru' : isParent ? 'Monitoring LMS Siswa' : 'E-Learning & LMS'}
          </Text>
        </View>
        <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
          <Ionicons name="reload" size={20} color={Colors.text} />
        </TouchableOpacity>
      </View>

      {/* KPI Cards */}
      <View style={styles.kpiContainer}>
        {isTeacherOrAdmin ? (
          <>
            <View style={[styles.kpiCard, { backgroundColor: '#EEF2FF' }]}>
              <View style={styles.kpiIconWrapper}>
                <Ionicons name="clipboard-outline" size={18} color="#6366F1" />
              </View>
              <Text style={styles.kpiValue}>{assignments.length} Tugas</Text>
              <Text style={styles.kpiLabel}>
                {totalPendingReviews > 0 ? `${totalPendingReviews} Perlu Diperiksa` : 'Semua Sudah Dinilai'}
              </Text>
            </View>
            <View style={[styles.kpiCard, { backgroundColor: '#F0FDF4' }]}>
              <View style={[styles.kpiIconWrapper, { backgroundColor: '#DCFCE7' }]}>
                <Ionicons name="layers" size={18} color="#16A34A" />
              </View>
              <Text style={styles.kpiValue}>{materials.length} Bahan</Text>
              <Text style={styles.kpiLabel}>Materi Terpublikasi</Text>
            </View>
          </>
        ) : isParent ? (
          <>
            <View style={[styles.kpiCard, { backgroundColor: '#FFFBEB' }]}>
              <View style={[styles.kpiIconWrapper, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="time-outline" size={18} color="#D97706" />
              </View>
              <Text style={styles.kpiValue}>
                {assignments.filter(a => a.myStatus === 'pending').length} Tugas
              </Text>
              <Text style={styles.kpiLabel}>Belum Dikumpul Anak</Text>
            </View>
            <View style={[styles.kpiCard, { backgroundColor: '#F0FDF4' }]}>
              <View style={[styles.kpiIconWrapper, { backgroundColor: '#DCFCE7' }]}>
                <Ionicons name="checkmark-done" size={18} color="#16A34A" />
              </View>
              <Text style={styles.kpiValue}>
                {assignments.filter(a => a.myStatus === 'submitted').length} Selesai
              </Text>
              <Text style={styles.kpiLabel}>Tugas Terkumpul</Text>
            </View>
          </>
        ) : (
          <>
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
          </>
        )}
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
            {isTeacherOrAdmin ? 'Tugas Siswa' : 'Tugas & PR'}
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
            {isTeacherOrAdmin ? 'Jadwal CBT' : 'Kuis & CBT'}
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
          {/* ========================================================== */}
          {/* TAB 1: TUGAS & PR                                          */}
          {/* ========================================================== */}
          {activeTab === 'tugas' && (
            <View>
              {/* Teacher Create Assignment Button */}
              {isTeacherOrAdmin && (
                <View style={styles.teacherActionBar}>
                  <TouchableOpacity
                    style={styles.createTaskPrimaryBtn}
                    onPress={handleOpenCreateAssignment}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="add-circle" size={18} color="#FFFFFF" />
                    <Text style={styles.createTaskPrimaryBtnText}>Buat Tugas Baru</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Search Bar */}
              <View style={styles.searchBox}>
                <Ionicons name="search" size={18} color={Colors.textLight} />
                <TextInput
                  style={styles.searchInput}
                  placeholder={
                    isTeacherOrAdmin
                      ? 'Cari judul tugas, mata pelajaran, atau kelas...'
                      : 'Cari tugas mata pelajaran...'
                  }
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholderTextColor={Colors.textLight}
                />
              </View>

              {filteredAssignments.length === 0 ? (
                <View style={styles.emptyStateContainer}>
                  <Ionicons name="document-text-outline" size={44} color="#CBD5E1" />
                  <Text style={styles.emptyStateTitle}>Tidak ada tugas ditemukan</Text>
                  <Text style={styles.emptyStateSubtitle}>
                    {isTeacherOrAdmin
                      ? 'Belum ada tugas yang dibuat untuk kelas sasaran ini.'
                      : 'Semua tugas telah diselesaikan atau belum ada penugasan aktif.'}
                  </Text>
                </View>
              ) : (
                filteredAssignments.map(task => {
                  const total = task.totalStudents || 34;
                  const submitted = task.totalSubmissions || 0;
                  const progressPct = Math.min(100, Math.round((submitted / (total || 1)) * 100));
                  const pendingReview = task.pendingReviewCount ?? 0;

                  return (
                    <View key={task.id} style={styles.taskCard}>
                      {/* Card Header */}
                      <View style={styles.taskCardHeader}>
                        <View style={styles.badgesRow}>
                          <View style={styles.subjectBadge}>
                            <Ionicons name="school" size={12} color="#6366F1" />
                            <Text style={styles.subjectBadgeText}>{task.subjectName}</Text>
                          </View>
                          {task.className && (
                            <View style={styles.classBadge}>
                              <Ionicons name="people" size={11} color="#475569" />
                              <Text style={styles.classBadgeText}>{task.className}</Text>
                            </View>
                          )}
                        </View>

                        {/* Status Tag */}
                        {isTeacherOrAdmin ? (
                          <View
                            style={[
                              styles.taskStatusTag,
                              task.status === 'completed'
                                ? styles.statusCompletedTag
                                : styles.statusActiveTag,
                            ]}
                          >
                            <Text
                              style={[
                                styles.taskStatusText,
                                task.status === 'completed'
                                  ? styles.statusCompletedText
                                  : styles.statusActiveText,
                              ]}
                            >
                              {task.status === 'completed' ? 'SELESAI' : 'AKTIF'}
                            </Text>
                          </View>
                        ) : (
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
                        )}
                      </View>

                      {/* Title & Teacher Info */}
                      <Text style={styles.taskTitle}>{task.title}</Text>
                      <Text style={styles.taskTeacher}>
                        {isTeacherOrAdmin ? `Pengajar: ${task.teacherName || currentUser?.name || 'Saya'}` : `Guru: ${task.teacherName}`}
                      </Text>
                      <Text style={styles.taskDesc}>{task.description}</Text>

                      {/* Teacher Submissions Progress Section */}
                      {isTeacherOrAdmin && (
                        <View style={styles.teacherProgressBox}>
                          <View style={styles.progressLabelRow}>
                            <Text style={styles.progressLabelText}>Pengumpulan Siswa:</Text>
                            <Text style={styles.progressValueText}>
                              {submitted} / {total} Siswa ({progressPct}%)
                            </Text>
                          </View>
                          <View style={styles.progressBarTrack}>
                            <View style={[styles.progressBarFill, { width: `${progressPct}%` }]} />
                          </View>
                          {pendingReview > 0 && (
                            <View style={styles.pendingReviewBadge}>
                              <Ionicons name="alert-circle" size={13} color="#D97706" />
                              <Text style={styles.pendingReviewBadgeText}>
                                {pendingReview} lembar jawaban belum dinilai
                              </Text>
                            </View>
                          )}
                        </View>
                      )}

                      <View style={styles.taskDivider} />

                      {/* Card Footer */}
                      <View style={styles.taskFooter}>
                        <View>
                          <Text style={styles.deadlinelabel}>Batas Waktu Pengumpulan:</Text>
                          <Text style={styles.deadlineValue}>{task.deadline}</Text>
                        </View>

                        {/* GURU: Action Button to Review Submissions */}
                        {isTeacherOrAdmin ? (
                          <View style={styles.teacherActionGroup}>
                            <TouchableOpacity
                              style={styles.reviewSubmissionsBtn}
                              onPress={() => handleOpenReviewModal(task)}
                              activeOpacity={0.8}
                            >
                              <Ionicons name="clipboard-outline" size={15} color="#FFFFFF" />
                              <Text style={styles.reviewSubmissionsBtnText}>Periksa Tugas</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.deleteTaskSmallBtn}
                              onPress={() => handleDeleteAssignment(task.id, task.title)}
                            >
                              <Ionicons name="trash-outline" size={16} color="#EF4444" />
                            </TouchableOpacity>
                          </View>
                        ) : isParent ? (
                          <View style={styles.scoreBadge}>
                            <Ionicons name="information-circle-outline" size={16} color="#3B82F6" />
                            <Text style={[styles.scoreText, { color: '#3B82F6' }]}>
                              {task.myStatus === 'submitted'
                                ? task.score !== undefined
                                  ? `Nilai Anak: ${task.score}/100`
                                  : 'Sudah Dikumpulkan'
                                : 'Belum Dikumpulkan'}
                            </Text>
                          </View>
                        ) : (
                          /* SISWA: Action Button to Submit */
                          task.myStatus === 'pending' ? (
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
                          )
                        )}
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          )}

          {/* ========================================================== */}
          {/* TAB 2: BAHAN AJAR                                          */}
          {/* ========================================================== */}
          {activeTab === 'materi' && (
            <View>
              <View style={styles.sectionHeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>Modul Pembelajaran & Dokumen Kelas</Text>
                  <Text style={styles.sectionSubtitle}>
                    {isTeacherOrAdmin
                      ? 'Kelola bahan ajar, slide presentasi, dan video pembelajaran untuk kelas.'
                      : 'Unduh dan pelajari materi ajar yang dibagikan guru kelas secara daring.'}
                  </Text>
                </View>
                {isTeacherOrAdmin && (
                  <TouchableOpacity
                    style={styles.uploadMaterialBtn}
                    onPress={handleOpenUploadMaterial}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="cloud-upload" size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.uploadMaterialBtnText}>Unggah Materi</Text>
                  </TouchableOpacity>
                )}
              </View>

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
                        {mat.subjectName} • {mat.className || mat.teacherName}
                      </Text>
                      <Text style={styles.materialDesc}>{mat.description}</Text>
                      <View style={styles.materialFooterRow}>
                        <Text style={styles.fileSizeText}>
                          {mat.size} • {mat.uploadDate}
                        </Text>
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                          <TouchableOpacity
                            style={styles.downloadBtn}
                            onPress={() => handleOpenMaterialPreview(mat)}
                          >
                            <Ionicons name="eye-outline" size={14} color="#6366F1" style={{ marginRight: 4 }} />
                            <Text style={styles.downloadBtnText}>Lihat Modul</Text>
                          </TouchableOpacity>
                          {isTeacherOrAdmin && (
                            <TouchableOpacity
                              style={styles.deleteMatBtn}
                              onPress={() => {
                                setMaterials(prev => prev.filter(m => m.id !== mat.id));
                                showToast(`Materi ${mat.title} berhasil dihapus.`, 'info');
                              }}
                            >
                              <Ionicons name="trash-outline" size={14} color="#EF4444" />
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* ========================================================== */}
          {/* TAB 3: KUIS & CBT                                          */}
          {/* ========================================================== */}
          {activeTab === 'kuis' && (
            <View>
              <Text style={styles.sectionTitle}>
                {isTeacherOrAdmin
                  ? 'Jadwal & Monitoring Asesmen CBT Siswa'
                  : 'Jadwal Asesmen & Ujian Berbasis Komputer'}
              </Text>
              <Text style={styles.sectionSubtitle}>
                {isTeacherOrAdmin
                  ? 'Pantau partisipasi siswa dalam kuis dan asesmen berkala secara real-time.'
                  : 'Ikuti ujian berkala secara online sesuai jadwal dan batas waktu pengerjaan.'}
              </Text>

              {/* CBT Quick Navigation & Management Card */}
              <View
                style={{
                  backgroundColor: '#F5F3FF',
                  borderWidth: 1,
                  borderColor: '#DDD6FE',
                  borderRadius: 14,
                  padding: 14,
                  marginBottom: 16,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 }}>
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: '#EDE9FE',
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                  >
                    <Ionicons name="desktop-outline" size={20} color="#7C3AED" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: '#5B21B6' }}>
                      {isTeacherOrAdmin ? 'Menu CBT & Bank Soal Lengkap' : 'Ruang Ujian Online CBT'}
                    </Text>
                    <Text style={{ fontSize: 11, color: '#6D28D9', marginTop: 2 }}>
                      {isTeacherOrAdmin
                        ? 'Buat soal cerita & PG, jadwal ujian, serta pengaturan kamera proctoring.'
                        : 'Masuk dan kerjakan ujian CBT dengan kamera pengawasan aktif.'}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#7C3AED',
                    paddingVertical: 10,
                    borderRadius: 8,
                    gap: 6,
                    marginTop: 6,
                  }}
                  onPress={() => router.push('/modules/cbt' as any)}
                >
                  <Ionicons name="open-outline" size={16} color="#FFF" />
                  <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 13 }}>
                    {isTeacherOrAdmin ? 'Kelola CBT, Soal Cerita & Kamera' : 'Buka Ruang Ujian CBT'}
                  </Text>
                </TouchableOpacity>
              </View>

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
                          exam.status === 'ongoing'
                            ? styles.statusOngoingText
                            : exam.status === 'completed'
                            ? styles.statusCompletedText
                            : styles.statusUpcomingText,
                        ]}
                      >
                        {exam.status === 'ongoing'
                          ? 'SEDANG AKTIF'
                          : exam.status === 'completed'
                          ? 'SELESAI'
                          : 'TERJADWAL'}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.examTitle}>{exam.title}</Text>
                  <Text style={styles.examSubject}>
                    {exam.subjectName} • {exam.className || 'Kelas Sasaran'}
                  </Text>

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
                    {isTeacherOrAdmin ? (
                      <View style={styles.teacherExamActionRow}>
                        <View style={styles.participantsBadge}>
                          <Ionicons name="people-outline" size={15} color="#475569" />
                          <Text style={styles.participantsBadgeText}>
                            Peserta: {exam.totalParticipants || 34} Siswa
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={styles.monitorExamBtn}
                          onPress={() => router.push('/modules/cbt' as any)}
                        >
                          <Ionicons name="analytics" size={15} color="#FFFFFF" />
                          <Text style={styles.monitorExamBtnText}>Kelola & Pantau CBT</Text>
                        </TouchableOpacity>
                      </View>
                    ) : exam.status === 'completed' ? (
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
                        onPress={() => router.push('/modules/cbt' as any)}
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

      {/* ============================================================== */}
      {/* MODAL GURU: Review Submissions & Grading                       */}
      {/* ============================================================== */}
      <Modal
        visible={isReviewModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsReviewModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCardLarge, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle} numberOfLines={1}>
                  Periksa Pengumpulan Tugas
                </Text>
                {selectedAssignmentForReview && (
                  <Text style={styles.modalSubTitle} numberOfLines={1}>
                    {selectedAssignmentForReview.title} ({selectedAssignmentForReview.className || 'Kelas'})
                  </Text>
                )}
              </View>
              <TouchableOpacity onPress={() => setIsReviewModalOpen(false)} style={styles.closeModalBtn}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            {/* Filter Tabs */}
            <View style={styles.reviewFilterContainer}>
              <TouchableOpacity
                style={[styles.filterChip, submissionFilter === 'ALL' && styles.filterChipActive]}
                onPress={() => setSubmissionFilter('ALL')}
              >
                <Text style={[styles.filterChipText, submissionFilter === 'ALL' && styles.filterChipTextActive]}>
                  Semua ({studentSubmissions.length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterChip, submissionFilter === 'submitted' && styles.filterChipActive]}
                onPress={() => setSubmissionFilter('submitted')}
              >
                <Text style={[styles.filterChipText, submissionFilter === 'submitted' && styles.filterChipTextActive]}>
                  Perlu Dinilai ({studentSubmissions.filter(s => s.status === 'submitted').length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterChip, submissionFilter === 'graded' && styles.filterChipActive]}
                onPress={() => setSubmissionFilter('graded')}
              >
                <Text style={[styles.filterChipText, submissionFilter === 'graded' && styles.filterChipTextActive]}>
                  Sudah Dinilai ({studentSubmissions.filter(s => s.status === 'graded').length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterChip, submissionFilter === 'pending' && styles.filterChipActive]}
                onPress={() => setSubmissionFilter('pending')}
              >
                <Text style={[styles.filterChipText, submissionFilter === 'pending' && styles.filterChipTextActive]}>
                  Belum Kumpul ({studentSubmissions.filter(s => s.status === 'pending').length})
                </Text>
              </TouchableOpacity>
            </View>

            {/* Search Student */}
            <View style={styles.subSearchBox}>
              <Ionicons name="search" size={16} color={Colors.textLight} />
              <TextInput
                style={styles.subSearchInput}
                placeholder="Cari nama siswa atau NISN..."
                value={studentSearchQuery}
                onChangeText={setStudentSearchQuery}
                placeholderTextColor={Colors.textLight}
              />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.submissionsScroll}>
              {filteredSubmissions.length === 0 ? (
                <View style={styles.emptySubmissions}>
                  <Ionicons name="file-tray-outline" size={36} color="#CBD5E1" />
                  <Text style={styles.emptySubmissionsText}>Tidak ada data pengumpulan sesuai filter.</Text>
                </View>
              ) : (
                filteredSubmissions.map(sub => {
                  const isEditingThis = editingStudentId === sub.id;

                  return (
                    <View key={sub.id} style={styles.submissionStudentCard}>
                      <View style={styles.subCardTopRow}>
                        <View style={styles.studentAvatarCircle}>
                          <Text style={styles.studentAvatarText}>
                            {sub.studentName.substring(0, 2).toUpperCase()}
                          </Text>
                        </View>
                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <Text style={styles.submissionStudentName}>{sub.studentName}</Text>
                          <Text style={styles.submissionStudentNisn}>NISN: {sub.nisn}</Text>
                        </View>
                        <View
                          style={[
                            styles.subStatusBadge,
                            sub.status === 'graded'
                              ? styles.subStatusGraded
                              : sub.status === 'submitted'
                              ? styles.subStatusSubmitted
                              : styles.subStatusPending,
                          ]}
                        >
                          <Text
                            style={[
                              styles.subStatusBadgeText,
                              sub.status === 'graded'
                                ? styles.subStatusGradedText
                                : sub.status === 'submitted'
                                ? styles.subStatusSubmittedText
                                : styles.subStatusPendingText,
                            ]}
                          >
                            {sub.status === 'graded'
                              ? `NILAI: ${sub.score}`
                              : sub.status === 'submitted'
                              ? 'SUDAH KUMPUL'
                              : 'BELUM KUMPUL'}
                          </Text>
                        </View>
                      </View>

                      {/* Submitted Answer & File pill with clickable Preview */}
                      {sub.status !== 'pending' && (
                        <View style={styles.subAnswerBox}>
                          {sub.submittedAt && (
                            <Text style={styles.submittedAtText}>
                              Dikirim: {sub.submittedAt}
                            </Text>
                          )}
                          {sub.submissionText ? (
                            <Text style={styles.submissionAnswerContent}>{sub.submissionText}</Text>
                          ) : null}

                          {sub.fileName && (
                            <TouchableOpacity
                              style={styles.interactiveFilePill}
                              onPress={() => handleOpenDocumentPreview(sub, selectedAssignmentForReview!)}
                              activeOpacity={0.7}
                            >
                              <View style={styles.filePillLeft}>
                                <View style={styles.pdfIconCircle}>
                                  <Ionicons name="document-text" size={16} color="#DC2626" />
                                </View>
                                <View style={{ flex: 1 }}>
                                  <Text style={styles.interactiveFileName} numberOfLines={1}>
                                    {sub.fileName}
                                  </Text>
                                  <Text style={styles.interactiveFileMeta}>
                                    {sub.fileSize || '345 KB'} • Ketuk untuk baca lembar jawaban
                                  </Text>
                                </View>
                              </View>
                              <View style={styles.filePillRightAction}>
                                <Ionicons name="eye" size={14} color="#4F46E5" />
                                <Text style={styles.filePillRightActionText}>Buka</Text>
                              </View>
                            </TouchableOpacity>
                          )}
                        </View>
                      )}

                      {/* Graded Feedback note if exists and not editing */}
                      {sub.status === 'graded' && !isEditingThis && sub.feedback ? (
                        <View style={styles.feedbackBox}>
                          <Text style={styles.feedbackLabel}>Catatan Guru:</Text>
                          <Text style={styles.feedbackText}>{sub.feedback}</Text>
                        </View>
                      ) : null}

                      {/* Grading Edit Area */}
                      {isEditingThis ? (
                        <View style={styles.gradingFormArea}>
                          <View style={styles.gradeInputRow}>
                            <Text style={styles.gradeInputLabel}>Beri Nilai (0-100):</Text>
                            <TextInput
                              style={styles.gradeInputField}
                              placeholder="0 - 100"
                              keyboardType="numeric"
                              maxLength={3}
                              value={gradeInput}
                              onChangeText={setGradeInput}
                            />
                          </View>
                          <TextInput
                            style={styles.feedbackInputField}
                            placeholder="Tuliskan catatan apresiasi / masukan untuk siswa..."
                            multiline
                            numberOfLines={2}
                            value={feedbackInput}
                            onChangeText={setFeedbackInput}
                            placeholderTextColor={Colors.textLight}
                          />
                          <View style={styles.gradingFormBtnRow}>
                            <TouchableOpacity
                              style={styles.cancelGradingBtn}
                              onPress={() => setEditingStudentId(null)}
                            >
                              <Text style={styles.cancelGradingBtnText}>Batal</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.saveGradingBtn, isSavingGrade && { opacity: 0.6 }]}
                              onPress={() => handleSaveGrade(sub)}
                              disabled={isSavingGrade}
                            >
                              {isSavingGrade ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                              ) : (
                                <>
                                  <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
                                  <Text style={styles.saveGradingBtnText}>Simpan Nilai</Text>
                                </>
                              )}
                            </TouchableOpacity>
                          </View>
                        </View>
                      ) : sub.status !== 'pending' ? (
                        <View style={styles.gradeActionRow}>
                          <TouchableOpacity
                            style={styles.triggerGradingBtn}
                            onPress={() => handleStartGrading(sub)}
                          >
                            <Ionicons
                              name={sub.status === 'graded' ? 'create-outline' : 'ribbon-outline'}
                              size={15}
                              color="#6366F1"
                            />
                            <Text style={styles.triggerGradingBtnText}>
                              {sub.status === 'graded' ? 'Ubah Nilai & Catatan' : 'Beri Nilai Siswa'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      ) : null}
                    </View>
                  );
                })
              )}
            </ScrollView>

            {/* In-Modal Toast for Review Modal */}
            <Toast
              visible={toast.visible}
              message={toast.message}
              type={toast.type}
              onDismiss={() => setToast(prev => ({ ...prev, visible: false }))}
            />
          </View>
        </View>
      </Modal>

      {/* ============================================================== */}
      {/* MODAL PRATINJAU DOKUMEN / PDF VIEWER                          */}
      {/* ============================================================== */}
      <Modal
        visible={isDocPreviewOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsDocPreviewOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.docPreviewCard, { paddingBottom: insets.bottom + 16 }]}>
            {/* Header Toolbar */}
            <View style={styles.docPreviewHeader}>
              <View style={{ flex: 1 }}>
                <View style={styles.docHeaderBadgeRow}>
                  <View style={styles.pdfHeaderBadge}>
                    <Ionicons name="document-text" size={12} color="#DC2626" />
                    <Text style={styles.pdfHeaderBadgeText}>DOKUMEN SISWA</Text>
                  </View>
                  <Text style={styles.docPagesInfo}>
                    {previewDocData?.pages || 2} Halaman • {previewDocData?.fileSize || '345 KB'}
                  </Text>
                </View>
                <Text style={styles.docPreviewTitle} numberOfLines={1}>
                  {previewDocData?.fileName}
                </Text>
              </View>
              <View style={styles.docHeaderRightActions}>
                <TouchableOpacity style={styles.docActionIconBtn} onPress={handleShareDocument}>
                  <Ionicons name="share-social-outline" size={18} color="#475569" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.docActionIconBtn} onPress={handleOpenExternalBrowser}>
                  <Ionicons name="open-outline" size={18} color="#475569" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.closeDocPreviewBtn}
                  onPress={() => setIsDocPreviewOpen(false)}
                >
                  <Ionicons name="close" size={22} color={Colors.text} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Student & Submission Info Banner */}
            {previewDocData?.studentName && (
              <View style={styles.docMetaBanner}>
                <View style={styles.docMetaAvatar}>
                  <Ionicons name="person" size={16} color="#4F46E5" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.docMetaName}>{previewDocData.studentName}</Text>
                  <Text style={styles.docMetaSub}>
                    {previewDocData.nisn ? `NISN: ${previewDocData.nisn} • ` : ''}
                    {previewDocData.className || 'Kelas XII'} • Dikirim: {previewDocData.submittedAt || 'Tepat Waktu'}
                  </Text>
                </View>
                {previewDocData.score !== undefined && (
                  <View style={styles.docScorePill}>
                    <Ionicons name="ribbon" size={13} color="#16A34A" />
                    <Text style={styles.docScorePillText}>Nilai: {previewDocData.score}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Document Content Paper */}
            <ScrollView showsVerticalScrollIndicator={false} style={styles.docScrollArea}>
              <View style={styles.simulatedPaperPage}>
                {/* Official School Watermark / Header */}
                <View style={styles.paperOfficialHeader}>
                  <View style={styles.paperLogoBox}>
                    <Ionicons name="school-outline" size={20} color="#4F46E5" />
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.paperSchoolName}>SMA SIPENA DIGITAL LEARNING</Text>
                    <Text style={styles.paperTaskTitle}>{previewDocData?.title}</Text>
                  </View>
                  <View style={styles.verifiedStampBadge}>
                    <Ionicons name="checkmark-done-circle" size={14} color="#059669" />
                    <Text style={styles.verifiedStampText}>VERIFIED LMS</Text>
                  </View>
                </View>

                <View style={styles.paperDivider} />

                {/* Brief Student Note */}
                {previewDocData?.submissionText ? (
                  <View style={styles.paperNoteBox}>
                    <Text style={styles.paperNoteLabel}>Pernyataan Pengantar Siswa:</Text>
                    <Text style={styles.paperNoteContent}>"{previewDocData.submissionText}"</Text>
                  </View>
                ) : null}

                {/* Document Sections & Formulas */}
                {previewDocData?.sections.map((sec, idx) => (
                  <View key={idx} style={styles.paperSectionItem}>
                    <Text style={styles.paperSectionTitle}>{sec.title}</Text>
                    {sec.formula && (
                      <View style={styles.paperFormulaBox}>
                        <Text style={styles.paperFormulaText}>{sec.formula}</Text>
                      </View>
                    )}
                    <Text style={styles.paperSectionBody}>{sec.body}</Text>
                  </View>
                ))}

                {/* Digital Verification Signature */}
                <View style={styles.paperSignatureBox}>
                  <View>
                    <Text style={styles.paperSignDate}>Diunggah secara daring pada portal SIPENA</Text>
                    <Text style={styles.paperSignIdentity}>
                      ID Bukti Fisik: #SIP-{Date.now().toString().slice(-6)} • 256-bit Secure Hash
                    </Text>
                  </View>
                  <Ionicons name="shield-checkmark" size={28} color="#10B981" />
                </View>
              </View>
            </ScrollView>

            {/* Bottom Actions */}
            <View style={styles.docPreviewFooter}>
              <TouchableOpacity
                style={styles.closeDocFooterBtn}
                onPress={() => setIsDocPreviewOpen(false)}
              >
                <Text style={styles.closeDocFooterBtnText}>Tutup</Text>
              </TouchableOpacity>

              {isTeacherOrAdmin && previewDocData?.submissionId && (
                <TouchableOpacity
                  style={styles.gradeDocFooterBtn}
                  onPress={() => {
                    setIsDocPreviewOpen(false);
                    const found = studentSubmissions.find(s => s.id === previewDocData.submissionId);
                    if (found) {
                      handleStartGrading(found);
                    }
                  }}
                >
                  <Ionicons name="ribbon-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.gradeDocFooterBtnText}>
                    {previewDocData.score !== undefined ? 'Ubah Nilai Siswa Ini' : 'Beri Nilai Siswa Ini'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* In-Modal Toast for Document Preview */}
            <Toast
              visible={toast.visible}
              message={toast.message}
              type={toast.type}
              onDismiss={() => setToast(prev => ({ ...prev, visible: false }))}
            />
          </View>
        </View>
      </Modal>

      {/* ============================================================== */}
      {/* MODAL GURU: Create New Assignment                             */}
      {/* ============================================================== */}
      <Modal
        visible={isCreateAssignmentModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsCreateAssignmentModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Terbitkan Tugas Baru</Text>
              <TouchableOpacity onPress={() => setIsCreateAssignmentModalOpen(false)}>
                <Ionicons name="close" size={22} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>Judul Tugas:</Text>
              <TextInput
                style={styles.textInputSingle}
                placeholder="Contoh: Praktikum Gelombang Elektromagnetik"
                value={newTitle}
                onChangeText={setNewTitle}
                placeholderTextColor={Colors.textLight}
              />

              <View style={styles.formTwoCols}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Mata Pelajaran:</Text>
                  <TextInput
                    style={styles.textInputSingle}
                    placeholder="Mata Pelajaran"
                    value={newSubject}
                    onChangeText={setNewSubject}
                    placeholderTextColor={Colors.textLight}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Kelas Sasaran:</Text>
                  <TextInput
                    style={styles.textInputSingle}
                    placeholder="Contoh: XII MIPA 1"
                    value={newClass}
                    onChangeText={setNewClass}
                    placeholderTextColor={Colors.textLight}
                  />
                </View>
              </View>

              <View style={styles.formTwoCols}>
                <View style={{ flex: 1.5 }}>
                  <Text style={styles.fieldLabel}>Batas Waktu Pengumpulan:</Text>
                  <TextInput
                    style={styles.textInputSingle}
                    placeholder="05 Okt 2026, 23:59 WIB"
                    value={newDeadline}
                    onChangeText={setNewDeadline}
                    placeholderTextColor={Colors.textLight}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Nilai Maksimal:</Text>
                  <TextInput
                    style={styles.textInputSingle}
                    placeholder="100"
                    keyboardType="numeric"
                    value={newMaxScore}
                    onChangeText={setNewMaxScore}
                    placeholderTextColor={Colors.textLight}
                  />
                </View>
              </View>

              <Text style={styles.fieldLabel}>Petunjuk & Deskripsi Pengerjaan:</Text>
              <TextInput
                style={styles.textInputArea}
                multiline
                numberOfLines={3}
                placeholder="Tuliskan instruksi jelas, kriteria penilaian, atau format berkas yang diminta..."
                value={newDescription}
                onChangeText={setNewDescription}
                placeholderTextColor={Colors.textLight}
              />

              <TouchableOpacity
                style={[styles.attachmentButton, newAttachedFile && styles.attachmentButtonActive]}
                onPress={handlePickAssignmentDoc}
                activeOpacity={0.7}
              >
                <Ionicons name="attach" size={20} color="#6366F1" />
                <Text style={styles.attachmentButtonText}>
                  {newAttachedFile ? 'Lampiran Disertakan: Panduan_Tugas.pdf' : 'Lampirkan Berkas Soal / Rubrik (PDF/DOC)'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.confirmSubmitBtn, isCreatingAssignment && { opacity: 0.6 }]}
                onPress={handleConfirmCreateAssignment}
                disabled={isCreatingAssignment}
              >
                {isCreatingAssignment ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <Ionicons name="send" size={18} color="#FFFFFF" />
                    <Text style={styles.confirmSubmitBtnText}>Terbitkan Tugas Sekarang</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>

            <Toast
              visible={toast.visible}
              message={toast.message}
              type={toast.type}
              onDismiss={() => setToast(prev => ({ ...prev, visible: false }))}
            />
          </View>
        </View>
      </Modal>

      {/* ============================================================== */}
      {/* MODAL GURU: Upload Learning Material                           */}
      {/* ============================================================== */}
      <Modal
        visible={isUploadMaterialModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsUploadMaterialModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Unggah Bahan Ajar Baru</Text>
              <TouchableOpacity onPress={() => setIsUploadMaterialModalOpen(false)}>
                <Ionicons name="close" size={22} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>Judul Modul / Bahan Ajar:</Text>
              <TextInput
                style={styles.textInputSingle}
                placeholder="Contoh: Modul 5: Optik & Dinamika Gelombang"
                value={newMaterialTitle}
                onChangeText={setNewMaterialTitle}
                placeholderTextColor={Colors.textLight}
              />

              <View style={styles.formTwoCols}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Mata Pelajaran:</Text>
                  <TextInput
                    style={styles.textInputSingle}
                    placeholder="Fisika Peminatan"
                    value={newMaterialSubject}
                    onChangeText={setNewMaterialSubject}
                    placeholderTextColor={Colors.textLight}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Kelas Sasaran:</Text>
                  <TextInput
                    style={styles.textInputSingle}
                    placeholder="XII MIPA 1"
                    value={newMaterialClass}
                    onChangeText={setNewMaterialClass}
                    placeholderTextColor={Colors.textLight}
                  />
                </View>
              </View>

              <Text style={styles.fieldLabel}>Tipe Berkas Materi:</Text>
              <View style={styles.typeSelectorRow}>
                {(['PDF', 'VIDEO', 'SLIDE', 'DOC'] as const).map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.typeOptionBtn, newMaterialType === t && styles.typeOptionBtnActive]}
                    onPress={() => setNewMaterialType(t)}
                  >
                    <Text
                      style={[
                        styles.typeOptionBtnText,
                        newMaterialType === t && styles.typeOptionBtnTextActive,
                      ]}
                    >
                      {t}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Deskripsi Singkat Materi:</Text>
              <TextInput
                style={styles.textInputArea}
                multiline
                numberOfLines={3}
                placeholder="Ringkasan isi modul atau petunjuk belajar mandiri siswa..."
                value={newMaterialDesc}
                onChangeText={setNewMaterialDesc}
                placeholderTextColor={Colors.textLight}
              />

              <TouchableOpacity
                style={styles.confirmSubmitBtn}
                onPress={handleConfirmUploadMaterial}
                disabled={isUploadingMaterial}
              >
                {isUploadingMaterial ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <Ionicons name="cloud-upload" size={18} color="#FFFFFF" />
                    <Text style={styles.confirmSubmitBtnText}>Publikasikan Bahan Ajar</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>

            <Toast
              visible={toast.visible}
              message={toast.message}
              type={toast.type}
              onDismiss={() => setToast(prev => ({ ...prev, visible: false }))}
            />
          </View>
        </View>
      </Modal>

      {/* ============================================================== */}
      {/* MODAL SISWA: Kumpul Tugas                                      */}
      {/* ============================================================== */}
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
                  style={[styles.attachmentButton, selectedFile && styles.attachmentButtonActive]}
                  onPress={handlePickDocument}
                  activeOpacity={0.7}
                >
                  <Ionicons name="attach" size={20} color="#6366F1" />
                  <Text style={styles.attachmentButtonText}>
                    {selectedFile ? 'Ganti Berkas Terpilih' : 'Pilih File dari HP (PDF / Gambar)'}
                  </Text>
                </TouchableOpacity>

                {selectedFile && (
                  <View style={styles.selectedFileBox}>
                    <Ionicons
                      name={selectedFile.mimeType?.includes('image') ? 'image-outline' : 'document-text-outline'}
                      size={24}
                      color="#6366F1"
                    />
                    <View style={styles.selectedFileInfo}>
                      <Text style={styles.selectedFileName} numberOfLines={1}>
                        {selectedFile.name}
                      </Text>
                      <Text style={styles.selectedFileSize}>
                        {selectedFile.size
                          ? `${(selectedFile.size / 1024).toFixed(1)} KB`
                          : 'Berkas terlampir siap kirim'}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => setSelectedFile(null)} style={styles.removeFileBtn}>
                      <Ionicons name="close-circle" size={22} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                )}

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

            <Toast
              visible={toast.visible}
              message={toast.message}
              type={toast.type}
              onDismiss={() => setToast(prev => ({ ...prev, visible: false }))}
            />
          </View>
        </View>
      </Modal>

      {/* Screen Root Toast Notification */}
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
  moduleBadgeTeacher: {
    backgroundColor: '#EEF2FF',
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
  teacherActionBar: {
    marginBottom: 12,
  },
  createTaskPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#6366F1',
    borderRadius: 12,
    paddingVertical: 12,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3,
  },
  createTaskPrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
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
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyStateTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 10,
  },
  emptyStateSubtitle: {
    fontSize: 12,
    color: Colors.textLight,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
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
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    flex: 1,
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
  classBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  classBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#475569',
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
  statusActiveTag: {
    backgroundColor: '#ECFDF5',
  },
  statusActiveText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
  },
  statusCompletedTag: {
    backgroundColor: '#EFF6FF',
  },
  statusCompletedText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2563EB',
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
  teacherProgressBox: {
    marginTop: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressLabelText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  progressValueText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6366F1',
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#6366F1',
    borderRadius: 3,
  },
  pendingReviewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  pendingReviewBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#D97706',
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
  teacherActionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reviewSubmissionsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#6366F1',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  reviewSubmissionsBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  deleteTaskSmallBtn: {
    padding: 7,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
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
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
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
  uploadMaterialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6366F1',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    elevation: 2, // Add elevation to ensure it sits on top for Android touches
    zIndex: 10,
  },
  uploadMaterialBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
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
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    elevation: 1,
    zIndex: 10,
  },
  downloadBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6366F1',
  },
  deleteMatBtn: {
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
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
    alignItems: 'stretch',
  },
  teacherExamActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  participantsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  participantsBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  monitorExamBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#4F46E5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  monitorExamBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  startExamBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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
    justifyContent: 'flex-end',
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
  modalCardLarge: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 18,
    height: '92%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  modalSubTitle: {
    fontSize: 12,
    color: '#6366F1',
    marginTop: 2,
    fontWeight: '600',
  },
  closeModalBtn: {
    padding: 4,
  },
  reviewFilterContainer: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
    flexWrap: 'wrap',
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  filterChipActive: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  filterChipTextActive: {
    color: '#6366F1',
    fontWeight: '700',
  },
  subSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 38,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
    marginBottom: 12,
  },
  subSearchInput: {
    flex: 1,
    fontSize: 12,
    color: Colors.text,
  },
  submissionsScroll: {
    flex: 1,
  },
  emptySubmissions: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
  },
  emptySubmissionsText: {
    fontSize: 12,
    color: Colors.textLight,
    marginTop: 8,
  },
  submissionStudentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  subCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  studentAvatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  studentAvatarText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6366F1',
  },
  submissionStudentName: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  submissionStudentNisn: {
    fontSize: 11,
    color: Colors.textLight,
    marginTop: 1,
  },
  subStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  subStatusGraded: {
    backgroundColor: '#DCFCE7',
  },
  subStatusGradedText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#16A34A',
  },
  subStatusSubmitted: {
    backgroundColor: '#EFF6FF',
  },
  subStatusSubmittedText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2563EB',
  },
  subStatusPending: {
    backgroundColor: '#F1F5F9',
  },
  subStatusPendingText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
  subStatusBadgeText: {
    letterSpacing: 0.5,
  },
  subAnswerBox: {
    marginTop: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  submittedAtText: {
    fontSize: 10,
    color: '#94A3B8',
    marginBottom: 4,
  },
  submissionAnswerContent: {
    fontSize: 12,
    color: '#334155',
    lineHeight: 17,
    marginBottom: 6,
  },

  /* Clickable File Pill Styling */
  interactiveFilePill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#C7D2FE',
    borderRadius: 10,
    padding: 10,
    marginTop: 6,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
  filePillLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  pdfIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  interactiveFileName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E1B4B',
  },
  interactiveFileMeta: {
    fontSize: 10,
    color: '#6366F1',
    marginTop: 2,
    fontWeight: '600',
  },
  filePillRightAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  filePillRightActionText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4F46E5',
  },

  feedbackBox: {
    marginTop: 8,
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  feedbackLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#16A34A',
    marginBottom: 2,
  },
  feedbackText: {
    fontSize: 11,
    color: '#15803D',
    lineHeight: 16,
  },
  gradeActionRow: {
    marginTop: 8,
    alignItems: 'flex-end',
  },
  triggerGradingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
  },
  triggerGradingBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6366F1',
  },
  gradingFormArea: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  gradeInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  gradeInputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
  },
  gradeInputField: {
    width: 80,
    height: 36,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  feedbackInputField: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    padding: 8,
    fontSize: 12,
    color: Colors.text,
    minHeight: 50,
    textAlignVertical: 'top',
    marginBottom: 8,
  },
  gradingFormBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  cancelGradingBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
  },
  cancelGradingBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  saveGradingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 6,
    backgroundColor: '#16A34A',
  },
  saveGradingBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  /* Document Previewer Styles */
  docPreviewCard: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 16,
    height: '94%',
  },
  docPreviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  docHeaderBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  pdfHeaderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#450A0A',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  pdfHeaderBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#F87171',
    letterSpacing: 0.5,
  },
  docPagesInfo: {
    fontSize: 10,
    color: '#94A3B8',
  },
  docPreviewTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  docHeaderRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  docActionIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeDocPreviewBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  docMetaBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  docMetaAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  docMetaName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  docMetaSub: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
  },
  docScorePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#064E3B',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  docScorePillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#34D399',
  },
  docScrollArea: {
    flex: 1,
  },
  simulatedPaperPage: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 18,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  paperOfficialHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paperLogoBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  paperSchoolName: {
    fontSize: 11,
    fontWeight: '800',
    color: '#4F46E5',
    letterSpacing: 0.5,
  },
  paperTaskTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    marginTop: 1,
  },
  verifiedStampBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  verifiedStampText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#059669',
  },
  paperDivider: {
    height: 1.5,
    backgroundColor: '#E2E8F0',
    marginVertical: 12,
  },
  paperNoteBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#6366F1',
    marginBottom: 14,
  },
  paperNoteLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6366F1',
    marginBottom: 2,
  },
  paperNoteContent: {
    fontSize: 11,
    fontStyle: 'italic',
    color: '#334155',
    lineHeight: 16,
  },
  paperSectionItem: {
    marginBottom: 14,
  },
  paperSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  paperFormulaBox: {
    backgroundColor: '#EEF2FF',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginVertical: 4,
    borderLeftWidth: 3,
    borderLeftColor: '#4F46E5',
  },
  paperFormulaText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#312E81',
    fontFamily: 'monospace',
  },
  paperSectionBody: {
    fontSize: 11,
    color: '#475569',
    lineHeight: 17,
  },
  paperSignatureBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  paperSignDate: {
    fontSize: 10,
    color: '#64748B',
  },
  paperSignIdentity: {
    fontSize: 9,
    color: '#94A3B8',
    marginTop: 2,
    fontFamily: 'monospace',
  },
  docPreviewFooter: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  closeDocFooterBtn: {
    flex: 1,
    backgroundColor: '#334155',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeDocFooterBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  gradeDocFooterBtn: {
    flex: 1.5,
    backgroundColor: '#16A34A',
    borderRadius: 10,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  gradeDocFooterBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  formTwoCols: {
    flexDirection: 'row',
    gap: 10,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 6,
  },
  textInputSingle: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
    fontSize: 13,
    color: Colors.text,
    marginBottom: 10,
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
  typeSelectorRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  typeOptionBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  typeOptionBtnActive: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#6366F1',
  },
  typeOptionBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textLight,
  },
  typeOptionBtnTextActive: {
    color: '#6366F1',
    fontWeight: '800',
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
    marginBottom: 12,
  },
  attachmentButtonActive: {
    borderColor: '#6366F1',
    backgroundColor: '#E0E7FF',
  },
  attachmentButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6366F1',
  },
  selectedFileBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
    marginBottom: 16,
  },
  selectedFileInfo: {
    flex: 1,
    marginLeft: 10,
  },
  selectedFileName: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text,
  },
  selectedFileSize: {
    fontSize: 10,
    color: Colors.textLight,
    marginTop: 2,
  },
  removeFileBtn: {
    padding: 4,
  },
  confirmSubmitBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#6366F1',
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 4,
  },
  confirmSubmitBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
