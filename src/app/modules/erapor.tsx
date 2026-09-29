import React, { useState, useEffect } from 'react';
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

const avatarMale = require('../../../assets/images/avatar_male.png');
const avatarFemale = require('../../../assets/images/avatar_female.png');
const logoOfficial = require('../../../assets/images/icon.png');

type TabType = 'rekap' | 'cetak' | 'kkm';

interface AcademicYear {
  id: number;
  name: string;
  is_active: boolean;
}

interface ClassItem {
  id: number;
  name: string;
  level?: string;
  major?: string;
}

interface SubjectItem {
  id: number;
  name: string;
  code: string;
  kkm?: number;
  hours_per_week?: number;
  has_practical?: boolean;
}

interface StudentGradeSummary {
  student_id: string;
  name: string;
  nis?: string;
  nisn?: string;
  gender?: string;
  harian: number[];
  uts: number | null;
  uas: number | null;
  praktik: number;
  tugas: number;
  avg_harian: number;
  final_score: number;
  harian_details?: any[];
  praktik_details?: any[];
  tugas_details?: any[];
}

export default function ERaporScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<TabType>('rekap');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [apiBaseUrl, setApiBaseUrl] = useState('');
  const [token, setToken] = useState('');
  const [schoolName, setSchoolName] = useState('SIPENA School');

  // Filter States
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [selectedAYId, setSelectedAYId] = useState<string>('');
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  // Grade Data States
  const [gradeSummary, setGradeSummary] = useState<StudentGradeSummary[]>([]);
  const [gradeWeights, setGradeWeights] = useState({
    weight_harian: 40,
    weight_uts: 30,
    weight_uas: 30,
    weight_praktik: 0,
  });
  const [isLoadingGrades, setIsLoadingGrades] = useState(false);

  // Student Report List (Tab 2)
  const [reportStudents, setReportStudents] = useState<any[]>([]);
  const [isLoadingReports, setIsLoadingReports] = useState(false);

  // Detail Modal State
  const [selectedStudentDetail, setSelectedStudentDetail] = useState<StudentGradeSummary | null>(null);

  // Bobot Modal State
  const [isWeightModalOpen, setIsWeightModalOpen] = useState(false);
  const [tempWeights, setTempWeights] = useState({
    weight_harian: '40',
    weight_uts: '30',
    weight_uas: '30',
    weight_praktik: '0',
  });
  const [isSavingWeights, setIsSavingWeights] = useState(false);

  // Manual Grade Input Modal State
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualType, setManualType] = useState<'Ujian Harian' | 'Tugas' | 'Praktik' | 'UTS' | 'UAS'>('Ujian Harian');
  const [manualTitle, setManualTitle] = useState('');
  const [manualDate, setManualDate] = useState(new Date().toISOString().split('T')[0]);
  const [manualScores, setManualScores] = useState<{ [studentId: string]: string }>({});
  const [bulkScoreInput, setBulkScoreInput] = useState('');
  const [isSavingManual, setIsSavingManual] = useState(false);

  // Official Report Card Modal State
  const [isReportCardModalOpen, setIsReportCardModalOpen] = useState(false);
  const [reportStudentData, setReportStudentData] = useState<any>(null);
  const [reportGrades, setReportGrades] = useState<any[]>([]);
  const [reportHomeroom, setReportHomeroom] = useState<any>(null);
  const [reportParentName, setReportParentName] = useState<string>('');
  const [isLoadingSingleReport, setIsLoadingSingleReport] = useState(false);

  // Toast / Notification Modal State (No native alerts)
  const [toastMessage, setToastMessage] = useState<{ title: string; desc: string; type: 'success' | 'warning' | 'info' | 'error' } | null>(null);

  const showToast = (title: string, desc: string, type: 'success' | 'warning' | 'info' | 'error' = 'info') => {
    setToastMessage({ title, desc, type });
  };

  useEffect(() => {
    initData();
  }, []);

  // Fetch initial filters (Academic Years, Classes, Subjects)
  const initData = async () => {
    try {
      setIsLoading(true);
      const url = await SecureStore.getItemAsync('sipena_api_url');
      const tok = await SecureStore.getItemAsync('sipena_token');
      const scName = await SecureStore.getItemAsync('sipena_school_name');

      if (url) setApiBaseUrl(url);
      if (tok) setToken(tok);
      if (scName) setSchoolName(scName);

      if (url && tok) {
        const headers = { Authorization: `Bearer ${tok}` };
        const [resAY, resCls, resSub] = await Promise.allSettled([
          axios.get(`${url}/api/academic-years?perPage=all`, { headers }),
          axios.get(`${url}/api/classes?perPage=all`, { headers }),
          axios.get(`${url}/api/subjects?perPage=all`, { headers })
        ]);

        let defaultAyId = '';
        if (resAY.status === 'fulfilled' && resAY.value.data?.data) {
          const ayList: AcademicYear[] = resAY.value.data.data;
          setAcademicYears(ayList);
          const activeAY = ayList.find(a => a.is_active) || ayList[0];
          if (activeAY) {
            defaultAyId = String(activeAY.id);
            setSelectedAYId(defaultAyId);
          }
        }

        let defaultClassId = '';
        if (resCls.status === 'fulfilled' && resCls.value.data?.data) {
          const clsList: ClassItem[] = resCls.value.data.data;
          setClasses(clsList);
          if (clsList.length > 0) {
            defaultClassId = String(clsList[0].id);
            setSelectedClassId(defaultClassId);
          }
        }

        let defaultSubjectId = '';
        if (resSub.status === 'fulfilled' && resSub.value.data?.data) {
          const subList: SubjectItem[] = resSub.value.data.data;
          setSubjects(subList);
          if (subList.length > 0) {
            defaultSubjectId = String(subList[0].id);
            setSelectedSubjectId(defaultSubjectId);
          }
        }

        // Auto fetch initial summary if filters are ready
        if (defaultAyId && defaultClassId && defaultSubjectId) {
          fetchGradesSummary(url, tok, defaultAyId, defaultClassId, defaultSubjectId);
        }
        if (defaultClassId) {
          fetchReportStudents(url, tok, defaultClassId);
        }
      }
    } catch (e: any) {
      console.warn('Gagal memuat filter E-Rapor:', e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    if (apiBaseUrl && token) {
      if (activeTab === 'rekap') {
        await fetchGradesSummary(apiBaseUrl, token, selectedAYId, selectedClassId, selectedSubjectId);
      } else if (activeTab === 'cetak') {
        await fetchReportStudents(apiBaseUrl, token, selectedClassId);
      }
    }
    setIsRefreshing(false);
  };

  // Fetch Grade Summary (Tab 1)
  const fetchGradesSummary = async (url: string, tok: string, ayId: string, clsId: string, subId: string) => {
    if (!ayId || !clsId || !subId) return;
    try {
      setIsLoadingGrades(true);
      const headers = { Authorization: `Bearer ${tok}` };
      const res = await axios.get(`${url}/api/grades/summary`, {
        headers,
        params: {
          academic_year_id: ayId,
          class_id: clsId,
          subject_id: subId
        }
      });

      if (res.data?.data) {
        setGradeSummary(res.data.data);
      } else {
        setGradeSummary([]);
      }

      if (res.data?.weights) {
        setGradeWeights(res.data.weights);
        setTempWeights({
          weight_harian: String(res.data.weights.weight_harian ?? 40),
          weight_uts: String(res.data.weights.weight_uts ?? 30),
          weight_uas: String(res.data.weights.weight_uas ?? 30),
          weight_praktik: String(res.data.weights.weight_praktik ?? 0),
        });
      }
    } catch (e: any) {
      console.warn('Gagal memuat ringkasan nilai:', e.message);
      setGradeSummary([]);
    } finally {
      setIsLoadingGrades(false);
    }
  };

  // Fetch Report Students list (Tab 2)
  const fetchReportStudents = async (url: string, tok: string, clsId: string) => {
    if (!clsId) return;
    try {
      setIsLoadingReports(true);
      const headers = { Authorization: `Bearer ${tok}` };
      const res = await axios.get(`${url}/api/grades/report-list`, {
        headers,
        params: { class_id: clsId }
      });
      if (res.data?.data) {
        setReportStudents(res.data.data);
      } else {
        setReportStudents([]);
      }
    } catch (e: any) {
      console.warn('Gagal memuat daftar siswa rapor:', e.message);
      setReportStudents([]);
    } finally {
      setIsLoadingReports(false);
    }
  };

  // Switch Class
  const handleSelectClass = (clsId: string) => {
    setSelectedClassId(clsId);
    if (apiBaseUrl && token) {
      if (selectedAYId && selectedSubjectId) {
        fetchGradesSummary(apiBaseUrl, token, selectedAYId, clsId, selectedSubjectId);
      }
      fetchReportStudents(apiBaseUrl, token, clsId);
    }
  };

  // Switch Subject
  const handleSelectSubject = (subId: string) => {
    setSelectedSubjectId(subId);
    if (apiBaseUrl && token && selectedAYId && selectedClassId) {
      fetchGradesSummary(apiBaseUrl, token, selectedAYId, selectedClassId, subId);
    }
  };

  // Switch Academic Year
  const handleSelectAY = (ayId: string) => {
    setSelectedAYId(ayId);
    if (apiBaseUrl && token && selectedClassId && selectedSubjectId) {
      fetchGradesSummary(apiBaseUrl, token, ayId, selectedClassId, selectedSubjectId);
    }
  };

  // Gender detection heuristic
  const isFemaleGender = (gender?: string, name?: string) => {
    if (gender) {
      const g = String(gender).trim().toUpperCase();
      if (g === 'P' || g === 'PEREMPUAN' || g === 'WANITA' || g === 'F') return true;
      if (g === 'L' || g === 'LAKI-LAKI' || g === 'PRIA' || g === 'M') return false;
    }
    if (name) {
      const n = name.toLowerCase();
      if (n.endsWith('i') || n.endsWith('a') || n.includes('siti') || n.includes('putri') || 
          n.includes('dewi') || n.includes('nur') || n.includes('ayu') || n.includes('ani') || 
          n.includes('kartini') || n.includes('adela') || n.includes('laely')) {
        return true;
      }
    }
    return false;
  };

  const renderAvatar = (gender?: string, photo?: string | null, name?: string) => {
    if (photo) {
      const photoUri = photo.startsWith('http') ? photo : `${apiBaseUrl}${photo}`;
      return <Image source={{ uri: photoUri }} style={styles.avatarImg} />;
    }
    const isFemale = isFemaleGender(gender, name);
    return <Image source={isFemale ? avatarFemale : avatarMale} style={styles.avatarImg} />;
  };

  // Predicate helper
  const getPredicate = (score: number) => {
    if (score >= 91) return { code: 'A', label: 'Sangat Baik', color: '#10B981', bg: '#ECFDF5' };
    if (score >= 81) return { code: 'B', label: 'Baik', color: '#0EA5E9', bg: '#F0F9FF' };
    if (score >= 71) return { code: 'C', label: 'Cukup', color: '#F59E0B', bg: '#FFFBEB' };
    return { code: 'D', label: 'Perlu Bimbingan', color: '#EF4444', bg: '#FEF2F2' };
  };

  // Save Bobot Nilai
  const handleSaveWeights = async () => {
    const h = parseInt(tempWeights.weight_harian || '0', 10);
    const t = parseInt(tempWeights.weight_uts || '0', 10);
    const a = parseInt(tempWeights.weight_uas || '0', 10);
    const p = parseInt(tempWeights.weight_praktik || '0', 10);
    const total = h + t + a + p;

    if (total !== 100) {
      showToast('Bobot Tidak Seimbang', `Total persentase bobot harus pas 100%. Saat ini: ${total}%.`, 'warning');
      return;
    }

    try {
      setIsSavingWeights(true);
      const headers = { Authorization: `Bearer ${token}` };
      await axios.post(`${apiBaseUrl}/api/grades/weights`, {
        academic_year_id: parseInt(selectedAYId, 10),
        subject_id: parseInt(selectedSubjectId, 10),
        weight_harian: h,
        weight_uts: t,
        weight_uas: a,
        weight_praktik: p,
      }, { headers });

      setIsWeightModalOpen(false);
      showToast('Bobot Disimpan', 'Konfigurasi bobot penilaian berhasil diperbarui.', 'success');
      fetchGradesSummary(apiBaseUrl, token, selectedAYId, selectedClassId, selectedSubjectId);
    } catch (e: any) {
      showToast('Gagal Menyimpan', e.response?.data?.error || e.message, 'error');
    } finally {
      setIsSavingWeights(false);
    }
  };

  // Open Manual Input Modal
  const openManualInputModal = () => {
    const initialScores: { [key: string]: string } = {};
    gradeSummary.forEach(s => {
      initialScores[s.student_id] = '';
    });
    setManualScores(initialScores);
    setManualTitle('');
    setBulkScoreInput('');
    setIsManualModalOpen(true);
  };

  // Apply Bulk Score
  const handleApplyBulkScore = () => {
    if (!bulkScoreInput.trim()) return;
    const val = bulkScoreInput.trim();
    const updated: { [key: string]: string } = {};
    gradeSummary.forEach(s => {
      updated[s.student_id] = val;
    });
    setManualScores(updated);
    showToast('Nilai Disalin', `Nilai ${val} telah diterapkan ke semua ${gradeSummary.length} siswa.`, 'info');
  };

  // Save Manual Grades
  const handleSaveManualGrades = async () => {
    if (!manualTitle.trim()) {
      showToast('Judul Wajib Diisi', 'Harap masukkan nama tugas/ujian (contoh: Tugas Bab 1).', 'warning');
      return;
    }

    const payloadGrades = gradeSummary.map(s => ({
      student_id: s.student_id,
      score: parseFloat(manualScores[s.student_id] || '0')
    })).filter(g => !isNaN(g.score));

    if (payloadGrades.length === 0) {
      showToast('Nilai Kosong', 'Harap isi setidaknya satu nilai siswa.', 'warning');
      return;
    }

    try {
      setIsSavingManual(true);
      const headers = { Authorization: `Bearer ${token}` };
      await axios.post(`${apiBaseUrl}/api/grades/manual`, {
        academic_year_id: parseInt(selectedAYId, 10),
        subject_id: parseInt(selectedSubjectId, 10),
        class_id: parseInt(selectedClassId, 10),
        type: manualType,
        title: manualTitle.trim(),
        date: manualDate,
        grades: payloadGrades
      }, { headers });

      setIsManualModalOpen(false);
      showToast('Nilai Tersimpan', `Nilai ${manualType} "${manualTitle}" untuk ${payloadGrades.length} siswa telah disimpan.`, 'success');
      fetchGradesSummary(apiBaseUrl, token, selectedAYId, selectedClassId, selectedSubjectId);
    } catch (e: any) {
      showToast('Gagal Simpan', e.response?.data?.error || e.message, 'error');
    } finally {
      setIsSavingManual(false);
    }
  };

  // Open Full Report Sheet Modal for specific student
  const openStudentReportModal = async (student: any) => {
    setReportStudentData(student);
    setIsReportCardModalOpen(true);
    try {
      setIsLoadingSingleReport(true);
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.get(`${apiBaseUrl}/api/grades/my-grades`, {
        headers,
        params: {
          academic_year_id: selectedAYId,
          student_id: student.id
        }
      });

      if (res.data) {
        setReportGrades(res.data.data || []);
        setReportHomeroom(res.data.homeroom_teacher || null);
        setReportParentName(res.data.parent_name || 'Orang Tua / Wali');
      }
    } catch (e: any) {
      console.warn('Gagal memuat rapor siswa:', e.message);
      showToast('Gagal Memuat Rapor', 'Tidak dapat mengambil lembar nilai siswa.', 'error');
    } finally {
      setIsLoadingSingleReport(false);
    }
  };

  // Stats Calculations
  const validScores = gradeSummary.map(s => Number(s.final_score || 0)).filter(s => s > 0);
  const classAvg = validScores.length > 0 
    ? (validScores.reduce((a, b) => a + b, 0) / validScores.length).toFixed(1) 
    : '0';
  const highestScore = validScores.length > 0 ? Math.max(...validScores).toFixed(1) : '-';
  const lowestScore = validScores.length > 0 ? Math.min(...validScores).toFixed(1) : '-';
  const passedCount = validScores.filter(s => s >= 75).length;
  const passRate = validScores.length > 0 ? Math.round((passedCount / validScores.length) * 100) : 0;

  // Filtered lists by search query
  const filteredGrades = gradeSummary.filter(s => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (s.name || '').toLowerCase().includes(q) || 
           (s.nis || '').toLowerCase().includes(q) || 
           (s.nisn || '').toLowerCase().includes(q);
  });

  const filteredReportStudents = reportStudents.filter(s => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (s.name || '').toLowerCase().includes(q) || 
           (s.nis || '').toLowerCase().includes(q) || 
           (s.nisn || '').toLowerCase().includes(q);
  });

  const currentClassName = classes.find(c => String(c.id) === selectedClassId)?.name || 'Pilih Kelas';
  const currentAYName = academicYears.find(a => String(a.id) === selectedAYId)?.name || '2026/2027';
  const currentSubject = subjects.find(s => String(s.id) === selectedSubjectId);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Top Header */}
      <View style={styles.topHeader}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Feather name="arrow-left" size={22} color={Colors.secondary} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <View style={styles.titleRow}>
            <Text style={styles.headerTitle}>6. E-Rapor & Penilaian</Text>
            <View style={styles.merdekaBadge}>
              <Text style={styles.merdekaBadgeText}>Kurikulum Merdeka</Text>
            </View>
          </View>
          <Text style={styles.headerSubtitle}>{schoolName} • T.A. {currentAYName}</Text>
        </View>
        <TouchableOpacity 
          style={styles.settingIconBtn}
          onPress={() => setIsWeightModalOpen(true)}
          activeOpacity={0.7}
        >
          <Feather name="sliders" size={20} color="#0284C7" />
        </TouchableOpacity>
      </View>

      {/* 3 Main Segmented Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'rekap' && styles.tabBtnActive]}
          onPress={() => setActiveTab('rekap')}
          activeOpacity={0.8}
        >
          <Ionicons 
            name="bar-chart-outline" 
            size={18} 
            color={activeTab === 'rekap' ? '#0284C7' : '#64748B'} 
          />
          <Text style={[styles.tabBtnText, activeTab === 'rekap' && styles.tabBtnTextActive]}>
            Rekap Nilai
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'cetak' && styles.tabBtnActive]}
          onPress={() => setActiveTab('cetak')}
          activeOpacity={0.8}
        >
          <Ionicons 
            name="document-text-outline" 
            size={18} 
            color={activeTab === 'cetak' ? '#0284C7' : '#64748B'} 
          />
          <Text style={[styles.tabBtnText, activeTab === 'cetak' && styles.tabBtnTextActive]}>
            Lembar Rapor
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'kkm' && styles.tabBtnActive]}
          onPress={() => setActiveTab('kkm')}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons 
            name="book-check-outline" 
            size={18} 
            color={activeTab === 'kkm' ? '#0284C7' : '#64748B'} 
          />
          <Text style={[styles.tabBtnText, activeTab === 'kkm' && styles.tabBtnTextActive]}>
            Standar KKM
          </Text>
        </TouchableOpacity>
      </View>

      {/* Main Content Area */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0284C7" />
          <Text style={styles.loadingText}>Memuat modul E-Rapor & Penilaian...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollContent}
          contentContainerStyle={{ paddingBottom: 110 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} colors={['#0284C7']} />
          }
        >
          {/* ======================================================== */}
          {/* TAB 1: REKAP NILAI SISWA (FORMATIF & SUMATIF)            */}
          {/* ======================================================== */}
          {activeTab === 'rekap' && (
            <View style={styles.tabContent}>
              {/* Class Selector Ribbon */}
              <View style={styles.filterSection}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionHeading}>Pilih Rombel / Kelas:</Text>
                  <Text style={styles.badgeCount}>{classes.length} Rombel</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
                  {classes.map(c => {
                    const isSelected = String(c.id) === selectedClassId;
                    return (
                      <TouchableOpacity
                        key={c.id}
                        style={[styles.chipItem, isSelected && styles.chipItemActive]}
                        onPress={() => handleSelectClass(String(c.id))}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                          Kelas {c.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Subject Selector Ribbon */}
              <View style={[styles.filterSection, { marginTop: 12 }]}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionHeading}>Pilih Mata Pelajaran:</Text>
                  <Text style={styles.badgeCount}>{subjects.length} Mapel</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
                  {subjects.map(s => {
                    const isSelected = String(s.id) === selectedSubjectId;
                    return (
                      <TouchableOpacity
                        key={s.id}
                        style={[styles.subjectChip, isSelected && styles.subjectChipActive]}
                        onPress={() => handleSelectSubject(String(s.id))}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.subjectCode, isSelected && styles.subjectCodeActive]}>
                          {s.code || 'MAPEL'}
                        </Text>
                        <Text style={[styles.subjectName, isSelected && styles.subjectNameActive]} numberOfLines={1}>
                          {s.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Statistics Overview Card */}
              <View style={styles.overviewCard}>
                <View style={styles.overviewHeader}>
                  <View>
                    <Text style={styles.overviewTitle}>
                      {currentSubject?.name || 'Mata Pelajaran'} • Kelas {currentClassName}
                    </Text>
                    <Text style={styles.overviewSubtitle}>Standar KKM: 75 • Skala 0 - 100</Text>
                  </View>
                  <TouchableOpacity 
                    style={styles.weightConfigPill}
                    onPress={() => setIsWeightModalOpen(true)}
                    activeOpacity={0.8}
                  >
                    <Feather name="settings" size={13} color="#0284C7" />
                    <Text style={styles.weightConfigPillText}>Atur Bobot</Text>
                  </TouchableOpacity>
                </View>

                {/* 4 Stat Boxes */}
                <View style={styles.statGrid}>
                  <View style={styles.statBox}>
                    <Text style={styles.statValue}>{classAvg}</Text>
                    <Text style={styles.statLabel}>Rata-rata Kelas</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={[styles.statValue, { color: '#10B981' }]}>{highestScore}</Text>
                    <Text style={styles.statLabel}>Nilai Tertinggi</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={[styles.statValue, { color: '#EF4444' }]}>{lowestScore}</Text>
                    <Text style={styles.statLabel}>Nilai Terendah</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={[styles.statValue, { color: '#0EA5E9' }]}>{passRate}%</Text>
                    <Text style={styles.statLabel}>Ketuntasan</Text>
                  </View>
                </View>

                {/* Live Weights Bar */}
                <View style={styles.weightBar}>
                  <Text style={styles.weightBarLabel}>Komposisi Bobot Aktif:</Text>
                  <View style={styles.weightBadgesRow}>
                    <View style={[styles.weightPill, { backgroundColor: '#E0F2FE' }]}>
                      <Text style={[styles.weightPillText, { color: '#0369A1' }]}>
                        Harian: {gradeWeights.weight_harian}%
                      </Text>
                    </View>
                    <View style={[styles.weightPill, { backgroundColor: '#FEF3C7' }]}>
                      <Text style={[styles.weightPillText, { color: '#B45309' }]}>
                        UTS: {gradeWeights.weight_uts}%
                      </Text>
                    </View>
                    <View style={[styles.weightPill, { backgroundColor: '#FEE2E2' }]}>
                      <Text style={[styles.weightPillText, { color: '#B91C1C' }]}>
                        UAS: {gradeWeights.weight_uas}%
                      </Text>
                    </View>
                    {gradeWeights.weight_praktik > 0 && (
                      <View style={[styles.weightPill, { backgroundColor: '#DCFCE7' }]}>
                        <Text style={[styles.weightPillText, { color: '#15803D' }]}>
                          Praktik: {gradeWeights.weight_praktik}%
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>

              {/* Action Toolbar: Search & Input Nilai Manual Button */}
              <View style={styles.toolbarSection}>
                <View style={styles.searchBox}>
                  <Feather name="search" size={17} color="#94A3B8" />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Cari siswa / NISN..."
                    placeholderTextColor="#94A3B8"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                  />
                  {searchQuery ? (
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                      <Feather name="x" size={16} color="#94A3B8" />
                    </TouchableOpacity>
                  ) : null}
                </View>

                <TouchableOpacity 
                  style={styles.addGradeBtn}
                  onPress={openManualInputModal}
                  activeOpacity={0.8}
                >
                  <Feather name="plus-circle" size={16} color="#FFF" />
                  <Text style={styles.addGradeBtnText}>Input Nilai</Text>
                </TouchableOpacity>
              </View>

              {/* Student Grade Cards List */}
              {isLoadingGrades ? (
                <View style={styles.subLoadingContainer}>
                  <ActivityIndicator size="small" color="#0284C7" />
                  <Text style={styles.subLoadingText}>Memuat lembar penilaian...</Text>
                </View>
              ) : filteredGrades.length === 0 ? (
                <View style={styles.emptyCard}>
                  <MaterialCommunityIcons name="clipboard-text-off-outline" size={48} color="#CBD5E1" />
                  <Text style={styles.emptyTitle}>Belum Ada Nilai Terdata</Text>
                  <Text style={styles.emptyDesc}>
                    Silakan gunakan tombol "+ Input Nilai" di atas untuk memasukkan tugas harian, kuis, atau ujian.
                  </Text>
                </View>
              ) : (
                <View style={styles.gradesList}>
                  {filteredGrades.map((student, idx) => {
                    const finalScore = Number(student.final_score || 0);
                    const pred = getPredicate(finalScore);
                    const isPassed = finalScore >= 75;

                    return (
                      <TouchableOpacity
                        key={student.student_id || idx}
                        style={styles.gradeCard}
                        onPress={() => setSelectedStudentDetail(student)}
                        activeOpacity={0.85}
                      >
                        <View style={styles.gradeCardTop}>
                          <View style={styles.studentInfoRow}>
                            <View style={styles.avatarWrapper}>
                              {renderAvatar(student.gender, null, student.name)}
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.studentName} numberOfLines={1}>{student.name}</Text>
                              <Text style={styles.studentNis}>
                                NISN: {student.nisn || student.nis || '-'} • No. {idx + 1}
                              </Text>
                            </View>
                          </View>

                          {/* Final Score & Predicate Badge */}
                          <View style={styles.finalScoreCol}>
                            <Text style={[styles.finalScoreValue, { color: isPassed ? '#0369A1' : '#EF4444' }]}>
                              {finalScore > 0 ? finalScore.toFixed(1) : '0'}
                            </Text>
                            <View style={[styles.predicateBadge, { backgroundColor: pred.bg }]}>
                              <Text style={[styles.predicateText, { color: pred.color }]}>
                                Predikat {pred.code}
                              </Text>
                            </View>
                          </View>
                        </View>

                        {/* Breakdown Pills: Harian, UTS, UAS, Praktik */}
                        <View style={styles.breakdownRow}>
                          <View style={styles.breakdownItem}>
                            <Text style={styles.breakdownLabel}>Harian</Text>
                            <Text style={styles.breakdownValue}>
                              {student.avg_harian > 0 ? student.avg_harian.toFixed(1) : '-'}
                            </Text>
                          </View>
                          <View style={styles.breakdownDivider} />
                          <View style={styles.breakdownItem}>
                            <Text style={styles.breakdownLabel}>UTS</Text>
                            <Text style={styles.breakdownValue}>
                              {student.uts !== null && student.uts !== undefined ? Number(student.uts).toFixed(1) : '-'}
                            </Text>
                          </View>
                          <View style={styles.breakdownDivider} />
                          <View style={styles.breakdownItem}>
                            <Text style={styles.breakdownLabel}>UAS</Text>
                            <Text style={styles.breakdownValue}>
                              {student.uas !== null && student.uas !== undefined ? Number(student.uas).toFixed(1) : '-'}
                            </Text>
                          </View>
                          <View style={styles.breakdownDivider} />
                          <View style={styles.breakdownItem}>
                            <Text style={styles.breakdownLabel}>Praktik</Text>
                            <Text style={styles.breakdownValue}>
                              {student.praktik > 0 ? Number(student.praktik).toFixed(1) : '-'}
                            </Text>
                          </View>
                          <View style={styles.detailPill}>
                            <Feather name="chevron-right" size={15} color="#94A3B8" />
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {/* ======================================================== */}
          {/* TAB 2: CETAK & REVIEW E-RAPOR SISWA                      */}
          {/* ======================================================== */}
          {activeTab === 'cetak' && (
            <View style={styles.tabContent}>
              {/* Class Selector Ribbon */}
              <View style={styles.filterSection}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionHeading}>Pilih Rombel / Kelas:</Text>
                  <Text style={styles.badgeCount}>{classes.length} Rombel</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
                  {classes.map(c => {
                    const isSelected = String(c.id) === selectedClassId;
                    return (
                      <TouchableOpacity
                        key={c.id}
                        style={[styles.chipItem, isSelected && styles.chipItemActive]}
                        onPress={() => handleSelectClass(String(c.id))}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                          Kelas {c.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Banner Info Cetak */}
              <View style={styles.infoBanner}>
                <View style={styles.infoBannerIcon}>
                  <Ionicons name="school" size={24} color="#0284C7" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoBannerTitle}>Pusat Penerbitan Rapor Resmi</Text>
                  <Text style={styles.infoBannerDesc}>
                    Lembar Laporan Hasil Belajar (LHB) resmi mencakup rekap seluruh mata pelajaran, nilai harian, nilai akhir, serta tanda tangan digital wali kelas & kepala sekolah.
                  </Text>
                </View>
              </View>

              {/* Search Box */}
              <View style={[styles.searchBox, { marginTop: 14 }]}>
                <Feather name="search" size={17} color="#94A3B8" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Cari siswa untuk cetak rapor..."
                  placeholderTextColor="#94A3B8"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {searchQuery ? (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <Feather name="x" size={16} color="#94A3B8" />
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* Student Report Cards List */}
              {isLoadingReports ? (
                <View style={styles.subLoadingContainer}>
                  <ActivityIndicator size="small" color="#0284C7" />
                  <Text style={styles.subLoadingText}>Memuat data siswa kelas {currentClassName}...</Text>
                </View>
              ) : filteredReportStudents.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Feather name="users" size={44} color="#CBD5E1" />
                  <Text style={styles.emptyTitle}>Tidak Ada Siswa di Kelas Ini</Text>
                  <Text style={styles.emptyDesc}>Pilih rombel lain dari daftar di atas.</Text>
                </View>
              ) : (
                <View style={[styles.gradesList, { marginTop: 14 }]}>
                  {filteredReportStudents.map((st, idx) => (
                    <View key={st.id || idx} style={styles.reportStudentCard}>
                      <View style={styles.studentInfoRow}>
                        <View style={styles.avatarWrapper}>
                          {renderAvatar(st.gender, null, st.name)}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.studentName} numberOfLines={1}>{st.name}</Text>
                          <Text style={styles.studentNis}>
                            NISN: {st.nisn || st.nis || '-'} • Kelas {currentClassName}
                          </Text>
                        </View>
                        <View style={styles.reportReadyBadge}>
                          <Text style={styles.reportReadyText}>Siap Cetak</Text>
                        </View>
                      </View>

                      <View style={styles.reportCardActions}>
                        <TouchableOpacity
                          style={styles.viewReportBtn}
                          onPress={() => openStudentReportModal(st)}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="eye-outline" size={16} color="#0284C7" />
                          <Text style={styles.viewReportBtnText}>Lihat Lembar Rapor</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.printActionBtn}
                          onPress={() => openStudentReportModal(st)}
                          activeOpacity={0.8}
                        >
                          <Feather name="printer" size={16} color="#FFF" />
                          <Text style={styles.printActionBtnText}>Cetak</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* ======================================================== */}
          {/* TAB 3: STANDAR KKM & CAPAIAN PEMBELAJARAN                 */}
          {/* ======================================================== */}
          {activeTab === 'kkm' && (
            <View style={styles.tabContent}>
              {/* Standar Predikat Banner */}
              <View style={styles.kkmReferenceCard}>
                <View style={styles.kkmHeaderRow}>
                  <MaterialCommunityIcons name="scale-balance" size={22} color="#0284C7" />
                  <Text style={styles.kkmTitle}>Rentang Nilai & Predikat Resmi</Text>
                </View>
                <Text style={styles.kkmSubtitle}>
                  Standar Kriteria Ketuntasan Minimal (KKM) Nasional: 75.0
                </Text>

                <View style={styles.predicateGrid}>
                  <View style={[styles.predCard, { borderLeftColor: '#10B981' }]}>
                    <Text style={[styles.predScore, { color: '#10B981' }]}>91 - 100</Text>
                    <Text style={styles.predGrade}>Predikat A (Sangat Baik)</Text>
                    <Text style={styles.predDesc}>Sangat menguasai seluruh capaian pembelajaran.</Text>
                  </View>
                  <View style={[styles.predCard, { borderLeftColor: '#0EA5E9' }]}>
                    <Text style={[styles.predScore, { color: '#0EA5E9' }]}>81 - 90</Text>
                    <Text style={styles.predGrade}>Predikat B (Baik)</Text>
                    <Text style={styles.predDesc}>Menguasai sebagian besar capaian pembelajaran.</Text>
                  </View>
                  <View style={[styles.predCard, { borderLeftColor: '#F59E0B' }]}>
                    <Text style={[styles.predScore, { color: '#F59E0B' }]}>71 - 80</Text>
                    <Text style={styles.predGrade}>Predikat C (Cukup - Tuntas)</Text>
                    <Text style={styles.predDesc}>Memenuhi kriteria ketuntasan minimal.</Text>
                  </View>
                  <View style={[styles.predCard, { borderLeftColor: '#EF4444' }]}>
                    <Text style={[styles.predScore, { color: '#EF4444' }]}>{'< 71'}</Text>
                    <Text style={styles.predGrade}>Predikat D (Perlu Bimbingan)</Text>
                    <Text style={styles.predDesc}>Belum mencapai kriteria ketuntasan kompetensi.</Text>
                  </View>
                </View>
              </View>

              {/* Subject KKM Table */}
              <View style={[styles.filterSection, { marginTop: 18 }]}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionHeading}>Daftar Mata Pelajaran & Beban Jam:</Text>
                  <Text style={styles.badgeCount}>{subjects.length} Mapel</Text>
                </View>

                <View style={styles.subjectKkmList}>
                  {subjects.map((sub, idx) => (
                    <View key={sub.id || idx} style={styles.subjectKkmRow}>
                      <View style={styles.subjectKkmLeft}>
                        <View style={styles.subIndexBadge}>
                          <Text style={styles.subIndexText}>{idx + 1}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.subKkmName}>{sub.name}</Text>
                          <Text style={styles.subKkmCode}>
                            Kode: {sub.code || '-'} • Beban: {sub.hours_per_week || 2} Jam/Minggu
                          </Text>
                        </View>
                      </View>
                      <View style={styles.subKkmRight}>
                        <View style={styles.kkmScoreBadge}>
                          <Text style={styles.kkmScoreLabel}>KKM</Text>
                          <Text style={styles.kkmScoreVal}>{sub.kkm || 75}</Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          )}
        </ScrollView>
      )}

      {/* ======================================================== */}
      {/* MODAL 1: ATUR BOBOT NILAI (WEIGHTS CONFIG)               */}
      {/* ======================================================== */}
      <Modal visible={isWeightModalOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <Feather name="sliders" size={20} color="#0284C7" />
                <Text style={styles.modalTitle}>Konfigurasi Bobot Nilai</Text>
              </View>
              <TouchableOpacity onPress={() => setIsWeightModalOpen(false)}>
                <Feather name="x" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Mata Pelajaran: {currentSubject?.name || 'Umum'} (Total harus pas 100%)
            </Text>

            <View style={styles.weightForm}>
              <View style={styles.weightInputGroup}>
                <Text style={styles.inputLabel}>Bobot Nilai Harian / Tugas (%)</Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="numeric"
                  value={tempWeights.weight_harian}
                  onChangeText={v => setTempWeights(p => ({ ...p, weight_harian: v }))}
                />
              </View>

              <View style={styles.weightInputGroup}>
                <Text style={styles.inputLabel}>Bobot UTS / Sumatif Tengah (%)</Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="numeric"
                  value={tempWeights.weight_uts}
                  onChangeText={v => setTempWeights(p => ({ ...p, weight_uts: v }))}
                />
              </View>

              <View style={styles.weightInputGroup}>
                <Text style={styles.inputLabel}>Bobot UAS / Sumatif Akhir (%)</Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="numeric"
                  value={tempWeights.weight_uas}
                  onChangeText={v => setTempWeights(p => ({ ...p, weight_uas: v }))}
                />
              </View>

              <View style={styles.weightInputGroup}>
                <Text style={styles.inputLabel}>Bobot Praktik / Kinerja (%)</Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="numeric"
                  value={tempWeights.weight_praktik}
                  onChangeText={v => setTempWeights(p => ({ ...p, weight_praktik: v }))}
                />
              </View>

              {/* Total Check */}
              {(() => {
                const tot = (parseInt(tempWeights.weight_harian || '0', 10) +
                  parseInt(tempWeights.weight_uts || '0', 10) +
                  parseInt(tempWeights.weight_uas || '0', 10) +
                  parseInt(tempWeights.weight_praktik || '0', 10));
                const isValid = tot === 100;
                return (
                  <View style={[styles.weightTotalBanner, { backgroundColor: isValid ? '#ECFDF5' : '#FEF2F2' }]}>
                    <Text style={[styles.weightTotalText, { color: isValid ? '#059669' : '#DC2626' }]}>
                      Total Bobot: {tot}% {isValid ? '✓ Sesuai (100%)' : '✕ Harus 100%'}
                    </Text>
                  </View>
                );
              })()}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setIsWeightModalOpen(false)}
              >
                <Text style={styles.cancelBtnText}>Batal</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={handleSaveWeights}
                disabled={isSavingWeights}
              >
                {isSavingWeights ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.confirmBtnText}>Simpan Bobot</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL 2: INPUT NILAI MANUAL (HARIAN / TUGAS / PRAKTIK)    */}
      {/* ======================================================== */}
      <Modal visible={isManualModalOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { maxHeight: '90%' }]}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <Feather name="edit-3" size={20} color="#0284C7" />
                <Text style={styles.modalTitle}>Input Nilai Baru</Text>
              </View>
              <TouchableOpacity onPress={() => setIsManualModalOpen(false)}>
                <Feather name="x" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              {currentSubject?.name} • Kelas {currentClassName} ({gradeSummary.length} Siswa)
            </Text>

            {/* Type selector */}
            <View style={styles.typeSelectorRow}>
              {(['Ujian Harian', 'Tugas', 'Praktik', 'UTS', 'UAS'] as const).map(t => (
                <TouchableOpacity
                  key={t}
                  style={[styles.typePill, manualType === t && styles.typePillActive]}
                  onPress={() => setManualType(t)}
                >
                  <Text style={[styles.typePillText, manualType === t && styles.typePillTextActive]}>
                    {t}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Title & Date */}
            <View style={styles.manualMetaRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Judul Penilaian / Materi</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Misal: UH Bab 2 Aljabar"
                  placeholderTextColor="#94A3B8"
                  value={manualTitle}
                  onChangeText={setManualTitle}
                />
              </View>
            </View>

            {/* Bulk set quick action */}
            <View style={styles.bulkRow}>
              <Text style={styles.bulkLabel}>Isi Cepat Semua:</Text>
              <TextInput
                style={styles.bulkInput}
                placeholder="Misal: 85"
                keyboardType="numeric"
                value={bulkScoreInput}
                onChangeText={setBulkScoreInput}
              />
              <TouchableOpacity style={styles.bulkBtn} onPress={handleApplyBulkScore}>
                <Text style={styles.bulkBtnText}>Terapkan</Text>
              </TouchableOpacity>
            </View>

            {/* Student Scores List */}
            <ScrollView style={styles.scoreInputList} showsVerticalScrollIndicator={false}>
              {gradeSummary.map((st, i) => (
                <View key={st.student_id} style={styles.scoreInputRow}>
                  <View style={styles.scoreStudentInfo}>
                    <Text style={styles.scoreStudentIndex}>{i + 1}.</Text>
                    <Text style={styles.scoreStudentName} numberOfLines={1}>{st.name}</Text>
                  </View>
                  <TextInput
                    style={styles.scoreInputField}
                    placeholder="0"
                    placeholderTextColor="#CBD5E1"
                    keyboardType="numeric"
                    value={manualScores[st.student_id] || ''}
                    onChangeText={val => setManualScores(prev => ({ ...prev, [st.student_id]: val }))}
                  />
                </View>
              ))}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setIsManualModalOpen(false)}
              >
                <Text style={styles.cancelBtnText}>Batal</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={handleSaveManualGrades}
                disabled={isSavingManual}
              >
                {isSavingManual ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.confirmBtnText}>Simpan Nilai</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL 3: RINCIAN NILAI SISWA (BREAKDOWN KOMPREHENSIF)     */}
      {/* ======================================================== */}
      <Modal visible={!!selectedStudentDetail} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { maxHeight: '85%' }]}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <Feather name="file-text" size={20} color="#0284C7" />
                <Text style={styles.modalTitle}>Rincian Penilaian Siswa</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedStudentDetail(null)}>
                <Feather name="x" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {selectedStudentDetail && (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Student Bio Card */}
                <View style={styles.detailBioCard}>
                  <View style={styles.avatarWrapperLarge}>
                    {renderAvatar(selectedStudentDetail.gender, null, selectedStudentDetail.name)}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.detailStudentName}>{selectedStudentDetail.name}</Text>
                    <Text style={styles.detailStudentMeta}>
                      NISN: {selectedStudentDetail.nisn || selectedStudentDetail.nis || '-'}
                    </Text>
                    <Text style={styles.detailStudentMeta}>
                      Kelas {currentClassName} • {currentSubject?.name}
                    </Text>
                  </View>
                  <View style={styles.finalScoreBubble}>
                    <Text style={styles.finalScoreBubbleVal}>
                      {Number(selectedStudentDetail.final_score || 0).toFixed(1)}
                    </Text>
                    <Text style={styles.finalScoreBubbleLabel}>Nilai Akhir</Text>
                  </View>
                </View>

                {/* Section Harian / Tugas Details */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>
                    1. Riwayat Ujian Harian / Formatif ({selectedStudentDetail.harian_details?.length || 0})
                  </Text>
                  {(!selectedStudentDetail.harian_details || selectedStudentDetail.harian_details.length === 0) ? (
                    <Text style={styles.detailEmptyText}>Belum ada riwayat ujian harian.</Text>
                  ) : (
                    selectedStudentDetail.harian_details.map((hd, i) => (
                      <View key={i} style={styles.detailItemRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.detailItemTitle}>{hd.title}</Text>
                          <Text style={styles.detailItemMeta}>
                            Sumber: {hd.source} • {hd.date ? String(hd.date).split('T')[0] : 'Hari Ini'}
                          </Text>
                        </View>
                        <Text style={styles.detailItemScore}>{hd.score}</Text>
                      </View>
                    ))
                  )}
                </View>

                {/* Section Tugas Details */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>
                    2. Riwayat Nilai Praktik / Kinerja ({selectedStudentDetail.praktik_details?.length || 0})
                  </Text>
                  {(!selectedStudentDetail.praktik_details || selectedStudentDetail.praktik_details.length === 0) ? (
                    <Text style={styles.detailEmptyText}>Belum ada riwayat praktik.</Text>
                  ) : (
                    selectedStudentDetail.praktik_details.map((pd, i) => (
                      <View key={i} style={styles.detailItemRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.detailItemTitle}>{pd.title}</Text>
                          <Text style={styles.detailItemMeta}>
                            {pd.date ? String(pd.date).split('T')[0] : '-'}
                          </Text>
                        </View>
                        <Text style={styles.detailItemScore}>{pd.score}</Text>
                      </View>
                    ))
                  )}
                </View>

                {/* Sumatif UTS & UAS */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>3. Sumatif Tengah & Akhir Semester</Text>
                  <View style={styles.detailItemRow}>
                    <Text style={styles.detailItemTitle}>UTS (Ujian Tengah Semester)</Text>
                    <Text style={styles.detailItemScore}>
                      {selectedStudentDetail.uts !== null && selectedStudentDetail.uts !== undefined 
                        ? Number(selectedStudentDetail.uts).toFixed(1) : '-'}
                    </Text>
                  </View>
                  <View style={styles.detailItemRow}>
                    <Text style={styles.detailItemTitle}>UAS (Ujian Akhir Semester)</Text>
                    <Text style={styles.detailItemScore}>
                      {selectedStudentDetail.uas !== null && selectedStudentDetail.uas !== undefined 
                        ? Number(selectedStudentDetail.uas).toFixed(1) : '-'}
                    </Text>
                  </View>
                </View>
              </ScrollView>
            )}

            <TouchableOpacity
              style={styles.closeDetailBtn}
              onPress={() => setSelectedStudentDetail(null)}
            >
              <Text style={styles.closeDetailBtnText}>Tutup Rincian</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL 4: LEMBAR E-RAPOR RESMI (OFFICIAL REPORT SHEET)    */}
      {/* ======================================================== */}
      <Modal visible={isReportCardModalOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { maxHeight: '92%', padding: 0 }]}>
            {/* Modal Title Bar */}
            <View style={[styles.modalHeader, { paddingHorizontal: 16, paddingTop: 16 }]}>
              <View style={styles.modalTitleRow}>
                <Ionicons name="document-text" size={20} color="#0284C7" />
                <Text style={styles.modalTitle}>Lembar Laporan Hasil Belajar (LHB)</Text>
              </View>
              <TouchableOpacity onPress={() => setIsReportCardModalOpen(false)}>
                <Feather name="x" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {isLoadingSingleReport ? (
              <View style={[styles.loadingContainer, { padding: 40 }]}>
                <ActivityIndicator size="large" color="#0284C7" />
                <Text style={styles.loadingText}>Menyiapkan Lembar Rapor Siswa...</Text>
              </View>
            ) : (
              <ScrollView style={styles.reportSheetScroll} showsVerticalScrollIndicator={false}>
                {/* Official Kop Surat */}
                <View style={styles.kopSurat}>
                  <Image source={logoOfficial} style={styles.kopLogo} />
                  <View style={styles.kopTextWrapper}>
                    <Text style={styles.kopSchoolName}>{schoolName.toUpperCase()}</Text>
                    <Text style={styles.kopSchoolAddress}>
                      Jl. Raya Pendidikan No. 01 • Akreditasi A • NPSN: 20214567
                    </Text>
                    <Text style={styles.kopSchoolContact}>
                      Email: info@sipena.sch.id • Website: https://sipena.sch.id
                    </Text>
                  </View>
                </View>
                <View style={styles.kopDividerThick} />
                <View style={styles.kopDividerThin} />

                {/* Report Title */}
                <View style={styles.reportTitleContainer}>
                  <Text style={styles.reportSheetHeading}>LAPORAN HASIL BELAJAR PESERTA DIDIK</Text>
                  <Text style={styles.reportSheetSubheading}>
                    KURIKULUM MERDEKA • TAHUN AJARAN {currentAYName}
                  </Text>
                </View>

                {/* Student Identity Grid */}
                <View style={styles.reportBioGrid}>
                  <View style={styles.bioCol}>
                    <View style={styles.bioRow}>
                      <Text style={styles.bioLabel}>Nama Siswa</Text>
                      <Text style={styles.bioColon}>:</Text>
                      <Text style={styles.bioVal} numberOfLines={1}>{reportStudentData?.name}</Text>
                    </View>
                    <View style={styles.bioRow}>
                      <Text style={styles.bioLabel}>NIS / NISN</Text>
                      <Text style={styles.bioColon}>:</Text>
                      <Text style={styles.bioVal}>
                        {reportStudentData?.nis || '-'} / {reportStudentData?.nisn || '-'}
                      </Text>
                    </View>
                    <View style={styles.bioRow}>
                      <Text style={styles.bioLabel}>Kelas / Rombel</Text>
                      <Text style={styles.bioColon}>:</Text>
                      <Text style={styles.bioVal}>{currentClassName}</Text>
                    </View>
                  </View>

                  <View style={styles.bioCol}>
                    <View style={styles.bioRow}>
                      <Text style={styles.bioLabel}>Semester</Text>
                      <Text style={styles.bioColon}>:</Text>
                      <Text style={styles.bioVal}>1 (Ganjil)</Text>
                    </View>
                    <View style={styles.bioRow}>
                      <Text style={styles.bioLabel}>Fase</Text>
                      <Text style={styles.bioColon}>:</Text>
                      <Text style={styles.bioVal}>Fase E</Text>
                    </View>
                    <View style={styles.bioRow}>
                      <Text style={styles.bioLabel}>Tahun Ajaran</Text>
                      <Text style={styles.bioColon}>:</Text>
                      <Text style={styles.bioVal}>{currentAYName}</Text>
                    </View>
                  </View>
                </View>

                {/* Table of Grades */}
                <View style={styles.reportTableContainer}>
                  {/* Table Header */}
                  <View style={styles.reportTableHeader}>
                    <Text style={[styles.thCell, { width: 32, textAlign: 'center' }]}>No</Text>
                    <Text style={[styles.thCell, { flex: 1 }]}>Mata Pelajaran</Text>
                    <Text style={[styles.thCell, { width: 44, textAlign: 'center' }]}>KKM</Text>
                    <Text style={[styles.thCell, { width: 48, textAlign: 'center' }]}>Akhir</Text>
                    <Text style={[styles.thCell, { width: 48, textAlign: 'center' }]}>Predikat</Text>
                  </View>

                  {/* Table Rows */}
                  {reportGrades.map((g, idx) => {
                    const finalSc = Number(g.final_score || 0);
                    const pred = getPredicate(finalSc);

                    return (
                      <View key={g.subject_id || idx} style={[styles.reportTableRow, idx % 2 === 1 && styles.tableRowAlt]}>
                        <Text style={[styles.tdCell, { width: 32, textAlign: 'center' }]}>{idx + 1}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.tdSubjectName}>{g.subject_name}</Text>
                          <Text style={styles.tdSubjectMeta}>
                            Harian: {g.avg_harian || 0} • UTS: {g.uts || 0} • UAS: {g.uas || 0}
                          </Text>
                        </View>
                        <Text style={[styles.tdCell, { width: 44, textAlign: 'center', color: '#64748B' }]}>75</Text>
                        <Text style={[styles.tdCell, { width: 48, textAlign: 'center', fontWeight: '700', color: finalSc >= 75 ? '#0369A1' : '#EF4444' }]}>
                          {finalSc.toFixed(1)}
                        </Text>
                        <View style={{ width: 48, alignItems: 'center' }}>
                          <View style={[styles.miniPredBadge, { backgroundColor: pred.bg }]}>
                            <Text style={[styles.miniPredText, { color: pred.color }]}>{pred.code}</Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}

                  {/* Average Summary Row */}
                  {(() => {
                    const finals = reportGrades.map(r => Number(r.final_score || 0));
                    const totalAvg = finals.length > 0 ? (finals.reduce((a, b) => a + b, 0) / finals.length).toFixed(1) : '0';
                    return (
                      <View style={styles.reportTableFooter}>
                        <Text style={styles.footerLabel}>RATA-RATA NILAI AKHIR SISWA</Text>
                        <Text style={styles.footerValue}>{totalAvg}</Text>
                      </View>
                    );
                  })()}
                </View>

                {/* Signatures Block (Orang Tua, Wali Kelas, Kepala Sekolah) */}
                <View style={styles.signaturesContainer}>
                  <View style={styles.signatureRowTop}>
                    <View style={styles.signBox}>
                      <Text style={styles.signRole}>Mengetahui,</Text>
                      <Text style={styles.signRole}>Orang Tua / Wali,</Text>
                      <View style={{ height: 45 }} />
                      <Text style={styles.signName}>( {reportParentName} )</Text>
                    </View>

                    <View style={styles.signBox}>
                      <Text style={styles.signRole}>Wali Kelas,</Text>
                      <Text style={styles.signRole}>Kelas {currentClassName}</Text>
                      <View style={{ height: 45 }} />
                      <Text style={styles.signName}>
                        {reportHomeroom?.name || '( Wali Kelas Belum Ditentukan )'}
                      </Text>
                      <Text style={styles.signNip}>NIP. {reportHomeroom?.nip || '-'}</Text>
                    </View>
                  </View>

                  {/* Center: Kepala Sekolah with Verified Seal */}
                  <View style={styles.principalSignBox}>
                    <Text style={styles.signRole}>Mengetahui,</Text>
                    <Text style={styles.signRole}>Kepala Sekolah</Text>
                    
                    {/* Digital Seal Stamp */}
                    <View style={styles.digitalSeal}>
                      <Ionicons name="checkmark-done-circle" size={14} color="#059669" />
                      <Text style={styles.digitalSealText}>TERVERIFIKASI SISTEM RESMI SIPENA</Text>
                    </View>

                    <Text style={styles.signName}>H. SODIKIN, S.Pd., M.M.</Text>
                    <Text style={styles.signNip}>NIP. 19700101 199501 1 001</Text>
                  </View>
                </View>
              </ScrollView>
            )}

            {/* Bottom Modal Actions */}
            <View style={[styles.modalActions, { paddingHorizontal: 16, paddingBottom: 16 }]}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setIsReportCardModalOpen(false)}
              >
                <Text style={styles.cancelBtnText}>Tutup</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.printFullBtn}
                onPress={() => {
                  showToast(
                    'Siap Dibagikan', 
                    `E-Rapor atas nama ${reportStudentData?.name} siap dibagikan ke portal orang tua atau dicetak PDF.`,
                    'success'
                  );
                }}
              >
                <Feather name="share-2" size={16} color="#FFF" />
                <Text style={styles.printFullBtnText}>Bagikan / Simpan</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ======================================================== */}
      {/* CUSTOM TOAST / ALERT MODAL (ZERO NATIVE ALERT)           */}
      {/* ======================================================== */}
      <Modal visible={!!toastMessage} transparent animationType="fade">
        <View style={styles.noticeOverlay}>
          <View style={styles.noticeCard}>
            <View style={[
              styles.noticeIconCircle, 
              toastMessage?.type === 'success' && { backgroundColor: '#ECFDF5' },
              toastMessage?.type === 'warning' && { backgroundColor: '#FFFBEB' },
              toastMessage?.type === 'error' && { backgroundColor: '#FEF2F2' }
            ]}>
              <Ionicons 
                name={
                  toastMessage?.type === 'success' ? 'checkmark-circle-outline' :
                  toastMessage?.type === 'warning' ? 'warning-outline' :
                  toastMessage?.type === 'error' ? 'alert-circle-outline' : 'information-circle-outline'
                } 
                size={28} 
                color={
                  toastMessage?.type === 'success' ? '#10B981' :
                  toastMessage?.type === 'warning' ? '#F59E0B' :
                  toastMessage?.type === 'error' ? '#EF4444' : '#0284C7'
                } 
              />
            </View>
            <Text style={styles.noticeTitle}>{toastMessage?.title}</Text>
            <Text style={styles.noticeDesc}>{toastMessage?.desc}</Text>
            <TouchableOpacity 
              style={[
                styles.noticeCloseBtn,
                toastMessage?.type === 'success' && { backgroundColor: '#10B981' },
                toastMessage?.type === 'warning' && { backgroundColor: '#F59E0B' },
                toastMessage?.type === 'error' && { backgroundColor: '#EF4444' }
              ]}
              onPress={() => setToastMessage(null)}
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
    backgroundColor: '#F8FAFC',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  headerTitleContainer: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  merdekaBadge: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  merdekaBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0284C7',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  settingIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E0F2FE',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // 3 Tabs
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 6,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    gap: 6,
  },
  tabBtnActive: {
    backgroundColor: '#E0F2FE',
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  tabBtnTextActive: {
    color: '#0284C7',
    fontWeight: '700',
  },

  scrollContent: {
    flex: 1,
  },
  tabContent: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  subLoadingContainer: {
    paddingVertical: 30,
    alignItems: 'center',
  },
  subLoadingText: {
    marginTop: 8,
    fontSize: 12,
    color: '#64748B',
  },

  // Filters
  filterSection: {
    marginBottom: 4,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  badgeCount: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  chipsScroll: {
    gap: 8,
  },
  chipItem: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chipItemActive: {
    backgroundColor: '#0284C7',
    borderColor: '#0284C7',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },

  subjectChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    maxWidth: 160,
  },
  subjectChipActive: {
    backgroundColor: '#0284C7',
    borderColor: '#0284C7',
  },
  subjectCode: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0284C7',
    letterSpacing: 0.5,
  },
  subjectCodeActive: {
    color: '#E0F2FE',
  },
  subjectName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    marginTop: 1,
  },
  subjectNameActive: {
    color: '#FFFFFF',
  },

  // Overview Card
  overviewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 },
      android: { elevation: 2 },
    }),
  },
  overviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  overviewTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  overviewSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  weightConfigPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 5,
  },
  weightConfigPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284C7',
  },
  statGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  statLabel: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
    textAlign: 'center',
  },
  weightBar: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
  },
  weightBarLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 6,
  },
  weightBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  weightPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  weightPillText: {
    fontSize: 10,
    fontWeight: '700',
  },

  // Toolbar
  toolbarSection: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
    marginBottom: 8,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
  },
  addGradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0284C7',
    paddingHorizontal: 14,
    height: 42,
    borderRadius: 10,
    gap: 6,
  },
  addGradeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Student Grades List
  gradesList: {
    gap: 10,
  },
  gradeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3 },
      android: { elevation: 1 },
    }),
  },
  gradeCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  studentInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  avatarWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#F1F5F9',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  studentName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  studentNis: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  finalScoreCol: {
    alignItems: 'flex-end',
  },
  finalScoreValue: {
    fontSize: 18,
    fontWeight: '900',
  },
  predicateBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 2,
  },
  predicateText: {
    fontSize: 10,
    fontWeight: '800',
  },

  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 8,
  },
  breakdownItem: {
    flex: 1,
    alignItems: 'center',
  },
  breakdownLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '500',
  },
  breakdownValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 1,
  },
  breakdownDivider: {
    width: 1,
    height: 18,
    backgroundColor: '#E2E8F0',
  },
  detailPill: {
    paddingLeft: 6,
  },

  // Empty Card
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 30,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 10,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
    marginTop: 10,
  },
  emptyDesc: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },

  // Tab 2: Info Banner & Report Cards
  infoBanner: {
    flexDirection: 'row',
    backgroundColor: '#E0F2FE',
    borderRadius: 10,
    padding: 12,
    gap: 12,
    alignItems: 'flex-start',
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  infoBannerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoBannerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0369A1',
  },
  infoBannerDesc: {
    fontSize: 11,
    color: '#0C4A6E',
    marginTop: 3,
    lineHeight: 16,
  },
  reportStudentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  reportReadyBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  reportReadyText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
  },
  reportCardActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 8,
  },
  viewReportBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F9FF',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  viewReportBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284C7',
  },
  printActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0284C7',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  printActionBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Tab 3: KKM & Predicates
  kkmReferenceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  kkmHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  kkmTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  kkmSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 3,
    marginBottom: 12,
  },
  predicateGrid: {
    gap: 8,
  },
  predCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
    borderLeftWidth: 4,
  },
  predScore: {
    fontSize: 13,
    fontWeight: '900',
  },
  predGrade: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 1,
  },
  predDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },

  subjectKkmList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  subjectKkmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  subjectKkmLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  subIndexBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  subIndexText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  subKkmName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  subKkmCode: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  subKkmRight: {
    alignItems: 'flex-end',
  },
  kkmScoreBadge: {
    alignItems: 'center',
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  kkmScoreLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: '#0369A1',
  },
  kkmScoreVal: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0284C7',
  },

  // Modals General
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalBox: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10 },
      android: { elevation: 6 },
    }),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 14,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: '#0284C7',
    alignItems: 'center',
  },
  confirmBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Weight Form
  weightForm: {
    gap: 10,
  },
  weightInputGroup: {
    gap: 4,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0F172A',
  },
  weightTotalBanner: {
    padding: 10,
    borderRadius: 8,
    marginTop: 4,
    alignItems: 'center',
  },
  weightTotalText: {
    fontSize: 12,
    fontWeight: '700',
  },

  // Manual Input Form
  typeSelectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  typePill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  typePillActive: {
    backgroundColor: '#0284C7',
  },
  typePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  typePillTextActive: {
    color: '#FFFFFF',
  },
  manualMetaRow: {
    marginBottom: 10,
  },
  bulkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    padding: 8,
    borderRadius: 8,
    gap: 8,
    marginBottom: 10,
  },
  bulkLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  bulkInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    width: 65,
    fontSize: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    textAlign: 'center',
  },
  bulkBtn: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  bulkBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  scoreInputList: {
    maxHeight: 220,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 10,
  },
  scoreInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  scoreStudentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  scoreStudentIndex: {
    fontSize: 12,
    color: '#94A3B8',
    width: 24,
  },
  scoreStudentName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E293B',
    flex: 1,
  },
  scoreInputField: {
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    width: 60,
    paddingVertical: 4,
    paddingHorizontal: 8,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '700',
    color: '#0284C7',
  },

  // Student Detail Modal
  detailBioCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    gap: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  avatarWrapperLarge: {
    width: 50,
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
    backgroundColor: '#E2E8F0',
  },
  detailStudentName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  detailStudentMeta: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  finalScoreBubble: {
    alignItems: 'center',
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  finalScoreBubbleVal: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0284C7',
  },
  finalScoreBubbleLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#0369A1',
  },
  detailSection: {
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    borderRadius: 10,
    padding: 10,
  },
  detailSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
  },
  detailEmptyText: {
    fontSize: 11,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  detailItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  detailItemTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  detailItemMeta: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 1,
  },
  detailItemScore: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0284C7',
  },
  closeDetailBtn: {
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  closeDetailBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },

  // Official Report Sheet
  reportSheetScroll: {
    paddingHorizontal: 16,
  },
  kopSurat: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 12,
  },
  kopLogo: {
    width: 44,
    height: 44,
    resizeMode: 'contain',
  },
  kopTextWrapper: {
    flex: 1,
  },
  kopSchoolName: {
    fontSize: 13,
    fontWeight: '900',
    color: '#023047',
    letterSpacing: 0.3,
  },
  kopSchoolAddress: {
    fontSize: 9,
    color: '#475569',
    marginTop: 1,
  },
  kopSchoolContact: {
    fontSize: 9,
    color: '#64748B',
  },
  kopDividerThick: {
    height: 2,
    backgroundColor: '#023047',
    marginTop: 4,
  },
  kopDividerThin: {
    height: 0.8,
    backgroundColor: '#023047',
    marginTop: 1.5,
    marginBottom: 10,
  },
  reportTitleContainer: {
    alignItems: 'center',
    marginBottom: 10,
  },
  reportSheetHeading: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0F172A',
    textAlign: 'center',
  },
  reportSheetSubheading: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 2,
  },
  reportBioGrid: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  bioCol: {
    flex: 1,
    gap: 4,
  },
  bioRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bioLabel: {
    width: 70,
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  bioColon: {
    width: 8,
    fontSize: 10,
    color: '#64748B',
  },
  bioVal: {
    flex: 1,
    fontSize: 10,
    fontWeight: '600',
    color: '#0F172A',
  },

  // Table
  reportTableContainer: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 12,
  },
  reportTableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#023047',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  thCell: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  reportTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  tableRowAlt: {
    backgroundColor: '#F8FAFC',
  },
  tdCell: {
    fontSize: 10,
    color: '#1E293B',
  },
  tdSubjectName: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0F172A',
  },
  tdSubjectMeta: {
    fontSize: 8.5,
    color: '#94A3B8',
  },
  miniPredBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  miniPredText: {
    fontSize: 9,
    fontWeight: '800',
  },
  reportTableFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#E0F2FE',
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  footerLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0369A1',
  },
  footerValue: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0284C7',
  },

  // Signatures
  signaturesContainer: {
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  signatureRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  signBox: {
    flex: 1,
    alignItems: 'center',
  },
  signRole: {
    fontSize: 10,
    color: '#475569',
  },
  signName: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
  },
  signNip: {
    fontSize: 9,
    color: '#64748B',
  },
  principalSignBox: {
    alignItems: 'center',
    paddingTop: 4,
  },
  digitalSeal: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  digitalSealText: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#059669',
  },
  printFullBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0284C7',
    paddingVertical: 11,
    borderRadius: 10,
    gap: 6,
  },
  printFullBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Notice / Custom Toast Modal
  noticeOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  noticeCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 22,
    alignItems: 'center',
  },
  noticeIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E0F2FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  noticeTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
    textAlign: 'center',
  },
  noticeDesc: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 18,
  },
  noticeCloseBtn: {
    backgroundColor: '#0284C7',
    paddingVertical: 11,
    paddingHorizontal: 30,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
  },
  noticeCloseText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
});
