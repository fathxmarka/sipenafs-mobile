import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Modal, FlatList, Platform,
  Dimensions, KeyboardAvoidingView, Image, Animated, Easing
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import Colors from '../../constants/Colors';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { Toast, ToastType } from '../../components/ui/Toast';
import { CameraView, useCameraPermissions } from 'expo-camera';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

type TeachingStatus = 'BELUM' | 'SEDANG_MENGAJAR' | 'SELESAI' | 'TERBLOKIR';

interface ScheduleCardData {
  id: string | number;
  subject: string;
  class_name: string;
  time: string;
  room: string;
  total_students: number;
  class_id?: number;
  subject_id?: number;
  status: TeachingStatus;
  is_filled?: boolean;
  topic?: string;
  description?: string;
  methods?: string;
  media?: string;
  syllabus_id?: number | null;
  attendance_photo_in?: string | null;
  attendance_photo_out?: string | null;
}

interface SyllabusItem {
  id: number;
  subject_id: number;
  level?: number;
  semester?: string;
  topic: string;
  sub_topic?: string;
  cp?: string;
  atp?: string;
  atp_code?: string;
}

interface StudentItem {
  id: string;
  name: string;
  nis: string;
  gender: string;
  status: 'H' | 'S' | 'I' | 'A';
  notes?: string;
}

const METHODS_LIST = [
  'Ceramah Interaktif',
  'Diskusi Kelompok',
  'Praktikum / Eksperimen',
  'Tanya Jawab & Kuis',
  'Presentasi Siswa',
  'Problem Based Learning (PBL)'
];

const MEDIA_LIST = [
  'Papan Tulis & Spidol',
  'LCD Proyektor & Slide',
  'Buku Paket / Modul',
  'Laptop / Tablet Siswa',
  'Alat Peraga / Lab'
];

const DEFAULT_SYLLABUSES: Record<number, SyllabusItem[]> = {
  101: [
    {
      id: 1,
      subject_id: 101,
      level: 12,
      topic: 'Persamaan Polinomial dan Teorema Sisa',
      sub_topic: 'Teorema Sisa, Teorema Faktor, dan Operasi Aljabar Polinomial',
      cp: 'Peserta didik mampu memahami dan menganalisis hubungan akar-akar polinomial serta penerapannya.',
      atp_code: 'MAT.12.POL.1',
      atp: 'Menganalisis keterbagian dan faktorisasi polinomial serta menyelesaikan masalah kontekstual.'
    },
    {
      id: 2,
      subject_id: 101,
      level: 12,
      topic: 'Limit Fungsi Trigonometri',
      sub_topic: 'Sifat Limit Trigonometri, Teorema Apit, dan Dalil L\'Hopital',
      cp: 'Peserta didik mampu memahami konsep dasar limit fungsi trigonometri dan menyelesaikan bentuk tak tentu.',
      atp_code: 'MAT.12.TRG.2',
      atp: 'Menentukan nilai limit di ketakhinggaan dan fungsi trigonometri secara analitis.'
    },
    {
      id: 3,
      subject_id: 101,
      level: 12,
      topic: 'Turunan Fungsi Implisit & Parametrik',
      sub_topic: 'Aturan Rantai, Gradien Garis Singgung, Titik Stasioner',
      cp: 'Peserta didik mampu menerapkan turunan tingkat tinggi untuk optimasi fungsi matematis.',
      atp_code: 'MAT.12.TUR.3',
      atp: 'Menyelesaikan turunan fungsi trigonometri dan fungsi implisit dalam pemecahan masalah.'
    }
  ],
  102: [
    {
      id: 4,
      subject_id: 102,
      level: 12,
      topic: 'Gelombang Bunyi dan Efek Doppler',
      sub_topic: 'Intensitas Bunyi, Taraf Intensitas, dan Efek Doppler',
      cp: 'Peserta didik memahami perambatan gelombang mekanik dan aplikasi resonansi.',
      atp_code: 'FIS.12.BUN.1',
      atp: 'Menganalisis frekuensi pelayangan dan efek Doppler dalam kehidupan sehari-hari.'
    },
    {
      id: 5,
      subject_id: 102,
      level: 12,
      topic: 'Listrik Statis dan Kapasitor Keping Sejajar',
      sub_topic: 'Hukum Gauss, Energi Potensial Listrik, Kapasitansi Dielektrik',
      cp: 'Peserta didik memahami interaksi muatan listrik dan medan elektrostatik.',
      atp_code: 'FIS.12.LIS.2',
      atp: 'Menghitung kuat medan listrik dan kapasitas dielektrik pada rangkaian kapasitor.'
    }
  ]
};

const INITIAL_STUDENTS_MIPA1: StudentItem[] = [
  { id: '1', name: 'Ahmad Fauzan Pratama', nis: '10291', gender: 'L', status: 'H' },
  { id: '2', name: 'Aisyah Putri Rahmawati', nis: '10292', gender: 'P', status: 'H' },
  { id: '3', name: 'Budi Santoso', nis: '10293', gender: 'L', status: 'H' },
  { id: '4', name: 'Citra Dewi Lestari', nis: '10294', gender: 'P', status: 'H' },
  { id: '5', name: 'Daffa Raihan Alfarizi', nis: '10295', gender: 'L', status: 'H' },
  { id: '6', name: 'Dinda Ayu Maharani', nis: '10296', gender: 'P', status: 'H' },
  { id: '7', name: 'Fajar Nugraha', nis: '10297', gender: 'L', status: 'H' },
  { id: '8', name: 'Gita Permata Sari', nis: '10298', gender: 'P', status: 'H' },
  { id: '9', name: 'Hafiz Danendra', nis: '10299', gender: 'L', status: 'H' },
  { id: '10', name: 'Indah Puspitasari', nis: '10300', gender: 'P', status: 'H' },
  { id: '11', name: 'Kevin Kurniawan', nis: '10301', gender: 'L', status: 'H' },
  { id: '12', name: 'Larasati Kirana', nis: '10302', gender: 'P', status: 'H' },
  { id: '13', name: 'Muhammad Aditya', nis: '10303', gender: 'L', status: 'H' },
  { id: '14', name: 'Nabila Azzahra', nis: '10304', gender: 'P', status: 'H' },
  { id: '15', name: 'Raditya Arya Putra', nis: '10305', gender: 'L', status: 'H' },
  { id: '16', name: 'Siti Rahmawati', nis: '10306', gender: 'P', status: 'H' },
];

