import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  FlatList,
  Switch,
  Platform,
  AppState,
  Alert,
  Dimensions,
  Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import Colors from '../../constants/Colors';
import { Toast, ToastType } from '../../components/ui/Toast';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { CameraView, useCameraPermissions } from 'expo-camera';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Interface Types
interface Exam {
  id: string;
  title: string;
  type: string;
  subject_id: number;
  class_id?: number | null;
  duration: number;
  start_time: string;
  end_time: string;
  token?: string | null;
  level?: string;
  is_active: boolean;
  proctor_enabled: boolean;
  proctor_face_detect: boolean;
  proctor_tab_lock: boolean;
  proctor_max_warnings: number;
  proctor_face_tolerance?: number;
  subject?: { id: number; name: string };
  class?: { id: number; name: string; level: number };
  _count?: { questions: number; results: number };
  results?: Array<{
    id: string;
    student_id: string;
    score_total: number;
    score_pg: number;
    status: string;
    finished_at?: string;
  }>;
}

interface Question {
  id: string;
  exam_id: string;
  text: string;
  type: 'PG' | 'ESAI';
  options: string | { [key: string]: string };
  answer: string;
  score_weight: number;
  passage_id?: string | null;
  passage?: {
    id: string;
    title: string;
    content: string;
  } | null;
}

interface Passage {
  id: string;
  subject_id: number;
  title: string;
  content: string;
}

interface ExamResult {
  id: string;
  student_id: string;
  student?: { id: string; name: string; nisn?: string };
  score_total: number;
  score_pg: number;
  status: string;
  started_at: string;
  finished_at?: string;
}

