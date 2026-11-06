import React, { useState, useEffect, useMemo } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  ActivityIndicator, RefreshControl, TextInput, Platform, Modal, Image 
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Colors from '../../constants/Colors';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { StudentFaceModal } from '../../components/StudentFaceModal';
import { Toast, ToastType } from '../../components/ui/Toast';

const avatarMale = require('../../../assets/images/avatar_male.png');
const avatarFemale = require('../../../assets/images/avatar_female.png');

type TabType = 'kbm' | 'guru' | 'disiplin';
type AttendanceStatus = 'H' | 'S' | 'I' | 'A';

interface StudentAttendanceItem {
  id: string;
  name: string;
  nis: string;
  nisn?: string;
  gender?: string;
  photo?: string | null;
  status: AttendanceStatus;
  absence_id?: string | null;
  notes?: string;
}

export default function PresensiScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Tab State
  const [activeTab, setActiveTab] = useState<TabType>('kbm');

  // Loading States
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Auth / API info
  const [apiBaseUrl, setApiBaseUrl] = useState('');
  const [authToken, setAuthToken] = useState('');

  // Toast / Feedback Modal
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error' | 'info'; title: string; desc: string } | null>(null);
  
  const [userData, setUserData] = useState<any>(null);

  // Student Attendance States
  const [studentAttStatus, setStudentAttStatus] = useState<any>(null);
  const [studentHistory, setStudentHistory] = useState<any[]>([]);
  const [isStudentPjj, setIsStudentPjj] = useState(false);
  const [studentSchoolLoc, setStudentSchoolLoc] = useState<any>(null);
  const [isStudentFaceReg, setIsStudentFaceReg] = useState(false);
  const [isStudentFaceModalOpen, setIsStudentFaceModalOpen] = useState(false);
  const [studentModalMode, setStudentModalMode] = useState<'attendance' | 'register'>('attendance');
  const [studentAttAction, setStudentAttAction] = useState<'check-in' | 'check-out'>('check-in');
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: ToastType }>({
    visible: false,
    message: '',
    type: 'info',
  });

  // ================= TAB 1: KBM & KELAS STATES =================
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [studentsAttendance, setStudentsAttendance] = useState<StudentAttendanceItem[]>([]);
  const [searchKbmQuery, setSearchKbmQuery] = useState('');
  const [hasUnsavedKbmChanges, setHasUnsavedKbmChanges] = useState(false);

  // Note Modal for Student
  const [noteModalStudent, setNoteModalStudent] = useState<StudentAttendanceItem | null>(null);
  const [tempNoteText, setTempNoteText] = useState('');

  // ================= TAB 2: GURU & STAF STATES =================
  const [staffList, setStaffList] = useState<any[]>([]);
  const [teacherAttendances, setTeacherAttendances] = useState<any[]>([]);
  const [schoolSettings, setSchoolSettings] = useState<any>(null);
  const [staffFilter, setStaffFilter] = useState<'all' | 'present' | 'late' | 'absent'>('all');
  const [searchStaffQuery, setSearchStaffQuery] = useState('');
  const [selectedStaffDetail, setSelectedStaffDetail] = useState<any>(null);

  // ================= TAB 3: KEDISIPLINAN & BUKU KASUS STATES =================
  const [violations, setViolations] = useState<any[]>([]);
  const [violationTypes, setViolationTypes] = useState<any[]>([]);
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [searchViolationQuery, setSearchViolationQuery] = useState('');

  // Add Violation Modal
  const [isAddViolationOpen, setIsAddViolationOpen] = useState(false);
  const [newViolationData, setNewViolationData] = useState({
    student_id: '',
    type_id: '',
    date: new Date().toISOString().split('T')[0],
    notes: ''
  });
  const [isSubmittingViolation, setIsSubmittingViolation] = useState(false);
  const [studentSearchInModal, setStudentSearchInModal] = useState('');

  // Delete Violation Modal
  const [violationToDelete, setViolationToDelete] = useState<any>(null);

  // Load initial data
  useEffect(() => {
    loadData();
  }, []);

  // When class or date changes in KBM tab, reload sheet
  useEffect(() => {
    if (selectedClassId && authToken && apiBaseUrl) {
      fetchKbmSheet(selectedClassId, selectedDate);
    }
  }, [selectedClassId, selectedDate]);

  // Helper gender detection
  const isFemaleGender = (gender?: string, name?: string) => {
    if (gender) {
      const g = String(gender).trim().toUpperCase();
      if (g === 'P' || g === 'PEREMPUAN' || g === 'WANITA' || g === 'F') return true;
      if (g === 'L' || g === 'LAKI-LAKI' || g === 'PRIA' || g === 'M') return false;
    }
    if (name) {
      const n = name.toLowerCase();
      if (n.endsWith('i') || n.endsWith('a') || n.includes('siti') || n.includes('putri') || n.includes('dewi') || n.includes('nur') || n.includes('ayu') || n.includes('ani') || n.includes('kartini') || n.includes('adela') || n.includes('laely')) {
        return true;
      }
    }
    return false;
  };

  // Helper avatar
  const renderAvatar = (gender?: string, photo?: string | null, name?: string) => {
    if (photo) {
      const photoUri = photo.startsWith('http') ? photo : `${apiBaseUrl}${photo}`;
      return <Image source={{ uri: photoUri }} style={styles.avatarImg} />;
    }
    const isFemale = isFemaleGender(gender, name);
    return <Image source={isFemale ? avatarFemale : avatarMale} style={styles.avatarImg} />;
  };

  const loadData = async () => {
    try {
      setIsLoading(true);
      const apiUrl = await SecureStore.getItemAsync('sipena_api_url');
      const token = await SecureStore.getItemAsync('sipena_token');
      const userStr = await SecureStore.getItemAsync('sipena_user');

      if (userStr) {
        setUserData(JSON.parse(userStr));
      }

      if (!apiUrl || !token) {
        setToastMessage({
          type: 'error',
          title: 'Sesi Berakhir',
          desc: 'Silakan login kembali untuk melanjutkan.'
        });
        return;
      }

      setApiBaseUrl(apiUrl);
      setAuthToken(token);
      const headers = { Authorization: `Bearer ${token}` };

      if (userStr) {
        const parsed = JSON.parse(userStr);
        const roleStr = (parsed.role || '').toLowerCase();
        if (roleStr.includes('siswa') || roleStr.includes('student')) {
          try {
            const [resAtt, resMe, resHistory] = await Promise.allSettled([
              axios.get(`${apiUrl}/api/student-attendance/status`, { headers }),
              axios.get(`${apiUrl}/api/students/me`, { headers }),
              axios.get(`${apiUrl}/api/student-attendance/history`, { headers }),
            ]);

            if (resAtt.status === 'fulfilled' && resAtt.value.data?.success) {
              setStudentAttStatus(resAtt.value.data.data || null);
              setIsStudentPjj(Boolean(resAtt.value.data.is_pjj));
              if (resAtt.value.data.school) setStudentSchoolLoc(resAtt.value.data.school);
            }

            if (resMe.status === 'fulfilled' && resMe.value.data) {
              const sData = resMe.value.data.data || resMe.value.data;
              setIsStudentFaceReg(Boolean(sData?.face_descriptor));
            }

            if (resHistory.status === 'fulfilled' && resHistory.value.data?.success) {
              setStudentHistory(resHistory.value.data.data || []);
            }
          } catch (e: any) {
            console.warn('Student attendance fetch error:', e.message);
          } finally {
            setIsLoading(false);
            setIsRefreshing(false);
          }
          return;
        }
      }

      // Parallel Fetch (for Teacher / Admin)
      const [resClasses, resStaffSummary, resViolations, resVioTypes, resStudents, resTeachers] = await Promise.allSettled([
        axios.get(`${apiUrl}/api/classes?perPage=all`, { headers }),
        axios.get(`${apiUrl}/api/teacher-attendance/school-summary`, { headers }),
        axios.get(`${apiUrl}/api/bk/violations`, { headers }),
        axios.get(`${apiUrl}/api/bk/violation-types`, { headers }),
        axios.get(`${apiUrl}/api/students?perPage=1000`, { headers }),
        axios.get(`${apiUrl}/api/teachers?perPage=all`, { headers }),
      ]);

      // 1. Classes
      if (resClasses.status === 'fulfilled' && resClasses.value.data?.data) {
        const clsList = resClasses.value.data.data;
        setClasses(clsList);
        if (clsList.length > 0 && !selectedClassId) {
          setSelectedClassId(String(clsList[0].id));
        }
      }

      // 2. Staff Summary (with reliable fallback to /api/teachers)
      let loadedStaff: any[] = [];
      if (resStaffSummary.status === 'fulfilled' && resStaffSummary.value.data?.data?.length > 0) {
        loadedStaff = resStaffSummary.value.data.data;
        setTeacherAttendances(resStaffSummary.value.data.attendance || []);
        if (resStaffSummary.value.data.settings) setSchoolSettings(resStaffSummary.value.data.settings);
      } else if (resTeachers.status === 'fulfilled' && resTeachers.value.data?.data) {
        loadedStaff = resTeachers.value.data.data.map((t: any) => ({
          user_id: t.user_id ? String(t.user_id) : null,
          staff_id: String(t.id),
          name: t.name,
          nip: t.nip,
          photo: t.photo,
          gender: t.teacher_profiles?.gender || (t.gender ? t.gender : null),
          type: t.teacher_employments?.[0]?.mst_jabatan?.name || t.teacher_employments?.[0]?.mst_jenis_ptk?.name || 'GURU',
          mapel_name: t.teacher_assignments?.[0]?.subject?.name || null
        }));
      }
      setStaffList(loadedStaff);

      if (!schoolSettings) {
        setSchoolSettings({
          working_hour_start: '07:00',
          working_hour_end: '15:30',
          grace_period: 15,
          geofence_radius: 100
        });
      }

      // 3. Violations & Types
      if (resViolations.status === 'fulfilled' && resViolations.value.data?.data) {
        setViolations(resViolations.value.data.data);
      }
      if (resVioTypes.status === 'fulfilled' && resVioTypes.value.data?.data) {
        setViolationTypes(resVioTypes.value.data.data);
      }

      // 4. All Students (for modal picker)
      if (resStudents.status === 'fulfilled' && resStudents.value.data?.data) {
        setAllStudents(resStudents.value.data.data);
      }

    } catch (e: any) {
      console.warn('Gagal memuat data presensi:', e.message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
    if (selectedClassId) {
      await fetchKbmSheet(selectedClassId, selectedDate);
    }
  };

  // Fetch KBM Attendance Sheet for Class & Date
  const fetchKbmSheet = async (classId: string, date: string) => {
    try {
      const headers = { Authorization: `Bearer ${authToken}` };
      const res = await axios.get(
        `${apiBaseUrl}/api/absences/sheet?class_id=${classId}&date=${date}`,
        { headers }
      );

      const rawList = res.data?.data || [];
      const mapped: StudentAttendanceItem[] = rawList.map((s: any) => ({
        id: String(s.id),
        name: s.name,
        nis: s.nis || s.nisn || '-',
        nisn: s.nisn || '',
        gender: s.gender || 'L',
        photo: s.photo || null,
        status: (s.absences?.[0]?.status as AttendanceStatus) || 'H',
        absence_id: s.absences?.[0]?.id ? String(s.absences[0].id) : null,
        notes: s.absences?.[0]?.notes || ''
      }));

      setStudentsAttendance(mapped);
      setHasUnsavedKbmChanges(false);
    } catch (e: any) {
      console.warn('Error fetching KBM sheet:', e.message);
    }
  };

  // ================= TAB 1: KBM ACTIONS =================
  const handleStatusChange = (studentId: string, newStatus: AttendanceStatus) => {
    setStudentsAttendance(prev => 
      prev.map(item => item.id === studentId ? { ...item, status: newStatus } : item)
    );
    setHasUnsavedKbmChanges(true);
  };

  const handleSetAllPresent = () => {
    setStudentsAttendance(prev => prev.map(s => ({ ...s, status: 'H' })));
    setHasUnsavedKbmChanges(true);
    setToastMessage({
      type: 'info',
      title: 'Semua Hadir',
      desc: 'Seluruh siswa rombel ditandai Hadir (H). Klik Simpan untuk memperbarui database.'
    });
  };

  const handleSaveKbmAttendance = async () => {
    if (!studentsAttendance.length) return;
    setIsSaving(true);
    try {
      const headers = { Authorization: `Bearer ${authToken}` };
      const payload = {
        date: selectedDate,
        subject_id: null,
        absences: studentsAttendance.map(s => ({
          student_id: s.id,
          status: s.status,
          notes: s.notes || ''
        }))
      };

      const res = await axios.post(`${apiBaseUrl}/api/absences/submit`, payload, { headers });
      if (res.data?.success || res.status === 200) {
        setHasUnsavedKbmChanges(false);
        setToastMessage({
          type: 'success',
          title: 'Presensi Tersimpan',
          desc: `Data presensi kelas berhasil diperbarui (${studentsAttendance.length} siswa).`
        });
        fetchKbmSheet(selectedClassId, selectedDate);
      }
    } catch (e: any) {
      setToastMessage({
        type: 'error',
        title: 'Gagal Menyimpan',
        desc: e.response?.data?.message || 'Terjadi kesalahan sistem saat menyimpan data.'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const changeDateByDays = (days: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  // Save Note for Student
  const handleSaveStudentNote = () => {
    if (!noteModalStudent) return;
    setStudentsAttendance(prev => 
      prev.map(s => s.id === noteModalStudent.id ? { ...s, notes: tempNoteText } : s)
    );
    setHasUnsavedKbmChanges(true);
    setNoteModalStudent(null);
  };

  // ================= TAB 3: VIOLATION ACTIONS =================
  const handleCreateViolation = async () => {
    if (!newViolationData.student_id || !newViolationData.type_id) {
      setToastMessage({
        type: 'error',
        title: 'Form Belum Lengkap',
        desc: 'Silakan pilih siswa dan jenis pelanggaran terlebih dahulu.'
      });
      return;
    }

    setIsSubmittingViolation(true);
    try {
      const headers = { Authorization: `Bearer ${authToken}` };
      const res = await axios.post(`${apiBaseUrl}/api/bk/violations`, newViolationData, { headers });
      if (res.data?.success) {
        setIsAddViolationOpen(false);
        setNewViolationData({
          student_id: '',
          type_id: '',
          date: new Date().toISOString().split('T')[0],
          notes: ''
        });
        setToastMessage({
          type: 'success',
          title: 'Kasus Dicatat',
          desc: 'Pelanggaran tata tertib berhasil dibukukan ke sistem.'
        });
        // Reload violations
        const vioRes = await axios.get(`${apiBaseUrl}/api/bk/violations`, { headers });
        if (vioRes.data?.data) setViolations(vioRes.data.data);
      }
    } catch (e: any) {
      setToastMessage({
        type: 'error',
        title: 'Gagal Mencatat',
        desc: e.response?.data?.message || 'Gagal menyimpan catatan pelanggaran.'
      });
    } finally {
      setIsSubmittingViolation(false);
    }
  };

  const handleDeleteViolation = async () => {
    if (!violationToDelete) return;
    try {
      const headers = { Authorization: `Bearer ${authToken}` };
      const res = await axios.delete(`${apiBaseUrl}/api/bk/violations/${violationToDelete.id}`, { headers });
      if (res.data?.success) {
        setViolations(prev => prev.filter(v => v.id !== violationToDelete.id));
        setToastMessage({
          type: 'success',
          title: 'Kasus Dihapus',
          desc: 'Catatan pelanggaran telah berhasil dihapus dari buku kasus.'
        });
      }
    } catch (e: any) {
      setToastMessage({
        type: 'error',
        title: 'Gagal Menghapus',
        desc: e.response?.data?.message || 'Tidak dapat menghapus data pelanggaran.'
      });
    } finally {
      setViolationToDelete(null);
    }
  };

  // ================= COMPUTED / FILTERED DATA =================
  // KBM stats
  const kbmStats = useMemo(() => {
    const total = studentsAttendance.length;
    const hadir = studentsAttendance.filter(s => s.status === 'H').length;
    const sakit = studentsAttendance.filter(s => s.status === 'S').length;
    const izin = studentsAttendance.filter(s => s.status === 'I').length;
    const alpa = studentsAttendance.filter(s => s.status === 'A').length;
    const pctHadir = total > 0 ? Math.round((hadir / total) * 100) : 0;
    return { total, hadir, sakit, izin, alpa, pctHadir };
  }, [studentsAttendance]);

  const filteredKbmStudents = useMemo(() => {
    if (!searchKbmQuery.trim()) return studentsAttendance;
    const q = searchKbmQuery.toLowerCase();
    return studentsAttendance.filter(s => 
      s.name.toLowerCase().includes(q) || s.nis.toLowerCase().includes(q)
    );
  }, [studentsAttendance, searchKbmQuery]);

  // Staff stats & enriched list
  const enrichedStaff = useMemo(() => {
    return staffList.map(st => {
      const att = teacherAttendances.find(a => 
        (st.user_id && Number(a.user_id) === Number(st.user_id)) ||
        (st.staff_id && Number(a.staff_id) === Number(st.staff_id))
      );
      
      let statusType: 'present' | 'late' | 'absent' = 'absent';
      let checkInTime = att?.check_in || null;
      let checkOutTime = att?.check_out || null;

      if (checkInTime) {
        const [hStart, mStart] = (schoolSettings?.working_hour_start || '07:00').split(':').map(Number);
        const grace = Number(schoolSettings?.grace_period || 15);
        const limitMins = hStart * 60 + mStart + grace;

        const [hIn, mIn] = checkInTime.split(':').map(Number);
        const inMins = hIn * 60 + mIn;

        if (inMins > limitMins) {
          statusType = 'late';
        } else {
          statusType = 'present';
        }
      }

      return {
        ...st,
        check_in: checkInTime,
        check_out: checkOutTime,
        statusType,
        rawStatus: att?.status || (checkInTime ? 'HADIR' : 'BELUM HADIR')
      };
    });
  }, [staffList, teacherAttendances, schoolSettings]);

  const staffStats = useMemo(() => {
    const total = enrichedStaff.length;
    const present = enrichedStaff.filter(s => s.statusType === 'present').length;
    const late = enrichedStaff.filter(s => s.statusType === 'late').length;
    const absent = enrichedStaff.filter(s => s.statusType === 'absent').length;
    return { total, present, late, absent };
  }, [enrichedStaff]);

  const filteredStaff = useMemo(() => {
    return enrichedStaff.filter(s => {
      if (staffFilter !== 'all' && s.statusType !== staffFilter) return false;
      if (searchStaffQuery.trim()) {
        const q = searchStaffQuery.toLowerCase();
        return s.name.toLowerCase().includes(q) || (s.nip && s.nip.toLowerCase().includes(q));
      }
      return true;
    });
  }, [enrichedStaff, staffFilter, searchStaffQuery]);

  // Violations filtered & stats
  const filteredViolations = useMemo(() => {
    if (!searchViolationQuery.trim()) return violations;
    const q = searchViolationQuery.toLowerCase();
    return violations.filter(v => 
      v.student?.name?.toLowerCase().includes(q) ||
      v.student?.nisn?.toLowerCase().includes(q) ||
      v.type?.name?.toLowerCase().includes(q)
    );
  }, [violations, searchViolationQuery]);

  const violationStats = useMemo(() => {
    const totalCases = violations.length;
    const totalPoints = violations.reduce((acc, v) => acc + Number(v.points || v.type?.points || 0), 0);
    const uniqueStudents = new Set(violations.map(v => v.student_id)).size;
    return { totalCases, totalPoints, uniqueStudents };
  }, [violations]);

  // Modal Student Filter
  const filteredStudentsInModal = useMemo(() => {
    if (!studentSearchInModal.trim()) return allStudents.slice(0, 15);
    const q = studentSearchInModal.toLowerCase();
    return allStudents.filter(s => 
      s.name.toLowerCase().includes(q) || (s.nisn && s.nisn.toLowerCase().includes(q))
    ).slice(0, 20);
  }, [allStudents, studentSearchInModal]);

  const isStudentUser = Boolean(
    (userData?.role || '').toLowerCase().includes('siswa') ||
    (userData?.role || '').toLowerCase().includes('student')
  );

  const studentAttStats = useMemo(() => {
    const total = studentHistory.length;
    let hadir = 0;
    let sakit = 0;
    let izin = 0;
    let alpa = 0;

    studentHistory.forEach((item: any) => {
      const st = (item.status || '').toUpperCase();
      if (st.includes('HADIR') || st === 'H' || item.check_in_time) {
        hadir++;
      } else if (st.includes('SAKIT') || st === 'S') {
        sakit++;
      } else if (st.includes('IZIN') || st === 'I') {
        izin++;
      } else if (st.includes('ALPA') || st.includes('ALPHA') || st === 'A') {
        alpa++;
      } else {
        hadir++;
      }
    });

    const pct = total > 0 ? Math.round((hadir / total) * 100) : 100;
    return { total, hadir, sakit, izin, alpa, pct };
  }, [studentHistory]);

  if (isStudentUser) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backBtn}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Feather name="arrow-left" size={22} color={Colors.secondary} />
          </TouchableOpacity>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>Presensi Siswa</Text>
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>Verifikasi Wajah & Lokasi GPS</Text>
            </View>
          </View>
          <TouchableOpacity 
            style={styles.refreshBtn}
            onPress={handleRefresh}
            activeOpacity={0.7}
          >
            <Feather name="refresh-cw" size={18} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollContent}
          contentContainerStyle={{ paddingBottom: 110, paddingHorizontal: 16, paddingTop: 16 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} colors={['#EA580C']} />
          }
        >
          {/* Banner PJJ */}
          {isStudentPjj && (
            <View style={styles.studentPjjBanner}>
              <Ionicons name="home" size={20} color="#059669" />
              <View style={{ flex: 1 }}>
                <Text style={styles.studentPjjTitle}>MODE PJJ AKTIF (BEBAS RADIUS)</Text>
                <Text style={styles.studentPjjDesc}>
                  Kelas Anda hari ini terjadwal Pembelajaran Jarak Jauh. Anda dapat absen masuk & pulang mandiri dari rumah tanpa batas jarak radius sekolah.
                </Text>
              </View>
            </View>
          )}

          {/* Banner Pendaftaran Wajah (Face ID) */}
          <View style={[styles.studentFaceCard, !isStudentFaceReg && styles.studentFaceCardWarn]}>
            <View style={styles.studentFaceLeft}>
              <View style={[styles.studentFaceIconCircle, !isStudentFaceReg && { backgroundColor: '#FFEDD5' }]}>
                <Ionicons 
                  name={isStudentFaceReg ? "checkmark-circle" : "scan-outline"} 
                  size={24} 
                  color={isStudentFaceReg ? "#059669" : "#EA580C"} 
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.studentFaceTitle}>
                  {isStudentFaceReg ? 'Face ID Siswa Terverifikasi' : 'Face ID Belum Terdaftar'}
                </Text>
                <Text style={styles.studentFaceDesc}>
                  {isStudentFaceReg
                    ? 'Data biometrik wajah Anda aktif untuk presensi sekolah.'
                    : 'Daftarkan wajah sekarang agar dapat melakukan presensi mandiri.'}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.studentFaceBtn, !isStudentFaceReg && styles.studentFaceBtnOrange]}
              onPress={() => {
                setStudentModalMode('register');
                setIsStudentFaceModalOpen(true);
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="camera-outline" size={15} color="#FFF" />
              <Text style={styles.studentFaceBtnText}>
                {isStudentFaceReg ? 'Perbarui Wajah' : 'Daftar Wajah'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Card Presensi Hari Ini */}
          <View style={styles.studentTodayCard}>
            <View style={styles.studentTodayHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={styles.todayIconCircle}>
                  <Ionicons name="calendar-outline" size={18} color="#2563EB" />
                </View>
                <View>
                  <Text style={styles.studentTodayTitle}>Presensi Hari Ini</Text>
                  <Text style={styles.studentTodayDate}>
                    {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </Text>
                </View>
              </View>
              <View style={[styles.studentStatusPill, studentAttStatus?.check_in_time ? styles.pillSuccess : styles.pillPending]}>
                <Text style={[styles.studentStatusPillText, studentAttStatus?.check_in_time ? { color: '#059669' } : { color: '#64748B' }]}>
                  {studentAttStatus?.check_in_time ? (studentAttStatus.status || 'Hadir') : 'Belum Absen'}
                </Text>
              </View>
            </View>

            {/* In & Out Grid */}
            <View style={styles.studentInOutGrid}>
              {/* Masuk */}
              <View style={styles.studentInOutCol}>
                <View style={styles.studentColHeader}>
                  <Ionicons name="log-in-outline" size={16} color={studentAttStatus?.check_in_time ? "#059669" : "#64748B"} />
                  <Text style={styles.studentColTitle}>JAM MASUK</Text>
                </View>
                <Text style={[styles.studentColTime, studentAttStatus?.check_in_time && { color: '#065F46' }]}>
                  {studentAttStatus?.check_in_time
                    ? new Date(studentAttStatus.check_in_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB'
                    : '-- : --'}
                </Text>
                <Text style={styles.studentColNote}>
                  {studentAttStatus?.check_in_time ? 'Tercatat di server' : 'Wajib scan wajah & GPS'}
                </Text>
              </View>

              <View style={styles.studentGridDivider} />

              {/* Pulang */}
              <View style={styles.studentInOutCol}>
                <View style={styles.studentColHeader}>
                  <Ionicons name="log-out-outline" size={16} color={studentAttStatus?.check_out_time ? "#059669" : "#64748B"} />
                  <Text style={styles.studentColTitle}>JAM PULANG</Text>
                </View>
                <Text style={[styles.studentColTime, studentAttStatus?.check_out_time && { color: '#065F46' }]}>
                  {studentAttStatus?.check_out_time
                    ? new Date(studentAttStatus.check_out_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB'
                    : '-- : --'}
                </Text>
                <Text style={styles.studentColNote}>
                  {studentAttStatus?.check_out_time ? 'Tercatat di server' : (studentAttStatus?.check_in_time ? 'Buka kamera saat jam pulang' : 'Belum absen masuk')}
                </Text>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={{ marginTop: 14 }}>
              {!studentAttStatus?.check_in_time ? (
                <TouchableOpacity
                  style={[styles.studentActionBtn, { backgroundColor: '#2563EB' }]}
                  onPress={() => {
                    if (!isStudentFaceReg) {
                      setToast({
                        visible: true,
                        message: 'Silakan daftarkan Face ID terlebih dahulu sebelum absen masuk.',
                        type: 'warning',
                      });
                      setStudentModalMode('register');
                      setIsStudentFaceModalOpen(true);
                      return;
                    }
                    setStudentAttAction('check-in');
                    setStudentModalMode('attendance');
                    setIsStudentFaceModalOpen(true);
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="camera" size={18} color="#FFF" />
                  <Text style={styles.studentActionBtnText}>📸 Lakukan Absen Masuk Sekarang</Text>
                </TouchableOpacity>
              ) : !studentAttStatus?.check_out_time ? (
                <TouchableOpacity
                  style={[styles.studentActionBtn, { backgroundColor: '#EA580C' }]}
                  onPress={() => {
                    if (!isStudentFaceReg) {
                      setToast({
                        visible: true,
                        message: 'Silakan daftarkan Face ID terlebih dahulu sebelum absen pulang.',
                        type: 'warning',
                      });
                      setStudentModalMode('register');
                      setIsStudentFaceModalOpen(true);
                      return;
                    }
                    setStudentAttAction('check-out');
                    setStudentModalMode('attendance');
                    setIsStudentFaceModalOpen(true);
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="camera" size={18} color="#FFF" />
                  <Text style={styles.studentActionBtnText}>📸 Lakukan Absen Pulang Sekarang</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.studentDoneBanner}>
                  <Ionicons name="checkmark-done-circle" size={22} color="#059669" />
                  <Text style={styles.studentDoneBannerText}>Presensi Masuk & Pulang Selesai Hari Ini</Text>
                </View>
              )}
            </View>
          </View>

          {/* Statistik Kehadiran 30 Hari */}
          <View style={styles.studentStatsCard}>
            <Text style={styles.studentStatsTitle}>Statistik Kehadiran (30 Hari Terakhir)</Text>
            <View style={styles.studentStatsGrid}>
              <View style={[styles.studentStatBox, { backgroundColor: '#EFF6FF' }]}>
                <Text style={[styles.studentStatVal, { color: '#1D4ED8' }]}>{studentAttStats.hadir}</Text>
                <Text style={styles.studentStatLbl}>Hadir</Text>
              </View>
              <View style={[styles.studentStatBox, { backgroundColor: '#FEF3C7' }]}>
                <Text style={[styles.studentStatVal, { color: '#B45309' }]}>{studentAttStats.sakit}</Text>
                <Text style={styles.studentStatLbl}>Sakit</Text>
              </View>
              <View style={[styles.studentStatBox, { backgroundColor: '#F3E8FF' }]}>
                <Text style={[styles.studentStatVal, { color: '#7E22CE' }]}>{studentAttStats.izin}</Text>
                <Text style={styles.studentStatLbl}>Izin</Text>
              </View>
              <View style={[styles.studentStatBox, { backgroundColor: '#FEE2E2' }]}>
                <Text style={[styles.studentStatVal, { color: '#B91C1C' }]}>{studentAttStats.alpa}</Text>
                <Text style={styles.studentStatLbl}>Alpa</Text>
              </View>
              <View style={[styles.studentStatBox, { backgroundColor: '#ECFDF5' }]}>
                <Text style={[styles.studentStatVal, { color: '#047857' }]}>{studentAttStats.pct}%</Text>
                <Text style={styles.studentStatLbl}>Rasio</Text>
              </View>
            </View>
          </View>

          {/* Histori Kehadiran */}
          <View style={{ marginTop: 18 }}>
            <Text style={styles.studentHistoryHeader}>Riwayat Presensi Siswa</Text>
            {studentHistory.length === 0 ? (
              <View style={styles.studentEmptyBox}>
                <Ionicons name="calendar-outline" size={36} color="#CBD5E1" />
                <Text style={styles.studentEmptyTitle}>Belum Ada Riwayat Presensi</Text>
                <Text style={styles.studentEmptySubtitle}>
                  Data presensi harian Anda akan ditampilkan di sini setelah Anda melakukan absen masuk & pulang.
                </Text>
              </View>
            ) : (
              studentHistory.map((item: any, idx: number) => {
                const dateStr = item.date ? new Date(item.date).toLocaleDateString('id-ID', {
                  weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
                }) : `Hari ke-${idx + 1}`;

                const inTime = item.check_in_time 
                  ? new Date(item.check_in_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB'
                  : '-';
                const outTime = item.check_out_time
                  ? new Date(item.check_out_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB'
                  : '-';

                return (
                  <View key={item.id ? String(item.id) : String(idx)} style={styles.studentHistoryItem}>
                    <View style={styles.historyItemTop}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name="time-outline" size={16} color="#64748B" />
                        <Text style={styles.historyItemDate}>{dateStr}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        {Boolean(item.is_pjj) && (
                          <View style={styles.historyPjjBadge}>
                            <Text style={styles.historyPjjText}>PJJ</Text>
                          </View>
                        )}
                        <View style={[
                          styles.historyStatusBadge,
                          item.status === 'Hadir' || item.check_in_time ? styles.hBadgeSuccess : styles.hBadgeDefault
                        ]}>
                          <Text style={[
                            styles.historyStatusText,
                            item.status === 'Hadir' || item.check_in_time ? { color: '#047857' } : { color: '#64748B' }
                          ]}>
                            {item.status || 'Hadir'}
                          </Text>
                        </View>
                      </View>
                    </View>

                    <View style={styles.historyTimesRow}>
                      <View style={styles.historyTimeCol}>
                        <Text style={styles.historyTimeLabel}>Masuk</Text>
                        <Text style={styles.historyTimeVal}>{inTime}</Text>
                      </View>
                      <View style={styles.historyTimeCol}>
                        <Text style={styles.historyTimeLabel}>Pulang</Text>
                        <Text style={styles.historyTimeVal}>{outTime}</Text>
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>

        {/* Face Attendance & Register Modal */}
        <StudentFaceModal
          visible={isStudentFaceModalOpen}
          onClose={() => setIsStudentFaceModalOpen(false)}
          mode={studentModalMode}
          attendanceAction={studentAttAction}
          isPjj={isStudentPjj}
          schoolLocation={studentSchoolLoc}
          studentName={userData?.name}
          onSuccess={() => {
            handleRefresh();
            if (studentModalMode === 'register') {
              setIsStudentFaceReg(true);
              setToast({
                visible: true,
                message: 'Face ID siswa berhasil didaftarkan!',
                type: 'success',
              });
            } else {
              setToast({
                visible: true,
                message: studentAttAction === 'check-in' 
                  ? 'Presensi Masuk berhasil dicatat!' 
                  : 'Presensi Pulang berhasil dicatat!',
                type: 'success',
              });
            }
          }}
        />

        <Toast
          visible={toast.visible}
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(prev => ({ ...prev, visible: false }))}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Feather name="arrow-left" size={22} color={Colors.secondary} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Presensi & Disiplin</Text>
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>Sistem Kehadiran & Tata Tertib</Text>
          </View>
        </View>
        <TouchableOpacity 
          style={styles.refreshBtn}
          onPress={handleRefresh}
          activeOpacity={0.7}
        >
          <Feather name="refresh-cw" size={18} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Segmented Control Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'kbm' && styles.tabBtnActive]}
          onPress={() => setActiveTab('kbm')}
          activeOpacity={0.8}
        >
          <Ionicons 
            name="school-outline" 
            size={17} 
            color={activeTab === 'kbm' ? '#EA580C' : '#64748B'} 
          />
          <Text style={[styles.tabBtnText, activeTab === 'kbm' && styles.tabBtnTextActive]}>
            Presensi KBM
          </Text>
        </TouchableOpacity>

        {(!userData || (userData?.role?.toLowerCase() !== 'guru' || (userData?.jabatan?.name && userData?.jabatan?.name?.toLowerCase() !== 'guru'))) && (
          <>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'guru' && styles.tabBtnActive]}
              onPress={() => setActiveTab('guru')}
              activeOpacity={0.8}
            >
              <Ionicons 
                name="finger-print-outline" 
                size={17} 
                color={activeTab === 'guru' ? '#EA580C' : '#64748B'} 
              />
              <Text style={[styles.tabBtnText, activeTab === 'guru' && styles.tabBtnTextActive]}>
                Guru & Staf
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'disiplin' && styles.tabBtnActive]}
              onPress={() => setActiveTab('disiplin')}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons 
                name="shield-alert-outline" 
                size={17} 
                color={activeTab === 'disiplin' ? '#EA580C' : '#64748B'} 
              />
              <Text style={[styles.tabBtnText, activeTab === 'disiplin' && styles.tabBtnTextActive]}>
                Buku Kasus
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Main Body */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#EA580C" />
          <Text style={styles.loadingText}>Memuat data presensi & kedisiplinan...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollContent}
          contentContainerStyle={{ paddingBottom: 110 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} colors={['#EA580C']} />
          }
        >
          {/* ======================================================== */}
          {/* TAB 1: PRESENSI SISWA / KBM                             */}
          {/* ======================================================== */}
          {activeTab === 'kbm' && (
            <View style={styles.tabContent}>
              {/* Class Horizontal Selector */}
              <View style={styles.filterSection}>
                <Text style={styles.sectionHeading}>Pilih Rombel / Kelas:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.classChips}>
                  {classes.map(c => {
                    const isSelected = String(c.id) === selectedClassId;
                    return (
                      <TouchableOpacity
                        key={c.id}
                        style={[styles.classChip, isSelected && styles.classChipActive]}
                        onPress={() => setSelectedClassId(String(c.id))}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.classChipText, isSelected && styles.classChipTextActive]}>
                          {c.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Date Control Banner */}
              <View style={styles.dateControlCard}>
                <TouchableOpacity 
                  style={styles.dateNavBtn} 
                  onPress={() => changeDateByDays(-1)}
                  activeOpacity={0.7}
                >
                  <Feather name="chevron-left" size={20} color="#EA580C" />
                </TouchableOpacity>

                <View style={styles.dateCenter}>
                  <Ionicons name="calendar-outline" size={16} color="#EA580C" />
                  <Text style={styles.dateText}>
                    {selectedDate === new Date().toISOString().split('T')[0] ? 'Hari Ini, ' : ''}
                    {selectedDate}
                  </Text>
                </View>

                <TouchableOpacity 
                  style={styles.dateNavBtn} 
                  onPress={() => changeDateByDays(1)}
                  activeOpacity={0.7}
                >
                  <Feather name="chevron-right" size={20} color="#EA580C" />
                </TouchableOpacity>
              </View>

              {/* KBM Metric Summary */}
              <View style={styles.kbmMetricsGrid}>
                <View style={[styles.kbmMetricCard, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
                  <Text style={[styles.kbmMetricValue, { color: '#059669' }]}>{kbmStats.hadir}</Text>
                  <Text style={[styles.kbmMetricLabel, { color: '#047857' }]}>Hadir (H)</Text>
                </View>

                <View style={[styles.kbmMetricCard, { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }]}>
                  <Text style={[styles.kbmMetricValue, { color: '#D97706' }]}>{kbmStats.sakit}</Text>
                  <Text style={[styles.kbmMetricLabel, { color: '#B45309' }]}>Sakit (S)</Text>
                </View>

                <View style={[styles.kbmMetricCard, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
                  <Text style={[styles.kbmMetricValue, { color: '#2563EB' }]}>{kbmStats.izin}</Text>
                  <Text style={[styles.kbmMetricLabel, { color: '#1D4ED8' }]}>Izin (I)</Text>
                </View>

                <View style={[styles.kbmMetricCard, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
                  <Text style={[styles.kbmMetricValue, { color: '#DC2626' }]}>{kbmStats.alpa}</Text>
                  <Text style={[styles.kbmMetricLabel, { color: '#B91C1C' }]}>Alpa (A)</Text>
                </View>
              </View>

              {/* Action Ribbon: Search + Set All Present */}
              <View style={styles.kbmActionRibbon}>
                <View style={styles.searchBox}>
                  <Feather name="search" size={16} color="#94A3B8" />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Cari siswa atau NIS..."
                    placeholderTextColor="#94A3B8"
                    value={searchKbmQuery}
                    onChangeText={setSearchKbmQuery}
                  />
                  {searchKbmQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchKbmQuery('')}>
                      <Feather name="x" size={14} color="#94A3B8" />
                    </TouchableOpacity>
                  )}
                </View>

                <TouchableOpacity 
                  style={styles.setAllBtn}
                  onPress={handleSetAllPresent}
                  activeOpacity={0.8}
                >
                  <Ionicons name="checkmark-done" size={16} color="#047857" />
                  <Text style={styles.setAllBtnText}>Semua Hadir</Text>
                </TouchableOpacity>
              </View>

              {/* Student Attendance List */}
              <View style={styles.studentListSection}>
                <View style={styles.listHeaderRow}>
                  <Text style={styles.listHeaderTitle}>
                    Daftar Siswa ({filteredKbmStudents.length} Anak)
                  </Text>
                  <Text style={styles.listHeaderSub}>Tingkat Kehadiran: {kbmStats.pctHadir}%</Text>
                </View>

                {filteredKbmStudents.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <Ionicons name="people-outline" size={40} color="#CBD5E1" />
                    <Text style={styles.emptyTitle}>Tidak ada siswa ditemukan</Text>
                    <Text style={styles.emptyDesc}>Pastikan kelas telah memiliki siswa terdaftar.</Text>
                  </View>
                ) : (
                  filteredKbmStudents.map((student, idx) => {
                    const isFemale = isFemaleGender(student.gender, student.name);
                    return (
                      <View key={student.id} style={styles.studentCard}>
                        <View style={styles.studentCardTop}>
                          <View style={styles.studentAvatarWrap}>
                            {renderAvatar(student.gender, student.photo, student.name)}
                            <View style={styles.studentIndexBadge}>
                              <Text style={styles.studentIndexText}>{idx + 1}</Text>
                            </View>
                          </View>

                          <View style={styles.studentInfo}>
                            <Text style={styles.studentName} numberOfLines={1}>{student.name}</Text>
                            <Text style={styles.studentNis}>
                              NISN: {student.nisn || student.nis || '-'} • {isFemale ? 'Perempuan' : 'Laki-laki'}
                            </Text>
                            {student.notes ? (
                              <View style={styles.noteSnippet}>
                                <Feather name="file-text" size={11} color="#EA580C" />
                                <Text style={styles.noteSnippetText} numberOfLines={1}>
                                  {student.notes}
                                </Text>
                              </View>
                            ) : null}
                          </View>

                          <TouchableOpacity 
                            style={styles.noteActionBtn}
                            onPress={() => {
                              setNoteModalStudent(student);
                              setTempNoteText(student.notes || '');
                            }}
                            activeOpacity={0.7}
                          >
                            <Feather name="edit-3" size={15} color={student.notes ? '#EA580C' : '#94A3B8'} />
                          </TouchableOpacity>
                        </View>

                        {/* 4-Way Status Toggle */}
                        <View style={styles.statusToggleBar}>
                          {(['H', 'S', 'I', 'A'] as AttendanceStatus[]).map((st) => {
                            const isCurrent = student.status === st;
                            let activeBg = '#10B981';
                            let label = 'Hadir';
                            if (st === 'S') { activeBg = '#F59E0B'; label = 'Sakit'; }
                            if (st === 'I') { activeBg = '#3B82F6'; label = 'Izin'; }
                            if (st === 'A') { activeBg = '#EF4444'; label = 'Alpa'; }

                            return (
                              <TouchableOpacity
                                key={st}
                                style={[
                                  styles.statusToggleBtn,
                                  isCurrent && { backgroundColor: activeBg, borderColor: activeBg }
                                ]}
                                onPress={() => handleStatusChange(student.id, st)}
                                activeOpacity={0.8}
                              >
                                <Text style={[styles.statusToggleText, isCurrent && styles.statusToggleTextActive]}>
                                  {st} - {label}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            </View>
          )}

          {/* ======================================================== */}
          {/* TAB 2: PRESENSI GURU & STAF                             */}
          {/* ======================================================== */}
          {activeTab === 'guru' && (
            <View style={styles.tabContent}>
              {/* Geofence & Working Hours Info Card */}
              <View style={styles.guruConfigCard}>
                <View style={styles.guruConfigHeader}>
                  <View style={styles.guruConfigIconBg}>
                    <Ionicons name="location" size={18} color="#EA580C" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.guruConfigTitle}>Geofence Presensi Sekolah</Text>
                    <Text style={styles.guruConfigSubtitle}>
                      Radius: {schoolSettings?.geofence_radius || 100}m • GPS & Face Recognition
                    </Text>
                  </View>
                  <View style={styles.liveBadge}>
                    <View style={styles.livePulse} />
                    <Text style={styles.liveText}>Realtime</Text>
                  </View>
                </View>

                <View style={styles.guruConfigDetailRow}>
                  <View style={styles.guruConfigCol}>
                    <Text style={styles.guruConfigLabel}>Jam Masuk</Text>
                    <Text style={styles.guruConfigValue}>
                      {schoolSettings?.working_hour_start || '07:00'} WIB
                    </Text>
                  </View>
                  <View style={styles.guruConfigDivider} />
                  <View style={styles.guruConfigCol}>
                    <Text style={styles.guruConfigLabel}>Toleransi</Text>
                    <Text style={styles.guruConfigValue}>
                      +{schoolSettings?.grace_period || 15} Menit
                    </Text>
                  </View>
                  <View style={styles.guruConfigDivider} />
                  <View style={styles.guruConfigCol}>
                    <Text style={styles.guruConfigLabel}>Jam Pulang</Text>
                    <Text style={styles.guruConfigValue}>
                      {schoolSettings?.working_hour_end || '15:30'} WIB
                    </Text>
                  </View>
                </View>
              </View>

              {/* Staff Attendance Metrics */}
              <View style={styles.staffMetricsRow}>
                <View style={styles.staffMetricItem}>
                  <Text style={styles.staffMetricNum}>{staffStats.total}</Text>
                  <Text style={styles.staffMetricLabel}>Total Guru</Text>
                </View>
                <View style={styles.staffMetricItem}>
                  <Text style={[styles.staffMetricNum, { color: '#059669' }]}>{staffStats.present}</Text>
                  <Text style={styles.staffMetricLabel}>Tepat Waktu</Text>
                </View>
                <View style={styles.staffMetricItem}>
                  <Text style={[styles.staffMetricNum, { color: '#D97706' }]}>{staffStats.late}</Text>
                  <Text style={styles.staffMetricLabel}>Terlambat</Text>
                </View>
                <View style={styles.staffMetricItem}>
                  <Text style={[styles.staffMetricNum, { color: '#DC2626' }]}>{staffStats.absent}</Text>
                  <Text style={styles.staffMetricLabel}>Belum Absen</Text>
                </View>
              </View>

              {/* Filter Tabs & Search */}
              <View style={styles.staffFilterRow}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {(['all', 'present', 'late', 'absent'] as const).map(tab => {
                    const isAct = staffFilter === tab;
                    let label = 'Semua';
                    if (tab === 'present') label = `Tepat (${staffStats.present})`;
                    if (tab === 'late') label = `Terlambat (${staffStats.late})`;
                    if (tab === 'absent') label = `Belum (${staffStats.absent})`;

                    return (
                      <TouchableOpacity
                        key={tab}
                        style={[styles.staffFilterChip, isAct && styles.staffFilterChipActive]}
                        onPress={() => setStaffFilter(tab)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.staffFilterChipText, isAct && styles.staffFilterChipTextActive]}>
                          {label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Search Staff */}
              <View style={[styles.searchBox, { marginHorizontal: 20, marginBottom: 12 }]}>
                <Feather name="search" size={16} color="#94A3B8" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Cari nama guru atau NIP..."
                  placeholderTextColor="#94A3B8"
                  value={searchStaffQuery}
                  onChangeText={setSearchStaffQuery}
                />
              </View>

              {/* Staff Cards List */}
              <View style={{ paddingHorizontal: 20, gap: 10 }}>
                {filteredStaff.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <Ionicons name="person-outline" size={40} color="#CBD5E1" />
                    <Text style={styles.emptyTitle}>Data guru tidak ditemukan</Text>
                  </View>
                ) : (
                  filteredStaff.map(st => {
                    let badgeBg = '#FEF2F2';
                    let badgeColor = '#DC2626';
                    let badgeLabel = 'Belum Hadir';

                    if (st.statusType === 'present') {
                      badgeBg = '#ECFDF5';
                      badgeColor = '#059669';
                      badgeLabel = `Hadir ${st.check_in}`;
                    } else if (st.statusType === 'late') {
                      badgeBg = '#FEF3C7';
                      badgeColor = '#D97706';
                      badgeLabel = `Telat ${st.check_in}`;
                    }

                    return (
                      <TouchableOpacity 
                        key={st.staff_id}
                        style={styles.staffCard}
                        onPress={() => setSelectedStaffDetail(st)}
                        activeOpacity={0.8}
                      >
                        <View style={styles.staffCardLeft}>
                          {renderAvatar(st.gender, st.photo, st.name)}
                          <View style={{ flex: 1 }}>
                            <Text style={styles.staffName} numberOfLines={1}>{st.name}</Text>
                            <Text style={styles.staffNip}>NIP: {st.nip || '-'}</Text>
                            <View style={styles.staffRolePill}>
                              <Text style={styles.staffRolePillText}>
                                {st.type} {st.mapel_name ? `• ${st.mapel_name}` : ''}
                              </Text>
                            </View>
                          </View>
                        </View>

                        <View style={[styles.staffStatusBadge, { backgroundColor: badgeBg }]}>
                          <Text style={[styles.staffStatusText, { color: badgeColor }]}>
                            {badgeLabel}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>
            </View>
          )}

          {/* ======================================================== */}
          {/* TAB 3: KEDISIPLINAN & BUKU KASUS                         */}
          {/* ======================================================== */}
          {activeTab === 'disiplin' && (
            <View style={styles.tabContent}>
              {/* Discipline Stats Header */}
              <View style={styles.disciplineStatsBanner}>
                <View style={styles.disciplineStatsCol}>
                  <Text style={styles.disciplineStatsNum}>{violationStats.totalCases}</Text>
                  <Text style={styles.disciplineStatsLabel}>Total Kasus</Text>
                </View>
                <View style={styles.disciplineStatsDivider} />
                <View style={styles.disciplineStatsCol}>
                  <Text style={[styles.disciplineStatsNum, { color: '#EA580C' }]}>
                    {violationStats.totalPoints}
                  </Text>
                  <Text style={styles.disciplineStatsLabel}>Poin Terkumpul</Text>
                </View>
                <View style={styles.disciplineStatsDivider} />
                <View style={styles.disciplineStatsCol}>
                  <Text style={styles.disciplineStatsNum}>{violationStats.uniqueStudents}</Text>
                  <Text style={styles.disciplineStatsLabel}>Siswa Tercatat</Text>
                </View>
              </View>

              {/* Action Ribbon: Search + Catat Kasus Button */}
              <View style={[styles.kbmActionRibbon, { marginTop: 12 }]}>
                <View style={styles.searchBox}>
                  <Feather name="search" size={16} color="#94A3B8" />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Cari siswa, NISN, kasus..."
                    placeholderTextColor="#94A3B8"
                    value={searchViolationQuery}
                    onChangeText={setSearchViolationQuery}
                  />
                  {searchViolationQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchViolationQuery('')}>
                      <Feather name="x" size={14} color="#94A3B8" />
                    </TouchableOpacity>
                  )}
                </View>

                <TouchableOpacity 
                  style={styles.addViolationBtn}
                  onPress={() => setIsAddViolationOpen(true)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="add" size={18} color="#FFF" />
                  <Text style={styles.addViolationBtnText}>Catat Kasus</Text>
                </TouchableOpacity>
              </View>

              {/* Violations List */}
              <View style={{ paddingHorizontal: 20, marginTop: 14, gap: 12 }}>
                <View style={styles.listHeaderRow}>
                  <Text style={styles.listHeaderTitle}>
                    Buku Catatan Kasus ({filteredViolations.length} Laporan)
                  </Text>
                  <Text style={styles.listHeaderSub}>Aturan Tata Tertib Sekolah</Text>
                </View>

                {filteredViolations.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <Ionicons name="shield-checkmark-outline" size={42} color="#10B981" />
                    <Text style={styles.emptyTitle}>Alhamdulillah, Belum Ada Kasus</Text>
                    <Text style={styles.emptyDesc}>Tidak ada catatan pelanggaran tata tertib saat ini.</Text>
                  </View>
                ) : (
                  filteredViolations.map((v) => {
                    const points = Number(v.points || v.type?.points || 0);
                    let pointBg = '#FEF2F2';
                    let pointColor = '#DC2626';
                    if (points <= 10) { pointBg = '#FEF3C7'; pointColor = '#D97706'; }
                    if (points <= 5) { pointBg = '#EFF6FF'; pointColor = '#2563EB'; }

                    return (
                      <View key={v.id} style={styles.violationCard}>
                        <View style={styles.violationCardTop}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.violationStudentName}>{v.student?.name || 'Siswa'}</Text>
                            <Text style={styles.violationStudentNis}>NISN: {v.student?.nisn || '-'}</Text>
                          </View>
                          <View style={[styles.violationPointsPill, { backgroundColor: pointBg }]}>
                            <Text style={[styles.violationPointsText, { color: pointColor }]}>
                              +{points} Poin
                            </Text>
                          </View>
                        </View>

                        <View style={styles.violationDetailBox}>
                          <Text style={styles.violationTypeName}>
                            {v.type?.name || 'Pelanggaran Tata Tertib'}
                          </Text>
                          {v.notes ? (
                            <Text style={styles.violationNotesText}>"{v.notes}"</Text>
                          ) : null}
                        </View>

                        <View style={styles.violationCardBottom}>
                          <View style={styles.violationDateWrap}>
                            <Feather name="calendar" size={13} color="#94A3B8" />
                            <Text style={styles.violationDateText}>
                              {v.date ? new Date(v.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                            </Text>
                          </View>

                          <TouchableOpacity 
                            style={styles.deleteVioBtn}
                            onPress={() => setViolationToDelete(v)}
                            activeOpacity={0.7}
                          >
                            <Feather name="trash-2" size={14} color="#EF4444" />
                            <Text style={styles.deleteVioBtnText}>Hapus</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            </View>
          )}
        </ScrollView>
      )}

      {/* Floating Save Bar for KBM tab when edits exist */}
      {activeTab === 'kbm' && hasUnsavedKbmChanges && (
        <View style={styles.floatingSaveBar}>
          <View style={styles.floatingSaveTextWrap}>
            <Text style={styles.floatingSaveTitle}>Perubahan Belum Disimpan</Text>
            <Text style={styles.floatingSaveSub}>Pastikan klik simpan sebelum berganti rombel</Text>
          </View>
          <TouchableOpacity 
            style={[styles.floatingSaveBtn, isSaving && { opacity: 0.8 }]}
            onPress={handleSaveKbmAttendance}
            disabled={isSaving}
            activeOpacity={0.85}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <Feather name="save" size={16} color="#FFF" />
                <Text style={styles.floatingSaveBtnText}>Simpan</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* ======================================================== */}
      {/* MODAL: EDIT STUDENT ATTENDANCE NOTE                     */}
      {/* ======================================================== */}
      <Modal visible={!!noteModalStudent} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Catatan Presensi</Text>
                <Text style={styles.modalSubtitle}>{noteModalStudent?.name}</Text>
              </View>
              <TouchableOpacity onPress={() => setNoteModalStudent(null)}>
                <Feather name="x" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.inputLabel}>Alasan / Keterangan (Opsional):</Text>
              <TextInput
                style={styles.noteTextInput}
                placeholder="Contoh: Demam tinggi, Surat dokter terlampir, izin acara..."
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={4}
                value={tempNoteText}
                onChangeText={setTempNoteText}
              />
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={styles.modalCancelBtn}
                onPress={() => setNoteModalStudent(null)}
              >
                <Text style={styles.modalCancelText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.modalConfirmBtn}
                onPress={handleSaveStudentNote}
              >
                <Text style={styles.modalConfirmText}>Simpan Catatan</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL: STAFF DETAIL                                     */}
      {/* ======================================================== */}
      <Modal visible={!!selectedStaffDetail} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Detail Presensi PTK</Text>
                <Text style={styles.modalSubtitle}>{selectedStaffDetail?.name}</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedStaffDetail(null)}>
                <Feather name="x" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>NIP / ID:</Text>
                <Text style={styles.detailVal}>{selectedStaffDetail?.nip || '-'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Jabatan:</Text>
                <Text style={styles.detailVal}>{selectedStaffDetail?.type || 'GURU'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Jam Masuk:</Text>
                <Text style={styles.detailVal}>{selectedStaffDetail?.check_in || 'Belum Presensi'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Jam Pulang:</Text>
                <Text style={styles.detailVal}>{selectedStaffDetail?.check_out || '-'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Status Evaluasi:</Text>
                <Text style={[
                  styles.detailVal, 
                  { fontWeight: '700', color: selectedStaffDetail?.statusType === 'present' ? '#059669' : selectedStaffDetail?.statusType === 'late' ? '#D97706' : '#DC2626' }
                ]}>
                  {selectedStaffDetail?.statusType === 'present' ? 'Tepat Waktu' : selectedStaffDetail?.statusType === 'late' ? 'Terlambat Masuk' : 'Belum Melakukan Presensi'}
                </Text>
              </View>
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={[styles.modalConfirmBtn, { width: '100%' }]}
                onPress={() => setSelectedStaffDetail(null)}
              >
                <Text style={styles.modalConfirmText}>Tutup</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL: ADD VIOLATION FORM                               */}
      {/* ======================================================== */}
      <Modal visible={isAddViolationOpen} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { maxHeight: '90%' }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Catat Kasus Pelanggaran</Text>
                <Text style={styles.modalSubtitle}>Input buku kasus tata tertib siswa</Text>
              </View>
              <TouchableOpacity onPress={() => setIsAddViolationOpen(false)}>
                <Feather name="x" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Select Student Section */}
              <Text style={styles.inputLabel}>Pilih Siswa Terlapor *</Text>
              <View style={[styles.searchBox, { marginBottom: 8 }]}>
                <Feather name="search" size={14} color="#94A3B8" />
                <TextInput
                  style={[styles.searchInput, { fontSize: 13 }]}
                  placeholder="Ketik nama atau NISN siswa..."
                  placeholderTextColor="#94A3B8"
                  value={studentSearchInModal}
                  onChangeText={setStudentSearchInModal}
                />
              </View>

              <View style={styles.studentModalPickerWrap}>
                <ScrollView nestedScrollEnabled style={{ maxHeight: 130 }}>
                  {filteredStudentsInModal.map(s => {
                    const isSelected = newViolationData.student_id === String(s.id);
                    return (
                      <TouchableOpacity
                        key={s.id}
                        style={[styles.modalStudentItem, isSelected && styles.modalStudentItemActive]}
                        onPress={() => setNewViolationData(prev => ({ ...prev, student_id: String(s.id) }))}
                      >
                        <Text style={[styles.modalStudentName, isSelected && { color: '#EA580C', fontWeight: '700' }]}>
                          {s.name}
                        </Text>
                        <Text style={styles.modalStudentNisn}>NISN: {s.nisn || '-'}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Select Violation Type */}
              <Text style={[styles.inputLabel, { marginTop: 14 }]}>Jenis Pelanggaran *</Text>
              <View style={styles.typePillContainer}>
                {violationTypes.map(t => {
                  const isSelected = newViolationData.type_id === String(t.id);
                  return (
                    <TouchableOpacity
                      key={t.id}
                      style={[styles.typePill, isSelected && styles.typePillActive]}
                      onPress={() => setNewViolationData(prev => ({ ...prev, type_id: String(t.id) }))}
                    >
                      <Text style={[styles.typePillText, isSelected && styles.typePillTextActive]}>
                        {t.name} (+{t.points} Poin)
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Date Input */}
              <Text style={[styles.inputLabel, { marginTop: 14 }]}>Tanggal Kejadian (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.textInputRegular}
                value={newViolationData.date}
                onChangeText={txt => setNewViolationData(prev => ({ ...prev, date: txt }))}
              />

              {/* Notes Input */}
              <Text style={[styles.inputLabel, { marginTop: 14 }]}>Keterangan / Kronologi Kejadian</Text>
              <TextInput
                style={styles.noteTextInput}
                placeholder="Tuliskan keterangan detail pelanggaran..."
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={3}
                value={newViolationData.notes}
                onChangeText={txt => setNewViolationData(prev => ({ ...prev, notes: txt }))}
              />
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={styles.modalCancelBtn}
                onPress={() => setIsAddViolationOpen(false)}
              >
                <Text style={styles.modalCancelText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalConfirmBtn, isSubmittingViolation && { opacity: 0.7 }]}
                onPress={handleCreateViolation}
                disabled={isSubmittingViolation}
              >
                {isSubmittingViolation ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.modalConfirmText}>Simpan Kasus</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL: DELETE CONFIRMATION                              */}
      {/* ======================================================== */}
      <Modal visible={!!violationToDelete} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.deleteConfirmIconWrap}>
              <Feather name="alert-triangle" size={32} color="#EF4444" />
            </View>

            <Text style={styles.deleteConfirmTitle}>Hapus Catatan Pelanggaran?</Text>
            <Text style={styles.deleteConfirmDesc}>
              Kasus <Text style={{ fontWeight: '700' }}>{violationToDelete?.student?.name}</Text> ({violationToDelete?.type?.name}) akan dihapus secara permanen dari buku kasus.
            </Text>

            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={styles.modalCancelBtn}
                onPress={() => setViolationToDelete(null)}
              >
                <Text style={styles.modalCancelText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalConfirmBtn, { backgroundColor: '#EF4444' }]}
                onPress={handleDeleteViolation}
              >
                <Text style={styles.modalConfirmText}>Ya, Hapus</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ======================================================== */}
      {/* TOAST / FEEDBACK MODAL                                  */}
      {/* ======================================================== */}
      <Modal visible={!!toastMessage} transparent animationType="fade">
        <View style={styles.toastOverlay}>
          <View style={styles.toastCard}>
            <View style={[
              styles.toastIconCircle,
              { backgroundColor: toastMessage?.type === 'success' ? '#ECFDF5' : toastMessage?.type === 'info' ? '#FFF7ED' : '#FEF2F2' }
            ]}>
              <Ionicons 
                name={
                  toastMessage?.type === 'success' ? 'checkmark-circle' :
                  toastMessage?.type === 'info' ? 'information-circle' : 'alert-circle'
                } 
                size={26} 
                color={
                  toastMessage?.type === 'success' ? '#10B981' :
                  toastMessage?.type === 'info' ? '#EA580C' : '#EF4444'
                } 
              />
            </View>
            <Text style={styles.toastTitle}>{toastMessage?.title}</Text>
            <Text style={styles.toastDesc}>{toastMessage?.desc}</Text>
            <TouchableOpacity 
              style={[
                styles.toastCloseBtn,
                { backgroundColor: toastMessage?.type === 'success' ? '#10B981' : toastMessage?.type === 'info' ? '#EA580C' : '#EF4444' }
              ]}
              onPress={() => setToastMessage(null)}
              activeOpacity={0.8}
            >
              <Text style={styles.toastCloseText}>Mengerti</Text>
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
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backBtn: {
    padding: 6,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
  },
  headerTitleWrap: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  headerBadge: {
    marginTop: 2,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: '#FFF7ED',
  },
  headerBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#EA580C',
  },
  refreshBtn: {
    padding: 6,
    borderRadius: 10,
    backgroundColor: '#FFF7ED',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    gap: 6,
  },
  tabBtnActive: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  tabBtnTextActive: {
    color: '#EA580C',
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  scrollContent: {
    flex: 1,
  },
  tabContent: {
    paddingTop: 14,
  },
  filterSection: {
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  classChips: {
    gap: 8,
  },
  classChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  classChipActive: {
    backgroundColor: '#EA580C',
    borderColor: '#EA580C',
  },
  classChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  classChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  dateControlCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: 14,
  },
  dateNavBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#FFF7ED',
  },
  dateCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  kbmMetricsGrid: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 14,
  },
  kbmMetricCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  kbmMetricValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  kbmMetricLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  kbmActionRibbon: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 12,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#1E293B',
    paddingVertical: 0,
  },
  setAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 4,
  },
  setAllBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#047857',
  },
  studentListSection: {
    paddingHorizontal: 20,
    gap: 10,
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  listHeaderTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  listHeaderSub: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  studentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 },
      android: { elevation: 1 },
    }),
  },
  studentCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  studentAvatarWrap: {
    position: 'relative',
    marginRight: 10,
  },
  avatarImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E2E8F0',
  },
  studentIndexBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#475569',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  studentIndexText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  studentNis: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  noteSnippet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  noteSnippetText: {
    fontSize: 10,
    color: '#EA580C',
    fontWeight: '600',
    flex: 1,
  },
  noteActionBtn: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
  },
  statusToggleBar: {
    flexDirection: 'row',
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
  },
  statusToggleBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statusToggleText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  statusToggleTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  floatingSaveBar: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: '#1E293B',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 },
      android: { elevation: 6 },
    }),
  },
  floatingSaveTextWrap: {
    flex: 1,
  },
  floatingSaveTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  floatingSaveSub: {
    color: '#94A3B8',
    fontSize: 10,
    marginTop: 1,
  },
  floatingSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EA580C',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
    gap: 6,
  },
  floatingSaveBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  guruConfigCard: {
    marginHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FED7AA',
    marginBottom: 14,
  },
  guruConfigHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  guruConfigIconBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  guruConfigTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  guruConfigSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4,
  },
  livePulse: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  liveText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
  },
  guruConfigDetailRow: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingVertical: 10,
  },
  guruConfigCol: {
    flex: 1,
    alignItems: 'center',
  },
  guruConfigDivider: {
    width: 1,
    backgroundColor: '#E2E8F0',
  },
  guruConfigLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
  guruConfigValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  staffMetricsRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: 12,
  },
  staffMetricItem: {
    flex: 1,
    alignItems: 'center',
  },
  staffMetricNum: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  staffMetricLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 2,
  },
  staffFilterRow: {
    marginHorizontal: 20,
    marginBottom: 10,
  },
  staffFilterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  staffFilterChipActive: {
    backgroundColor: '#FFF7ED',
    borderColor: '#EA580C',
  },
  staffFilterChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  staffFilterChipTextActive: {
    color: '#EA580C',
    fontWeight: '700',
  },
  staffCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  staffCardLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  staffName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  staffNip: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  staffRolePill: {
    alignSelf: 'flex-start',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 3,
  },
  staffRolePillText: {
    fontSize: 9,
    color: '#475569',
    fontWeight: '600',
  },
  staffStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  staffStatusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  disciplineStatsBanner: {
    flexDirection: 'row',
    marginHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  disciplineStatsCol: {
    flex: 1,
    alignItems: 'center',
  },
  disciplineStatsDivider: {
    width: 1,
    backgroundColor: '#F1F5F9',
  },
  disciplineStatsNum: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  disciplineStatsLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  addViolationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EA580C',
    paddingHorizontal: 14,
    borderRadius: 12,
    gap: 4,
  },
  addViolationBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  violationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3 },
      android: { elevation: 1 },
    }),
  },
  violationCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  violationStudentName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  violationStudentNis: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  violationPointsPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  violationPointsText: {
    fontSize: 12,
    fontWeight: '800',
  },
  violationDetailBox: {
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 10,
    marginBottom: 8,
  },
  violationTypeName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  violationNotesText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 3,
    fontStyle: 'italic',
  },
  violationCardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  violationDateWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  violationDateText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  deleteVioBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
  },
  deleteVioBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#EF4444',
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
    marginTop: 10,
  },
  emptyDesc: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 4,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 12 },
      android: { elevation: 8 },
    }),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  modalBody: {
    padding: 18,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  noteTextInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    color: '#0F172A',
    textAlignVertical: 'top',
  },
  textInputRegular: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0F172A',
  },
  studentModalPickerWrap: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    overflow: 'hidden',
  },
  modalStudentItem: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalStudentItemActive: {
    backgroundColor: '#FFF7ED',
  },
  modalStudentName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
  },
  modalStudentNisn: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },
  typePillContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  typePill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  typePillActive: {
    backgroundColor: '#FFF7ED',
    borderColor: '#EA580C',
  },
  typePillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  typePillTextActive: {
    color: '#EA580C',
    fontWeight: '700',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  detailLabel: {
    fontSize: 13,
    color: '#64748B',
  },
  detailVal: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 16,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  modalCancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
  modalCancelText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  modalConfirmBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#EA580C',
  },
  modalConfirmText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  deleteConfirmIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  deleteConfirmTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  deleteConfirmDesc: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 14,
    paddingHorizontal: 20,
  },
  toastOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  toastCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10 },
      android: { elevation: 6 },
    }),
  },
  toastIconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  toastTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
    textAlign: 'center',
  },
  toastDesc: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  toastCloseBtn: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  toastCloseText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  studentPjjBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#ECFDF5',
    borderWidth: 1.5,
    borderColor: '#A7F3D0',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  studentPjjTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#059669',
    letterSpacing: 0.5,
  },
  studentPjjDesc: {
    fontSize: 12,
    color: '#065F46',
    marginTop: 2,
    lineHeight: 16,
  },
  studentFaceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14,
  },
  studentFaceCardWarn: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FED7AA',
  },
  studentFaceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  studentFaceIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  studentFaceTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E293B',
  },
  studentFaceDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  studentFaceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#059669',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  studentFaceBtnOrange: {
    backgroundColor: '#EA580C',
  },
  studentFaceBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  studentTodayCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    marginBottom: 14,
  },
  studentTodayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  todayIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  studentTodayTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E293B',
  },
  studentTodayDate: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  studentStatusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  pillSuccess: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  pillPending: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
  studentStatusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  studentInOutGrid: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    marginTop: 12,
    alignItems: 'center',
  },
  studentInOutCol: {
    flex: 1,
    alignItems: 'center',
  },
  studentColHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  studentColTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  studentColTime: {
    fontSize: 16,
    fontWeight: '800',
    color: '#334155',
  },
  studentColNote: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
  },
  studentGridDivider: {
    width: 1,
    height: 44,
    backgroundColor: '#CBD5E1',
    marginHorizontal: 8,
  },
  studentActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
  },
  studentActionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  studentDoneBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  studentDoneBannerText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#059669',
  },
  studentStatsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
  },
  studentStatsTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 10,
  },
  studentStatsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  studentStatBox: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  studentStatVal: {
    fontSize: 15,
    fontWeight: '800',
  },
  studentStatLbl: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '600',
  },
  studentHistoryHeader: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 10,
  },
  studentEmptyBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  studentEmptyTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  studentEmptySubtitle: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 16,
  },
  studentHistoryItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8,
  },
  historyItemTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  historyItemDate: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  historyPjjBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  historyPjjText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#059669',
  },
  historyStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  hBadgeSuccess: {
    backgroundColor: '#D1FAE5',
  },
  hBadgeDefault: {
    backgroundColor: '#F1F5F9',
  },
  historyStatusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  historyTimesRow: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 8,
  },
  historyTimeCol: {
    flex: 1,
  },
  historyTimeLabel: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '600',
  },
  historyTimeVal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginTop: 2,
  },
});