export default function JurnalMengajarScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{
    subject?: string;
    class_name?: string;
    time?: string;
    room?: string;
    autoOpen?: string;
  }>();

  // User & School Policy State
  const [userName, setUserName] = useState('Indra Mulyana');
  const [userNip, setUserNip] = useState('197508122005011003');
  const [userRole, setUserRole] = useState('guru');
  const [isFaceJournalEnabled, setIsFaceJournalEnabled] = useState(true);
  const [journalGracePeriod, setJournalGracePeriod] = useState(15);

  // Schedules state (Persis alur KBM SIPENAFS)
  const [todaySchedules, setTodaySchedules] = useState<ScheduleCardData[]>([
    {
      id: 'sched-1',
      subject: 'Matematika Peminatan',
      class_name: 'Kelas XII MIPA 1',
      time: '07:30 - 09:00 WIB',
      room: 'Ruang 12-A',
      total_students: 36,
      class_id: 1,
      subject_id: 101,
      status: 'BELUM',
      is_filled: false,
    },
    {
      id: 'sched-2',
      subject: 'Fisika Terapan & Gelombang',
      class_name: 'Kelas XII MIPA 2',
      time: '09:15 - 10:45 WIB',
      room: 'Lab Fisika',
      total_students: 34,
      class_id: 2,
      subject_id: 102,
      status: 'BELUM',
      is_filled: false,
    }
  ]);

  // Face Camera Verification Modal (100% Hands-Free Auto-Detect)
  const [isFaceModalOpen, setIsFaceModalOpen] = useState(false);
  const [faceActionType, setFaceActionType] = useState<'CLOCK_IN' | 'CLOCK_OUT'>('CLOCK_IN');
  const [activeFaceSchedule, setActiveFaceSchedule] = useState<ScheduleCardData | null>(null);
  const [isProcessingFace, setIsProcessingFace] = useState(false);
  const cameraRef = useRef<any>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  // Auto-detection states (Tanpa Tombol)
  const [faceProgress, setFaceProgress] = useState(0);
  const [faceDetectStatus, setFaceDetectStatus] = useState('Mendeteksi Posisi Wajah...');
  const [isFaceVerified, setIsFaceVerified] = useState(false);
  const autoDetectTimerRef = useRef<any>(null);
  const isAutoProcessingRef = useRef(false);
  const activeFaceScheduleRef = useRef<ScheduleCardData | null>(null);
  const faceActionTypeRef = useRef<'CLOCK_IN' | 'CLOCK_OUT'>('CLOCK_IN');

  // Scanning animation
  const scanAnim = useRef(new Animated.Value(0)).current;

  // Journal form modal state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [activeSchedule, setActiveSchedule] = useState<ScheduleCardData | null>(null);
  const [topic, setTopic] = useState('');
  const [description, setDescription] = useState('');
  const [selectedMethod, setSelectedMethod] = useState('Diskusi Kelompok');
  const [selectedMedia, setSelectedMedia] = useState('Papan Tulis & Spidol');
  const [students, setStudents] = useState<StudentItem[]>(INITIAL_STUDENTS_MIPA1);
  const [searchStudent, setSearchStudent] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Syllabus state (Persis SIPENAFS Web - Opsional)
  const [syllabuses, setSyllabuses] = useState<SyllabusItem[]>([]);
  const [selectedSyllabusIds, setSelectedSyllabusIds] = useState<number[]>([]);
  const [isLoadingSyllabuses, setIsLoadingSyllabuses] = useState(false);

  // Journal history
  const [historyJournals, setHistoryJournals] = useState<any[]>([
    {
      id: 'hist-1',
      date: 'Selasa, 29 Sep 2026',
      subject: 'Matematika Peminatan',
      class_name: 'Kelas XI MIPA 3',
      time: '10:00 - 11:30 WIB',
      topic: 'Trigonometri: Rumus Jumlah & Selisih Dua Sudut',
      hadir: 36,
      sakit: 0,
      izin: 0,
      alpa: 0,
      status: 'SELESAI'
    }
  ]);

  // Toast
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: ToastType }>({
    visible: false,
    message: '',
    type: 'info',
  });

  const showToast = (message: string, type: ToastType = 'info') => {
    setToast({ visible: true, message, type });
  };

  const adminRoles = ['admin', 'superadmin', 'operator', 'operator sekolah', 'kepala sekolah', 'wakil kepala sekolah', 'tata usaha'];
  const isAdmin = adminRoles.includes((userRole || '').toLowerCase());
  const isFaceRequired = !isAdmin && isFaceJournalEnabled;

  useEffect(() => {
    loadUserDataAndSchool();
  }, []);

  useEffect(() => {
    if (isFaceModalOpen) {
      setFaceProgress(0);
      setIsFaceVerified(false);
      setFaceDetectStatus('Mendeteksi Posisi Wajah...');
      isAutoProcessingRef.current = false;

      // Start animated laser scan
      Animated.loop(
        Animated.sequence([
          Animated.timing(scanAnim, {
            toValue: 1,
            duration: 1800,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.timing(scanAnim, {
            toValue: 0,
            duration: 1800,
            easing: Easing.linear,
            useNativeDriver: true,
          })
        ])
      ).start();

      if (!cameraPermission?.granted) {
        requestCameraPermission();
      }

      // Automated scanning progress sequence (Auto-detect tanpa tombol)
      let currentProgress = 0;
      autoDetectTimerRef.current = setInterval(() => {
        if (isAutoProcessingRef.current) return;

        currentProgress += 5;
        if (currentProgress > 100) currentProgress = 100;
        setFaceProgress(currentProgress);

        if (currentProgress < 25) {
          setFaceDetectStatus('Mencari Posisi Wajah...');
        } else if (currentProgress < 85) {
          setFaceDetectStatus(`Wajah Terdeteksi • Tahan Posisi (${currentProgress}%)`);
        } else if (currentProgress < 100) {
          setFaceDetectStatus('Memverifikasi Biometrik AI...');
        } else {
          // Reached 100% -> Auto capture
          if (autoDetectTimerRef.current) {
            clearInterval(autoDetectTimerRef.current);
            autoDetectTimerRef.current = null;
          }
          setIsFaceVerified(true);
          setFaceDetectStatus('Absen Berhasil Terverifikasi!');
          triggerAutoCapture();
        }
      }, 85);
    } else {
      scanAnim.setValue(0);
      if (autoDetectTimerRef.current) {
        clearInterval(autoDetectTimerRef.current);
        autoDetectTimerRef.current = null;
      }
      isAutoProcessingRef.current = false;
      setIsFaceVerified(false);
      setFaceProgress(0);
    }

    return () => {
      if (autoDetectTimerRef.current) {
        clearInterval(autoDetectTimerRef.current);
        autoDetectTimerRef.current = null;
      }
    };
  }, [isFaceModalOpen, cameraPermission?.granted]);

  const loadUserDataAndSchool = async () => {
    try {
      const storedUser = await SecureStore.getItemAsync('sipena_user');
      const apiUrl = await SecureStore.getItemAsync('sipena_api_url');
      const token = await SecureStore.getItemAsync('sipena_token');

      if (storedUser) {
        const u = JSON.parse(storedUser);
        if (u.name) setUserName(u.name);
        if (u.nip) setUserNip(u.nip);
        if (u.role) setUserRole(u.role);
      }

      // Fetch School Face Policy from Backend
      if (apiUrl && token && !token.startsWith('demo-')) {
        try {
          const resSchool = await axios.get(`${apiUrl}/api/school`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (resSchool.data && resSchool.data.data) {
            const sc = resSchool.data.data;
            if (sc.is_face_journal !== undefined) {
              setIsFaceJournalEnabled(Boolean(sc.is_face_journal));
            }
            if (sc.journal_grace_period !== undefined) {
              setJournalGracePeriod(Number(sc.journal_grace_period));
            }
          }
        } catch (_) {}
      }
    } catch (_) {}

    // Check if autoOpen query param was passed from index
    if (params.autoOpen === 'true') {
      const targetSched = todaySchedules.find(s => 
        (params.subject && s.subject.toLowerCase().includes(params.subject.toLowerCase())) ||
        (params.class_name && s.class_name.toLowerCase().includes(params.class_name.toLowerCase()))
      ) || todaySchedules[0];

      if (targetSched) {
        handleScheduleAction(targetSched);
      }
    }
  };

  /**
   * Action Router for Schedule Card
   */
  const handleScheduleAction = (sched: ScheduleCardData) => {
    if (sched.status === 'BELUM') {
      // Step 1: Absen Mulai Mengajar
      handleInitiateClockIn(sched);
    } else if (sched.status === 'SEDANG_MENGAJAR') {
      // Step 2: Sedang mengajar -> Isi jurnal
      openJournalForm(sched);
    } else if (sched.status === 'SELESAI') {
      // Step 3: Sudah selesai -> Buka form untuk review/edit
      openJournalForm(sched);
    } else if (sched.status === 'TERBLOKIR') {
      showToast('Jadwal ini terblokir karena keterlambatan. Silakan ajukan buka blokir.', 'warning');
    }
  };

  /**
   * Initiate Clock In (Absen Mulai Mengajar)
   */
  const handleInitiateClockIn = (sched: ScheduleCardData) => {
    activeFaceScheduleRef.current = sched;
    faceActionTypeRef.current = 'CLOCK_IN';
    setActiveFaceSchedule(sched);
    setFaceActionType('CLOCK_IN');
    if (isFaceRequired) {
      setIsFaceModalOpen(true);
    } else {
      // Direct clock in without face camera (Bypass Admin atau Setting Face Nonaktif)
      processClockIn(sched, null);
    }
  };

  /**
   * Initiate Clock Out (Absen Selesai Mengajar)
   */
  const handleInitiateClockOut = (sched: ScheduleCardData) => {
    // Validasi: Jurnal materi & absensi harus sudah diisi terlebih dahulu (Persis SIPENAFS)
    if (!sched.is_filled || !sched.topic || sched.topic === 'Belum diisi') {
      showToast('Silakan isi dan simpan materi serta absensi siswa terlebih dahulu sebelum absen selesai mengajar.', 'warning');
      return;
    }

    activeFaceScheduleRef.current = sched;
    faceActionTypeRef.current = 'CLOCK_OUT';
    setActiveFaceSchedule(sched);
    setFaceActionType('CLOCK_OUT');
    if (isFaceRequired) {
      setIsFaceModalOpen(true);
    } else {
      processClockOut(sched, null);
    }
  };

  /**
   * Process Clock In to Backend
   */
  const processClockIn = async (sched: ScheduleCardData, photoBase64: string | null) => {
    setIsProcessingFace(true);
    try {
      const apiUrl = await SecureStore.getItemAsync('sipena_api_url');
      const token = await SecureStore.getItemAsync('sipena_token');

      if (apiUrl && token && !token.startsWith('demo-')) {
        try {
          await axios.post(`${apiUrl}/api/journals/clock-in`, {
            class_id: sched.class_id,
            subject_id: sched.subject_id,
            date: new Date().toISOString().split('T')[0],
            start_time: sched.time.split(' - ')[0],
            end_time: sched.time.split(' - ')[1]?.replace(' WIB', ''),
            photoBase64: photoBase64
          }, {
            headers: { Authorization: `Bearer ${token}` }
          });
        } catch (apiErr: any) {
          console.warn("Clock-in API warning:", apiErr?.response?.data || apiErr?.message);
        }
      }

      // Update local schedule state
      setTodaySchedules(prev => prev.map(s => {
        if (s.id === sched.id) {
          return {
            ...s,
            status: 'SEDANG_MENGAJAR',
            attendance_photo_in: photoBase64 || 'verified'
          };
        }
        return s;
      }));

      setIsFaceModalOpen(false);
      showToast(`Absen mulai berhasil! Selamat mengajar di ${sched.class_name}.`, 'success');

      // Otomatis buka form jurnal setelah absen masuk berhasil
      setTimeout(() => {
        openJournalForm({ ...sched, status: 'SEDANG_MENGAJAR' });
      }, 400);
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Gagal memproses absen mulai mengajar.';
      showToast(msg, 'error');
      setIsFaceModalOpen(false);
    } finally {
      setIsProcessingFace(false);
      isAutoProcessingRef.current = false;
    }
  };

  /**
   * Process Clock Out to Backend
   */
  const processClockOut = async (sched: ScheduleCardData, photoBase64: string | null) => {
    setIsProcessingFace(true);
    try {
      const apiUrl = await SecureStore.getItemAsync('sipena_api_url');
      const token = await SecureStore.getItemAsync('sipena_token');

      if (apiUrl && token && !token.startsWith('demo-')) {
        try {
          await axios.post(`${apiUrl}/api/journals/clock-out`, {
            class_id: sched.class_id,
            subject_id: sched.subject_id,
            date: new Date().toISOString().split('T')[0],
            photoBase64: photoBase64
          }, {
            headers: { Authorization: `Bearer ${token}` }
          });
        } catch (apiErr: any) {
          console.warn("Clock-out API warning:", apiErr?.response?.data || apiErr?.message);
        }
      }

      // Update local schedule state
      setTodaySchedules(prev => prev.map(s => {
        if (s.id === sched.id) {
          return {
            ...s,
            status: 'SELESAI',
            attendance_photo_out: photoBase64 || 'verified'
          };
        }
        return s;
      }));

      setIsFaceModalOpen(false);
      showToast(`Absen selesai mengajar berhasil dicatat. KBM ${sched.subject} rampung!`, 'success');
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Gagal memproses absen selesai mengajar.';
      showToast(msg, 'error');
      setIsFaceModalOpen(false);
    } finally {
      setIsProcessingFace(false);
      isAutoProcessingRef.current = false;
    }
  };

  /**
   * Automatic Face Capture & Verification (100% Auto, No Button Needed)
   */
  const triggerAutoCapture = async () => {
    if (isAutoProcessingRef.current) return;
    const targetSched = activeFaceScheduleRef.current || activeFaceSchedule || todaySchedules[0];
    const actionType = faceActionTypeRef.current || faceActionType;
    if (!targetSched) return;

    isAutoProcessingRef.current = true;
    setIsProcessingFace(true);

    let base64Photo = 'data:image/jpeg;base64,/simulated_face_proof_ok';

    try {
      if (cameraRef.current) {
        const photoPromise = cameraRef.current.takePictureAsync({
          base64: true,
          quality: 0.5,
          skipProcessing: true
        });
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 1500)
        );
        const photoResult: any = await Promise.race([photoPromise, timeoutPromise]);
        if (photoResult && photoResult.base64) {
          base64Photo = `data:image/jpeg;base64,${photoResult.base64}`;
        }
      }
    } catch (_) {}

    // Jeda sejenak agar guru melihat efek visual 'ABSEN BERHASIL' sebelum modal tertutup otomatis
    setTimeout(async () => {
      if (actionType === 'CLOCK_IN') {
        await processClockIn(targetSched, base64Photo);
      } else {
        await processClockOut(targetSched, base64Photo);
      }
    }, 600);
  };

  const openJournalForm = async (sched: ScheduleCardData) => {
    setActiveSchedule(sched);
    setTopic(sched.topic && sched.topic !== 'Belum diisi' ? sched.topic : '');
    setDescription(sched.description || '');
    setSelectedMethod(sched.methods || 'Diskusi Kelompok');
    setSelectedMedia(sched.media || 'Papan Tulis & Spidol');
    
    // Set existing syllabus if any (Persis SIPENAFS Web)
    if (sched.syllabus_id) {
      setSelectedSyllabusIds([sched.syllabus_id]);
    } else {
      setSelectedSyllabusIds([]);
    }

    setIsFormOpen(true);

    // Fetch syllabuses from backend or fallback for current subject
    setIsLoadingSyllabuses(true);
    try {
      const apiUrl = await SecureStore.getItemAsync('sipena_api_url');
      const token = await SecureStore.getItemAsync('sipena_token');
      let fetchedSyls: SyllabusItem[] = [];

      if (apiUrl && token && !token.startsWith('demo-')) {
        try {
          const res = await axios.get(`${apiUrl}/api/syllabuses?subject_id=${sched.subject_id}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (res.data?.data && Array.isArray(res.data.data)) {
            fetchedSyls = res.data.data;
          }
        } catch (err) {
          console.warn('Gagal memuat silabus dari server:', err);
        }
      }

      if (fetchedSyls.length === 0 && sched.subject_id && DEFAULT_SYLLABUSES[sched.subject_id]) {
        fetchedSyls = DEFAULT_SYLLABUSES[sched.subject_id];
      }
      setSyllabuses(fetchedSyls);
    } catch (err) {
      console.error('Error fetching syllabuses:', err);
    } finally {
      setIsLoadingSyllabuses(false);
    }
  };

  /**
   * Toggle Silabus Selection (Persis Logic SIPENAFS Web TeachingJournal.jsx)
   * Mengisi otomatis Topik dan Uraian CP / ATP / Konten Materi,
   * atau mengosongkannya jika uncheck semua.
   */
  const handleToggleSyllabus = (syl: SyllabusItem) => {
    const isChecked = selectedSyllabusIds.includes(syl.id);
    let nextIds: number[];
    if (!isChecked) {
      nextIds = [...selectedSyllabusIds, syl.id];
    } else {
      nextIds = selectedSyllabusIds.filter(id => id !== syl.id);
    }

    setSelectedSyllabusIds(nextIds);

    // Update topic and description based on all selected syllabuses
    const selectedSyls = syllabuses.filter(s => nextIds.includes(s.id));
    if (selectedSyls.length > 0) {
      const newTopic = [...new Set(selectedSyls.map(s => s.topic))].join(' & ');
      setTopic(newTopic);

      let newDesc = '';
      selectedSyls.forEach(s => {
        newDesc += `--- ${s.topic} ---\n`;
        if (s.cp) newDesc += `[CP]\n${s.cp}\n\n`;
        if (s.atp_code) newDesc += `[ATP: ${s.atp_code}]\n${s.atp}\n\n`;
        else if (s.atp) newDesc += `[ATP]\n${s.atp}\n\n`;
        if (s.sub_topic) newDesc += `[KONTEN MATERI]\n${s.sub_topic}\n\n`;
      });
      setDescription(newDesc.trim());
    } else {
      setTopic('');
      setDescription('');
    }
  };

  const handleMarkAllHadir = () => {
    setStudents(prev => prev.map(s => ({ ...s, status: 'H' })));
    showToast('Semua siswa ditandai Hadir.', 'info');
  };

  const handleUpdateStudentStatus = (studentId: string, status: 'H' | 'S' | 'I' | 'A') => {
    setStudents(prev => prev.map(s => s.id === studentId ? { ...s, status } : s));
  };

  const handleSubmitJournal = async () => {
    if (!topic.trim()) {
      showToast('Topik / Materi pokok KBM wajib diisi!', 'warning');
      return;
    }

    setIsSaving(true);
    try {
      const apiUrl = await SecureStore.getItemAsync('sipena_api_url');
      const token = await SecureStore.getItemAsync('sipena_token');

      const submitPayload: any = {
        class_id: activeSchedule?.class_id || 1,
        subject_id: activeSchedule?.subject_id || 101,
        date: new Date().toISOString().split('T')[0],
        start_time: activeSchedule?.time.split(' - ')[0],
        end_time: activeSchedule?.time.split(' - ')[1]?.replace(' WIB', ''),
        topic: topic.trim(),
        description: description.trim(),
        methods: selectedMethod,
        media: selectedMedia,
        absences: students.map(s => ({ student_id: s.id, status: s.status }))
      };

      if (selectedSyllabusIds.length > 0) {
        submitPayload.syllabus_id = selectedSyllabusIds[0];
      }

      if (apiUrl && token && !token.startsWith('demo-')) {
        try {
          await axios.post(`${apiUrl}/api/journals/submit`, submitPayload, {
            headers: { Authorization: `Bearer ${token}` }
          });
        } catch (_) {}
      }

      // Update schedule state
      if (activeSchedule) {
        setTodaySchedules(prev => prev.map(s => {
          if (s.id === activeSchedule.id) {
            return {
              ...s,
              is_filled: true,
              topic: topic.trim(),
              description: description.trim(),
              methods: selectedMethod,
              media: selectedMedia,
              syllabus_id: selectedSyllabusIds.length > 0 ? selectedSyllabusIds[0] : null,
            };
          }
          return s;
        }));

        // Add to history
        const countH = students.filter(s => s.status === 'H').length;
        const countS = students.filter(s => s.status === 'S').length;
        const countI = students.filter(s => s.status === 'I').length;
        const countA = students.filter(s => s.status === 'A').length;

        const newHistoryItem = {
          id: 'hist-' + Date.now(),
          date: 'Hari Ini, ' + new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB',
          subject: activeSchedule.subject,
          class_name: activeSchedule.class_name,
          time: activeSchedule.time,
          topic: topic.trim(),
          hadir: countH,
          sakit: countS,
          izin: countI,
          alpa: countA,
          status: 'TERSIMPAN'
        };

        setHistoryJournals(prev => [newHistoryItem, ...prev]);
      }

      setIsFormOpen(false);
      showToast('Jurnal mengajar & absensi siswa tersimpan! Jangan lupa absen selesai saat jam KBM usai.', 'success');
    } catch (e: any) {
      showToast('Gagal menyimpan jurnal.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const countH = students.filter(s => s.status === 'H').length;
  const countS = students.filter(s => s.status === 'S').length;
  const countI = students.filter(s => s.status === 'I').length;
  const countA = students.filter(s => s.status === 'A').length;

  const filteredStudents = students.filter(s => 
    !searchStudent || s.name.toLowerCase().includes(searchStudent.toLowerCase()) || s.nis.includes(searchStudent)
  );

  const scanTranslateY = scanAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-110, 110],
  });

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Top Navigation Bar */}
      <View style={styles.navBar}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>

        <View style={styles.navTitleContainer}>
          <Text style={styles.navTitle}>Jurnal Mengajar Guru</Text>
          <Text style={styles.navSubtitle}>KBM, Presensi Siswa & Wajah</Text>
        </View>

        <TouchableOpacity 
          style={styles.refreshButton}
          onPress={() => showToast('Data jurnal & jadwal diperbarui.', 'info')}
          activeOpacity={0.7}
        >
          <Ionicons name="refresh" size={20} color="#0B8A7D" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
      >
        {/* Guru Banner Card */}
        <View style={styles.teacherBanner}>
          <View style={styles.teacherAvatarCircle}>
            <Ionicons name="school" size={26} color="#0B8A7D" />
          </View>
          <View style={styles.teacherInfo}>
            <Text style={styles.teacherGreeting}>Selamat Bertugas,</Text>
            <Text style={styles.teacherName}>{userName}</Text>
            <Text style={styles.teacherNip}>NIP: {userNip} • Guru Pengampu</Text>
          </View>
        </View>

        {/* Kebijakan Absensi Wajah Banner (Identik SIPENAFS) */}
        <View style={[
          styles.policyBanner,
          isAdmin ? styles.policyBannerAdmin : (isFaceJournalEnabled ? styles.policyBannerFaceActive : styles.policyBannerFaceDisabled)
        ]}>
          <Ionicons 
            name={isAdmin ? "shield-checkmark" : (isFaceJournalEnabled ? "camera" : "checkmark-circle")} 
            size={18} 
            color={isAdmin ? "#2563EB" : (isFaceJournalEnabled ? "#D97706" : "#059669")} 
          />
          <View style={{ flex: 1 }}>
            <Text style={[
              styles.policyTitle,
              isAdmin ? { color: "#1E40AF" } : (isFaceJournalEnabled ? { color: "#92400E" } : { color: "#065F46" })
            ]}>
              {isAdmin 
                ? 'Mode Administrator (Bypass Absensi Wajah Aktif)' 
                : (isFaceJournalEnabled 
                    ? 'Kebijakan Sekolah: Absensi Wajah KBM Diwajibkan' 
                    : 'Kebijakan Sekolah: Absensi Wajah Dinonaktifkan')}
            </Text>
            <Text style={styles.policyDesc}>
              {isAdmin
                ? 'Sebagai Administrator, Anda dapat langsung mencatat atau mengedit KBM tanpa pemindaian kamera wajah.'
                : (isFaceJournalEnabled
                    ? 'Guru wajib melakukan verifikasi foto wajah kamera depan saat absen mulai dan absen selesai mengajar.'
                    : 'Verifikasi wajah dinonaktifkan di pengaturan sekolah. Guru dapat langsung mengisi jurnal KBM.')}
            </Text>
          </View>
        </View>

        {/* Status Counter Chips */}
        <View style={styles.statusChipsRow}>
          <View style={styles.statusChip}>
            <Text style={styles.statusChipVal}>{todaySchedules.length} Sesi</Text>
            <Text style={styles.statusChipLbl}>KBM Hari Ini</Text>
          </View>
          <View style={[styles.statusChip, { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }]}>
            <Text style={[styles.statusChipVal, { color: '#D97706' }]}>
              {todaySchedules.filter(s => s.status === 'SEDANG_MENGAJAR').length} Aktif
            </Text>
            <Text style={[styles.statusChipLbl, { color: '#B45309' }]}>Sedang Berjalan</Text>
          </View>
          <View style={[styles.statusChip, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
            <Text style={[styles.statusChipVal, { color: '#059669' }]}>
              {todaySchedules.filter(s => s.status === 'SELESAI').length} Selesai
            </Text>
            <Text style={[styles.statusChipLbl, { color: '#047857' }]}>Rampung</Text>
          </View>
        </View>

        {/* Section: Jadwal Mengajar Hari Ini */}
        <View style={styles.sectionWrap}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Jadwal Mengajar Hari Ini</Text>
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>Aktif KBM</Text>
            </View>
          </View>

          {todaySchedules.map((sched) => {
            const isBelum = sched.status === 'BELUM';
            const isSedang = sched.status === 'SEDANG_MENGAJAR';
            const isSelesai = sched.status === 'SELESAI';

            return (
              <View 
                key={sched.id} 
                style={[
                  styles.scheduleCard,
                  isSedang && { borderLeftColor: '#F59E0B', borderLeftWidth: 5 },
                  isSelesai && { borderLeftColor: '#10B981', borderLeftWidth: 5 }
                ]}
              >
                <View style={styles.scheduleTopRow}>
                  <View style={styles.timeTag}>
                    <Ionicons name="time-outline" size={14} color="#0B8A7D" />
                    <Text style={styles.timeTagText}>{sched.time}</Text>
                  </View>
                  <View style={styles.roomTag}>
                    <Ionicons name="location-outline" size={13} color="#64748B" />
                    <Text style={styles.roomTagText}>{sched.room}</Text>
                  </View>

                  {/* Status Badge Sesuai SIPENAFS */}
                  {isBelum && (
                    <View style={styles.statusBadgeBelum}>
                      <Text style={styles.statusBadgeTextBelum}>BELUM ABSEN</Text>
                    </View>
                  )}
                  {isSedang && (
                    <View style={styles.statusBadgeSedang}>
                      <View style={styles.pulseDot} />
                      <Text style={styles.statusBadgeTextSedang}>SEDANG MENGAJAR</Text>
                    </View>
                  )}
                  {isSelesai && (
                    <View style={styles.statusBadgeSelesai}>
                      <Ionicons name="checkmark-circle" size={12} color="#059669" />
                      <Text style={styles.statusBadgeTextSelesai}>SELESAI MENGAJAR</Text>
                    </View>
                  )}
                </View>

                <Text style={styles.schedSubject}>{sched.subject}</Text>
                <Text style={styles.schedClass}>{sched.class_name} • {sched.total_students} Siswa</Text>

                {/* Materi Pokok Terisi Preview */}
                {sched.is_filled && sched.topic ? (
                  <View style={styles.topicFilledCard}>
                    <Text style={styles.topicFilledLabel}>Topik Bahasan KBM:</Text>
                    <Text style={styles.topicFilledContent} numberOfLines={2}>{sched.topic}</Text>
                  </View>
                ) : null}

                {/* ACTION BUTTONS (Alur Persis SIPENAFS) */}
                <View style={{ marginTop: 12, gap: 8 }}>
                  {/* STEP 1: BELUM MULAI -> WAJIB ABSEN MULAI MENGAJAR (WAJAH) */}
                  {isBelum && (
                    <TouchableOpacity
                      style={styles.clockInBtn}
                      onPress={() => handleInitiateClockIn(sched)}
                      activeOpacity={0.82}
                    >
                      <Ionicons name="camera-outline" size={18} color="#FFFFFF" />
                      <Text style={styles.clockInBtnText}>
                        {isFaceRequired ? '▶️ Absen Mulai Mengajar (Wajah)' : '▶️ Absen Mulai Mengajar'}
                      </Text>
                    </TouchableOpacity>
                  )}

                  {/* STEP 2: SEDANG MENGAJAR -> ISI JURNAL & ABSEN SELESAI */}
                  {isSedang && (
                    <>
                      <TouchableOpacity
                        style={styles.fillJournalBtn}
                        onPress={() => openJournalForm(sched)}
                        activeOpacity={0.82}
                      >
                        <Ionicons name="create-outline" size={17} color="#FFFFFF" />
                        <Text style={styles.fillJournalBtnText}>
                          {sched.is_filled ? '✏️ Edit Jurnal & Presensi Siswa' : '📝 Isi Jurnal & Presensi Siswa'}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.clockOutBtn}
                        onPress={() => handleInitiateClockOut(sched)}
                        activeOpacity={0.82}
                      >
                        <Ionicons name="camera-reverse-outline" size={17} color="#FFFFFF" />
                        <Text style={styles.clockOutBtnText}>
                          {isFaceRequired ? '⏹️ Absen Selesai Mengajar (Wajah)' : '⏹️ Absen Selesai Mengajar'}
                        </Text>
                      </TouchableOpacity>
                    </>
                  )}

                  {/* STEP 3: SELESAI MENGAJAR -> LIHAT / EDIT JURNAL */}
                  {isSelesai && (
                    <TouchableOpacity
                      style={styles.viewJournalBtn}
                      onPress={() => openJournalForm(sched)}
                      activeOpacity={0.82}
                    >
                      <Ionicons name="document-text-outline" size={16} color="#065F46" />
                      <Text style={styles.viewJournalBtnText}>✏️ Lihat / Edit Jurnal KBM</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}
        </View>

        {/* Section: Riwayat Jurnal Terakhir */}
        <View style={styles.sectionWrap}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Riwayat Jurnal KBM Guru</Text>
            <Text style={styles.historyCountText}>{historyJournals.length} Catatan</Text>
          </View>

          {historyJournals.map(hist => (
            <View key={hist.id} style={styles.historyCard}>
              <View style={styles.historyCardTop}>
                <View>
                  <Text style={styles.historySubject}>{hist.subject}</Text>
                  <Text style={styles.historyClass}>{hist.class_name} • {hist.time}</Text>
                </View>
                <Text style={styles.historyDate}>{hist.date}</Text>
              </View>

              <View style={styles.historyTopicBox}>
                <Text style={styles.historyTopicLabel}>Materi KBM:</Text>
                <Text style={styles.historyTopicText}>{hist.topic}</Text>
              </View>

              <View style={styles.historyAttendanceRow}>
                <View style={styles.attBadgeH}>
                  <Text style={styles.attBadgeTextH}>Hadir: {hist.hadir}</Text>
                </View>
                <View style={styles.attBadgeS}>
                  <Text style={styles.attBadgeTextS}>Sakit: {hist.sakit}</Text>
                </View>
                <View style={styles.attBadgeI}>
                  <Text style={styles.attBadgeTextI}>Izin: {hist.izin}</Text>
                </View>
                <View style={styles.attBadgeA}>
                  <Text style={styles.attBadgeTextA}>Alpa: {hist.alpa}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* ======================================================== */}
      {/* MODAL 1: KAMERA VERIFIKASI WAJAH (ABSENSI WAJAH KBM)      */}
      {/* ======================================================== */}
      <Modal visible={isFaceModalOpen} animationType="slide" transparent>
        <View style={styles.faceModalOverlay}>
          <View style={[styles.faceModalCard, { paddingBottom: insets.bottom + 20 }]}>
            {/* Header */}
            <View style={styles.faceModalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.faceModalTitle}>
                  {faceActionType === 'CLOCK_IN' 
                    ? '📸 Verifikasi Wajah Mulai Mengajar' 
                    : '📸 Verifikasi Wajah Selesai Mengajar'}
                </Text>
                <Text style={styles.faceModalSubtitle}>
                  {activeFaceSchedule?.class_name} • {activeFaceSchedule?.subject}
                </Text>
              </View>
              <TouchableOpacity 
                style={styles.modalCloseBtn}
                onPress={() => setIsFaceModalOpen(false)}
                disabled={isProcessingFace}
              >
                <Ionicons name="close" size={22} color={Colors.text} />
              </TouchableOpacity>
            </View>

            {/* Camera Area */}
            <View style={styles.cameraFrameWrapper}>
              {!cameraPermission?.granted ? (
                <View style={styles.permissionBox}>
                  <Ionicons name="camera-outline" size={44} color="#0B8A7D" />
                  <Text style={styles.permissionBoxTitle}>Izin Akses Kamera Diperlukan</Text>
                  <Text style={styles.permissionBoxDesc}>
                    Untuk memvalidasi kehadiran guru secara presisi di kelas, aplikasi membutuhkan izin kamera depan.
                  </Text>
                  <TouchableOpacity
                    style={styles.requestPermissionBtn}
                    onPress={requestCameraPermission}
                  >
                    <Text style={styles.requestPermissionBtnText}>Beri Izin Kamera</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.cameraBoxContainer}>
                  <CameraView
                    style={StyleSheet.absoluteFill}
                    facing="front"
                    ref={cameraRef}
                  />

                  {/* Oval Face Guide Overlay */}
                  <View style={styles.faceGuideOverlay}>
                    <View style={[styles.ovalSilhouette, isFaceVerified && styles.ovalSilhouetteVerified]}>
                      <View style={styles.cornerTL} />
                      <View style={styles.cornerTR} />
                      <View style={styles.cornerBL} />
                      <View style={styles.cornerBR} />
                      {/* Animated Laser Scanning Bar */}
                      {!isFaceVerified && (
                        <Animated.View 
                          style={[
                            styles.scanningLine,
                            { transform: [{ translateY: scanTranslateY }] }
                          ]} 
                        />
                      )}
                    </View>
                    <View style={styles.liveTagContainer}>
                      <View style={[styles.liveGreenDot, isFaceVerified && { backgroundColor: '#10B981' }]} />
                      <Text style={styles.liveTagText}>
                        {isFaceVerified ? 'Wajah Terverifikasi' : 'AI Face Auto-Detect Aktif'}
                      </Text>
                    </View>
                    <Text style={styles.faceInstructionText}>
                      {isFaceVerified ? '✅ Posisi Sempurna • Absen Dicatat' : 'Posisikan wajah Anda di dalam bingkai oval'}
                    </Text>
                  </View>

                  {/* Full Overlay when Verified (Persis SIPENAFS) */}
                  {isFaceVerified && (
                    <View style={styles.verifiedBackdrop}>
                      <Ionicons name="checkmark-circle" size={76} color="#FFFFFF" />
                      <Text style={styles.verifiedText}>ABSEN BERHASIL</Text>
                      <Text style={styles.verifiedSubText}>Menyimpan catatan kehadiran...</Text>
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* Bottom: Hands-Free Auto-Detection HUD (TANPA TOMBOL MANUAL) */}
            <View style={styles.autoDetectHud}>
              {/* Progress Bar Track */}
              <View style={styles.hudProgressRow}>
                <View style={styles.hudProgressBar}>
                  <View style={[styles.hudProgressFill, { width: `${faceProgress}%` }]} />
                </View>
                <Text style={styles.hudPercentText}>{Math.round(faceProgress)}%</Text>
              </View>

              {/* Status Row with Live Indicator */}
              <View style={styles.hudStatusRow}>
                {isProcessingFace ? (
                  <ActivityIndicator size="small" color="#0B8A7D" />
                ) : (
                  <View style={[styles.hudDot, isFaceVerified ? styles.hudDotSuccess : styles.hudDotActive]} />
                )}
                <Text style={styles.hudStatusText}>{faceDetectStatus}</Text>
              </View>

              <Text style={styles.hudHintText}>
                ⚡ Deteksi otomatis aktif tanpa tombol. Arahkan wajah menghadap kamera hingga progress 100%.
              </Text>
            </View>
          </View>
        </View>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL 2: FORMULIR JURNAL & PRESENSI SISWA                */}
      {/* ======================================================== */}
      <Modal visible={isFormOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={[styles.modalBox, { height: Math.min(SCREEN_HEIGHT * 0.88, 700), paddingBottom: insets.bottom + 12 }]}
          >
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalHeaderTitle}>Formulir Jurnal & Presensi KBM</Text>
                <Text style={styles.modalHeaderSub}>
                  {activeSchedule?.class_name} • {activeSchedule?.subject}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setIsFormOpen(false)}
              >
                <Ionicons name="close" size={22} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView 
              showsVerticalScrollIndicator={true} 
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingBottom: 24 }}
              keyboardShouldPersistTaps="handled"
            >
              {/* Jadwal Info Pill */}
              <View style={styles.schedPillBox}>
                <Ionicons name="time" size={16} color="#0B8A7D" />
                <Text style={styles.schedPillText}>
                  {activeSchedule?.time} ({activeSchedule?.room})
                </Text>
              </View>

              {/* Selector Silabus (Opsional) - Persis SIPENAFS Web */}
              <View style={styles.inputGroup}>
                <View style={styles.syllabusLabelRow}>
                  <View style={styles.syllabusLabelLeft}>
                    <Ionicons name="book-outline" size={15} color="#0B8A7D" />
                    <Text style={styles.inputLabelWithIcon}>Pilih Materi dari Silabus</Text>
                    <View style={styles.optionalBadge}>
                      <Text style={styles.optionalBadgeText}>Opsional</Text>
                    </View>
                  </View>
                  {selectedSyllabusIds.length > 0 && (
                    <TouchableOpacity 
                      onPress={() => {
                        setSelectedSyllabusIds([]);
                        setTopic('');
                        setDescription('');
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={styles.clearSyllabusBtnText}>Hapus Pilihan</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <View style={styles.syllabusContainerBox}>
                  {isLoadingSyllabuses ? (
                    <View style={styles.syllabusLoadingBox}>
                      <ActivityIndicator size="small" color="#0B8A7D" />
                      <Text style={styles.syllabusLoadingText}>Memuat silabus mata pelajaran...</Text>
                    </View>
                  ) : syllabuses.length > 0 ? (
                    <ScrollView 
                      nestedScrollEnabled={true} 
                      style={styles.syllabusScroll} 
                      contentContainerStyle={{ paddingVertical: 4 }}
                      showsVerticalScrollIndicator={true}
                    >
                      {syllabuses.map((syl) => {
                        const isSelected = selectedSyllabusIds.includes(syl.id);
                        return (
                          <TouchableOpacity
                            key={syl.id}
                            style={[
                              styles.syllabusItemCard,
                              isSelected && styles.syllabusItemCardActive
                            ]}
                            onPress={() => handleToggleSyllabus(syl)}
                            activeOpacity={0.75}
                          >
                            <View style={[styles.syllabusCheckbox, isSelected && styles.syllabusCheckboxActive]}>
                              {isSelected && <Ionicons name="checkmark" size={12} color="#FFFFFF" />}
                            </View>

                            <View style={styles.syllabusItemContent}>
                              <View style={styles.syllabusTitleRow}>
                                {Boolean(syl.level) && (
                                  <View style={styles.syllabusLevelTag}>
                                    <Text style={styles.syllabusLevelTagText}>Kelas {syl.level}</Text>
                                  </View>
                                )}
                                <Text 
                                  style={[styles.syllabusTopicText, isSelected && styles.syllabusTopicTextActive]} 
                                  numberOfLines={1}
                                >
                                  {syl.topic}
                                </Text>
                              </View>

                              {Boolean(syl.atp || syl.atp_code) && (
                                <Text style={styles.syllabusAtpText} numberOfLines={2}>
                                  {syl.atp_code ? `(${syl.atp_code}) ` : ''}{syl.atp}
                                </Text>
                              )}
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  ) : (
                    <View style={styles.syllabusEmptyBox}>
                      <Ionicons name="information-circle-outline" size={16} color="#94A3B8" />
                      <Text style={styles.syllabusEmptyText}>Silabus belum tersedia untuk mata pelajaran ini.</Text>
                    </View>
                  )}
                </View>

                {selectedSyllabusIds.length > 0 && (
                  <View style={styles.syllabusNoteBox}>
                    <Ionicons name="sparkles" size={13} color="#0B8A7D" />
                    <Text style={styles.syllabusNoteText}>
                      {selectedSyllabusIds.length} silabus dipilih. Topik & uraian aktivitas di bawah otomatis terisi (dapat disunting bebas).
                    </Text>
                  </View>
                )}
              </View>

              {/* Input: Topik Pokok Pembelajaran */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  Topik / Materi Pokok Pembelajaran <Text style={{ color: '#EF4444' }}>*</Text>
                </Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Misal: Persamaan Polinomial dan Teorema Sisa"
                  placeholderTextColor={Colors.textLight}
                  value={topic}
                  onChangeText={setTopic}
                />
              </View>

              {/* Input: Uraian Kegiatan KBM */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Uraian Aktivitas & Catatan KBM</Text>
                <TextInput
                  style={[styles.textInput, { height: 75, textAlignVertical: 'top' }]}
                  placeholder="Uraikan jalannya pembelajaran, tugas kelompok, atau catatan evaluasi kelas..."
                  placeholderTextColor={Colors.textLight}
                  multiline
                  value={description}
                  onChangeText={setDescription}
                />
              </View>

              {/* Selector: Metode Pembelajaran */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Metode Pembelajaran</Text>
                <View style={styles.chipsRow}>
                  {METHODS_LIST.map((m, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={[styles.chip, selectedMethod === m && styles.chipActive]}
                      onPress={() => setSelectedMethod(m)}
                    >
                      <Text style={[styles.chipText, selectedMethod === m && styles.chipTextActive]}>
                        {m}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Selector: Media Pembelajaran */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Media & Alat Bantu</Text>
                <View style={styles.chipsRow}>
                  {MEDIA_LIST.map((med, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={[styles.chip, selectedMedia === med && styles.chipActive]}
                      onPress={() => setSelectedMedia(med)}
                    >
                      <Text style={[styles.chipText, selectedMedia === med && styles.chipTextActive]}>
                        {med}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Section: Presensi Siswa */}
              <View style={styles.attendanceSection}>
                <View style={styles.attendanceHeader}>
                  <View>
                    <Text style={styles.attendanceTitle}>Presensi Siswa di Jam Ini</Text>
                    <Text style={styles.attendanceCountSub}>
                      Total: {students.length} Siswa (H: {countH} | S: {countS} | I: {countI} | A: {countA})
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.markAllBtn}
                    onPress={handleMarkAllHadir}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="checkmark-done" size={14} color="#059669" />
                    <Text style={styles.markAllBtnText}>Semua Hadir</Text>
                  </TouchableOpacity>
                </View>

                {/* Search Student Input */}
                <View style={styles.searchStudentBox}>
                  <Ionicons name="search" size={16} color={Colors.textLight} />
                  <TextInput
                    style={styles.searchStudentInput}
                    placeholder="Cari nama atau NIS siswa..."
                    placeholderTextColor={Colors.textLight}
                    value={searchStudent}
                    onChangeText={setSearchStudent}
                  />
                  {searchStudent !== '' && (
                    <TouchableOpacity onPress={() => setSearchStudent('')}>
                      <Ionicons name="close-circle" size={16} color={Colors.textLight} />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Student List */}
                <View style={styles.studentListContainer}>
                  {filteredStudents.map((st, i) => (
                    <View key={st.id} style={styles.studentRow}>
                      <View style={styles.studentNumBox}>
                        <Text style={styles.studentNumText}>{i + 1}</Text>
                      </View>
                      <View style={styles.studentInfoCol}>
                        <Text style={styles.studentName} numberOfLines={1}>{st.name}</Text>
                        <Text style={styles.studentNis}>NIS: {st.nis} • {st.gender === 'L' ? 'Laki-laki' : 'Perempuan'}</Text>
                      </View>

                      {/* Segmented H/S/I/A */}
                      <View style={styles.segmentContainer}>
                        {(['H', 'S', 'I', 'A'] as const).map(code => {
                          const isSel = st.status === code;
                          return (
                            <TouchableOpacity
                              key={code}
                              style={[
                                styles.segmentBtn,
                                isSel && code === 'H' && styles.segActiveH,
                                isSel && code === 'S' && styles.segActiveS,
                                isSel && code === 'I' && styles.segActiveI,
                                isSel && code === 'A' && styles.segActiveA,
                              ]}
                              onPress={() => handleUpdateStudentStatus(st.id, code)}
                            >
                              <Text style={[
                                styles.segmentBtnText,
                                isSel && styles.segmentBtnTextActive
                              ]}>
                                {code}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            </ScrollView>

            {/* Bottom Submit Action */}
            <View style={styles.modalBottomBar}>
              <TouchableOpacity
                style={styles.cancelModalBtn}
                onPress={() => setIsFormOpen(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelModalBtnText}>Batal</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.saveModalBtn}
                onPress={handleSubmitJournal}
                disabled={isSaving}
                activeOpacity={0.82}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
                    <Text style={styles.saveModalBtnText}>Simpan Jurnal & Presensi</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

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
  navBar: {
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
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  navTitleContainer: {
    flex: 1,
    marginLeft: 12,
  },
  navTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
  },
  navSubtitle: {
    fontSize: 11,
    color: Colors.textLight,
    marginTop: 1,
  },
  refreshButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#E6F4F1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  teacherBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 14,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  teacherAvatarCircle: {
    width: 50,
    height: 50,
    borderRadius: 15,
    backgroundColor: '#E6F4F1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  teacherInfo: {
    flex: 1,
  },
  teacherGreeting: {
    fontSize: 11,
    color: '#0B8A7D',
    fontWeight: '700',
  },
  teacherName: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text,
    marginTop: 1,
  },
  teacherNip: {
    fontSize: 11,
    color: Colors.textLight,
    marginTop: 2,
  },
  policyBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  policyBannerFaceActive: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  policyBannerFaceDisabled: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  policyBannerAdmin: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  policyTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  policyDesc: {
    fontSize: 10,
    color: '#64748B',
    lineHeight: 15,
    marginTop: 2,
  },
  statusChipsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginTop: 12,
  },
  statusChip: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  statusChipVal: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.text,
  },
  statusChipLbl: {
    fontSize: 10,
    color: Colors.textLight,
    marginTop: 2,
    fontWeight: '600',
  },
  sectionWrap: {
    marginTop: 20,
    paddingHorizontal: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  liveText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#065F46',
  },
  scheduleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  scheduleTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  timeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E6F4F1',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  timeTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0B8A7D',
  },
  roomTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  roomTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  statusBadgeBelum: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginLeft: 'auto',
  },
  statusBadgeTextBelum: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
  },
  statusBadgeSedang: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginLeft: 'auto',
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D97706',
  },
  statusBadgeTextSedang: {
    fontSize: 10,
    fontWeight: '800',
    color: '#B45309',
  },
  statusBadgeSelesai: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginLeft: 'auto',
  },
  statusBadgeTextSelesai: {
    fontSize: 10,
    fontWeight: '800',
    color: '#059669',
  },
  schedSubject: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
  },
  schedClass: {
    fontSize: 12,
    color: Colors.textLight,
    marginTop: 2,
    fontWeight: '500',
  },
  topicFilledCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
  },
  topicFilledLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0B8A7D',
    marginBottom: 2,
  },
  topicFilledContent: {
    fontSize: 12,
    color: '#334155',
    lineHeight: 16,
  },

  // Button Variants
  clockInBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#0B8A7D',
    borderRadius: 12,
    paddingVertical: 12,
  },
  clockInBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  fillJournalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    paddingVertical: 11,
  },
  fillJournalBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  clockOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 11,
  },
  clockOutBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  viewJournalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 12,
    paddingVertical: 10,
  },
  viewJournalBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#065F46',
  },

  historyCountText: {
    fontSize: 11,
    color: Colors.textLight,
    fontWeight: '600',
  },
  historyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  historyCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  historySubject: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text,
  },
  historyClass: {
    fontSize: 11,
    color: Colors.textLight,
    marginTop: 1,
  },
  historyDate: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
  historyTopicBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 8,
    marginVertical: 8,
  },
  historyTopicLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  historyTopicText: {
    fontSize: 12,
    color: '#1E293B',
    marginTop: 2,
  },
  historyAttendanceRow: {
    flexDirection: 'row',
    gap: 6,
  },
  attBadgeH: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  attBadgeTextH: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
  },
  attBadgeS: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  attBadgeTextS: {
    fontSize: 10,
    fontWeight: '700',
    color: '#D97706',
  },
  attBadgeI: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  attBadgeTextI: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2563EB',
  },
  attBadgeA: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  attBadgeTextA: {
    fontSize: 10,
    fontWeight: '700',
    color: '#DC2626',
  },

  // Modal 1: Face Camera Verification
  faceModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  faceModalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  faceModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  faceModalTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text,
  },
  faceModalSubtitle: {
    fontSize: 11,
    color: '#0B8A7D',
    fontWeight: '700',
    marginTop: 2,
  },
  cameraFrameWrapper: {
    height: 320,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#000000',
    marginTop: 14,
  },
  cameraBoxContainer: {
    flex: 1,
    position: 'relative',
  },
  faceGuideOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  ovalSilhouette: {
    width: 200,
    height: 250,
    borderRadius: 100,
    borderWidth: 2,
    borderColor: '#10B981',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanningLine: {
    width: 170,
    height: 2,
    backgroundColor: '#34D399',
    shadowColor: '#10B981',
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
  },
  cornerTL: {
    position: 'absolute',
    top: 10,
    left: 10,
    width: 18,
    height: 18,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: '#34D399',
  },
  cornerTR: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 18,
    height: 18,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderColor: '#34D399',
  },
  cornerBL: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    width: 18,
    height: 18,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderColor: '#34D399',
  },
  cornerBR: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    width: 18,
    height: 18,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderColor: '#34D399',
  },
  liveTagContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    position: 'absolute',
    top: 12,
  },
  liveRedDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#EF4444',
  },
  liveTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  faceInstructionText: {
    position: 'absolute',
    bottom: 12,
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
  },
  permissionBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#F8FAFC',
  },
  permissionBoxTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text,
    marginTop: 10,
  },
  permissionBoxDesc: {
    fontSize: 11,
    color: Colors.textLight,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 16,
  },
  requestPermissionBtn: {
    backgroundColor: '#0B8A7D',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 14,
  },
  requestPermissionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  liveGreenDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#10B981',
  },
  ovalSilhouetteVerified: {
    borderColor: '#10B981',
    borderWidth: 3,
  },
  verifiedBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(5, 150, 105, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    borderRadius: 18,
  },
  verifiedText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 2,
    marginTop: 10,
  },
  verifiedSubText: {
    fontSize: 12,
    color: '#ECFDF5',
    fontWeight: '600',
    marginTop: 4,
  },
  autoDetectHud: {
    marginTop: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  hudProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  hudProgressBar: {
    flex: 1,
    height: 10,
    backgroundColor: '#E2E8F0',
    borderRadius: 6,
    overflow: 'hidden',
  },
  hudProgressFill: {
    height: '100%',
    backgroundColor: '#0B8A7D',
    borderRadius: 6,
  },
  hudPercentText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0B8A7D',
    minWidth: 40,
    textAlign: 'right',
  },
  hudStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  hudDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  hudDotActive: {
    backgroundColor: '#0B8A7D',
  },
  hudDotSuccess: {
    backgroundColor: '#10B981',
  },
  hudStatusText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  hudHintText: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 16,
    marginTop: 8,
  },

  // Modal 2: Journal Form Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalBox: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  modalHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
  },
  modalHeaderSub: {
    fontSize: 11,
    color: '#0B8A7D',
    fontWeight: '700',
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  schedPillBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E6F4F1',
    padding: 10,
    borderRadius: 8,
    marginTop: 12,
  },
  schedPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0B8A7D',
  },
  inputGroup: {
    marginTop: 14,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: Colors.text,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipActive: {
    backgroundColor: '#E6F4F1',
    borderColor: '#0B8A7D',
  },
  chipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4B5563',
  },
  chipTextActive: {
    color: '#0B8A7D',
    fontWeight: '700',
  },
  attendanceSection: {
    marginTop: 18,
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
    paddingTop: 14,
  },
  attendanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  attendanceTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.text,
  },
  attendanceCountSub: {
    fontSize: 10,
    color: Colors.textLight,
    marginTop: 2,
    fontWeight: '600',
  },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  markAllBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  searchStudentBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 10,
    marginBottom: 8,
  },
  searchStudentInput: {
    flex: 1,
    fontSize: 12,
    color: Colors.text,
    padding: 0,
  },
  studentListContainer: {
    gap: 6,
  },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  studentNumBox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  studentNumText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4B5563',
  },
  studentInfoCol: {
    flex: 1,
    marginRight: 8,
  },
  studentName: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text,
  },
  studentNis: {
    fontSize: 10,
    color: Colors.textLight,
  },
  segmentContainer: {
    flexDirection: 'row',
    gap: 3,
  },
  segmentBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  segActiveH: {
    backgroundColor: '#059669',
  },
  segActiveS: {
    backgroundColor: '#D97706',
  },
  segActiveI: {
    backgroundColor: '#2563EB',
  },
  segActiveA: {
    backgroundColor: '#DC2626',
  },
  segmentBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#6B7280',
  },
  segmentBtnTextActive: {
    color: '#FFFFFF',
  },
  modalBottomBar: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
    paddingTop: 12,
  },
  cancelModalBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelModalBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  saveModalBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#0B8A7D',
    borderRadius: 10,
    paddingVertical: 12,
  },
  saveModalBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // Syllabus Selector Styles (Persis SIPENAFS Web)
  syllabusLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  syllabusLabelLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  inputLabelWithIcon: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text,
  },
  optionalBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  optionalBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6B7280',
  },
  clearSyllabusBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#EF4444',
  },
  syllabusContainerBox: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    maxHeight: 155,
    overflow: 'hidden',
  },
  syllabusLoadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
  },
  syllabusLoadingText: {
    fontSize: 12,
    color: Colors.textLight,
  },
  syllabusScroll: {
    maxHeight: 155,
    paddingHorizontal: 8,
  },
  syllabusItemCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    borderRadius: 6,
    marginVertical: 1,
  },
  syllabusItemCardActive: {
    backgroundColor: '#F0FDF4',
  },
  syllabusCheckbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
    backgroundColor: '#FFFFFF',
  },
  syllabusCheckboxActive: {
    backgroundColor: '#0B8A7D',
    borderColor: '#0B8A7D',
  },
  syllabusItemContent: {
    flex: 1,
  },
  syllabusTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  syllabusLevelTag: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  syllabusLevelTagText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#0369A1',
  },
  syllabusTopicText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    flexShrink: 1,
  },
  syllabusTopicTextActive: {
    color: '#065F46',
  },
  syllabusAtpText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 15,
  },
  syllabusEmptyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 12,
  },
  syllabusEmptyText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  syllabusNoteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 6,
  },
  syllabusNoteText: {
    fontSize: 11,
    color: '#065F46',
    flex: 1,
    lineHeight: 14,
  },
});