export default function CbtScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Authentication & User Data
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string>('');
  const [apiUrl, setApiUrl] = useState<string>('');
  const [role, setRole] = useState<'guru' | 'siswa' | 'admin'>('guru');

  // Master Data
  const [exams, setExams] = useState<Exam[]>([]);
  const [subjects, setSubjects] = useState<Array<{ id: number; name: string }>>([]);
  const [classes, setClasses] = useState<Array<{ id: number; name: string; level: number }>>([]);
  const [teacherSubjects, setTeacherSubjects] = useState<Array<{ id: number; name: string }>>([]);
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<number | 'ALL'>('ALL');
  const [loading, setLoading] = useState<boolean>(true);

  // Toast Notification
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: ToastType }>({
    visible: false,
    message: '',
    type: 'info',
  });

  const showToast = (message: string, type: ToastType = 'info') => {
    setToast({ visible: true, message, type });
  };

  // -------------------------------------------------------------
  // TEACHER MODALS & STATES
  // -------------------------------------------------------------
  // Create / Edit Exam Modal
  const [isExamModalOpen, setIsExamModalOpen] = useState(false);
  const [editingExamId, setEditingExamId] = useState<string | null>(null);
  const [examForm, setExamForm] = useState({
    title: '',
    type: 'UH',
    subject_id: '',
    class_id: '',
    duration: '60',
    start_time: '',
    end_time: '',
    token: '',
    level: '10',
    proctor_enabled: true,
    proctor_face_detect: true,
    proctor_tab_lock: true,
    proctor_max_warnings: '5',
    proctor_face_tolerance: '10',
  });

  // Question Management Modal
  const [isQuestionsModalOpen, setIsQuestionsModalOpen] = useState(false);
  const [selectedExamForQuestions, setSelectedExamForQuestions] = useState<Exam | null>(null);
  const [examQuestions, setExamQuestions] = useState<Question[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [questionTab, setQuestionTab] = useState<'list' | 'create_pg' | 'create_passage' | 'bank'>('list');

  // Form New Question (PG)
  const [questionForm, setQuestionForm] = useState({
    text: '',
    type: 'PG',
    optionA: '',
    optionB: '',
    optionC: '',
    optionD: '',
    optionE: '',
    answer: 'A',
    score_weight: '1',
    passage_id: '',
  });

  // Form New Passage (Soal Cerita / Wacana)
  const [passageForm, setPassageForm] = useState({
    title: '',
    content: '',
  });
  const [availablePassages, setAvailablePassages] = useState<Passage[]>([]);

  // Bank Questions in Exam Modal
  const [bankQuestions, setBankQuestions] = useState<any[]>([]);
  const [selectedBankIds, setSelectedBankIds] = useState<string[]>([]);
  const [loadingBank, setLoadingBank] = useState(false);

  // -------------------------------------------------------------
  // STANDALONE BANK SOAL STATES (Kelola Bank Soal Kapan Saja)
  // -------------------------------------------------------------
  const [isStandaloneBankModalOpen, setIsStandaloneBankModalOpen] = useState(false);
  const [standaloneBankTab, setStandaloneBankTab] = useState<'list' | 'create_pg' | 'create_passage' | 'ai'>('list');
  const [bankSubjectFilter, setBankSubjectFilter] = useState<number | 'ALL'>('ALL');
  const [bankLevelFilter, setBankLevelFilter] = useState<string>('ALL');
  const [bankSearchKeyword, setBankSearchKeyword] = useState<string>('');
  const [bankItems, setBankItems] = useState<any[]>([]);
  const [loadingBankItems, setLoadingBankItems] = useState<boolean>(false);
  const [editingBankQuestionId, setEditingBankQuestionId] = useState<string | null>(null);

  // Form Bank Question (PG)
  const [bankQuestionForm, setBankQuestionForm] = useState({
    subject_id: '',
    level: '10',
    topic: '',
    text: '',
    type: 'PG',
    optionA: '',
    optionB: '',
    optionC: '',
    optionD: '',
    optionE: '',
    answer: 'A',
    score_weight: '1',
    passage_id: '',
  });

  // Form Bank Passage (Wacana / Cerita)
  const [bankPassageForm, setBankPassageForm] = useState({
    subject_id: '',
    title: '',
    content: '',
  });
  const [bankPassagesList, setBankPassagesList] = useState<Passage[]>([]);

  // AI Generator Form in Bank Soal
  const [bankAiForm, setBankAiForm] = useState({
    subject_id: '',
    level: '10',
    topic: '',
    count: '5',
    passage_id: '',
  });
  const [generatingBankAi, setGeneratingBankAi] = useState(false);
  const [aiPreviewMode, setAiPreviewMode] = useState(false);
  const [aiGeneratedQuestions, setAiGeneratedQuestions] = useState<any[]>([]);
  const [selectedAiIndices, setSelectedAiIndices] = useState<number[]>([]);
  const [isSavingAiBatch, setIsSavingAiBatch] = useState(false);

  // Results & Monitoring Modal
  const [isResultsModalOpen, setIsResultsModalOpen] = useState(false);
  const [selectedExamForResults, setSelectedExamForResults] = useState<Exam | null>(null);
  const [examResults, setExamResults] = useState<ExamResult[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const [selectedStudentLogs, setSelectedStudentLogs] = useState<any[]>([]);
  const [isLogsModalOpen, setIsLogsModalOpen] = useState(false);
  const [logStudentName, setLogStudentName] = useState('');

  // -------------------------------------------------------------
  // STUDENT EXAM ARENA STATES
  // -------------------------------------------------------------
  const [isStudentExamModalOpen, setIsStudentExamModalOpen] = useState(false);
  const [activeStudentExam, setActiveStudentExam] = useState<Exam | null>(null);
  const [studentQuestions, setStudentQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [studentAnswers, setStudentAnswers] = useState<{ [questionId: string]: string }>({});
  const [doubtfulAnswers, setDoubtfulAnswers] = useState<{ [questionId: string]: boolean }>({});
  const [timeLeftSeconds, setTimeLeftSeconds] = useState(0);
  const [isSubmittingExam, setIsSubmittingExam] = useState(false);
  const [isTokenPromptOpen, setIsTokenPromptOpen] = useState(false);
  const [inputToken, setInputToken] = useState('');
  const [pendingExamToStart, setPendingExamToStart] = useState<Exam | null>(null);
  const [isNavDrawerOpen, setIsNavDrawerOpen] = useState(false);
  const [examResultSummary, setExamResultSummary] = useState<any | null>(null);

  // Camera & Anti-Cheat Proctoring for Student
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [proctorWarningCount, setProctorWarningCount] = useState(0);
  const [isCameraBoxMinimized, setIsCameraBoxMinimized] = useState(false);

  // -------------------------------------------------------------
  // INITIALIZATION
  // -------------------------------------------------------------
  useEffect(() => {
    loadUserAndInit();
  }, []);

  const loadUserAndInit = async () => {
    setLoading(true);
    try {
      const storedUser = await SecureStore.getItemAsync('sipena_user');
      const storedToken = await SecureStore.getItemAsync('sipena_token');
      const storedApiUrl = await SecureStore.getItemAsync('sipena_api_url');

      if (!storedUser || !storedToken || !storedApiUrl) {
        showToast('Sesi tidak valid. Harap login kembali.', 'error');
        setLoading(false);
        return;
      }

      const userObj = JSON.parse(storedUser);
      setUser(userObj);
      setToken(storedToken);
      setApiUrl(storedApiUrl);

      const roleStr = (userObj.role || '').toLowerCase();
      const detectedRole = roleStr.includes('guru') ? 'guru' : (roleStr.includes('siswa') ? 'siswa' : 'admin');
      setRole(detectedRole);

      if (detectedRole === 'guru' || detectedRole === 'admin') {
        await fetchTeacherMasterData(storedApiUrl, storedToken, userObj);
        await fetchExamsList(storedApiUrl, storedToken);
      } else {
        await fetchStudentExamsList(storedApiUrl, storedToken);
      }
    } catch (err: any) {
      console.error('Init CBT Error:', err);
      showToast('Gagal memuat sistem CBT: ' + (err.message || ''), 'error');
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------------
  // DATA FETCHING: TEACHER
  // -------------------------------------------------------------
  const fetchTeacherMasterData = async (url: string, jwt: string, userObj: any) => {
    try {
      const [resSubjects, resClasses, resSchedules] = await Promise.allSettled([
        axios.get(`${url}/api/subjects`, { headers: { Authorization: `Bearer ${jwt}` } }),
        axios.get(`${url}/api/classes`, { headers: { Authorization: `Bearer ${jwt}` } }),
        axios.get(`${url}/api/schedules`, { headers: { Authorization: `Bearer ${jwt}` } }),
      ]);

      let allSubj: Array<{ id: number; name: string }> = [];
      if (resSubjects.status === 'fulfilled' && resSubjects.value.data?.data) {
        allSubj = resSubjects.value.data.data.map((s: any) => ({ id: Number(s.id), name: s.name }));
        setSubjects(allSubj);
      }

      if (resClasses.status === 'fulfilled' && resClasses.value.data?.data) {
        const cls = resClasses.value.data.data.map((c: any) => ({
          id: Number(c.id),
          name: c.name,
          level: Number(c.level || 10),
        }));
        setClasses(cls);
      }

      // Filter teacher subjects from schedule or profile
      if (userObj.teacher_id && resSchedules.status === 'fulfilled' && resSchedules.value.data?.data) {
        const scheds = resSchedules.value.data.data;
        const myScheds = scheds.filter((s: any) => String(s.teacher_id) === String(userObj.teacher_id));
        const uniqueSubjs = new Map<number, string>();
        myScheds.forEach((s: any) => {
          if (s.subject_id && s.subject?.name) {
            uniqueSubjs.set(Number(s.subject_id), s.subject.name);
          }
        });

        if (uniqueSubjs.size > 0) {
          const teacherSubjList = Array.from(uniqueSubjs.entries()).map(([id, name]) => ({ id, name }));
          setTeacherSubjects(teacherSubjList);
        } else {
          setTeacherSubjects(allSubj);
        }
      } else {
        setTeacherSubjects(allSubj);
      }
    } catch (e) {
      console.warn('Gagal memuat master data CBT:', e);
    }
  };

  const fetchExamsList = async (url?: string, jwt?: string) => {
    try {
      const targetUrl = url || apiUrl;
      const targetToken = jwt || token;
      const res = await axios.get(`${targetUrl}/api/exams`, {
        headers: { Authorization: `Bearer ${targetToken}` },
      });
      if (res.data?.data) {
        setExams(res.data.data);
      }
    } catch (e: any) {
      console.error('Fetch exams error:', e);
    }
  };

  // -------------------------------------------------------------
  // DATA FETCHING: STUDENT
  // -------------------------------------------------------------
  const fetchStudentExamsList = async (url?: string, jwt?: string) => {
    try {
      const targetUrl = url || apiUrl;
      const targetToken = jwt || token;
      const res = await axios.get(`${targetUrl}/api/exams/student`, {
        headers: { Authorization: `Bearer ${targetToken}` },
      });
      if (res.data?.data) {
        setExams(res.data.data);
      }
    } catch (e: any) {
      console.error('Fetch student exams error:', e);
    }
  };

  // -------------------------------------------------------------
  // TEACHER: CREATE / EDIT EXAM
  // -------------------------------------------------------------
  const generateRandomToken = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let res = '';
    for (let i = 0; i < 6; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return res;
  };

  const openCreateExamModal = () => {
    const now = new Date();
    const startStr = now.toISOString().slice(0, 16).replace('T', ' ');
    const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const endStr = end.toISOString().slice(0, 16).replace('T', ' ');

    const defaultSubjectId = teacherSubjects.length > 0 ? String(teacherSubjects[0].id) : (subjects.length > 0 ? String(subjects[0].id) : '');
    const defaultClassId = classes.length > 0 ? String(classes[0].id) : '';

    setEditingExamId(null);
    setExamForm({
      title: '',
      type: 'UH',
      subject_id: defaultSubjectId,
      class_id: defaultClassId,
      duration: '60',
      start_time: startStr,
      end_time: endStr,
      token: generateRandomToken(),
      level: '10',
      proctor_enabled: true,
      proctor_face_detect: true,
      proctor_tab_lock: true,
      proctor_max_warnings: '5',
      proctor_face_tolerance: '10',
    });
    setIsExamModalOpen(true);
  };

  const openEditExamModal = (exam: Exam) => {
    setEditingExamId(exam.id);
    setExamForm({
      title: exam.title,
      type: exam.type || 'UH',
      subject_id: String(exam.subject_id),
      class_id: exam.class_id ? String(exam.class_id) : '',
      duration: String(exam.duration || 60),
      start_time: exam.start_time ? exam.start_time.slice(0, 16).replace('T', ' ') : '',
      end_time: exam.end_time ? exam.end_time.slice(0, 16).replace('T', ' ') : '',
      token: exam.token || '',
      level: exam.level || '10',
      proctor_enabled: !!exam.proctor_enabled,
      proctor_face_detect: exam.proctor_face_detect !== false,
      proctor_tab_lock: exam.proctor_tab_lock !== false,
      proctor_max_warnings: String(exam.proctor_max_warnings || 5),
      proctor_face_tolerance: String(exam.proctor_face_tolerance || 10),
    });
    setIsExamModalOpen(true);
  };

  const handleSaveExam = async () => {
    if (!examForm.title.trim()) {
      showToast('Judul Ujian wajib diisi!', 'warning');
      return;
    }
    if (!examForm.subject_id) {
      showToast('Pilih Mata Pelajaran terlebih dahulu!', 'warning');
      return;
    }

    try {
      const payload = {
        title: examForm.title.trim(),
        type: examForm.type,
        subject_id: Number(examForm.subject_id),
        class_id: examForm.class_id ? Number(examForm.class_id) : null,
        duration: Number(examForm.duration) || 60,
        start_time: examForm.start_time,
        end_time: examForm.end_time,
        token: examForm.token.trim() || generateRandomToken(),
        level: examForm.level,
        proctor_enabled: examForm.proctor_enabled,
        proctor_face_detect: examForm.proctor_face_detect,
        proctor_tab_lock: examForm.proctor_tab_lock,
        proctor_max_warnings: Number(examForm.proctor_max_warnings) || 5,
        proctor_face_tolerance: Number(examForm.proctor_face_tolerance) || 10,
      };

      if (editingExamId) {
        await axios.put(`${apiUrl}/api/exams/${editingExamId}`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
        showToast('Jadwal ujian berhasil diperbarui!', 'success');
      } else {
        await axios.post(`${apiUrl}/api/exams`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
        showToast('Jadwal ujian baru berhasil dibuat!', 'success');
      }

      setIsExamModalOpen(false);
      fetchExamsList();
    } catch (err: any) {
      console.error('Save exam error:', err);
      showToast('Gagal menyimpan jadwal ujian: ' + (err.response?.data?.message || err.message), 'error');
    }
  };

  const handleDeleteExam = (exam: Exam) => {
    Alert.alert(
      'Hapus Ujian?',
      `Seluruh data soal dan riwayat nilai untuk "${exam.title}" akan dihapus permanen.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Ya, Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              await axios.delete(`${apiUrl}/api/exams/${exam.id}`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              showToast('Ujian berhasil dihapus', 'info');
              fetchExamsList();
            } catch (e: any) {
              showToast('Gagal menghapus ujian: ' + (e.message || ''), 'error');
            }
          },
        },
      ]
    );
  };

  // -------------------------------------------------------------
  // TEACHER: QUESTIONS & PASSAGES (SOAL CERITA) MANAGEMENT
  // -------------------------------------------------------------
  const openQuestionsModal = async (exam: Exam) => {
    setSelectedExamForQuestions(exam);
    setIsQuestionsModalOpen(true);
    setQuestionTab('list');
    await fetchExamQuestionsAndPassages(exam.id, exam.subject_id);
  };

  const fetchExamQuestionsAndPassages = async (examId: string, subjectId: number) => {
    setLoadingQuestions(true);
    try {
      const [resQ, resP] = await Promise.allSettled([
        axios.get(`${apiUrl}/api/exams/${examId}/questions`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${apiUrl}/api/passages?subject_id=${subjectId}`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (resQ.status === 'fulfilled' && resQ.value.data?.data) {
        setExamQuestions(resQ.value.data.data);
      }
      if (resP.status === 'fulfilled' && resP.value.data?.data) {
        setAvailablePassages(resP.value.data.data);
      }
    } catch (e) {
      console.error('Error fetching questions:', e);
    } finally {
      setLoadingQuestions(false);
    }
  };

  const handleSaveQuestionPG = async () => {
    if (!questionForm.text.trim()) {
      showToast('Teks butir soal wajib diisi!', 'warning');
      return;
    }
    if (!questionForm.optionA.trim() || !questionForm.optionB.trim()) {
      showToast('Opsi A dan B wajib diisi!', 'warning');
      return;
    }

    try {
      const optionsObj: { [key: string]: string } = {
        A: questionForm.optionA.trim(),
        B: questionForm.optionB.trim(),
      };
      if (questionForm.optionC.trim()) optionsObj.C = questionForm.optionC.trim();
      if (questionForm.optionD.trim()) optionsObj.D = questionForm.optionD.trim();
      if (questionForm.optionE.trim()) optionsObj.E = questionForm.optionE.trim();

      const payload = {
        exam_id: selectedExamForQuestions?.id,
        text: questionForm.text.trim(),
        type: 'PG',
        options: JSON.stringify(optionsObj),
        answer: questionForm.answer,
        score_weight: Number(questionForm.score_weight) || 1,
        passage_id: questionForm.passage_id ? questionForm.passage_id : null,
      };

      await axios.post(`${apiUrl}/api/exams/questions`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      showToast('Soal Pilihan Ganda berhasil disimpan!', 'success');
      setQuestionForm({
        text: '',
        type: 'PG',
        optionA: '',
        optionB: '',
        optionC: '',
        optionD: '',
        optionE: '',
        answer: 'A',
        score_weight: '1',
        passage_id: '',
      });
      setQuestionTab('list');
      if (selectedExamForQuestions) {
        fetchExamQuestionsAndPassages(selectedExamForQuestions.id, selectedExamForQuestions.subject_id);
      }
    } catch (err: any) {
      showToast('Gagal menyimpan soal: ' + (err.response?.data?.message || err.message), 'error');
    }
  };

  const handleSavePassage = async () => {
    if (!passageForm.title.trim() || !passageForm.content.trim()) {
      showToast('Judul dan isi teks cerita wacana wajib diisi!', 'warning');
      return;
    }
    if (!selectedExamForQuestions?.subject_id) {
      showToast('Mata pelajaran tidak valid', 'warning');
      return;
    }

    try {
      const payload = {
        subject_id: selectedExamForQuestions.subject_id,
        title: passageForm.title.trim(),
        content: passageForm.content.trim(),
      };

      const res = await axios.post(`${apiUrl}/api/passages`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      showToast('Teks Cerita / Wacana berhasil dibuat!', 'success');
      setPassageForm({ title: '', content: '' });
      if (res.data?.data) {
        setAvailablePassages((prev) => [res.data.data, ...prev]);
        setQuestionForm((prev) => ({ ...prev, passage_id: String(res.data.data.id) }));
      }
      setQuestionTab('create_pg');
    } catch (err: any) {
      showToast('Gagal membuat wacana: ' + (err.response?.data?.message || err.message), 'error');
    }
  };

  const handleDeleteQuestion = (questionId: string) => {
    Alert.alert('Hapus Soal?', 'Butir soal ini akan dihapus dari ujian.', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          try {
            await axios.delete(`${apiUrl}/api/exams/questions/${questionId}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            showToast('Soal berhasil dihapus', 'info');
            if (selectedExamForQuestions) {
              fetchExamQuestionsAndPassages(selectedExamForQuestions.id, selectedExamForQuestions.subject_id);
            }
          } catch (e: any) {
            showToast('Gagal menghapus soal: ' + e.message, 'error');
          }
        },
      },
    ]);
  };

  const openBankTab = async () => {
    setQuestionTab('bank');
    setLoadingBank(true);
    try {
      const subjId = selectedExamForQuestions?.subject_id;
      const res = await axios.get(`${apiUrl}/api/question-bank${subjId ? `?subject_id=${subjId}` : ''}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data?.data) {
        setBankQuestions(res.data.data);
      }
    } catch (e) {
      console.error('Fetch bank questions error:', e);
    } finally {
      setLoadingBank(false);
    }
  };

  const handleImportBankQuestions = async () => {
    if (selectedBankIds.length === 0) {
      showToast('Pilih setidaknya 1 soal dari bank untuk diimpor!', 'warning');
      return;
    }
    try {
      await axios.post(
        `${apiUrl}/api/exams/${selectedExamForQuestions?.id}/import-bank`,
        { question_ids: selectedBankIds },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      showToast(`Berhasil mengimpor ${selectedBankIds.length} butir soal!`, 'success');
      setSelectedBankIds([]);
      setQuestionTab('list');
      if (selectedExamForQuestions) {
        fetchExamQuestionsAndPassages(selectedExamForQuestions.id, selectedExamForQuestions.subject_id);
      }
    } catch (e: any) {
      showToast('Gagal import soal: ' + e.message, 'error');
    }
  };

  // -------------------------------------------------------------
  // TEACHER: STANDALONE BANK SOAL MANAGEMENT (KAPAN SAJA)
  // -------------------------------------------------------------
  const openStandaloneBankModal = async () => {
    setIsStandaloneBankModalOpen(true);
    setStandaloneBankTab('list');
    setEditingBankQuestionId(null);
    setAiPreviewMode(false);
    setAiGeneratedQuestions([]);
    setSelectedAiIndices([]);

    const defaultSubjId = teacherSubjects.length > 0 ? teacherSubjects[0].id : (subjects.length > 0 ? subjects[0].id : '');
    const initialSubj = bankSubjectFilter === 'ALL' && defaultSubjId ? defaultSubjId : bankSubjectFilter;

    if (defaultSubjId) {
      setBankQuestionForm((prev) => ({ ...prev, subject_id: String(defaultSubjId) }));
      setBankPassageForm((prev) => ({ ...prev, subject_id: String(defaultSubjId) }));
      setBankAiForm((prev) => ({ ...prev, subject_id: String(defaultSubjId) }));
      fetchBankPassages(Number(defaultSubjId));
    }

    fetchBankQuestionsList(initialSubj, bankLevelFilter, bankSearchKeyword);
  };

  const fetchBankQuestionsList = async (subjId?: number | 'ALL', level?: string, search?: string) => {
    setLoadingBankItems(true);
    try {
      const params = new URLSearchParams();
      const targetSubj = subjId !== undefined ? subjId : bankSubjectFilter;
      if (targetSubj && targetSubj !== 'ALL') params.append('subject_id', String(targetSubj));
      const targetLevel = level !== undefined ? level : bankLevelFilter;
      if (targetLevel && targetLevel !== 'ALL') params.append('level', targetLevel);
      const targetSearch = search !== undefined ? search : bankSearchKeyword;
      if (targetSearch.trim()) params.append('search', targetSearch.trim());

      const res = await axios.get(`${apiUrl}/api/question-bank?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data?.data) {
        setBankItems(res.data.data);
      }
    } catch (e: any) {
      console.error('Fetch bank questions error:', e);
      showToast('Gagal memuat bank soal: ' + (e.message || ''), 'error');
    } finally {
      setLoadingBankItems(false);
    }
  };

  const fetchBankPassages = async (subjId: number) => {
    if (!subjId) return;
    try {
      const res = await axios.get(`${apiUrl}/api/passages?subject_id=${subjId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data) {
        const passList = Array.isArray(res.data) ? res.data : res.data.data || [];
        setBankPassagesList(passList);
      }
    } catch (e) {
      console.warn('Fetch passages error:', e);
    }
  };

  const handleEditBankQuestion = (item: any) => {
    setEditingBankQuestionId(String(item.id));
    const opts = typeof item.options === 'string' ? (() => { try { return JSON.parse(item.options); } catch { return {}; } })() : (item.options || {});
    setBankQuestionForm({
      subject_id: String(item.subject_id),
      level: item.level || '10',
      topic: item.topic || '',
      text: item.text || '',
      type: item.type || 'PG',
      optionA: opts.A || '',
      optionB: opts.B || '',
      optionC: opts.C || '',
      optionD: opts.D || '',
      optionE: opts.E || '',
      answer: item.answer || 'A',
      score_weight: String(item.score_weight || 1),
      passage_id: item.passage_id ? String(item.passage_id) : '',
    });
    fetchBankPassages(Number(item.subject_id));
    setStandaloneBankTab('create_pg');
  };

  const handleSaveBankQuestion = async (continueWithSamePassage = false) => {
    if (!bankQuestionForm.text.trim()) {
      showToast('Teks pertanyaan soal wajib diisi!', 'warning');
      return;
    }
    if (!bankQuestionForm.subject_id) {
      showToast('Pilih mata pelajaran terlebih dahulu!', 'warning');
      return;
    }
    if (!bankQuestionForm.optionA.trim() || !bankQuestionForm.optionB.trim()) {
      showToast('Opsi A dan B wajib diisi!', 'warning');
      return;
    }

    try {
      const optionsObj: { [key: string]: string } = {
        A: bankQuestionForm.optionA.trim(),
        B: bankQuestionForm.optionB.trim(),
      };
      if (bankQuestionForm.optionC.trim()) optionsObj.C = bankQuestionForm.optionC.trim();
      if (bankQuestionForm.optionD.trim()) optionsObj.D = bankQuestionForm.optionD.trim();
      if (bankQuestionForm.optionE.trim()) optionsObj.E = bankQuestionForm.optionE.trim();

      const payload = {
        id: editingBankQuestionId || undefined,
        subject_id: Number(bankQuestionForm.subject_id),
        level: bankQuestionForm.level,
        topic: bankQuestionForm.topic.trim(),
        text: bankQuestionForm.text.trim(),
        type: 'PG',
        options: JSON.stringify(optionsObj),
        answer: bankQuestionForm.answer,
        score_weight: Number(bankQuestionForm.score_weight) || 1,
        passage_id: bankQuestionForm.passage_id ? bankQuestionForm.passage_id : null,
      };

      await axios.post(`${apiUrl}/api/question-bank`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      showToast(
        editingBankQuestionId ? 'Soal di bank berhasil diperbarui!' : 'Soal berhasil disimpan ke Bank Soal!',
        'success'
      );

      if (continueWithSamePassage) {
        setEditingBankQuestionId(null);
        setBankQuestionForm((prev) => ({
          ...prev,
          text: '',
          optionA: '',
          optionB: '',
          optionC: '',
          optionD: '',
          optionE: '',
          answer: 'A',
          score_weight: '1',
        }));
      } else {
        setEditingBankQuestionId(null);
        setBankQuestionForm((prev) => ({
          ...prev,
          text: '',
          optionA: '',
          optionB: '',
          optionC: '',
          optionD: '',
          optionE: '',
          answer: 'A',
          score_weight: '1',
          passage_id: '',
        }));
        setStandaloneBankTab('list');
      }

      fetchBankQuestionsList(Number(bankQuestionForm.subject_id), bankQuestionForm.level);
    } catch (err: any) {
      showToast('Gagal menyimpan soal ke bank: ' + (err.response?.data?.message || err.message), 'error');
    }
  };

  const handleDeleteBankQuestion = (id: string, text: string) => {
    Alert.alert(
      'Hapus Soal dari Bank?',
      `Soal "${(text || '').replace(/<[^>]*>/g, '').slice(0, 45)}..." akan dihapus dari bank soal.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Ya, Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              await axios.delete(`${apiUrl}/api/question-bank/${id}`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              showToast('Soal berhasil dihapus dari bank', 'info');
              fetchBankQuestionsList();
            } catch (e: any) {
              showToast('Gagal menghapus soal: ' + e.message, 'error');
            }
          },
        },
      ]
    );
  };

  const handleSaveBankPassage = async () => {
    if (!bankPassageForm.title.trim() || !bankPassageForm.content.trim()) {
      showToast('Judul dan isi cerita wacana wajib diisi!', 'warning');
      return;
    }
    if (!bankPassageForm.subject_id) {
      showToast('Pilih mata pelajaran untuk wacana ini!', 'warning');
      return;
    }

    try {
      const payload = {
        subject_id: Number(bankPassageForm.subject_id),
        title: bankPassageForm.title.trim(),
        content: bankPassageForm.content.trim(),
      };

      const res = await axios.post(`${apiUrl}/api/passages`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      showToast('Teks Cerita / Wacana stimulus berhasil disimpan!', 'success');
      const newPassage = res.data?.data || res.data;
      if (newPassage?.id) {
        setBankPassagesList((prev) => [newPassage, ...prev]);
        setBankQuestionForm((prev) => ({
          ...prev,
          passage_id: String(newPassage.id),
          subject_id: String(newPassage.subject_id),
        }));
      }
      setBankPassageForm((prev) => ({ ...prev, title: '', content: '' }));
      setStandaloneBankTab('create_pg');
    } catch (err: any) {
      showToast('Gagal membuat wacana: ' + (err.response?.data?.message || err.message), 'error');
    }
  };

  const handleGenerateBankAi = async () => {
    if (!bankAiForm.topic.trim()) {
      showToast('Topik materi untuk AI wajib diisi!', 'warning');
      return;
    }
    if (!bankAiForm.subject_id) {
      showToast('Pilih mata pelajaran terlebih dahulu!', 'warning');
      return;
    }

    const selectedSubjObj = subjects.find((s) => Number(s.id) === Number(bankAiForm.subject_id));
    const subjName = selectedSubjObj?.name || 'Mata Pelajaran';

    setGeneratingBankAi(true);
    try {
      const countNum = Math.max(1, Math.min(30, parseInt(bankAiForm.count) || 5));
      const payload = {
        subject_name: subjName,
        level: bankAiForm.level,
        topic: bankAiForm.topic.trim(),
        count: countNum,
        type: 'PG',
        option_keys: 'ABCDE',
        passage_id: bankAiForm.passage_id ? Number(bankAiForm.passage_id) : undefined,
      };

      let genData: any[] = [];

      // 1. Try school server API
      try {
        const res = await axios.post(`${apiUrl}/api/question-bank/generate-ai`, payload, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 10000,
        });
        if (res.data?.data && Array.isArray(res.data.data) && res.data.data.length > 0) {
          genData = res.data.data;
        }
      } catch (serverErr: any) {
        console.warn('Server AI engine error/timeout, initiating high-speed backup engine...', serverErr?.message);
      }

      // 2. High-speed backup engine if server returned 500 / 503 / timeout
      if (genData.length === 0) {
        try {
          const groqPrompt = `Anda adalah GURU KELAS ${bankAiForm.level} SMA/SMK di Indonesia.
Tugas Anda membuat ${countNum} butir soal pilihan ganda tentang "${bankAiForm.topic.trim()}" mata pelajaran "${subjName}".
Sediakan 5 pilihan jawaban (A, B, C, D, E) dan tandai jawaban yang benar di field "answer".
Format JSON array murni tanpa pembuka/penutup markdown:
[
  {
    "text": "Teks pertanyaan dalam format HTML.",
    "options": {
      "A": "Pilihan A",
      "B": "Pilihan B",
      "C": "Pilihan C",
      "D": "Pilihan D",
      "E": "Pilihan E"
    },
    "answer": "A",
    "type": "PG",
    "score_weight": 1
  }
]`;

          const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer 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',
            },
            body: JSON.stringify({
              model: 'openai/gpt-oss-120b',
              messages: [
                {
                  role: 'system',
                  content: 'Output ONLY a valid JSON array of questions matching the exact schema requested, without markdown fences.',
                },
                {
                  role: 'user',
                  content: groqPrompt,
                },
              ],
              temperature: 0.2,
              max_tokens: 4096,
            }),
          });

          if (groqRes.ok) {
            const groqJson = await groqRes.json();
            const rawContent = groqJson.choices?.[0]?.message?.content || '[]';
            const matched = rawContent.match(/\[[\s\S]*\]/);
            const parsed = JSON.parse(matched ? matched[0] : rawContent);
            if (Array.isArray(parsed) && parsed.length > 0) {
              genData = parsed;
            }
          }
        } catch (backupErr: any) {
          console.warn('Backup AI Engine error:', backupErr?.message);
        }
      }

      if (genData.length === 0) {
        showToast('AI engine sedang sibuk. Silakan coba lagi sebentar lagi.', 'warning');
        return;
      }

      // Transition to Preview mode (Do NOT save to DB yet!)
      setAiGeneratedQuestions(genData);
      setSelectedAiIndices(genData.map((_: any, i: number) => i));
      setAiPreviewMode(true);
      showToast(`Berhasil merumuskan ${genData.length} butir soal! Silakan tinjau sebelum disimpan.`, 'success');
    } catch (err: any) {
      console.warn('Generate AI Bank error:', err?.message);
      showToast('Gagal generate AI: ' + (err.response?.data?.message || err.message), 'error');
    } finally {
      setGeneratingBankAi(false);
    }
  };

  const handleToggleSelectAiQuestion = (index: number) => {
    if (selectedAiIndices.includes(index)) {
      setSelectedAiIndices(selectedAiIndices.filter((i) => i !== index));
    } else {
      setSelectedAiIndices([...selectedAiIndices, index]);
    }
  };

  const handleSelectAllAiQuestions = () => {
    setSelectedAiIndices(aiGeneratedQuestions.map((_, i) => i));
  };

  const handleDeselectAllAiQuestions = () => {
    setSelectedAiIndices([]);
  };

  const handleSaveSelectedAiQuestions = async () => {
    if (selectedAiIndices.length === 0) {
      showToast('Pilih setidaknya 1 butir soal untuk disimpan ke Bank Soal!', 'warning');
      return;
    }

    const questionsToSave = aiGeneratedQuestions
      .filter((_, idx) => selectedAiIndices.includes(idx))
      .map((q) => ({
        ...q,
        subject_id: Number(bankAiForm.subject_id),
        level: bankAiForm.level,
        topic: bankAiForm.topic.trim(),
        passage_id: bankAiForm.passage_id ? Number(bankAiForm.passage_id) : null,
      }));

    setIsSavingAiBatch(true);
    try {
      await axios.post(
        `${apiUrl}/api/question-bank/batch`,
        {
          subject_id: Number(bankAiForm.subject_id),
          level: bankAiForm.level,
          topic: bankAiForm.topic.trim(),
          passage_id: bankAiForm.passage_id ? Number(bankAiForm.passage_id) : null,
          questions: questionsToSave,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      showToast(`Berhasil menyimpan ${questionsToSave.length} butir soal ke Bank Soal!`, 'success');
      setAiPreviewMode(false);
      setAiGeneratedQuestions([]);
      setSelectedAiIndices([]);
      setStandaloneBankTab('list');
      fetchBankQuestionsList(Number(bankAiForm.subject_id), bankAiForm.level);
    } catch (err: any) {
      console.error('Save AI batch error:', err);
      showToast('Gagal menyimpan soal AI: ' + (err.response?.data?.message || err.message), 'error');
    } finally {
      setIsSavingAiBatch(false);
    }
  };

  // -------------------------------------------------------------
  // TEACHER: LIVE MONITORING & RESULTS
  // -------------------------------------------------------------
  const openResultsModal = async (exam: Exam) => {
    setSelectedExamForResults(exam);
    setIsResultsModalOpen(true);
    setLoadingResults(true);
    try {
      const res = await axios.get(`${apiUrl}/api/exams/${exam.id}/results`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data?.data) {
        setExamResults(res.data.data);
      }
    } catch (e) {
      console.error('Fetch results error:', e);
    } finally {
      setLoadingResults(false);
    }
  };

  const openStudentLogsModal = async (studentId: string, studentName: string) => {
    if (!selectedExamForResults) return;
    setLogStudentName(studentName);
    setIsLogsModalOpen(true);
    try {
      const res = await axios.get(`${apiUrl}/api/exams/${selectedExamForResults.id}/proctor-logs/${studentId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data?.data) {
        setSelectedStudentLogs(res.data.data);
      }
    } catch (e) {
      console.error('Fetch logs error:', e);
    }
  };

  // -------------------------------------------------------------
  // STUDENT: START & TAKE EXAM WITH CAMERA PROCTORING
  // -------------------------------------------------------------
  const handleStartExamPrompt = (exam: Exam) => {
    if (exam.token) {
      setPendingExamToStart(exam);
      setInputToken('');
      setIsTokenPromptOpen(true);
    } else {
      startExamArena(exam);
    }
  };

  const handleValidateTokenAndStart = () => {
    if (!pendingExamToStart) return;
    if (pendingExamToStart.token && inputToken.trim().toUpperCase() !== pendingExamToStart.token.toUpperCase()) {
      showToast('Token ujian salah! Silakan tanyakan ke guru pengawas.', 'error');
      return;
    }
    setIsTokenPromptOpen(false);
    startExamArena(pendingExamToStart);
  };

  const startExamArena = async (exam: Exam) => {
    setLoading(true);
    try {
      // Request camera permission if proctoring enabled
      if (exam.proctor_enabled && !cameraPermission?.granted) {
        const perm = await requestCameraPermission();
        if (!perm.granted) {
          showToast('Ujian ini mewajibkan kamera depan aktif untuk pengawasan proctoring!', 'warning');
        }
      }

      const res = await axios.get(`${apiUrl}/api/exams/student/${exam.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.data?.shuffledQuestions || res.data.shuffledQuestions.length === 0) {
        showToast('Belum ada soal pada ujian ini.', 'warning');
        setLoading(false);
        return;
      }

      setActiveStudentExam(exam);
      setStudentQuestions(res.data.shuffledQuestions);
      setCurrentQuestionIndex(0);

      // Load existing saved answers if any
      const savedAns = res.data.result?.answers ? JSON.parse(res.data.result.answers) : {};
      setStudentAnswers(savedAns);

      // Duration setup
      const durationSecs = (exam.duration || 60) * 60;
      setTimeLeftSeconds(durationSecs);
      setProctorWarningCount(0);
      setIsStudentExamModalOpen(true);
    } catch (err: any) {
      console.error('Start exam error:', err);
      showToast(err.response?.data?.message || 'Gagal memulai ujian: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Timer countdown hook for student
  useEffect(() => {
    if (!isStudentExamModalOpen || timeLeftSeconds <= 0) return;

    const timer = setInterval(() => {
      setTimeLeftSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleAutoSubmitExam();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isStudentExamModalOpen, timeLeftSeconds]);

  // Anti-Cheat: AppState Tab Lock Listener
  useEffect(() => {
    if (!isStudentExamModalOpen || !activeStudentExam?.proctor_tab_lock) return;

    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        setProctorWarningCount((prev) => {
          const nextCount = prev + 1;
          // Log violation to backend
          if (activeStudentExam && token && apiUrl) {
            axios.post(
              `${apiUrl}/api/exams/${activeStudentExam.id}/proctor-logs`,
              {
                type: 'TAB_LOCK',
                details: `Peringatan #${nextCount}: Siswa meninggalkan aplikasi / berganti layar pada ${new Date().toLocaleTimeString()}`,
              },
              { headers: { Authorization: `Bearer ${token}` } }
            ).catch(() => {});
          }

          Alert.alert(
            '⚠️ PERINGATAN INTEGRITAS UJIAN!',
            `Anda terdeteksi meninggalkan aplikasi ujian (Peringatan ke-${nextCount} dari ${activeStudentExam.proctor_max_warnings || 5}). Tindakan ini dicatat oleh pengawas!`,
            [{ text: 'Lanjutkan Ujian', style: 'default' }]
          );

          return nextCount;
        });
      }
    });

    return () => subscription.remove();
  }, [isStudentExamModalOpen, activeStudentExam]);

  const formatTimer = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handleSelectAnswer = (questionId: string, optionKey: string) => {
    const updated = { ...studentAnswers, [questionId]: optionKey };
    setStudentAnswers(updated);

    // Save progress to backend in background
    if (activeStudentExam) {
      axios.post(
        `${apiUrl}/api/exams/${activeStudentExam.id}/save-progress`,
        { answers: JSON.stringify(updated) },
        { headers: { Authorization: `Bearer ${token}` } }
      ).catch(() => {});
    }
  };

  const toggleDoubtful = (questionId: string) => {
    setDoubtfulAnswers((prev) => ({
      ...prev,
      [questionId]: !prev[questionId],
    }));
  };

  const handleAutoSubmitExam = () => {
    showToast('Waktu ujian telah habis! Sistem mengumpulkan jawaban otomatis.', 'warning');
    finalizeSubmitExam();
  };

  const handleConfirmSubmit = () => {
    const totalQ = studentQuestions.length;
    const answeredCount = Object.keys(studentAnswers).length;
    const unansweredCount = totalQ - answeredCount;

    Alert.alert(
      'Selesaikan Ujian?',
      `Anda telah menjawab ${answeredCount} dari ${totalQ} butir soal.${
        unansweredCount > 0 ? ` Terdapat ${unansweredCount} soal yang belum dijawab!` : ''
      }\n\nApakah Anda yakin ingin mengumpulkan lembar jawaban sekarang?`,
      [
        { text: 'Periksa Kembali', style: 'cancel' },
        {
          text: 'Ya, Kumpulkan',
          style: 'default',
          onPress: () => finalizeSubmitExam(),
        },
      ]
    );
  };

  const finalizeSubmitExam = async () => {
    if (!activeStudentExam) return;
    setIsSubmittingExam(true);

    try {
      const res = await axios.post(
        `${apiUrl}/api/exams/${activeStudentExam.id}/submit`,
        {
          answers: JSON.stringify(studentAnswers),
          start_time: new Date().toISOString(),
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setIsStudentExamModalOpen(false);
      setExamResultSummary({
        title: activeStudentExam.title,
        subjectName: activeStudentExam.subject?.name,
        scoreTotal: res.data?.score_total !== undefined ? res.data.score_total : 0,
        scorePg: res.data?.score_pg !== undefined ? res.data.score_pg : 0,
        answeredCount: Object.keys(studentAnswers).length,
        totalQuestions: studentQuestions.length,
      });

      showToast('Ujian berhasil dikumpulkan & dinilai!', 'success');
      fetchStudentExamsList();
    } catch (err: any) {
      showToast('Gagal submit ujian: ' + (err.response?.data?.message || err.message), 'error');
    } finally {
      setIsSubmittingExam(false);
    }
  };

  // Filtered exams for teacher
  const filteredExams = exams.filter((e) => {
    if (selectedSubjectFilter === 'ALL') return true;
    return Number(e.subject_id) === Number(selectedSubjectFilter);
  });

  // Current active question in student arena
  const currentQuestion: Question | undefined = studentQuestions[currentQuestionIndex];
  const parsedOptions: { [key: string]: string } = currentQuestion
    ? typeof currentQuestion.options === 'string'
      ? (() => {
          try {
            return JSON.parse(currentQuestion.options);
          } catch {
            return {};
          }
        })()
      : currentQuestion.options || {}
    : {};

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* ======================================================== */}
      {/* SCREEN TOP HEADER                                         */}
      {/* ======================================================== */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#1E293B" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>CBT & Asesmen Online</Text>
          <Text style={styles.headerSubtitle}>
            {role === 'guru' ? 'Portal Ujian & Bank Soal Guru' : (role === 'siswa' ? 'Ruang Ujian Terjadwal Siswa' : 'Asesmen Komputer SIPENA')}
          </Text>
        </View>
        <TouchableOpacity style={styles.refreshButton} onPress={() => loadUserAndInit()}>
          <Ionicons name="refresh-outline" size={22} color="#0EA5E9" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color="#0EA5E9" />
          <Text style={styles.loadingText}>Menyiapkan Sistem CBT...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* ==================================================== */}
          {/* ROLE VIEW: TEACHER (GURU)                            */}
          {/* ==================================================== */}
          {(role === 'guru' || role === 'admin') && (
            <View>
              {/* Stat Cards */}
              <View style={styles.statsRow}>
                <View style={[styles.statCard, { backgroundColor: '#F0F9FF', borderColor: '#BAE6FD' }]}>
                  <View style={styles.statIconBox}>
                    <Ionicons name="calendar-outline" size={20} color="#0284C7" />
                  </View>
                  <Text style={styles.statVal}>{exams.length}</Text>
                  <Text style={styles.statLabel}>Ujian Terjadwal</Text>
                </View>

                <View style={[styles.statCard, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
                  <View style={[styles.statIconBox, { backgroundColor: '#D1FAE5' }]}>
                    <Ionicons name="videocam-outline" size={20} color="#059669" />
                  </View>
                  <Text style={styles.statVal}>
                    {exams.filter((e) => e.proctor_enabled).length}
                  </Text>
                  <Text style={styles.statLabel}>Kamera Diawasi</Text>
                </View>

                <View style={[styles.statCard, { backgroundColor: '#FAF5FF', borderColor: '#E9D5FF' }]}>
                  <View style={[styles.statIconBox, { backgroundColor: '#F3E8FF' }]}>
                    <Ionicons name="people-outline" size={20} color="#7C3AED" />
                  </View>
                  <Text style={styles.statVal}>
                    {exams.reduce((acc, e) => acc + (e._count?.results || 0), 0)}
                  </Text>
                  <Text style={styles.statLabel}>Peserta Dinilai</Text>
                </View>
              </View>

              {/* Action Buttons for Guru */}
              <View style={styles.actionButtonRow}>
                <TouchableOpacity style={styles.createExamBtn} onPress={openCreateExamModal} activeOpacity={0.8}>
                  <Ionicons name="add-circle" size={18} color="#FFFFFF" />
                  <Text style={styles.createExamBtnText}>Buat Jadwal Ujian</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.bankSoalBtn}
                  onPress={openStandaloneBankModal}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons name="book-open-variant" size={18} color="#0284C7" />
                  <Text style={styles.bankSoalBtnText}>Bank Soal</Text>
                </TouchableOpacity>
              </View>

              {/* Subject Filter Chips if teacher has multiple subjects */}
              {teacherSubjects.length > 1 && (
                <View style={styles.filterSection}>
                  <Text style={styles.filterHeaderTitle}>Mapel Guru:</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipsRow}>
                    <TouchableOpacity
                      style={[styles.filterChip, selectedSubjectFilter === 'ALL' && styles.filterChipActive]}
                      onPress={() => setSelectedSubjectFilter('ALL')}
                    >
                      <Text style={[styles.filterChipText, selectedSubjectFilter === 'ALL' && styles.filterChipTextActive]}>
                        Semua Mapel ({exams.length})
                      </Text>
                    </TouchableOpacity>
                    {teacherSubjects.map((s) => (
                      <TouchableOpacity
                        key={s.id}
                        style={[styles.filterChip, selectedSubjectFilter === s.id && styles.filterChipActive]}
                        onPress={() => setSelectedSubjectFilter(s.id)}
                      >
                        <Text style={[styles.filterChipText, selectedSubjectFilter === s.id && styles.filterChipTextActive]}>
                          {s.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* List of Exams for Teacher */}
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionHeading}>Daftar Asesmen & Ujian CBT</Text>
                <Text style={styles.sectionSubCount}>{filteredExams.length} Sesi</Text>
              </View>

              {filteredExams.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Ionicons name="document-text-outline" size={48} color="#94A3B8" />
                  <Text style={styles.emptyTitle}>Belum Ada Jadwal Ujian</Text>
                  <Text style={styles.emptySubtitle}>
                    Buat jadwal asesmen kuis atau ujian CBT pertama Anda dengan menekan tombol di atas.
                  </Text>
                </View>
              ) : (
                filteredExams.map((exam) => (
                  <View key={exam.id} style={styles.examCard}>
                    {/* Top Row: Type & Token Badge */}
                    <View style={styles.examCardHeader}>
                      <View style={styles.examTypeTag}>
                        <Text style={styles.examTypeTagText}>{exam.type || 'UH'}</Text>
                      </View>
                      <View style={{ flex: 1, marginLeft: 8 }}>
                        <Text style={styles.examCardTitle} numberOfLines={1}>
                          {exam.title}
                        </Text>
                        <Text style={styles.examCardSubject}>
                          {exam.subject?.name || 'Mata Pelajaran'} • {exam.class?.name || (exam.level ? `Kelas ${exam.level}` : 'Semua Kelas')}
                        </Text>
                      </View>
                      {exam.token ? (
                        <View style={styles.tokenBox}>
                          <Text style={styles.tokenLabel}>TOKEN</Text>
                          <Text style={styles.tokenCode}>{exam.token}</Text>
                        </View>
                      ) : null}
                    </View>

                    {/* Meta Info Row */}
                    <View style={styles.examMetaGrid}>
                      <View style={styles.examMetaItem}>
                        <Ionicons name="time-outline" size={14} color="#64748B" />
                        <Text style={styles.examMetaText}>{exam.duration} Menit</Text>
                      </View>
                      <View style={styles.examMetaItem}>
                        <Ionicons name="help-circle-outline" size={14} color="#64748B" />
                        <Text style={styles.examMetaText}>{exam._count?.questions || 0} Soal</Text>
                      </View>
                      <View style={styles.examMetaItem}>
                        <Ionicons name="people-outline" size={14} color="#64748B" />
                        <Text style={styles.examMetaText}>{exam._count?.results || 0} Dinilai</Text>
                      </View>
                    </View>

                    {/* Proctoring Badges */}
                    <View style={styles.proctorBadgesRow}>
                      {exam.proctor_enabled ? (
                        <View style={[styles.proctorBadge, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
                          <Ionicons name="videocam" size={12} color="#059669" />
                          <Text style={[styles.proctorBadgeText, { color: '#065F46' }]}>Kamera Pengawas</Text>
                        </View>
                      ) : (
                        <View style={[styles.proctorBadge, { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' }]}>
                          <Ionicons name="videocam-off-outline" size={12} color="#94A3B8" />
                          <Text style={[styles.proctorBadgeText, { color: '#64748B' }]}>Kamera Nonaktif</Text>
                        </View>
                      )}

                      {exam.proctor_tab_lock && (
                        <View style={[styles.proctorBadge, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
                          <Ionicons name="lock-closed" size={12} color="#2563EB" />
                          <Text style={[styles.proctorBadgeText, { color: '#1E40AF' }]}>Kunci Layar/Tab</Text>
                        </View>
                      )}

                      {exam.proctor_face_detect && (
                        <View style={[styles.proctorBadge, { backgroundColor: '#FAF5FF', borderColor: '#E9D5FF' }]}>
                          <Ionicons name="scan-outline" size={12} color="#7C3AED" />
                          <Text style={[styles.proctorBadgeText, { color: '#5B21B6' }]}>Wajah Aktif</Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.cardDivider} />

                    {/* Action Buttons Row */}
                    <View style={styles.examCardFooter}>
                      <TouchableOpacity
                        style={styles.manageQBtn}
                        onPress={() => openQuestionsModal(exam)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="list" size={14} color="#0284C7" />
                        <Text style={styles.manageQBtnText}>Kelola Soal</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.monitorBtn}
                        onPress={() => openResultsModal(exam)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="analytics" size={14} color="#059669" />
                        <Text style={styles.monitorBtnText}>Pantau Nilai</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.iconActionBtn}
                        onPress={() => openEditExamModal(exam)}
                      >
                        <Ionicons name="pencil-outline" size={16} color="#64748B" />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.iconActionBtn, { backgroundColor: '#FEF2F2' }]}
                        onPress={() => handleDeleteExam(exam)}
                      >
                        <Ionicons name="trash-outline" size={16} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}

          {/* ==================================================== */}
          {/* ROLE VIEW: STUDENT (SISWA)                           */}
          {/* ==================================================== */}
          {role === 'siswa' && (
            <View>
              {/* Student Greeting Banner */}
              <View style={styles.studentBanner}>
                <View style={styles.studentBannerIcon}>
                  <Ionicons name="school" size={24} color="#0EA5E9" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.studentBannerTitle}>Ujian & Asesmen Terjadwal</Text>
                  <Text style={styles.studentBannerDesc}>
                    Pastikan baterai mencukupi, koneksi internet stabil, dan patuhi aturan pengawasan kamera.
                  </Text>
                </View>
              </View>

              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionHeading}>Daftar Ujian Anda</Text>
                <Text style={styles.sectionSubCount}>{exams.length} Ujian</Text>
              </View>

              {exams.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Ionicons name="checkmark-circle-outline" size={48} color="#10B981" />
                  <Text style={styles.emptyTitle}>Tidak Ada Ujian Aktif</Text>
                  <Text style={styles.emptySubtitle}>
                    Saat ini tidak ada jadwal kuis atau asesmen CBT untuk kelas Anda.
                  </Text>
                </View>
              ) : (
                exams.map((exam) => {
                  const studentResult = exam.results && exam.results.length > 0 ? exam.results[0] : null;
                  const isFinished = !!studentResult?.finished_at || studentResult?.status === 'Selesai';

                  return (
                    <View key={exam.id} style={styles.examCard}>
                      <View style={styles.examCardHeader}>
                        <View style={[styles.examTypeTag, { backgroundColor: '#F0FDF4' }]}>
                          <Text style={[styles.examTypeTagText, { color: '#16A34A' }]}>{exam.type || 'CBT'}</Text>
                        </View>
                        <View style={{ flex: 1, marginLeft: 8 }}>
                          <Text style={styles.examCardTitle}>{exam.title}</Text>
                          <Text style={styles.examCardSubject}>
                            {exam.subject?.name || 'Mata Pelajaran'} • Durasi: {exam.duration} Menit
                          </Text>
                        </View>
                      </View>

                      {/* Proctor Badges */}
                      <View style={[styles.proctorBadgesRow, { marginTop: 10 }]}>
                        {exam.proctor_enabled && (
                          <View style={[styles.proctorBadge, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
                            <Ionicons name="videocam" size={12} color="#059669" />
                            <Text style={[styles.proctorBadgeText, { color: '#065F46' }]}>Kamera Pengawas Wajib</Text>
                          </View>
                        )}
                        {exam.proctor_tab_lock && (
                          <View style={[styles.proctorBadge, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
                            <Ionicons name="lock-closed" size={12} color="#2563EB" />
                            <Text style={[styles.proctorBadgeText, { color: '#1E40AF' }]}>Kunci Aplikasi</Text>
                          </View>
                        )}
                      </View>

                      <View style={styles.cardDivider} />

                      {/* Student Action: Start or Result */}
                      {isFinished ? (
                        <View style={styles.studentCompletedRow}>
                          <View style={styles.scorePill}>
                            <Ionicons name="trophy" size={16} color="#F59E0B" />
                            <Text style={styles.scorePillText}>
                              Nilai Anda: {studentResult.score_total !== undefined ? studentResult.score_total : studentResult.score_pg} / 100
                            </Text>
                          </View>
                          <View style={styles.finishedStatusTag}>
                            <Text style={styles.finishedStatusText}>Selesai Dikerjakan</Text>
                          </View>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={styles.startExamBtn}
                          onPress={() => handleStartExamPrompt(exam)}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="play-circle" size={18} color="#FFFFFF" />
                          <Text style={styles.startExamBtnText}>Masuk Ruang Ujian</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })
              )}
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* ======================================================== */}
      {/* MODAL 1: TEACHER CREATE / EDIT EXAM                       */}
      {/* ======================================================== */}
      <Modal visible={isExamModalOpen} transparent animationType="slide" onRequestClose={() => setIsExamModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: '90%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingExamId ? 'Edit Jadwal Ujian' : 'Buat Jadwal Ujian CBT Baru'}</Text>
              <TouchableOpacity onPress={() => setIsExamModalOpen(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Judul Ujian */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>1. JUDUL ASESMEN / UJIAN <Text style={styles.req}>*</Text></Text>
                <TextInput
                  style={styles.inputBox}
                  placeholder="Contoh: Penilaian Harian 1, PTS Semester Ganjil..."
                  placeholderTextColor="#94A3B8"
                  value={examForm.title}
                  onChangeText={(val) => setExamForm({ ...examForm, title: val })}
                />
              </View>

              {/* Tipe Ujian & Durasi */}
              <View style={styles.rowTwoCols}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.inputLabel}>2. TIPE UJIAN</Text>
                  <View style={styles.selectTypeContainer}>
                    {['UH', 'PTS', 'PAS', 'CBT'].map((t) => (
                      <TouchableOpacity
                        key={t}
                        style={[styles.typeOptionChip, examForm.type === t && styles.typeOptionChipActive]}
                        onPress={() => setExamForm({ ...examForm, type: t })}
                      >
                        <Text style={[styles.typeOptionText, examForm.type === t && styles.typeOptionTextActive]}>{t}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                  <Text style={styles.inputLabel}>3. DURASI (MENIT) <Text style={styles.req}>*</Text></Text>
                  <TextInput
                    style={styles.inputBox}
                    keyboardType="number-pad"
                    value={examForm.duration}
                    onChangeText={(val) => setExamForm({ ...examForm, duration: val })}
                  />
                </View>
              </View>

              {/* Mata Pelajaran Guru */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>4. MATA PELAJARAN <Text style={styles.req}>*</Text></Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickerChipsRow}>
                  {teacherSubjects.map((s) => {
                    const isSelected = String(examForm.subject_id) === String(s.id);
                    return (
                      <TouchableOpacity
                        key={s.id}
                        style={[styles.pickerChip, isSelected && styles.pickerChipActive]}
                        onPress={() => setExamForm({ ...examForm, subject_id: String(s.id) })}
                      >
                        <Text style={[styles.pickerChipText, isSelected && styles.pickerChipTextActive]}>{s.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Kelas Sasaran */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>5. KELAS SASARAN (OPSIONAL)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickerChipsRow}>
                  <TouchableOpacity
                    style={[styles.pickerChip, !examForm.class_id && styles.pickerChipActive]}
                    onPress={() => setExamForm({ ...examForm, class_id: '' })}
                  >
                    <Text style={[styles.pickerChipText, !examForm.class_id && styles.pickerChipTextActive]}>Semua Kelas</Text>
                  </TouchableOpacity>
                  {classes.map((c) => {
                    const isSelected = String(examForm.class_id) === String(c.id);
                    return (
                      <TouchableOpacity
                        key={c.id}
                        style={[styles.pickerChip, isSelected && styles.pickerChipActive]}
                        onPress={() => setExamForm({ ...examForm, class_id: String(c.id), level: String(c.level || '10') })}
                      >
                        <Text style={[styles.pickerChipText, isSelected && styles.pickerChipTextActive]}>{c.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Token Ujian */}
              <View style={styles.inputGroup}>
                <View style={styles.labelWithAction}>
                  <Text style={styles.inputLabel}>6. TOKEN UJIAN SISWA</Text>
                  <TouchableOpacity onPress={() => setExamForm({ ...examForm, token: generateRandomToken() })}>
                    <Text style={styles.linkAction}>Acak Token</Text>
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={[styles.inputBox, { fontWeight: '700', letterSpacing: 2 }]}
                  placeholder="KOSONGKAN JIKA TANPA TOKEN"
                  placeholderTextColor="#94A3B8"
                  value={examForm.token}
                  autoCapitalize="characters"
                  onChangeText={(val) => setExamForm({ ...examForm, token: val.toUpperCase() })}
                />
              </View>

              {/* =================================================== */}
              {/* SETTINGAN PENGAWASAN KAMERA (AI PROCTORING)         */}
              {/* =================================================== */}
              <View style={styles.proctorSettingBox}>
                <View style={styles.proctorBoxHeader}>
                  <Ionicons name="videocam" size={20} color="#059669" />
                  <Text style={styles.proctorBoxTitle}>Pengaturan Pengawasan Kamera & Anti-Curang</Text>
                </View>

                {/* Switch: Proctor Enabled */}
                <View style={styles.switchRow}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={styles.switchTitle}>Aktifkan Pengawasan Kamera Depan</Text>
                    <Text style={styles.switchDesc}>Mewajibkan siswa menyalakan kamera depan selama pengerjaan ujian.</Text>
                  </View>
                  <Switch
                    value={examForm.proctor_enabled}
                    onValueChange={(val) => setExamForm({ ...examForm, proctor_enabled: val })}
                    trackColor={{ false: '#CBD5E1', true: '#6EE7B7' }}
                    thumbColor={examForm.proctor_enabled ? '#059669' : '#F1F5F9'}
                  />
                </View>

                {/* Switch: Face Detection */}
                <View style={styles.switchRow}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={styles.switchTitle}>Deteksi Wajah Siswa</Text>
                    <Text style={styles.switchDesc}>Memberikan peringatan jika wajah tidak terdeteksi atau menoleh.</Text>
                  </View>
                  <Switch
                    value={examForm.proctor_face_detect}
                    onValueChange={(val) => setExamForm({ ...examForm, proctor_face_detect: val })}
                    trackColor={{ false: '#CBD5E1', true: '#6EE7B7' }}
                    thumbColor={examForm.proctor_face_detect ? '#059669' : '#F1F5F9'}
                  />
                </View>

                {/* Switch: Tab Lock */}
                <View style={styles.switchRow}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={styles.switchTitle}>Kunci Aplikasi & Anti-Pindah Layar</Text>
                    <Text style={styles.switchDesc}>Mencatat pelanggaran jika siswa keluar dari aplikasi ujian.</Text>
                  </View>
                  <Switch
                    value={examForm.proctor_tab_lock}
                    onValueChange={(val) => setExamForm({ ...examForm, proctor_tab_lock: val })}
                    trackColor={{ false: '#CBD5E1', true: '#6EE7B7' }}
                    thumbColor={examForm.proctor_tab_lock ? '#059669' : '#F1F5F9'}
                  />
                </View>
              </View>

              <TouchableOpacity style={styles.saveSubmitBtn} onPress={handleSaveExam} activeOpacity={0.8}>
                <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                <Text style={styles.saveSubmitBtnText}>Simpan Jadwal Ujian</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL 2: QUESTIONS & SOAL CERITA MANAGEMENT              */}
      {/* ======================================================== */}
      <Modal visible={isQuestionsModalOpen} transparent animationType="slide" onRequestClose={() => setIsQuestionsModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: '92%' }]}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle} numberOfLines={1}>
                  Kelola Soal: {selectedExamForQuestions?.title}
                </Text>
                <Text style={styles.modalSubTitle}>
                  {selectedExamForQuestions?.subject?.name} • {examQuestions.length} Butir Soal
                </Text>
              </View>
              <TouchableOpacity onPress={() => setIsQuestionsModalOpen(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Sub-Tabs: Daftar Soal / Buat PG / Buat Wacana / Bank */}
            <View style={styles.tabButtonBar}>
              <TouchableOpacity
                style={[styles.tabBtnItem, questionTab === 'list' && styles.tabBtnItemActive]}
                onPress={() => setQuestionTab('list')}
              >
                <Text style={[styles.tabBtnText, questionTab === 'list' && styles.tabBtnTextActive]}>
                  Daftar Soal ({examQuestions.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabBtnItem, questionTab === 'create_pg' && styles.tabBtnItemActive]}
                onPress={() => setQuestionTab('create_pg')}
              >
                <Text style={[styles.tabBtnText, questionTab === 'create_pg' && styles.tabBtnTextActive]}>
                  + Soal PG
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabBtnItem, questionTab === 'create_passage' && styles.tabBtnItemActive]}
                onPress={() => setQuestionTab('create_passage')}
              >
                <Text style={[styles.tabBtnText, questionTab === 'create_passage' && styles.tabBtnTextActive]}>
                  + Soal Cerita
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabBtnItem, questionTab === 'bank' && styles.tabBtnItemActive]}
                onPress={openBankTab}
              >
                <Text style={[styles.tabBtnText, questionTab === 'bank' && styles.tabBtnTextActive]}>
                  Bank Soal
                </Text>
              </TouchableOpacity>
            </View>

            {/* Content Area */}
            {loadingQuestions ? (
              <View style={styles.loadingCenter}>
                <ActivityIndicator size="small" color="#0EA5E9" />
                <Text style={styles.loadingText}>Memuat butir soal...</Text>
              </View>
            ) : questionTab === 'list' ? (
              <FlatList
                data={examQuestions}
                keyExtractor={(item) => String(item.id)}
                contentContainerStyle={{ padding: 16 }}
                ListEmptyComponent={
                  <View style={styles.emptyCard}>
                    <Ionicons name="document-text-outline" size={40} color="#94A3B8" />
                    <Text style={styles.emptyTitle}>Belum Ada Butir Soal</Text>
                    <Text style={styles.emptySubtitle}>Pilih tab "+ Soal PG" atau "Bank Soal" untuk menambahkan soal.</Text>
                  </View>
                }
                renderItem={({ item, index }) => {
                  const opts = typeof item.options === 'string' ? (() => { try { return JSON.parse(item.options); } catch { return {}; } })() : item.options || {};
                  return (
                    <View style={styles.questionItemCard}>
                      <View style={styles.questionItemTop}>
                        <View style={styles.questionNumBadge}>
                          <Text style={styles.questionNumBadgeText}>No. {index + 1}</Text>
                        </View>
                        <View style={styles.answerKeyBadge}>
                          <Text style={styles.answerKeyBadgeText}>Kunci: {item.answer}</Text>
                        </View>
                        <View style={{ flex: 1 }} />
                        <TouchableOpacity onPress={() => handleDeleteQuestion(item.id)}>
                          <Ionicons name="trash-outline" size={18} color="#EF4444" />
                        </TouchableOpacity>
                      </View>

                      {/* If has passage */}
                      {item.passage && (
                        <View style={styles.passageCardMini}>
                          <Ionicons name="book-outline" size={14} color="#059669" />
                          <Text style={styles.passageCardMiniTitle} numberOfLines={1}>
                            Wacana: {item.passage.title}
                          </Text>
                        </View>
                      )}

                      <Text style={styles.questionItemText}>{item.text}</Text>

                      {/* Options List */}
                      <View style={styles.optionsPreviewBox}>
                        {Object.entries(opts).map(([key, val]) => (
                          <Text key={key} style={[styles.optLine, item.answer === key && styles.optLineCorrect]}>
                            <Text style={{ fontWeight: '700' }}>{key}.</Text> {String(val)}
                          </Text>
                        ))}
                      </View>
                    </View>
                  );
                }}
              />
            ) : questionTab === 'create_pg' ? (
              <ScrollView contentContainerStyle={styles.modalBody}>
                {/* Wacana / Soal Cerita Selector */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>TAUTKAN SOAL CERITA / WACANA (JIKA ADA):</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickerChipsRow}>
                    <TouchableOpacity
                      style={[styles.pickerChip, !questionForm.passage_id && styles.pickerChipActive]}
                      onPress={() => setQuestionForm({ ...questionForm, passage_id: '' })}
                    >
                      <Text style={[styles.pickerChipText, !questionForm.passage_id && styles.pickerChipTextActive]}>
                        Tanpa Wacana
                      </Text>
                    </TouchableOpacity>
                    {availablePassages.map((p) => (
                      <TouchableOpacity
                        key={p.id}
                        style={[styles.pickerChip, questionForm.passage_id === String(p.id) && styles.pickerChipActive]}
                        onPress={() => setQuestionForm({ ...questionForm, passage_id: String(p.id) })}
                      >
                        <Text style={[styles.pickerChipText, questionForm.passage_id === String(p.id) && styles.pickerChipTextActive]}>
                          📖 {p.title}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                {/* Teks Soal */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>PERTANYAAN / TEKS SOAL: <Text style={styles.req}>*</Text></Text>
                  <TextInput
                    style={[styles.inputBox, { height: 75, textAlignVertical: 'top' }]}
                    placeholder="Tuliskan pertanyaan di sini..."
                    placeholderTextColor="#94A3B8"
                    multiline
                    value={questionForm.text}
                    onChangeText={(val) => setQuestionForm({ ...questionForm, text: val })}
                  />
                </View>

                {/* Pilihan Jawaban A - E */}
                {['A', 'B', 'C', 'D', 'E'].map((optKey) => {
                  const formKey = `option${optKey}` as keyof typeof questionForm;
                  const isCorrect = questionForm.answer === optKey;
                  return (
                    <View key={optKey} style={styles.optionInputRow}>
                      <TouchableOpacity
                        style={[styles.correctAnswerRadio, isCorrect && styles.correctAnswerRadioActive]}
                        onPress={() => setQuestionForm({ ...questionForm, answer: optKey })}
                      >
                        <Text style={[styles.radioLetter, isCorrect && styles.radioLetterActive]}>{optKey}</Text>
                      </TouchableOpacity>
                      <TextInput
                        style={[styles.inputBox, { flex: 1, marginLeft: 10 }]}
                        placeholder={`Teks Pilihan ${optKey}...`}
                        placeholderTextColor="#94A3B8"
                        value={questionForm[formKey]}
                        onChangeText={(val) => setQuestionForm({ ...questionForm, [formKey]: val })}
                      />
                    </View>
                  );
                })}

                <Text style={styles.inputHelpText}>Ketuk lingkaran huruf di sebelah kiri untuk menandai kunci jawaban yang benar.</Text>

                <TouchableOpacity style={styles.saveSubmitBtn} onPress={handleSaveQuestionPG} activeOpacity={0.8}>
                  <Ionicons name="add-circle" size={18} color="#FFFFFF" />
                  <Text style={styles.saveSubmitBtnText}>Simpan Soal ke Ujian</Text>
                </TouchableOpacity>
              </ScrollView>
            ) : questionTab === 'create_passage' ? (
              <ScrollView contentContainerStyle={styles.modalBody}>
                <View style={styles.passageInfoBanner}>
                  <Ionicons name="sparkles" size={20} color="#059669" />
                  <Text style={styles.passageInfoBannerText}>
                    Wacana atau Soal Cerita memungkinkan beberapa butir soal mengacu pada satu teks bacaan panjang yang sama.
                  </Text>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>JUDUL TEKS CERITA / WACANA: <Text style={styles.req}>*</Text></Text>
                  <TextInput
                    style={styles.inputBox}
                    placeholder="Contoh: Kisah Sang Penemu Listrik, Wacana Gejala Pemanasan Global..."
                    placeholderTextColor="#94A3B8"
                    value={passageForm.title}
                    onChangeText={(val) => setPassageForm({ ...passageForm, title: val })}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>ISI TEKS CERITA / NARASI BACAAN: <Text style={styles.req}>*</Text></Text>
                  <TextInput
                    style={[styles.inputBox, { height: 160, textAlignVertical: 'top' }]}
                    placeholder="Tulis atau tempel teks wacana/cerita lengkap di sini..."
                    placeholderTextColor="#94A3B8"
                    multiline
                    value={passageForm.content}
                    onChangeText={(val) => setPassageForm({ ...passageForm, content: val })}
                  />
                </View>

                <TouchableOpacity style={styles.saveSubmitBtn} onPress={handleSavePassage} activeOpacity={0.8}>
                  <Ionicons name="save" size={18} color="#FFFFFF" />
                  <Text style={styles.saveSubmitBtnText}>Simpan Wacana Baru</Text>
                </TouchableOpacity>
              </ScrollView>
            ) : (
              // BANK SOAL TAB
              <View style={{ flex: 1, padding: 16 }}>
                {loadingBank ? (
                  <View style={styles.loadingCenter}>
                    <ActivityIndicator size="small" color="#0EA5E9" />
                    <Text style={styles.loadingText}>Memuat bank soal...</Text>
                  </View>
                ) : (
                  <FlatList
                    data={bankQuestions}
                    keyExtractor={(item) => String(item.id)}
                    ListEmptyComponent={
                      <View style={styles.emptyCard}>
                        <Text style={styles.emptyTitle}>Bank Soal Kosong</Text>
                        <Text style={styles.emptySubtitle}>Tidak ada soal tersedia di bank soal untuk mapel ini.</Text>
                      </View>
                    }
                    renderItem={({ item }) => {
                      const isSelected = selectedBankIds.includes(String(item.id));
                      return (
                        <TouchableOpacity
                          style={[styles.bankItemCard, isSelected && styles.bankItemCardSelected]}
                          onPress={() => {
                            if (isSelected) {
                              setSelectedBankIds(selectedBankIds.filter((id) => id !== String(item.id)));
                            } else {
                              setSelectedBankIds([...selectedBankIds, String(item.id)]);
                            }
                          }}
                        >
                          <Ionicons
                            name={isSelected ? 'checkbox' : 'square-outline'}
                            size={20}
                            color={isSelected ? '#0284C7' : '#94A3B8'}
                          />
                          <View style={{ flex: 1, marginLeft: 10 }}>
                            <Text style={styles.bankItemText} numberOfLines={2}>
                              {item.text}
                            </Text>
                            <Text style={styles.bankItemMeta}>Kunci: {item.answer} • Bobot: {item.score_weight || 1}</Text>
                          </View>
                        </TouchableOpacity>
                      );
                    }}
                  />
                )}

                {selectedBankIds.length > 0 && (
                  <TouchableOpacity style={styles.importConfirmBtn} onPress={handleImportBankQuestions}>
                    <Ionicons name="download-outline" size={18} color="#FFF" />
                    <Text style={styles.importConfirmBtnText}>Import {selectedBankIds.length} Soal Terpilih</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL: STANDALONE GUDANG & BANK SOAL INDEPENDEN          */}
      {/* ======================================================== */}
      <Modal
        visible={isStandaloneBankModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsStandaloneBankModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { height: '92%', paddingBottom: Math.max(insets.bottom, 16) }]}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <MaterialCommunityIcons name="book-open-page-variant" size={20} color="#0284C7" />
                  <Text style={styles.modalTitle}>Bank Soal & Gudang Asesmen</Text>
                </View>
                <Text style={styles.modalSubTitle}>
                  Kelola butir soal mandiri, wacana cerita, & AI kapan saja
                </Text>
              </View>
              <TouchableOpacity onPress={() => setIsStandaloneBankModalOpen(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Standalone Bank Sub-Tabs */}
            <View style={styles.tabButtonBar}>
              <TouchableOpacity
                style={[styles.tabBtnItem, standaloneBankTab === 'list' && styles.tabBtnItemActive]}
                onPress={() => setStandaloneBankTab('list')}
              >
                <Text style={[styles.tabBtnText, standaloneBankTab === 'list' && styles.tabBtnTextActive]}>
                  Koleksi ({bankItems.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabBtnItem, standaloneBankTab === 'create_pg' && styles.tabBtnItemActive]}
                onPress={() => {
                  setEditingBankQuestionId(null);
                  setStandaloneBankTab('create_pg');
                }}
              >
                <Text style={[styles.tabBtnText, standaloneBankTab === 'create_pg' && styles.tabBtnTextActive]}>
                  + Soal PG
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabBtnItem, standaloneBankTab === 'create_passage' && styles.tabBtnItemActive]}
                onPress={() => setStandaloneBankTab('create_passage')}
              >
                <Text style={[styles.tabBtnText, standaloneBankTab === 'create_passage' && styles.tabBtnTextActive]}>
                  + Soal Cerita
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabBtnItem, standaloneBankTab === 'ai' && styles.tabBtnItemActive]}
                onPress={() => setStandaloneBankTab('ai')}
              >
                <Text style={[styles.tabBtnText, standaloneBankTab === 'ai' && styles.tabBtnTextActive]}>
                  ✨ AI Generator
                </Text>
              </TouchableOpacity>
            </View>

            {/* TAB CONTENT */}
            {standaloneBankTab === 'list' ? (
              <View style={{ flex: 1 }}>
                {/* Search & Filter Controls */}
                <View style={styles.bankFilterContainer}>
                  <View style={styles.bankSearchBox}>
                    <Ionicons name="search" size={16} color="#94A3B8" />
                    <TextInput
                      style={styles.bankSearchInput}
                      placeholder="Cari teks soal atau topik..."
                      placeholderTextColor="#94A3B8"
                      value={bankSearchKeyword}
                      onChangeText={(val) => {
                        setBankSearchKeyword(val);
                        fetchBankQuestionsList(bankSubjectFilter, bankLevelFilter, val);
                      }}
                    />
                    {bankSearchKeyword ? (
                      <TouchableOpacity
                        onPress={() => {
                          setBankSearchKeyword('');
                          fetchBankQuestionsList(bankSubjectFilter, bankLevelFilter, '');
                        }}
                      >
                        <Ionicons name="close-circle" size={16} color="#94A3B8" />
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  {/* Subject Pills */}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bankPillsRow}>
                    <TouchableOpacity
                      style={[styles.bankPill, bankSubjectFilter === 'ALL' && styles.bankPillActive]}
                      onPress={() => {
                        setBankSubjectFilter('ALL');
                        fetchBankQuestionsList('ALL', bankLevelFilter, bankSearchKeyword);
                      }}
                    >
                      <Text style={[styles.bankPillText, bankSubjectFilter === 'ALL' && styles.bankPillTextActive]}>
                        Semua Mapel
                      </Text>
                    </TouchableOpacity>
                    {(teacherSubjects.length > 0 ? teacherSubjects : subjects).map((s) => (
                      <TouchableOpacity
                        key={s.id}
                        style={[styles.bankPill, bankSubjectFilter === s.id && styles.bankPillActive]}
                        onPress={() => {
                          setBankSubjectFilter(s.id);
                          fetchBankQuestionsList(s.id, bankLevelFilter, bankSearchKeyword);
                          fetchBankPassages(s.id);
                        }}
                      >
                        <Text style={[styles.bankPillText, bankSubjectFilter === s.id && styles.bankPillTextActive]}>
                          {s.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  {/* Level Pills */}
                  <View style={styles.bankLevelRow}>
                    {['ALL', '10', '11', '12'].map((lvl) => (
                      <TouchableOpacity
                        key={lvl}
                        style={[styles.levelChip, bankLevelFilter === lvl && styles.levelChipActive]}
                        onPress={() => {
                          setBankLevelFilter(lvl);
                          fetchBankQuestionsList(bankSubjectFilter, lvl, bankSearchKeyword);
                        }}
                      >
                        <Text style={[styles.levelChipText, bankLevelFilter === lvl && styles.levelChipTextActive]}>
                          {lvl === 'ALL' ? 'Semua Tingkat' : `Kelas ${lvl}`}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Bank Questions FlatList */}
                {loadingBankItems ? (
                  <View style={styles.loadingCenter}>
                    <ActivityIndicator size="small" color="#0284C7" />
                    <Text style={styles.loadingText}>Memuat butir soal di bank...</Text>
                  </View>
                ) : (
                  <FlatList
                    data={bankItems}
                    keyExtractor={(item) => String(item.id)}
                    contentContainerStyle={{ padding: 14 }}
                    ListEmptyComponent={
                      <View style={styles.emptyCard}>
                        <MaterialCommunityIcons name="book-open-outline" size={44} color="#94A3B8" />
                        <Text style={styles.emptyTitle}>Bank Soal Masih Kosong</Text>
                        <Text style={styles.emptySubtitle}>
                          Anda dapat membuat soal baru secara mandiri atau memanfaatkan AI Generator kapan saja.
                        </Text>
                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                          <TouchableOpacity
                            style={styles.emptyActionBtn}
                            onPress={() => {
                              setEditingBankQuestionId(null);
                              setStandaloneBankTab('create_pg');
                            }}
                          >
                            <Ionicons name="add-circle" size={16} color="#FFF" />
                            <Text style={styles.emptyActionBtnText}>Buat Soal PG</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.emptyActionBtn, { backgroundColor: '#7C3AED' }]}
                            onPress={() => setStandaloneBankTab('ai')}
                          >
                            <Ionicons name="sparkles" size={16} color="#FFF" />
                            <Text style={styles.emptyActionBtnText}>Generate AI</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    }
                    renderItem={({ item, index }) => {
                      const opts =
                        typeof item.options === 'string'
                          ? (() => {
                              try {
                                return JSON.parse(item.options);
                              } catch {
                                return {};
                              }
                            })()
                          : item.options || {};

                      const cleanText = (item.text || '').replace(/<[^>]*>/g, '').trim();

                      return (
                        <View style={styles.bankItemMainCard}>
                          {/* Top Badges & Actions */}
                          <View style={styles.bankItemTopRow}>
                            <View style={styles.badgeGroup}>
                              <View style={styles.subjectMiniBadge}>
                                <Text style={styles.subjectMiniBadgeText} numberOfLines={1}>
                                  {item.subject?.name || 'Mapel'}
                                </Text>
                              </View>
                              <View style={styles.levelMiniBadge}>
                                <Text style={styles.levelMiniBadgeText}>Kelas {item.level || '10'}</Text>
                              </View>
                              {item.topic ? (
                                <View style={styles.topicMiniBadge}>
                                  <Text style={styles.topicMiniBadgeText}>{item.topic}</Text>
                                </View>
                              ) : null}
                              {item.ai_difficulty && (
                                <View
                                  style={[
                                    styles.aiDiffBadge,
                                    item.ai_difficulty === 'Sulit'
                                      ? styles.aiDiffSulit
                                      : item.ai_difficulty === 'Sedang'
                                      ? styles.aiDiffSedang
                                      : styles.aiDiffMudah,
                                  ]}
                                >
                                  <Ionicons name="hardware-chip-outline" size={10} color="#475569" />
                                  <Text style={styles.aiDiffBadgeText}>{item.ai_difficulty}</Text>
                                </View>
                              )}
                            </View>

                            <View style={styles.bankItemActions}>
                              <TouchableOpacity style={styles.actionIconPencil} onPress={() => handleEditBankQuestion(item)}>
                                <Ionicons name="pencil" size={14} color="#0284C7" />
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={styles.actionIconTrash}
                                onPress={() => handleDeleteBankQuestion(item.id, item.text)}
                              >
                                <Ionicons name="trash-outline" size={14} color="#EF4444" />
                              </TouchableOpacity>
                            </View>
                          </View>

                          {/* Passage Card if Linked */}
                          {item.passage && (
                            <View style={styles.passageCardMini}>
                              <Ionicons name="book-outline" size={13} color="#059669" />
                              <Text style={styles.passageCardMiniTitle} numberOfLines={1}>
                                Wacana: {item.passage.title}
                              </Text>
                            </View>
                          )}

                          {/* Question Text */}
                          <Text style={styles.bankItemQuestionText}>
                            <Text style={{ fontWeight: '800', color: '#0369A1' }}>{index + 1}. </Text>
                            {cleanText}
                          </Text>

                          {/* Options Preview */}
                          <View style={styles.optionsPreviewBox}>
                            {Object.entries(opts).map(([key, val]) => {
                              const isCorrect = String(item.answer).toUpperCase() === key.toUpperCase();
                              return (
                                <View
                                  key={key}
                                  style={[styles.bankOptRow, isCorrect && styles.bankOptRowCorrect]}
                                >
                                  <View style={[styles.bankOptKeyCircle, isCorrect && styles.bankOptKeyCircleCorrect]}>
                                    <Text
                                      style={[styles.bankOptKeyLetter, isCorrect && styles.bankOptKeyLetterCorrect]}
                                    >
                                      {key}
                                    </Text>
                                  </View>
                                  <Text
                                    style={[styles.bankOptValText, isCorrect && styles.bankOptValTextCorrect]}
                                    numberOfLines={2}
                                  >
                                    {String(val)}
                                  </Text>
                                  {isCorrect && (
                                    <Ionicons name="checkmark-circle" size={14} color="#16A34A" style={{ marginLeft: 4 }} />
                                  )}
                                </View>
                              );
                            })}
                          </View>

                          {/* Card Footer */}
                          <View style={styles.bankCardBottomMeta}>
                            <Text style={styles.bankCardMetaText}>
                              Kunci: <Text style={{ fontWeight: '800', color: '#15803D' }}>{item.answer}</Text> • Bobot: {item.score_weight || 1}
                            </Text>
                            {item.creator?.name ? (
                              <Text style={styles.bankCardMetaText}>Oleh: {item.creator.name}</Text>
                            ) : null}
                          </View>
                        </View>
                      );
                    }}
                  />
                )}
              </View>
            ) : standaloneBankTab === 'create_pg' ? (
              /* TAB 2: CREATE / EDIT PG IN BANK */
              <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.modalBody, { paddingBottom: 60 }]} showsVerticalScrollIndicator={false}>
                <View style={styles.formHeaderTitleRow}>
                  <Text style={styles.formSectionHeading}>
                    {editingBankQuestionId ? 'Ubah Butir Soal Bank' : 'Tambah Soal Baru ke Bank Soal'}
                  </Text>
                  {editingBankQuestionId && (
                    <TouchableOpacity
                      onPress={() => {
                        setEditingBankQuestionId(null);
                        setBankQuestionForm({
                          subject_id: '',
                          level: '10',
                          topic: '',
                          text: '',
                          type: 'PG',
                          optionA: '',
                          optionB: '',
                          optionC: '',
                          optionD: '',
                          optionE: '',
                          answer: 'A',
                          score_weight: '1',
                          passage_id: '',
                        });
                        setStandaloneBankTab('list');
                      }}
                    >
                      <Text style={styles.cancelEditLink}>Batal Ubah</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* 1. Pilih Mapel */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>
                    1. MATA PELAJARAN: <Text style={styles.req}>*</Text>
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bankPillsRow}>
                    {(teacherSubjects.length > 0 ? teacherSubjects : subjects).map((s) => (
                      <TouchableOpacity
                        key={s.id}
                        style={[
                          styles.subjectChipOption,
                          bankQuestionForm.subject_id === String(s.id) && styles.subjectChipOptionActive,
                        ]}
                        onPress={() => {
                          setBankQuestionForm({ ...bankQuestionForm, subject_id: String(s.id) });
                          fetchBankPassages(s.id);
                        }}
                      >
                        <Text
                          style={[
                            styles.subjectChipOptionText,
                            bankQuestionForm.subject_id === String(s.id) && styles.subjectChipOptionTextActive,
                          ]}
                        >
                          {s.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                {/* 2. Tingkat & Topik */}
                <View style={styles.rowTwoCols}>
                  <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                    <Text style={styles.inputLabel}>2. TINGKAT</Text>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      {['10', '11', '12'].map((lvl) => (
                        <TouchableOpacity
                          key={lvl}
                          style={[
                            styles.levelChipSmall,
                            bankQuestionForm.level === lvl && styles.levelChipSmallActive,
                          ]}
                          onPress={() => setBankQuestionForm({ ...bankQuestionForm, level: lvl })}
                        >
                          <Text
                            style={[
                              styles.levelChipSmallText,
                              bankQuestionForm.level === lvl && styles.levelChipSmallTextActive,
                            ]}
                          >
                            Kls {lvl}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.inputLabel}>3. TOPIK / MATERI</Text>
                    <TextInput
                      style={styles.inputBox}
                      placeholder="Contoh: Aljabar, Sel..."
                      placeholderTextColor="#94A3B8"
                      value={bankQuestionForm.topic}
                      onChangeText={(val) => setBankQuestionForm({ ...bankQuestionForm, topic: val })}
                    />
                  </View>
                </View>

                {/* 4. Wacana / Soal Cerita */}
                <View style={styles.inputGroup}>
                  <View style={styles.labelWithAction}>
                    <Text style={styles.inputLabel}>4. TEKS CERITA / WACANA (OPSIONAL):</Text>
                    <TouchableOpacity onPress={() => setStandaloneBankTab('create_passage')}>
                      <Text style={styles.linkAction}>+ Buat Wacana Baru</Text>
                    </TouchableOpacity>
                  </View>

                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bankPillsRow}>
                    <TouchableOpacity
                      style={[
                        styles.passageOptionChip,
                        !bankQuestionForm.passage_id && styles.passageOptionChipActive,
                      ]}
                      onPress={() => setBankQuestionForm({ ...bankQuestionForm, passage_id: '' })}
                    >
                      <Text
                        style={[
                          styles.passageOptionChipText,
                          !bankQuestionForm.passage_id && styles.passageOptionChipTextActive,
                        ]}
                      >
                        Tanpa Wacana
                      </Text>
                    </TouchableOpacity>

                    {bankPassagesList.map((p) => (
                      <TouchableOpacity
                        key={p.id}
                        style={[
                          styles.passageOptionChip,
                          bankQuestionForm.passage_id === String(p.id) && styles.passageOptionChipActive,
                        ]}
                        onPress={() => setBankQuestionForm({ ...bankQuestionForm, passage_id: String(p.id) })}
                      >
                        <Text
                          style={[
                            styles.passageOptionChipText,
                            bankQuestionForm.passage_id === String(p.id) && styles.passageOptionChipTextActive,
                          ]}
                          numberOfLines={1}
                        >
                          📖 {p.title}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                {/* 5. Teks Soal */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>
                    5. PERTANYAAN / TEKS SOAL: <Text style={styles.req}>*</Text>
                  </Text>
                  <TextInput
                    style={[styles.inputBox, { height: 80, textAlignVertical: 'top' }]}
                    placeholder="Tuliskan pertanyaan butir soal di sini..."
                    placeholderTextColor="#94A3B8"
                    multiline
                    value={bankQuestionForm.text}
                    onChangeText={(val) => setBankQuestionForm({ ...bankQuestionForm, text: val })}
                  />
                </View>

                {/* 6. Pilihan Jawaban A - E */}
                <Text style={[styles.inputLabel, { marginBottom: 8 }]}>
                  6. PILIHAN JAWABAN & KUNCI: <Text style={styles.req}>*</Text>
                </Text>
                {['A', 'B', 'C', 'D', 'E'].map((optKey) => {
                  const formKey = `option${optKey}` as keyof typeof bankQuestionForm;
                  const isCorrect = bankQuestionForm.answer === optKey;
                  return (
                    <View key={optKey} style={styles.optionInputRow}>
                      <TouchableOpacity
                        style={[styles.correctAnswerRadio, isCorrect && styles.correctAnswerRadioActive]}
                        onPress={() => setBankQuestionForm({ ...bankQuestionForm, answer: optKey })}
                      >
                        <Text style={[styles.radioLetter, isCorrect && styles.radioLetterActive]}>{optKey}</Text>
                      </TouchableOpacity>
                      <TextInput
                        style={[styles.inputBox, { flex: 1, marginLeft: 10 }]}
                        placeholder={`Teks Pilihan ${optKey}...`}
                        placeholderTextColor="#94A3B8"
                        value={String(bankQuestionForm[formKey])}
                        onChangeText={(val) => setBankQuestionForm({ ...bankQuestionForm, [formKey]: val })}
                      />
                    </View>
                  );
                })}

                <Text style={styles.inputHelpText}>
                  Ketuk lingkaran huruf di sebelah kiri untuk menandai kunci jawaban yang benar.
                </Text>

                {/* 7. Bobot Nilai */}
                <View style={[styles.inputGroup, { width: 140, marginTop: 10 }]}>
                  <Text style={styles.inputLabel}>7. BOBOT NILAI</Text>
                  <TextInput
                    style={styles.inputBox}
                    keyboardType="numeric"
                    value={bankQuestionForm.score_weight}
                    onChangeText={(val) => setBankQuestionForm({ ...bankQuestionForm, score_weight: val })}
                  />
                </View>

                {/* Action Buttons */}
                <View style={{ gap: 10, marginTop: 14, marginBottom: 20 }}>
                  <TouchableOpacity
                    style={styles.saveSubmitBtn}
                    onPress={() => handleSaveBankQuestion(false)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="save" size={18} color="#FFFFFF" />
                    <Text style={styles.saveSubmitBtnText}>
                      {editingBankQuestionId ? 'Perbarui Soal Bank' : 'Simpan ke Bank Soal'}
                    </Text>
                  </TouchableOpacity>

                  {bankQuestionForm.passage_id ? (
                    <TouchableOpacity
                      style={[styles.saveSubmitBtn, { backgroundColor: '#0284C7' }]}
                      onPress={() => handleSaveBankQuestion(true)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" />
                      <Text style={styles.saveSubmitBtnText}>Simpan & Buat Soal Lain (Wacana Tetap)</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </ScrollView>
            ) : standaloneBankTab === 'create_passage' ? (
              /* TAB 3: CREATE PASSAGE / WACANA IN BANK */
              <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.modalBody, { paddingBottom: 60 }]} showsVerticalScrollIndicator={false}>
                <View style={styles.passageInfoBanner}>
                  <Ionicons name="sparkles" size={20} color="#059669" />
                  <Text style={styles.passageInfoBannerText}>
                    Wacana / Teks Cerita memungkinkan stimulus bacaan panjang disimpan sekali dan digunakan bersama oleh banyak butir soal (misal: soal 1-5).
                  </Text>
                </View>

                {/* Mapel Wacana */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>
                    1. MATA PELAJARAN: <Text style={styles.req}>*</Text>
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bankPillsRow}>
                    {(teacherSubjects.length > 0 ? teacherSubjects : subjects).map((s) => (
                      <TouchableOpacity
                        key={s.id}
                        style={[
                          styles.subjectChipOption,
                          bankPassageForm.subject_id === String(s.id) && styles.subjectChipOptionActive,
                        ]}
                        onPress={() => setBankPassageForm({ ...bankPassageForm, subject_id: String(s.id) })}
                      >
                        <Text
                          style={[
                            styles.subjectChipOptionText,
                            bankPassageForm.subject_id === String(s.id) && styles.subjectChipOptionTextActive,
                          ]}
                        >
                          {s.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                {/* Judul Wacana */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>
                    2. JUDUL TEKS CERITA / WACANA: <Text style={styles.req}>*</Text>
                  </Text>
                  <TextInput
                    style={styles.inputBox}
                    placeholder="Contoh: Kisah Tokoh Penjelajah Samudra, Fenomena Aurora..."
                    placeholderTextColor="#94A3B8"
                    value={bankPassageForm.title}
                    onChangeText={(val) => setBankPassageForm({ ...bankPassageForm, title: val })}
                  />
                </View>

                {/* Isi Wacana */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>
                    3. ISI TEKS CERITA / NARASI BACAAN: <Text style={styles.req}>*</Text>
                  </Text>
                  <TextInput
                    style={[styles.inputBox, { height: 180, textAlignVertical: 'top' }]}
                    placeholder="Tulis atau tempelkan teks cerita lengkap yang akan dijadikan rujukan soal..."
                    placeholderTextColor="#94A3B8"
                    multiline
                    value={bankPassageForm.content}
                    onChangeText={(val) => setBankPassageForm({ ...bankPassageForm, content: val })}
                  />
                </View>

                <TouchableOpacity
                  style={styles.saveSubmitBtn}
                  onPress={handleSaveBankPassage}
                  activeOpacity={0.8}
                >
                  <Ionicons name="save" size={18} color="#FFFFFF" />
                  <Text style={styles.saveSubmitBtnText}>Simpan Teks Cerita Baru</Text>
                </TouchableOpacity>

                {/* List existing passages */}
                {bankPassagesList.length > 0 && (
                  <View style={{ marginTop: 10, marginBottom: 20 }}>
                    <Text style={styles.subHeadingTitle}>Wacana yang Sudah Tersedia ({bankPassagesList.length}):</Text>
                    {bankPassagesList.map((p) => (
                      <View key={p.id} style={styles.existingPassageCard}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Ionicons name="book" size={14} color="#059669" />
                          <Text style={styles.existingPassageTitle}>{p.title}</Text>
                        </View>
                        <Text style={styles.existingPassageSnippet} numberOfLines={2}>
                          {p.content}
                        </Text>
                        <TouchableOpacity
                          style={styles.useThisPassageBtn}
                          onPress={() => {
                            setBankQuestionForm((prev) => ({
                              ...prev,
                              passage_id: String(p.id),
                              subject_id: String(p.subject_id),
                            }));
                            setStandaloneBankTab('create_pg');
                          }}
                        >
                          <Text style={styles.useThisPassageBtnText}>Gunakan untuk Buat Soal PG →</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </ScrollView>
            ) : aiPreviewMode ? (
              /* TAB 4 (SUB-VIEW A): PREVIEW SOAL HASIL AI SEBELUM SIMPAN */
              <View style={{ flex: 1 }}>
                {/* Header Information Banner */}
                <View style={styles.aiPreviewHeaderCard}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={styles.aiPreviewIconCircle}>
                      <Ionicons name="sparkles" size={20} color="#7C3AED" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.aiPreviewHeaderTitle}>
                        Preview Hasil AI ({aiGeneratedQuestions.length} Butir Soal)
                      </Text>
                      <Text style={styles.aiPreviewHeaderSub}>
                        Tinjau butir soal di bawah ini dan centang yang ingin Anda simpan ke database Bank Soal.
                      </Text>
                    </View>
                  </View>

                  {/* Quick Select Bar */}
                  <View style={styles.aiPreviewControlsRow}>
                    <Text style={styles.aiPreviewSelectedCount}>
                      Terpilih:{' '}
                      <Text style={{ color: '#0284C7', fontWeight: '800' }}>
                        {selectedAiIndices.length}
                      </Text>{' '}
                      dari {aiGeneratedQuestions.length} Soal
                    </Text>
                    <TouchableOpacity
                      style={styles.aiPreviewSelectAllBtn}
                      onPress={() => {
                        if (selectedAiIndices.length === aiGeneratedQuestions.length) {
                          handleDeselectAllAiQuestions();
                        } else {
                          handleSelectAllAiQuestions();
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={
                          selectedAiIndices.length === aiGeneratedQuestions.length
                            ? 'close-circle-outline'
                            : 'checkmark-done-circle-outline'
                        }
                        size={15}
                        color="#0284C7"
                      />
                      <Text style={styles.aiPreviewSelectAllBtnText}>
                        {selectedAiIndices.length === aiGeneratedQuestions.length
                          ? 'Batal Pilih Semua'
                          : 'Pilih Semua'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* List of Generated Questions */}
                <FlatList
                  data={aiGeneratedQuestions}
                  keyExtractor={(_, index) => `ai-preview-${index}`}
                  contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 24 }}
                  showsVerticalScrollIndicator={false}
                  renderItem={({ item, index }) => {
                    const isSelected = selectedAiIndices.includes(index);
                    const cleanText = (item.text || '')
                      .replace(/<[^>]*>/g, '')
                      .replace(/&nbsp;/g, ' ')
                      .trim();
                    const opts: { [key: string]: string } =
                      typeof item.options === 'string'
                        ? (() => {
                            try {
                              return JSON.parse(item.options);
                            } catch {
                              return {};
                            }
                          })()
                        : item.options || {};

                    return (
                      <TouchableOpacity
                        key={index}
                        style={[
                          styles.aiPreviewCard,
                          isSelected && styles.aiPreviewCardSelected,
                        ]}
                        onPress={() => handleToggleSelectAiQuestion(index)}
                        activeOpacity={0.85}
                      >
                        {/* Card Header with Checkbox & Badges */}
                        <View style={styles.aiPreviewCardHeader}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                            <Ionicons
                              name={isSelected ? 'checkbox' : 'square-outline'}
                              size={22}
                              color={isSelected ? '#0284C7' : '#94A3B8'}
                            />
                            <View style={styles.bankItemTypeBadge}>
                              <Text style={styles.bankItemTypeBadgeText}>
                                Soal #{index + 1} • {item.type || 'PG'}
                              </Text>
                            </View>
                            {item.passage_id && (
                              <View
                                style={[
                                  styles.bankItemPassageBadge,
                                  { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
                                ]}
                              >
                                <Text style={[styles.bankItemPassageBadgeText, { color: '#1D4ED8' }]}>
                                  📖 Wacana
                                </Text>
                              </View>
                            )}
                          </View>
                          <View
                            style={[
                              styles.previewStatusChip,
                              isSelected ? styles.previewStatusChipActive : styles.previewStatusChipInactive,
                            ]}
                          >
                            <Text
                              style={[
                                styles.previewStatusChipText,
                                isSelected
                                  ? styles.previewStatusChipTextActive
                                  : styles.previewStatusChipTextInactive,
                              ]}
                            >
                              {isSelected ? '✓ Terpilih' : 'Dilewati'}
                            </Text>
                          </View>
                        </View>

                        {/* Question Text */}
                        <Text style={styles.aiPreviewQuestionText}>{cleanText}</Text>

                        {/* Options A - E */}
                        <View style={styles.aiPreviewOptionsGrid}>
                          {Object.entries(opts).map(([key, val]) => {
                            const isCorrect = String(item.answer).toUpperCase() === key.toUpperCase();
                            return (
                              <View
                                key={key}
                                style={[
                                  styles.aiPreviewOptRow,
                                  isCorrect && styles.aiPreviewOptRowCorrect,
                                ]}
                              >
                                <View
                                  style={[
                                    styles.aiPreviewOptKeyBadge,
                                    isCorrect && styles.aiPreviewOptKeyBadgeCorrect,
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.aiPreviewOptKeyText,
                                      isCorrect && styles.aiPreviewOptKeyTextCorrect,
                                    ]}
                                  >
                                    {key}
                                  </Text>
                                </View>
                                <Text
                                  style={[
                                    styles.aiPreviewOptValText,
                                    isCorrect && styles.aiPreviewOptValTextCorrect,
                                  ]}
                                  numberOfLines={2}
                                >
                                  {String(val).replace(/<[^>]*>/g, '').trim()}
                                </Text>
                                {isCorrect && (
                                  <View style={styles.correctBadgeSmall}>
                                    <Ionicons name="checkmark-circle" size={13} color="#15803D" />
                                    <Text style={styles.correctBadgeSmallText}>Kunci</Text>
                                  </View>
                                )}
                              </View>
                            );
                          })}
                        </View>
                      </TouchableOpacity>
                    );
                  }}
                />

                {/* Sticky Bottom Actions Bar */}
                <View style={styles.aiPreviewBottomBar}>
                  <TouchableOpacity
                    style={styles.aiPreviewBackBtn}
                    onPress={() => setAiPreviewMode(false)}
                    disabled={isSavingAiBatch}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="arrow-back" size={16} color="#475569" />
                    <Text style={styles.aiPreviewBackBtnText}>Atur Ulang</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.aiPreviewSaveBtn,
                      (selectedAiIndices.length === 0 || isSavingAiBatch) && styles.aiPreviewSaveBtnDisabled,
                    ]}
                    onPress={handleSaveSelectedAiQuestions}
                    disabled={selectedAiIndices.length === 0 || isSavingAiBatch}
                    activeOpacity={0.8}
                  >
                    {isSavingAiBatch ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Ionicons name="cloud-upload" size={18} color="#FFFFFF" />
                    )}
                    <Text style={styles.aiPreviewSaveBtnText}>
                      {isSavingAiBatch
                        ? 'Menyimpan ke Database...'
                        : `Simpan ${selectedAiIndices.length} Soal ke Bank`}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              /* TAB 4 (SUB-VIEW B): FORM AI GENERATOR */
              <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.modalBody, { paddingBottom: 60 }]} showsVerticalScrollIndicator={false}>
                <View style={[styles.passageInfoBanner, { backgroundColor: '#FAF5FF', borderColor: '#E9D5FF' }]}>
                  <Ionicons name="sparkles" size={22} color="#7C3AED" />
                  <Text style={[styles.passageInfoBannerText, { color: '#5B21B6' }]}>
                    AI Generator menyusun butir soal pilihan ganda secara otomatis lengkap dengan 5 pilihan jawaban (A-E), kunci jawaban, dan pembahasan materi.
                  </Text>
                </View>

                {/* Mapel AI */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>
                    1. MATA PELAJARAN: <Text style={styles.req}>*</Text>
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bankPillsRow}>
                    {(teacherSubjects.length > 0 ? teacherSubjects : subjects).map((s) => (
                      <TouchableOpacity
                        key={s.id}
                        style={[
                          styles.subjectChipOption,
                          bankAiForm.subject_id === String(s.id) && styles.subjectChipOptionActive,
                        ]}
                        onPress={() => {
                          setBankAiForm({ ...bankAiForm, subject_id: String(s.id) });
                          fetchBankPassages(s.id);
                        }}
                      >
                        <Text
                          style={[
                            styles.subjectChipOptionText,
                            bankAiForm.subject_id === String(s.id) && styles.subjectChipOptionTextActive,
                          ]}
                        >
                          {s.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                {/* 2. Tingkat Kelas */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>2. TINGKAT KELAS</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {['10', '11', '12'].map((lvl) => (
                      <TouchableOpacity
                        key={lvl}
                        style={[
                          styles.levelChipSmall,
                          { flex: 1 },
                          bankAiForm.level === lvl && styles.levelChipSmallActive,
                        ]}
                        onPress={() => setBankAiForm({ ...bankAiForm, level: lvl })}
                      >
                        <Text
                          style={[
                            styles.levelChipSmallText,
                            bankAiForm.level === lvl && styles.levelChipSmallTextActive,
                          ]}
                        >
                          Kelas {lvl}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* 3. Jumlah Soal (Custom + Stepper + Preset) */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>
                    3. JUMLAH SOAL (CUSTOM): <Text style={styles.req}>*</Text>
                  </Text>

                  {/* Stepper & Direct Custom Input */}
                  <View style={styles.countStepperContainer}>
                    <TouchableOpacity
                      style={styles.stepperButton}
                      onPress={() => {
                        const cur = parseInt(bankAiForm.count) || 5;
                        const nextVal = Math.max(1, cur - 1);
                        setBankAiForm({ ...bankAiForm, count: String(nextVal) });
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="remove" size={20} color="#0284C7" />
                    </TouchableOpacity>

                    <View style={styles.stepperInputWrapper}>
                      <TextInput
                        style={styles.stepperNumberInput}
                        keyboardType="number-pad"
                        value={bankAiForm.count}
                        maxLength={3}
                        onChangeText={(val) => {
                          const cleaned = val.replace(/[^0-9]/g, '');
                          setBankAiForm({ ...bankAiForm, count: cleaned });
                        }}
                      />
                      <Text style={styles.stepperSuffix}>Butir Soal</Text>
                    </View>

                    <TouchableOpacity
                      style={styles.stepperButton}
                      onPress={() => {
                        const cur = parseInt(bankAiForm.count) || 5;
                        const nextVal = Math.min(30, cur + 1);
                        setBankAiForm({ ...bankAiForm, count: String(nextVal) });
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="add" size={20} color="#0284C7" />
                    </TouchableOpacity>
                  </View>

                  {/* Preset Pills */}
                  <View style={styles.presetRow}>
                    <Text style={styles.presetLabelText}>Preset Cepat:</Text>
                    {['3', '5', '10', '15', '20'].map((cnt) => (
                      <TouchableOpacity
                        key={cnt}
                        style={[
                          styles.countPresetChip,
                          bankAiForm.count === cnt && styles.countPresetChipActive,
                        ]}
                        onPress={() => setBankAiForm({ ...bankAiForm, count: cnt })}
                      >
                        <Text
                          style={[
                            styles.countPresetChipText,
                            bankAiForm.count === cnt && styles.countPresetChipTextActive,
                          ]}
                        >
                          {cnt} Soal
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={styles.inputHelpText}>
                    Anda dapat mengetik angka custom berapa pun di atas atau memilih tombol preset (1 - 30 soal).
                  </Text>
                </View>

                {/* Topik Materi */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>
                    4. TOPIK / MATERI SPESIFIK: <Text style={styles.req}>*</Text>
                  </Text>
                  <TextInput
                    style={styles.inputBox}
                    placeholder="Contoh: Barisan dan Deret Geometri, Struktur Cerpen..."
                    placeholderTextColor="#94A3B8"
                    value={bankAiForm.topic}
                    onChangeText={(val) => setBankAiForm({ ...bankAiForm, topic: val })}
                  />
                </View>

                {/* Rujukan Wacana (Opsional) */}
                {bankPassagesList.length > 0 && (
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>5. RUJUKAN WACANA CERITA (OPSIONAL):</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bankPillsRow}>
                      <TouchableOpacity
                        style={[
                          styles.passageOptionChip,
                          !bankAiForm.passage_id && styles.passageOptionChipActive,
                        ]}
                        onPress={() => setBankAiForm({ ...bankAiForm, passage_id: '' })}
                      >
                        <Text
                          style={[
                            styles.passageOptionChipText,
                            !bankAiForm.passage_id && styles.passageOptionChipTextActive,
                          ]}
                        >
                          Tanpa Wacana
                        </Text>
                      </TouchableOpacity>

                      {bankPassagesList.map((p) => (
                        <TouchableOpacity
                          key={p.id}
                          style={[
                            styles.passageOptionChip,
                            bankAiForm.passage_id === String(p.id) && styles.passageOptionChipActive,
                          ]}
                          onPress={() => setBankAiForm({ ...bankAiForm, passage_id: String(p.id) })}
                        >
                          <Text
                            style={[
                              styles.passageOptionChipText,
                              bankAiForm.passage_id === String(p.id) && styles.passageOptionChipTextActive,
                            ]}
                            numberOfLines={1}
                          >
                            📖 {p.title}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}

                {/* Generate Button */}
                <TouchableOpacity
                  style={[styles.saveSubmitBtn, { backgroundColor: '#7C3AED', marginTop: 14 }]}
                  onPress={handleGenerateBankAi}
                  disabled={generatingBankAi}
                  activeOpacity={0.8}
                >
                  {generatingBankAi ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Ionicons name="sparkles" size={18} color="#FFFFFF" />
                  )}
                  <Text style={styles.saveSubmitBtnText}>
                    {generatingBankAi ? 'AI Sedang Merumuskan Soal...' : '✨ Mulai Generate Soal dengan AI'}
                  </Text>
                </TouchableOpacity>

                {generatingBankAi && (
                  <View style={styles.aiLoadingNotice}>
                    <ActivityIndicator size="small" color="#7C3AED" style={{ marginBottom: 6 }} />
                    <Text style={styles.aiLoadingNoticeText}>
                      Menghubungkan ke AI Engine untuk menyusun butir soal kurikulum terbaik...
                    </Text>
                    <Text style={[styles.aiLoadingNoticeText, { fontWeight: '700', marginTop: 4, color: '#0284C7' }]}>
                      ✨ Hasil akan ditampilkan dalam mode Preview terlebih dahulu agar Anda dapat memeriksa & memilih soal sebelum disimpan ke database.
                    </Text>
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL 3: LIVE RESULTS & MONITORING FOR TEACHER           */}
      {/* ======================================================== */}
      <Modal visible={isResultsModalOpen} transparent animationType="slide" onRequestClose={() => setIsResultsModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: '90%' }]}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle} numberOfLines={1}>
                  Pantau Nilai: {selectedExamForResults?.title}
                </Text>
                <Text style={styles.modalSubTitle}>
                  {examResults.length} Siswa Terdaftar / Mengerjakan
                </Text>
              </View>
              <TouchableOpacity onPress={() => setIsResultsModalOpen(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            {loadingResults ? (
              <View style={styles.loadingCenter}>
                <ActivityIndicator size="small" color="#059669" />
                <Text style={styles.loadingText}>Memuat hasil ujian...</Text>
              </View>
            ) : (
              <FlatList
                data={examResults}
                keyExtractor={(item) => String(item.id)}
                contentContainerStyle={{ padding: 16 }}
                ListEmptyComponent={
                  <View style={styles.emptyCard}>
                    <Ionicons name="people-outline" size={40} color="#94A3B8" />
                    <Text style={styles.emptyTitle}>Belum Ada Peserta</Text>
                    <Text style={styles.emptySubtitle}>Belum ada siswa yang memulai atau menyelesaikan ujian ini.</Text>
                  </View>
                }
                renderItem={({ item, index }) => (
                  <View style={styles.resultItemCard}>
                    <View style={styles.rankBadge}>
                      <Text style={styles.rankBadgeText}>#{index + 1}</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.resultStudentName}>
                        {item.student?.name || `Siswa ID: ${item.student_id}`}
                      </Text>
                      <Text style={styles.resultStudentStatus}>
                        Status: {item.status || 'Selesai'}
                      </Text>
                    </View>
                    <View style={styles.scorePillSmall}>
                      <Text style={styles.scorePillSmallText}>
                        {item.score_total !== undefined ? item.score_total : item.score_pg}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.logIconBtn}
                      onPress={() => openStudentLogsModal(item.student_id, item.student?.name || 'Siswa')}
                    >
                      <Ionicons name="shield-checkmark-outline" size={18} color="#0284C7" />
                    </TouchableOpacity>
                  </View>
                )}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL 4: PROCTOR VIOLATION LOGS                           */}
      {/* ======================================================== */}
      <Modal visible={isLogsModalOpen} transparent animationType="slide" onRequestClose={() => setIsLogsModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: '75%' }]}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Log Integritas & Kamera</Text>
                <Text style={styles.modalSubTitle}>Siswa: {logStudentName}</Text>
              </View>
              <TouchableOpacity onPress={() => setIsLogsModalOpen(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={selectedStudentLogs}
              keyExtractor={(item, index) => String(index)}
              contentContainerStyle={{ padding: 16 }}
              ListEmptyComponent={
                <View style={styles.emptyCard}>
                  <Ionicons name="checkmark-circle" size={40} color="#10B981" />
                  <Text style={styles.emptyTitle}>Integritas Bersih</Text>
                  <Text style={styles.emptySubtitle}>Tidak ada pelanggaran atau catatan mencurigakan selama ujian.</Text>
                </View>
              }
              renderItem={({ item }) => (
                <View style={styles.logCard}>
                  <Ionicons name="warning-outline" size={18} color="#D97706" />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.logType}>{item.type || 'Peringatan'}</Text>
                    <Text style={styles.logDetails}>{item.details || 'Aktivitas pengawasan terdeteksi'}</Text>
                    <Text style={styles.logTime}>{new Date(item.created_at).toLocaleTimeString()}</Text>
                  </View>
                </View>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL 5: TOKEN PROMPT FOR STUDENT                         */}
      {/* ======================================================== */}
      <Modal visible={isTokenPromptOpen} transparent animationType="fade" onRequestClose={() => setIsTokenPromptOpen(false)}>
        <View style={styles.modalOverlayCenter}>
          <View style={styles.tokenPromptCard}>
            <View style={styles.tokenPromptIcon}>
              <Ionicons name="key" size={28} color="#0EA5E9" />
            </View>
            <Text style={styles.tokenPromptTitle}>Masukkan Token Ujian</Text>
            <Text style={styles.tokenPromptDesc}>
              Ujian "{pendingExamToStart?.title}" diproteksi dengan token pengawas.
            </Text>

            <TextInput
              style={styles.tokenBigInput}
              placeholder="TOKEN 6 HURUF"
              placeholderTextColor="#94A3B8"
              autoCapitalize="characters"
              maxLength={10}
              value={inputToken}
              onChangeText={(val) => setInputToken(val.toUpperCase())}
            />

            <View style={styles.promptBtnRow}>
              <TouchableOpacity style={styles.promptCancelBtn} onPress={() => setIsTokenPromptOpen(false)}>
                <Text style={styles.promptCancelBtnText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.promptConfirmBtn} onPress={handleValidateTokenAndStart}>
                <Text style={styles.promptConfirmBtnText}>Mulai Ujian</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL 6: STUDENT EXAM ARENA (FULLSCREEN)                 */}
      {/* ======================================================== */}
      <Modal
        visible={isStudentExamModalOpen}
        animationType="slide"
        onRequestClose={() => {
          Alert.alert('Perhatian', 'Selesaikan lembar ujian Anda terlebih dahulu sebelum keluar.', [{ text: 'Mengerti' }]);
        }}
      >
        <View style={[styles.examArenaContainer, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          {/* Top Arena Header: Title, Timer, Drawer Toggle */}
          <View style={styles.arenaHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.arenaExamTitle} numberOfLines={1}>
                {activeStudentExam?.title}
              </Text>
              <Text style={styles.arenaSubject}>
                {activeStudentExam?.subject?.name} • Soal {currentQuestionIndex + 1} dari {studentQuestions.length}
              </Text>
            </View>

            {/* Countdown Timer Badge */}
            <View style={[styles.timerBadge, timeLeftSeconds < 300 && styles.timerBadgeCritical]}>
              <Ionicons name="stopwatch-outline" size={16} color={timeLeftSeconds < 300 ? '#EF4444' : '#0F172A'} />
              <Text style={[styles.timerText, timeLeftSeconds < 300 && styles.timerTextCritical]}>
                {formatTimer(timeLeftSeconds)}
              </Text>
            </View>

            {/* Questions Grid Navigator Trigger */}
            <TouchableOpacity style={styles.gridNavTriggerBtn} onPress={() => setIsNavDrawerOpen(true)}>
              <Ionicons name="grid-outline" size={20} color="#0EA5E9" />
            </TouchableOpacity>
          </View>

          {/* Floating Camera Preview Box if Proctor Enabled */}
          {activeStudentExam?.proctor_enabled && (
            <View style={[styles.floatingCameraWrapper, isCameraBoxMinimized && styles.floatingCameraMinimized]}>
              {!isCameraBoxMinimized ? (
                <View style={styles.cameraBoxInner}>
                  {cameraPermission?.granted ? (
                    <CameraView style={StyleSheet.absoluteFill} facing="front" />
                  ) : (
                    <View style={styles.cameraOffOverlay}>
                      <Ionicons name="videocam-off" size={20} color="#EF4444" />
                      <Text style={styles.cameraOffText}>Izin Kamera Diperlukan</Text>
                    </View>
                  )}
                  <View style={styles.cameraStatusPill}>
                    <View style={styles.recDot} />
                    <Text style={styles.cameraStatusText}>PENGAWAS AKTIF</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.minimizeCameraBtn}
                    onPress={() => setIsCameraBoxMinimized(true)}
                  >
                    <Ionicons name="chevron-up" size={14} color="#FFF" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.restoreCameraBtn}
                  onPress={() => setIsCameraBoxMinimized(false)}
                >
                  <View style={styles.recDot} />
                  <Ionicons name="videocam" size={14} color="#059669" />
                  <Text style={styles.restoreCameraText}>Kamera</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Question & Content Area */}
          <ScrollView contentContainerStyle={styles.arenaContentScroll} showsVerticalScrollIndicator={false}>
            {/* If Current Question has Passage / Soal Cerita */}
            {currentQuestion?.passage && (
              <View style={styles.passageCard}>
                <View style={styles.passageCardHeader}>
                  <Ionicons name="book" size={16} color="#059669" />
                  <Text style={styles.passageCardTitle}>{currentQuestion.passage.title}</Text>
                </View>
                <Text style={styles.passageCardContent}>{currentQuestion.passage.content}</Text>
              </View>
            )}

            {/* Question Text */}
            <View style={styles.questionCardBody}>
              <View style={styles.questionNumRow}>
                <Text style={styles.bigQuestionNum}>Pertanyaan No. {currentQuestionIndex + 1}</Text>
                {doubtfulAnswers[currentQuestion?.id || ''] && (
                  <View style={styles.doubtfulBadge}>
                    <Text style={styles.doubtfulBadgeText}>Ragu-Ragu</Text>
                  </View>
                )}
              </View>
              <Text style={styles.arenaQuestionText}>{currentQuestion?.text}</Text>
            </View>

            {/* Radio Options A - E */}
            <View style={styles.optionsListWrapper}>
              {Object.entries(parsedOptions).map(([key, val]) => {
                const isSelected = studentAnswers[currentQuestion?.id || ''] === key;
                return (
                  <TouchableOpacity
                    key={key}
                    style={[styles.arenaOptionCard, isSelected && styles.arenaOptionCardSelected]}
                    onPress={() => currentQuestion && handleSelectAnswer(currentQuestion.id, key)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.arenaRadioCircle, isSelected && styles.arenaRadioCircleSelected]}>
                      <Text style={[styles.arenaRadioLetter, isSelected && styles.arenaRadioLetterSelected]}>
                        {key}
                      </Text>
                    </View>
                    <Text style={[styles.arenaOptionText, isSelected && styles.arenaOptionTextSelected]}>
                      {String(val)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={{ height: 60 }} />
          </ScrollView>

          {/* Bottom Navigation Buttons: Prev, Doubtful, Next / Submit */}
          <View style={styles.arenaBottomBar}>
            <TouchableOpacity
              style={[styles.arenaNavBtn, currentQuestionIndex === 0 && styles.arenaNavBtnDisabled]}
              disabled={currentQuestionIndex === 0}
              onPress={() => setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))}
            >
              <Ionicons name="chevron-back" size={18} color={currentQuestionIndex === 0 ? '#94A3B8' : '#334155'} />
              <Text style={[styles.arenaNavBtnText, currentQuestionIndex === 0 && { color: '#94A3B8' }]}>Sebelumnya</Text>
            </TouchableOpacity>

            {/* Doubtful Toggle */}
            <TouchableOpacity
              style={[
                styles.doubtfulToggleBtn,
                currentQuestion && doubtfulAnswers[currentQuestion.id] && styles.doubtfulToggleBtnActive,
              ]}
              onPress={() => currentQuestion && toggleDoubtful(currentQuestion.id)}
            >
              <Ionicons
                name="help-circle-outline"
                size={16}
                color={currentQuestion && doubtfulAnswers[currentQuestion.id] ? '#D97706' : '#64748B'}
              />
              <Text
                style={[
                  styles.doubtfulToggleText,
                  currentQuestion && doubtfulAnswers[currentQuestion.id] && styles.doubtfulToggleTextActive,
                ]}
              >
                Ragu
              </Text>
            </TouchableOpacity>

            {currentQuestionIndex < studentQuestions.length - 1 ? (
              <TouchableOpacity
                style={styles.arenaNextBtn}
                onPress={() => setCurrentQuestionIndex((prev) => Math.min(studentQuestions.length - 1, prev + 1))}
              >
                <Text style={styles.arenaNextBtnText}>Berikutnya</Text>
                <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.arenaFinishBtn} onPress={handleConfirmSubmit}>
                <Ionicons name="checkmark-done" size={18} color="#FFFFFF" />
                <Text style={styles.arenaFinishBtnText}>Selesai</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Question Grid Navigator Modal / Drawer */}
          <Modal visible={isNavDrawerOpen} transparent animationType="slide" onRequestClose={() => setIsNavDrawerOpen(false)}>
            <View style={styles.modalOverlay}>
              <View style={[styles.modalCard, { maxHeight: '80%' }]}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Daftar Nomor Soal</Text>
                  <TouchableOpacity onPress={() => setIsNavDrawerOpen(false)}>
                    <Ionicons name="close" size={24} color="#64748B" />
                  </TouchableOpacity>
                </View>

                {/* Legend */}
                <View style={styles.legendRow}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendBox, { backgroundColor: '#10B981' }]} />
                    <Text style={styles.legendText}>Terjawab</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendBox, { backgroundColor: '#F59E0B' }]} />
                    <Text style={styles.legendText}>Ragu-Ragu</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendBox, { backgroundColor: '#E2E8F0' }]} />
                    <Text style={styles.legendText}>Belum</Text>
                  </View>
                </View>

                {/* Numbers Grid */}
                <ScrollView contentContainerStyle={styles.numbersGrid}>
                  {studentQuestions.map((q, idx) => {
                    const isAnswered = !!studentAnswers[q.id];
                    const isDoubt = !!doubtfulAnswers[q.id];
                    const isCurrent = currentQuestionIndex === idx;

                    let bg = '#F1F5F9';
                    let txt = '#475569';

                    if (isAnswered) {
                      bg = '#10B981';
                      txt = '#FFF';
                    }
                    if (isDoubt) {
                      bg = '#F59E0B';
                      txt = '#FFF';
                    }

                    return (
                      <TouchableOpacity
                        key={q.id}
                        style={[
                          styles.gridNumberTile,
                          { backgroundColor: bg },
                          isCurrent && styles.gridNumberTileCurrent,
                        ]}
                        onPress={() => {
                          setCurrentQuestionIndex(idx);
                          setIsNavDrawerOpen(false);
                        }}
                      >
                        <Text style={[styles.gridNumberText, { color: txt }]}>{idx + 1}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                <TouchableOpacity style={styles.saveSubmitBtn} onPress={handleConfirmSubmit}>
                  <Text style={styles.saveSubmitBtnText}>Selesaikan Ujian Sekarang</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        </View>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL 7: RESULT SUMMARY MODAL                            */}
      {/* ======================================================== */}
      {examResultSummary && (
        <Modal visible={true} transparent animationType="fade">
          <View style={styles.modalOverlayCenter}>
            <View style={styles.resultSummaryCard}>
              <View style={styles.resultSummaryIconCircle}>
                <Ionicons name="trophy" size={36} color="#F59E0B" />
              </View>
              <Text style={styles.resultSummaryTitle}>Ujian Selesai Dikoreksi!</Text>
              <Text style={styles.resultSummaryExamTitle}>{examResultSummary.title}</Text>
              <Text style={styles.resultSummarySubject}>{examResultSummary.subjectName}</Text>

              {/* Big Score Display */}
              <View style={styles.bigScoreBox}>
                <Text style={styles.bigScoreValue}>{examResultSummary.scoreTotal}</Text>
                <Text style={styles.bigScoreLabel}>SKOR NILAI TOTAL</Text>
              </View>

              <Text style={styles.resultSummaryDesc}>
                Terjawab {examResultSummary.answeredCount} dari {examResultSummary.totalQuestions} soal. Nilai Anda telah tercatat otomatis di buku nilai guru.
              </Text>

              <TouchableOpacity style={styles.closeSummaryBtn} onPress={() => setExamResultSummary(null)}>
                <Text style={styles.closeSummaryBtnText}>Kembali ke Halaman Utama</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* Toast Notification */}
      {toast.visible && (
        <Toast
          visible={toast.visible}
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast({ ...toast, visible: false })}
        />
      )}
    </View>
  );
}

// -------------------------------------------------------------
// STYLESHEET
// -------------------------------------------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  refreshButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F0F9FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  scrollContent: {
    padding: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  statIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#E0F2FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  statVal: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  statLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 2,
    textAlign: 'center',
  },
  actionButtonRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  createExamBtn: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#059669',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  createExamBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  bankSoalBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  bankSoalBtnText: {
    color: '#0284C7',
    fontWeight: '700',
    fontSize: 13,
  },
  filterSection: {
    marginBottom: 16,
  },
  filterHeaderTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 8,
  },
  filterChipsRow: {
    gap: 8,
  },
  filterChip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  filterChipActive: {
    backgroundColor: '#0EA5E9',
    borderColor: '#0EA5E9',
  },
  filterChipText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E293B',
  },
  sectionSubCount: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    marginVertical: 10,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
    marginTop: 10,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  examCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4 },
      android: { elevation: 1 },
    }),
  },
  examCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  examTypeTag: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  examTypeTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1D4ED8',
  },
  examCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  examCardSubject: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  tokenBox: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignItems: 'center',
  },
  tokenLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: '#B45309',
  },
  tokenCode: {
    fontSize: 12,
    fontWeight: '900',
    color: '#92400E',
    letterSpacing: 1,
  },
  examMetaGrid: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 10,
  },
  examMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  examMetaText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  proctorBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  proctorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    gap: 4,
  },
  proctorBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 12,
  },
  examCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  manageQBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F9FF',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  manageQBtnText: {
    fontSize: 12,
    color: '#0284C7',
    fontWeight: '700',
  },
  monitorBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ECFDF5',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  monitorBtnText: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '700',
  },
  iconActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Student Styles
  studentBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    gap: 12,
  },
  studentBannerIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#E0F2FE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  studentBannerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0369A1',
  },
  studentBannerDesc: {
    fontSize: 11,
    color: '#475569',
    marginTop: 2,
    lineHeight: 16,
  },
  studentCompletedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scorePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  scorePillText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#B45309',
  },
  finishedStatusTag: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  finishedStatusText: {
    fontSize: 11,
    color: '#059669',
    fontWeight: '700',
  },
  startExamBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0EA5E9',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  startExamBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  // Modal Overlays
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalOverlayCenter: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    height: '92%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSubTitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  modalBody: {
    padding: 16,
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  req: {
    color: '#EF4444',
  },
  inputBox: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
  },
  rowTwoCols: {
    flexDirection: 'row',
  },
  selectTypeContainer: {
    flexDirection: 'row',
    gap: 4,
  },
  typeOptionChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    backgroundColor: '#F8FAFC',
  },
  typeOptionChipActive: {
    backgroundColor: '#0284C7',
    borderColor: '#0284C7',
  },
  typeOptionText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  typeOptionTextActive: {
    color: '#FFFFFF',
  },
  pickerChipsRow: {
    gap: 6,
  },
  pickerChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  pickerChipActive: {
    backgroundColor: '#0284C7',
    borderColor: '#0284C7',
  },
  pickerChipText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  pickerChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  labelWithAction: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  linkAction: {
    fontSize: 11,
    color: '#0284C7',
    fontWeight: '700',
  },
  proctorSettingBox: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  proctorBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  proctorBoxTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#166534',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#DCFCE7',
  },
  switchTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  switchDesc: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  saveSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#059669',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
    marginTop: 10,
    marginBottom: 20,
  },
  saveSubmitBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  // Sub-Tabs Bar
  tabButtonBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingHorizontal: 8,
  },
  tabBtnItem: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnItemActive: {
    borderBottomColor: '#0284C7',
  },
  tabBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  tabBtnTextActive: {
    color: '#0284C7',
    fontWeight: '800',
  },
  questionItemCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  questionItemTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  questionNumBadge: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  questionNumBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0369A1',
  },
  answerKeyBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 6,
  },
  answerKeyBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#15803D',
  },
  passageCardMini: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    padding: 6,
    borderRadius: 6,
    marginBottom: 8,
    gap: 4,
  },
  passageCardMiniTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#166534',
    flex: 1,
  },
  questionItemText: {
    fontSize: 13,
    color: '#1E293B',
    lineHeight: 18,
    marginBottom: 8,
  },
  optionsPreviewBox: {
    gap: 4,
  },
  optLine: {
    fontSize: 11,
    color: '#475569',
  },
  optLineCorrect: {
    color: '#16A34A',
    fontWeight: '700',
  },
  optionInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  correctAnswerRadio: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  correctAnswerRadioActive: {
    borderColor: '#16A34A',
    backgroundColor: '#DCFCE7',
  },
  radioLetter: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  radioLetterActive: {
    color: '#15803D',
    fontWeight: '900',
  },
  inputHelpText: {
    fontSize: 11,
    color: '#64748B',
    fontStyle: 'italic',
    marginTop: 4,
    marginBottom: 10,
  },
  passageInfoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    marginBottom: 14,
    gap: 8,
  },
  passageInfoBannerText: {
    fontSize: 11,
    color: '#166534',
    flex: 1,
    lineHeight: 16,
  },
  bankItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  bankItemCardSelected: {
    borderColor: '#0284C7',
    backgroundColor: '#F0F9FF',
  },
  bankItemText: {
    fontSize: 12,
    color: '#1E293B',
    fontWeight: '600',
  },
  bankItemMeta: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  importConfirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0284C7',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
    marginTop: 10,
  },
  importConfirmBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  resultItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
  },
  resultStudentName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  resultStudentStatus: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  scorePillSmall: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 6,
  },
  scorePillSmallText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#B45309',
  },
  logIconBtn: {
    padding: 6,
  },
  logCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  logType: {
    fontSize: 12,
    fontWeight: '800',
    color: '#92400E',
  },
  logDetails: {
    fontSize: 11,
    color: '#78350F',
    marginTop: 2,
  },
  logTime: {
    fontSize: 9,
    color: '#A16207',
    marginTop: 4,
  },
  tokenPromptCard: {
    width: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  tokenPromptIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E0F2FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  tokenPromptTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  tokenPromptDesc: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  tokenBigInput: {
    width: '100%',
    borderWidth: 2,
    borderColor: '#BAE6FD',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingVertical: 12,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 4,
    marginVertical: 16,
    color: '#0284C7',
  },
  promptBtnRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  promptCancelBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
  },
  promptCancelBtnText: {
    color: '#475569',
    fontWeight: '700',
    fontSize: 13,
  },
  promptConfirmBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#0EA5E9',
    borderRadius: 8,
  },
  promptConfirmBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  // Student Arena Styles
  examArenaContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  arenaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  arenaExamTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  arenaSubject: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
    marginRight: 8,
  },
  timerBadgeCritical: {
    backgroundColor: '#FEE2E2',
  },
  timerText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  timerTextCritical: {
    color: '#EF4444',
  },
  gridNavTriggerBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#F0F9FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  floatingCameraWrapper: {
    position: 'absolute',
    top: 60,
    right: 16,
    zIndex: 99,
  },
  floatingCameraMinimized: {
    top: 60,
  },
  cameraBoxInner: {
    width: 100,
    height: 130,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000000',
    borderWidth: 2,
    borderColor: '#059669',
  },
  cameraOffOverlay: {
    flex: 1,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
  },
  cameraOffText: {
    fontSize: 8,
    color: '#EF4444',
    textAlign: 'center',
    marginTop: 4,
  },
  cameraStatusPill: {
    position: 'absolute',
    top: 4,
    left: 4,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 3,
  },
  recDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
  },
  cameraStatusText: {
    fontSize: 7,
    color: '#FFF',
    fontWeight: '800',
  },
  minimizeCameraBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 10,
    padding: 2,
  },
  restoreCameraBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  restoreCameraText: {
    fontSize: 10,
    color: '#065F46',
    fontWeight: '700',
  },
  arenaContentScroll: {
    padding: 16,
  },
  passageCard: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  passageCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  passageCardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#166534',
  },
  passageCardContent: {
    fontSize: 12,
    color: '#1E293B',
    lineHeight: 20,
    textAlign: 'justify',
  },
  questionCardBody: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  questionNumRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  bigQuestionNum: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0284C7',
  },
  doubtfulBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  doubtfulBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#B45309',
  },
  arenaQuestionText: {
    fontSize: 14,
    color: '#0F172A',
    lineHeight: 22,
    fontWeight: '500',
  },
  optionsListWrapper: {
    gap: 10,
  },
  arenaOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
  },
  arenaOptionCardSelected: {
    borderColor: '#0284C7',
    backgroundColor: '#F0F9FF',
  },
  arenaRadioCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  arenaRadioCircleSelected: {
    backgroundColor: '#0284C7',
  },
  arenaRadioLetter: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  arenaRadioLetterSelected: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  arenaOptionText: {
    fontSize: 13,
    color: '#334155',
    flex: 1,
    lineHeight: 20,
  },
  arenaOptionTextSelected: {
    color: '#0369A1',
    fontWeight: '700',
  },
  arenaBottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  arenaNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 4,
  },
  arenaNavBtnDisabled: {
    opacity: 0.5,
  },
  arenaNavBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  doubtfulToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
    gap: 4,
  },
  doubtfulToggleBtnActive: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  doubtfulToggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  doubtfulToggleTextActive: {
    color: '#B45309',
    fontWeight: '700',
  },
  arenaNextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0284C7',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 4,
  },
  arenaNextBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  arenaFinishBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16A34A',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 4,
  },
  arenaFinishBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  // Legend
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendBox: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  legendText: {
    fontSize: 11,
    color: '#64748B',
  },
  numbersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    padding: 16,
    justifyContent: 'center',
  },
  gridNumberTile: {
    width: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridNumberTileCurrent: {
    borderWidth: 2,
    borderColor: '#0F172A',
  },
  gridNumberText: {
    fontSize: 14,
    fontWeight: '800',
  },
  // Summary Result Modal
  resultSummaryCard: {
    width: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  resultSummaryIconCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  resultSummaryTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  resultSummaryExamTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0284C7',
    marginTop: 4,
    textAlign: 'center',
  },
  resultSummarySubject: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  bigScoreBox: {
    backgroundColor: '#F0FDF4',
    borderWidth: 2,
    borderColor: '#86EFAC',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    marginVertical: 16,
  },
  bigScoreValue: {
    fontSize: 44,
    fontWeight: '900',
    color: '#15803D',
  },
  bigScoreLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#166534',
    letterSpacing: 1,
    marginTop: 2,
  },
  resultSummaryDesc: {
    fontSize: 12,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  closeSummaryBtn: {
    width: '100%',
    backgroundColor: '#0F172A',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  closeSummaryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  // -------------------------------------------------------------
  // STANDALONE BANK SOAL STYLES
  // -------------------------------------------------------------
  bankFilterContainer: {
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    padding: 12,
  },
  bankSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 38,
    gap: 8,
  },
  bankSearchInput: {
    flex: 1,
    fontSize: 12,
    color: '#1E293B',
    paddingVertical: 0,
  },
  bankPillsRow: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 8,
  },
  bankPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  bankPillActive: {
    backgroundColor: '#0284C7',
    borderColor: '#0284C7',
  },
  bankPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  bankPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  bankLevelRow: {
    flexDirection: 'row',
    gap: 6,
  },
  levelChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  levelChipActive: {
    backgroundColor: '#E0F2FE',
    borderColor: '#38BDF8',
  },
  levelChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  levelChipTextActive: {
    color: '#0369A1',
  },
  emptyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0284C7',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  emptyActionBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  bankItemMainCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  bankItemTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  badgeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 5,
    flex: 1,
  },
  subjectMiniBadge: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  subjectMiniBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#0369A1',
  },
  levelMiniBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  levelMiniBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#475569',
  },
  topicMiniBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  topicMiniBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#B45309',
  },
  aiDiffBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  aiDiffMudah: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  aiDiffSedang: {
    backgroundColor: '#FEFCE8',
    borderColor: '#FEF08A',
  },
  aiDiffSulit: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  aiDiffBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#475569',
  },
  bankItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionIconPencil: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#F0F9FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionIconTrash: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bankItemQuestionText: {
    fontSize: 13,
    color: '#1E293B',
    lineHeight: 18,
    marginBottom: 10,
  },
  bankOptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  bankOptRowCorrect: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  bankOptKeyCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  bankOptKeyCircleCorrect: {
    backgroundColor: '#16A34A',
  },
  bankOptKeyLetter: {
    fontSize: 10,
    fontWeight: '800',
    color: '#475569',
  },
  bankOptKeyLetterCorrect: {
    color: '#FFFFFF',
  },
  bankOptValText: {
    fontSize: 11,
    color: '#334155',
    flex: 1,
  },
  bankOptValTextCorrect: {
    fontWeight: '700',
    color: '#15803D',
  },
  bankCardBottomMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  bankCardMetaText: {
    fontSize: 10,
    color: '#94A3B8',
  },
  formHeaderTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  formSectionHeading: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  cancelEditLink: {
    fontSize: 11,
    fontWeight: '700',
    color: '#EF4444',
  },
  subjectChipOption: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  subjectChipOptionActive: {
    backgroundColor: '#0284C7',
    borderColor: '#0284C7',
  },
  subjectChipOptionText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  subjectChipOptionTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  levelChipSmall: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  levelChipSmallActive: {
    backgroundColor: '#0284C7',
    borderColor: '#0284C7',
  },
  levelChipSmallText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  levelChipSmallTextActive: {
    color: '#FFFFFF',
  },
  passageOptionChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    maxWidth: 220,
  },
  passageOptionChipActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
  },
  passageOptionChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  passageOptionChipTextActive: {
    color: '#065F46',
    fontWeight: '700',
  },
  subHeadingTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 8,
  },
  existingPassageCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  existingPassageTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  existingPassageSnippet: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 16,
    marginVertical: 6,
  },
  useThisPassageBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  useThisPassageBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0369A1',
  },
  aiLoadingNotice: {
    backgroundColor: '#FAF5FF',
    borderWidth: 1,
    borderColor: '#E9D5FF',
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
  },
  aiLoadingNoticeText: {
    fontSize: 11,
    color: '#6B21A8',
    textAlign: 'center',
    lineHeight: 16,
  },
  countStepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    padding: 4,
    marginBottom: 8,
  },
  stepperButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  stepperNumberInput: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    minWidth: 44,
    padding: 0,
  },
  stepperSuffix: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  presetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  presetLabelText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginRight: 2,
  },
  countPresetChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  countPresetChipActive: {
    backgroundColor: '#0284C7',
    borderColor: '#0284C7',
  },
  countPresetChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  countPresetChipTextActive: {
    color: '#FFFFFF',
  },
  // -------------------------------------------------------------
  // AI PREVIEW SCREEN STYLES
  // -------------------------------------------------------------
  aiPreviewHeaderCard: {
    backgroundColor: '#FAF5FF',
    borderWidth: 1,
    borderColor: '#E9D5FF',
    borderRadius: 12,
    padding: 14,
    margin: 14,
    marginBottom: 8,
  },
  aiPreviewIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3E8FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiPreviewHeaderTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#5B21B6',
  },
  aiPreviewHeaderSub: {
    fontSize: 11,
    color: '#7C3AED',
    marginTop: 2,
    lineHeight: 15,
  },
  aiPreviewControlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3E8FF',
  },
  aiPreviewSelectedCount: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  aiPreviewSelectAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  aiPreviewSelectAllBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284C7',
  },
  aiPreviewCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  aiPreviewCardSelected: {
    borderColor: '#0284C7',
    backgroundColor: '#F8FAFC',
  },
  aiPreviewCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  bankItemTypeBadge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  bankItemTypeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1E40AF',
  },
  bankItemPassageBadge: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  bankItemPassageBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  previewStatusChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  previewStatusChipActive: {
    backgroundColor: '#E0F2FE',
  },
  previewStatusChipInactive: {
    backgroundColor: '#F1F5F9',
  },
  previewStatusChipText: {
    fontSize: 10,
    fontWeight: '700',
  },
  previewStatusChipTextActive: {
    color: '#0284C7',
  },
  previewStatusChipTextInactive: {
    color: '#94A3B8',
  },
  aiPreviewQuestionText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: 19,
    marginBottom: 10,
  },
  aiPreviewOptionsGrid: {
    gap: 6,
  },
  aiPreviewOptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  aiPreviewOptRowCorrect: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  aiPreviewOptKeyBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  aiPreviewOptKeyBadgeCorrect: {
    backgroundColor: '#16A34A',
  },
  aiPreviewOptKeyText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#475569',
  },
  aiPreviewOptKeyTextCorrect: {
    color: '#FFFFFF',
  },
  aiPreviewOptValText: {
    fontSize: 12,
    color: '#334155',
    flex: 1,
  },
  aiPreviewOptValTextCorrect: {
    fontWeight: '700',
    color: '#15803D',
  },
  correctBadgeSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 6,
  },
  correctBadgeSmallText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803D',
  },
  aiPreviewBottomBar: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  aiPreviewBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  aiPreviewBackBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  aiPreviewSaveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#16A34A',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
  },
  aiPreviewSaveBtnDisabled: {
    backgroundColor: '#94A3B8',
    opacity: 0.7,
  },
  aiPreviewSaveBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
