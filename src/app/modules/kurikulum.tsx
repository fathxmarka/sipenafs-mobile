import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  ActivityIndicator, RefreshControl, TextInput, Platform, Modal, Image, FlatList
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Colors from '../../constants/Colors';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';

const avatarMale = require('../../../assets/images/avatar_male.png');
const avatarFemale = require('../../../assets/images/avatar_female.png');

type TabType = 'schedule' | 'journal' | 'subjects' | 'timeline';

const DAYS = [
  { value: 1, label: 'Senin' },
  { value: 2, label: 'Selasa' },
  { value: 3, label: 'Rabu' },
  { value: 4, label: 'Kamis' },
  { value: 5, label: 'Jumat' },
  { value: 6, label: 'Sabtu' },
];

const METHODS_LIST = [
  'Ceramah Interaktif',
  'Diskusi Kelompok',
  'Praktikum / Eksperimen',
  'Tanya Jawab',
  'Presentasi Siswa',
  'Problem Based Learning (PBL)'
];

const MEDIA_LIST = [
  'Papan Tulis & Spidol',
  'LCD Proyektor / Slide',
  'Buku Paket / Modul',
  'Laboratorium',
  'Laptop / Tablet'
];

interface ScheduleItem {
  id: number;
  class_id: number;
  subject_id: number;
  teacher_id: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
  subject?: { id: number; name: string; code?: string; kkm?: number };
  class?: { id: number; name: string };
  teacher?: { id: number; name: string; is_substitute?: boolean };
}

interface JournalItem {
  id: number | string;
  teacher_id: number | string;
  class_id: number;
  subject_id: number;
  date: string;
  start_time: string;
  end_time: string;
  topic?: string;
  description?: string;
  methods?: string;
  media?: string;
  is_completed?: boolean;
  teacher?: { id: number | string; name: string };
  class?: { id: number; name: string };
  subject?: { id: number; name: string };
  teacher_reviews?: any[];
}

interface SubjectItem {
  id: number;
  name: string;
  code?: string;
  group?: string;
  kkm?: number;
  hours_per_week?: number;
}

interface StudentItem {
  id: string;
  name: string;
  nis?: string;
  nisn?: string;
  gender?: string;
}

export default function KurikulumScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Determine current day of week (1 = Monday ... 6 = Saturday)
  const currentDayIndex = new Date().getDay(); // 0 is Sunday, 1 is Monday
  const defaultDay = currentDayIndex === 0 ? 1 : Math.min(6, currentDayIndex);

  const [activeTab, setActiveTab] = useState<TabType>('schedule');
  const [selectedDay, setSelectedDay] = useState<number>(defaultDay);
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [apiBaseUrl, setApiBaseUrl] = useState('');
  const [token, setToken] = useState('');
  const [userRole, setUserRole] = useState('');
  const [teacherId, setTeacherId] = useState<string | null>(null);

  // Data states
  const [schedulesList, setSchedulesList] = useState<ScheduleItem[]>([]);
  const [subjectsList, setSubjectsList] = useState<any[]>([]);
  const [classesList, setClassesList] = useState<any[]>([]);
  const [journalsList, setJournalsList] = useState<JournalItem[]>([]);

  // Jurnal Date Filter (Default Hari Ini: YYYY-MM-DD)
  const [journalDate, setJournalDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Detail Modal state
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleItem | null>(null);

  // Formulir Jurnal Mengajar Modal state
  const [isJournalFormOpen, setIsJournalFormOpen] = useState(false);
  const [activeScheduleForJournal, setActiveScheduleForJournal] = useState<ScheduleItem | null>(null);
  const [journalTopic, setJournalTopic] = useState('');
  const [journalDescription, setJournalDescription] = useState('');
  const [selectedMethod, setSelectedMethod] = useState('Diskusi Kelompok');
  const [selectedMedia, setSelectedMedia] = useState('Papan Tulis & Spidol');
  const [classStudents, setClassStudents] = useState<StudentItem[]>([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [studentAbsences, setStudentAbsences] = useState<{ [studentId: string]: { status: 'H' | 'S' | 'I' | 'A'; notes: string } }>({});
  const [isSavingJournal, setIsSavingJournal] = useState(false);

  // Custom Toast Modal (Zero native alert)
  const [toastMessage, setToastMessage] = useState<{ title: string; desc: string; type: 'success' | 'warning' | 'info' | 'error' } | null>(null);

  const showToast = (title: string, desc: string, type: 'success' | 'warning' | 'info' | 'error' = 'info') => {
    setToastMessage({ title, desc, type });
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      setIsLoading(true);
      const apiUrl = await SecureStore.getItemAsync('sipena_api_url');
      const tok = await SecureStore.getItemAsync('sipena_token');
      const storedUser = await SecureStore.getItemAsync('sipena_user');

      if (!apiUrl || !tok) {
        setIsLoading(false);
        return;
      }

      setApiBaseUrl(apiUrl);
      setToken(tok);

      if (storedUser) {
        const u = JSON.parse(storedUser);
        setUserRole(u.role || '');
        if (u.teacher_id) setTeacherId(String(u.teacher_id));
      }

      const headers = { Authorization: `Bearer ${tok}` };

      // Load Schedules, Subjects, Classes, and Journals in parallel
      const [resSchedules, resSubjects, resClasses, resJournals] = await Promise.allSettled([
        axios.get(`${apiUrl}/api/schedules`, { headers }),
        axios.get(`${apiUrl}/api/subjects?perPage=all`, { headers }),
        axios.get(`${apiUrl}/api/classes?perPage=all`, { headers }),
        axios.get(`${apiUrl}/api/journals`, { headers })
      ]);

      if (resSchedules.status === 'fulfilled' && resSchedules.value.data) {
        setSchedulesList(resSchedules.value.data.data || []);
      }
      if (resSubjects.status === 'fulfilled' && resSubjects.value.data) {
        setSubjectsList(resSubjects.value.data.data || []);
      }
      if (resClasses.status === 'fulfilled' && resClasses.value.data) {
        setClassesList(resClasses.value.data.data || []);
      }
      if (resJournals.status === 'fulfilled' && resJournals.value.data) {
        setJournalsList(resJournals.value.data.data || []);
      }
    } catch (e: any) {
      console.warn('Gagal memuat data Kurikulum & Jadwal:', e.message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchAllData();
  };

  // Helper date navigation for Jurnal Mengajar
  const shiftJournalDate = (daysOffset: number) => {
    const d = new Date(journalDate);
    d.setDate(d.getDate() + daysOffset);
    setJournalDate(d.toISOString().split('T')[0]);
  };

  // Convert journalDate to day_of_week (1 = Senin ... 7 = Minggu)
  const getDayOfWeekFromDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const day = d.getDay();
    return day === 0 ? 7 : day;
  };

  const journalDayOfWeek = getDayOfWeekFromDate(journalDate);

  // Schedules matching the journal date's day of week
  const schedulesOnJournalDate = schedulesList.filter(s => s.day_of_week === journalDayOfWeek);

  // Check if a schedule already has an existing journal on the selected date
  const getExistingJournalForSchedule = (sched: ScheduleItem) => {
    return journalsList.find(j => {
      const matchClass = Number(j.class_id) === Number(sched.class_id);
      const matchSubject = Number(j.subject_id) === Number(sched.subject_id);
      const matchDate = String(j.date).split('T')[0] === journalDate;
      return matchClass && matchSubject && matchDate;
    });
  };

  // Open Journal Form Modal for a schedule
  const handleOpenJournalForm = async (sched: ScheduleItem) => {
    setActiveScheduleForJournal(sched);
    const existing = getExistingJournalForSchedule(sched);

    if (existing) {
      setJournalTopic(existing.topic && existing.topic !== 'Belum diisi' ? existing.topic : '');
      setJournalDescription(existing.description || '');
      setSelectedMethod(existing.methods || 'Diskusi Kelompok');
      setSelectedMedia(existing.media || 'Papan Tulis & Spidol');
    } else {
      setJournalTopic('');
      setJournalDescription('');
      setSelectedMethod('Diskusi Kelompok');
      setSelectedMedia('Papan Tulis & Spidol');
    }

    // Load students for this class
    try {
      setIsLoadingStudents(true);
      setIsJournalFormOpen(true);
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.get(`${apiBaseUrl}/api/grades/report-list`, {
        headers,
        params: { class_id: sched.class_id }
      });

      const stList: StudentItem[] = res.data?.data || [];
      setClassStudents(stList);

      // Default all students to 'H' (Hadir)
      const initialAbs: { [key: string]: { status: 'H' | 'S' | 'I' | 'A'; notes: string } } = {};
      stList.forEach(st => {
        initialAbs[st.id] = { status: 'H', notes: '' };
      });
      setStudentAbsences(initialAbs);
    } catch (e: any) {
      console.warn('Gagal memuat siswa kelas:', e.message);
    } finally {
      setIsLoadingStudents(false);
    }
  };

  // Mark all students Hadir in form
  const handleMarkAllHadir = () => {
    const updated = { ...studentAbsences };
    classStudents.forEach(st => {
      updated[st.id] = { status: 'H', notes: '' };
    });
    setStudentAbsences(updated);
  };

  // Submit Teaching Journal to Backend
  const handleSubmitJournal = async () => {
    if (!activeScheduleForJournal) return;
    if (!journalTopic.trim()) {
      showToast('Topik Wajib Diisi', 'Silakan masukkan materi atau topik pembelajaran pokok hari ini.', 'warning');
      return;
    }

    try {
      setIsSavingJournal(true);
      const headers = { Authorization: `Bearer ${token}` };

      // Build absences payload (only non-hadir need status and notes recorded in database)
      const absencesPayload = Object.entries(studentAbsences).map(([studentId, data]) => ({
        student_id: studentId,
        status: data.status,
        notes: data.notes
      }));

      const payload = {
        class_id: activeScheduleForJournal.class_id,
        subject_id: activeScheduleForJournal.subject_id,
        teacher_id: activeScheduleForJournal.teacher_id || teacherId,
        date: journalDate,
        start_time: activeScheduleForJournal.start_time,
        end_time: activeScheduleForJournal.end_time,
        topic: journalTopic.trim(),
        description: journalDescription.trim(),
        methods: selectedMethod,
        media: selectedMedia,
        absences: absencesPayload
      };

      const res = await axios.post(`${apiBaseUrl}/api/journals/submit`, payload, { headers });

      if (res.data) {
        setIsJournalFormOpen(false);
        showToast(
          'Jurnal Berhasil Disimpan',
          `Jurnal mengajar dan rekap absensi untuk Kelas ${activeScheduleForJournal.class?.name || ''} berhasil disimpan.`,
          'success'
        );
        // Refresh journals list
        const resJournals = await axios.get(`${apiBaseUrl}/api/journals`, { headers });
        if (resJournals.data?.data) {
          setJournalsList(resJournals.data.data);
        }
      }
    } catch (e: any) {
      showToast('Gagal Menyimpan Jurnal', e.response?.data?.message || e.message, 'error');
    } finally {
      setIsSavingJournal(false);
    }
  };

  // Filter schedules by day, class, and search query (Tab 1)
  const filteredSchedules = schedulesList.filter(s => {
    const dayMatch = s.day_of_week === selectedDay;
    const classMatch = selectedClassId === 'all' || String(s.class_id || s.class?.id) === selectedClassId;
    
    const q = searchQuery.toLowerCase().trim();
    const subMatch = (s.subject?.name || '').toLowerCase().includes(q);
    const teacherMatch = (s.teacher?.name || '').toLowerCase().includes(q);
    const clsMatch = (s.class?.name || '').toLowerCase().includes(q);
    const searchMatch = !q || subMatch || teacherMatch || clsMatch;

    return dayMatch && classMatch && searchMatch;
  });

  // Filter subjects by search (Tab 3)
  const filteredSubjects = subjectsList.filter(sub => {
    const q = searchQuery.toLowerCase().trim();
    return !q || (sub.name || '').toLowerCase().includes(q) || (sub.code || '').toLowerCase().includes(q);
  });

  const totalSubjects = subjectsList.length;
  const avgKkm = subjectsList.length > 0 
    ? Math.round(subjectsList.reduce((acc, s) => acc + (s.kkm || 75), 0) / subjectsList.length) 
    : 75;
  const totalHours = subjectsList.reduce((acc, s) => acc + (s.hours_per_week || 0), 0);

  const getDayName = (dayNum?: number) => {
    const d = DAYS.find(x => x.value === dayNum);
    return d ? d.label : 'Hari';
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

  const renderAvatar = (gender?: string, name?: string) => {
    const isFemale = isFemaleGender(gender, name);
    return <Image source={isFemale ? avatarFemale : avatarMale} style={styles.avatarImg} />;
  };

  // Render a Schedule Card with direct "Isi Jurnal" button
  const renderScheduleCard = ({ item }: { item: ScheduleItem }) => {
    const startTime = item.start_time || '07:00';
    const endTime = item.end_time || '07:40';
    const subjectName = item.subject?.name || 'Mata Pelajaran';
    const teacherName = item.teacher?.name || 'Guru Belum Ditentukan';
    const className = item.class?.name || 'Kelas';
    const isSub = item.teacher?.is_substitute;

    return (
      <View style={styles.scheduleCardWrapper}>
        <TouchableOpacity 
          style={styles.scheduleCard}
          onPress={() => setSelectedSchedule(item)}
          activeOpacity={0.7}
        >
          {/* Time Pillar */}
          <View style={styles.timePillar}>
            <Text style={styles.timeStart}>{startTime}</Text>
            <View style={styles.timeDivider} />
            <Text style={styles.timeEnd}>{endTime}</Text>
          </View>

          {/* Content */}
          <View style={styles.scheduleContent}>
            <View style={styles.scheduleHeaderRow}>
              <View style={styles.classPillSmall}>
                <Text style={styles.classPillSmallText}>{className}</Text>
              </View>
              {isSub ? (
                <View style={styles.substituteBadge}>
                  <Text style={styles.substituteBadgeText}>Guru Pengganti</Text>
                </View>
              ) : null}
            </View>

            <Text style={styles.subjectNameText} numberOfLines={1}>{subjectName}</Text>
            
            <View style={styles.teacherRow}>
              <Feather name="user" size={12} color={Colors.textLight} style={{ marginRight: 4 }} />
              <Text style={styles.teacherNameText} numberOfLines={1}>{teacherName}</Text>
            </View>
          </View>

          {/* Direct Isi Jurnal Action Button */}
          <TouchableOpacity 
            style={styles.cardJournalActionBtn}
            onPress={() => handleOpenJournalForm(item)}
            activeOpacity={0.8}
          >
            <Feather name="edit-3" size={14} color="#D97706" />
            <Text style={styles.cardJournalActionText}>Jurnal</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
          <Feather name="chevron-left" size={26} color={Colors.secondary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>4. Kurikulum & Jadwal</Text>
          <View style={styles.headerBadge}>
            <View style={[styles.dotOnline, { backgroundColor: '#F59E0B' }]} />
            <Text style={styles.headerBadgeText}>Jadwal, KBM & Jurnal Mengajar</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.refreshButton} onPress={onRefresh} activeOpacity={0.7}>
          <Feather name="rotate-cw" size={18} color={Colors.secondary} />
        </TouchableOpacity>
      </View>

      {/* Tab Segment Selector (4 TABS) */}
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'schedule' && styles.tabButtonActive]}
          onPress={() => setActiveTab('schedule')}
        >
          <Feather name="calendar" size={14} color={activeTab === 'schedule' ? '#FFF' : Colors.textLight} />
          <Text style={[styles.tabText, activeTab === 'schedule' && styles.tabTextActive]}>Jadwal</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'journal' && styles.tabButtonActive]}
          onPress={() => setActiveTab('journal')}
        >
          <Feather name="edit-3" size={14} color={activeTab === 'journal' ? '#FFF' : Colors.textLight} />
          <Text style={[styles.tabText, activeTab === 'journal' && styles.tabTextActive]}>Jurnal KBM</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'subjects' && styles.tabButtonActive]}
          onPress={() => setActiveTab('subjects')}
        >
          <Feather name="book-open" size={14} color={activeTab === 'subjects' ? '#FFF' : Colors.textLight} />
          <Text style={[styles.tabText, activeTab === 'subjects' && styles.tabTextActive]}>Mapel ({totalSubjects})</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'timeline' && styles.tabButtonActive]}
          onPress={() => setActiveTab('timeline')}
        >
          <Feather name="clock" size={14} color={activeTab === 'timeline' ? '#FFF' : Colors.textLight} />
          <Text style={[styles.tabText, activeTab === 'timeline' && styles.tabTextActive]}>Slot JP</Text>
        </TouchableOpacity>
      </View>

      {/* Main Content Area */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Memuat jadwal pelajaran & jurnal mengajar...</Text>
        </View>
      ) : (
        <View style={{ flex: 1 }}>

          {/* ======================================================== */}
          {/* TAB 1: JADWAL KBM MINGGUAN                                */}
          {/* ======================================================== */}
          {activeTab === 'schedule' && (
            <View style={{ flex: 1 }}>
              {/* Day Selector Ribbon */}
              <View style={styles.daySelectorContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayScrollContent}>
                  {DAYS.map((day) => {
                    const isActive = selectedDay === day.value;
                    const countOnDay = schedulesList.filter(s => s.day_of_week === day.value).length;
                    return (
                      <TouchableOpacity
                        key={day.value}
                        style={[styles.dayCard, isActive && styles.dayCardActive]}
                        onPress={() => setSelectedDay(day.value)}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.dayLabel, isActive && styles.dayLabelActive]}>{day.label}</Text>
                        <Text style={[styles.dayCount, isActive && styles.dayCountActive]}>{countOnDay} Sesi</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Class & Search Filter */}
              <View style={styles.filterBar}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.classChipsContent}>
                  <TouchableOpacity
                    style={[styles.classChip, selectedClassId === 'all' && styles.classChipActive]}
                    onPress={() => setSelectedClassId('all')}
                  >
                    <Text style={[styles.classChipText, selectedClassId === 'all' && styles.classChipTextActive]}>
                      Semua Kelas
                    </Text>
                  </TouchableOpacity>
                  {classesList.map((cls) => {
                    const isSelected = selectedClassId === String(cls.id);
                    return (
                      <TouchableOpacity
                        key={cls.id}
                        style={[styles.classChip, isSelected && styles.classChipActive]}
                        onPress={() => setSelectedClassId(String(cls.id))}
                      >
                        <Text style={[styles.classChipText, isSelected && styles.classChipTextActive]}>
                          Kelas {cls.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Search Box */}
              <View style={styles.searchContainer}>
                <Feather name="search" size={16} color={Colors.textLight} style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Cari mapel, guru, atau kelas..."
                  placeholderTextColor={Colors.textLight}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {searchQuery ? (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <Feather name="x" size={16} color={Colors.textLight} />
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* Schedules List */}
              <FlatList
                data={filteredSchedules}
                keyExtractor={(item: ScheduleItem) => String(item.id)}
                renderItem={renderScheduleCard}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
                showsVerticalScrollIndicator={false}
                refreshControl={
                  <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={[Colors.primary]} />
                }
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Feather name="calendar" size={48} color="#CBD5E1" />
                    <Text style={styles.emptyTitle}>Tidak Ada Jadwal KBM</Text>
                    <Text style={styles.emptySubtitle}>Tidak ada jadwal mengajar pada kriteria ini.</Text>
                  </View>
                }
              />
            </View>
          )}

          {/* ======================================================== */}
          {/* TAB 2: JURNAL MENGAJAR (FITUR PENUH KBM MOBILE)          */}
          {/* ======================================================== */}
          {activeTab === 'journal' && (
            <ScrollView 
              style={{ flex: 1 }} 
              contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={['#D97706']} />
              }
            >
              {/* Date Navigation Ribbon */}
              <View style={styles.journalDateRibbon}>
                <TouchableOpacity 
                  style={styles.dateNavBtn} 
                  onPress={() => shiftJournalDate(-1)}
                  activeOpacity={0.7}
                >
                  <Feather name="chevron-left" size={20} color="#D97706" />
                </TouchableOpacity>

                <View style={styles.dateInfoCenter}>
                  <View style={styles.dateIconWrapper}>
                    <Feather name="calendar" size={15} color="#D97706" />
                    <Text style={styles.journalDayTitle}>{getDayName(journalDayOfWeek)}</Text>
                  </View>
                  <Text style={styles.journalDateText}>{journalDate}</Text>
                </View>

                <TouchableOpacity 
                  style={styles.dateNavBtn} 
                  onPress={() => shiftJournalDate(1)}
                  activeOpacity={0.7}
                >
                  <Feather name="chevron-right" size={20} color="#D97706" />
                </TouchableOpacity>
              </View>

              {/* Status Banner */}
              <View style={styles.journalOverviewCard}>
                <View style={styles.journalOverviewHeader}>
                  <View style={styles.journalOverviewTitleGroup}>
                    <Text style={styles.journalOverviewTitle}>Jurnal Mengajar Hari Ini</Text>
                    <Text style={styles.journalOverviewSubtitle}>
                      {schedulesOnJournalDate.length} Sesi KBM Terjadwal
                    </Text>
                  </View>
                  <View style={styles.journalDateBadge}>
                    <Text style={styles.journalDateBadgeText}>
                      {journalDate === new Date().toISOString().split('T')[0] ? 'Hari Ini' : getDayName(journalDayOfWeek)}
                    </Text>
                  </View>
                </View>

                {/* 3 Metrics */}
                {(() => {
                  const filledCount = schedulesOnJournalDate.filter(s => Boolean(getExistingJournalForSchedule(s))).length;
                  const unFilledCount = schedulesOnJournalDate.length - filledCount;
                  return (
                    <View style={styles.journalStatsRow}>
                      <View style={styles.journalStatBox}>
                        <Text style={styles.journalStatVal}>{schedulesOnJournalDate.length}</Text>
                        <Text style={styles.journalStatLbl}>Total Jadwal</Text>
                      </View>
                      <View style={[styles.journalStatBox, { backgroundColor: '#ECFDF5' }]}>
                        <Text style={[styles.journalStatVal, { color: '#059669' }]}>{filledCount}</Text>
                        <Text style={styles.journalStatLbl}>Sudah Diisi</Text>
                      </View>
                      <View style={[styles.journalStatBox, { backgroundColor: '#FFFBEB' }]}>
                        <Text style={[styles.journalStatVal, { color: '#D97706' }]}>{unFilledCount}</Text>
                        <Text style={styles.journalStatLbl}>Belum Diisi</Text>
                      </View>
                    </View>
                  );
                })()}
              </View>

              {/* Schedules List for Selected Date with Fill Journal Button */}
              <View style={styles.sectionHeaderWrap}>
                <Text style={styles.sectionHeading}>Daftar Jam KBM ({schedulesOnJournalDate.length} Sesi):</Text>
              </View>

              {schedulesOnJournalDate.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Feather name="coffee" size={44} color="#CBD5E1" />
                  <Text style={styles.emptyTitle}>Tidak Ada Jadwal Mengajar</Text>
                  <Text style={styles.emptySubtitle}>Tidak ada jadwal KBM pada hari {getDayName(journalDayOfWeek)}.</Text>
                </View>
              ) : (
                schedulesOnJournalDate.map(sched => {
                  const existingJournal = getExistingJournalForSchedule(sched);
                  const isFilled = Boolean(existingJournal && existingJournal.topic && existingJournal.topic !== 'Belum diisi');

                  return (
                    <View key={sched.id} style={styles.journalItemCard}>
                      <View style={styles.journalCardTop}>
                        <View style={styles.journalTimeTag}>
                          <Feather name="clock" size={13} color="#D97706" />
                          <Text style={styles.journalTimeTagText}>
                            {sched.start_time} - {sched.end_time} WIB
                          </Text>
                        </View>

                        {isFilled ? (
                          <View style={styles.journalBadgeFilled}>
                            <Feather name="check-circle" size={12} color="#059669" />
                            <Text style={styles.journalBadgeFilledText}>Terisi</Text>
                          </View>
                        ) : (
                          <View style={styles.journalBadgeUnfilled}>
                            <Feather name="alert-circle" size={12} color="#D97706" />
                            <Text style={styles.journalBadgeUnfilledText}>Belum Diisi</Text>
                          </View>
                        )}
                      </View>

                      <View style={styles.journalCardBody}>
                        <View style={styles.journalClassPill}>
                          <Text style={styles.journalClassPillText}>Kelas {sched.class?.name || '-'}</Text>
                        </View>
                        <Text style={styles.journalSubjectTitle}>{sched.subject?.name || 'Mata Pelajaran'}</Text>
                        <Text style={styles.journalTeacherText}>
                          Guru: <Text style={{ fontWeight: '700', color: Colors.secondary }}>{sched.teacher?.name || '-'}</Text>
                        </Text>

                        {isFilled && (
                          <View style={styles.filledTopicBox}>
                            <Text style={styles.filledTopicLabel}>Materi / Topik KBM:</Text>
                            <Text style={styles.filledTopicText}>{existingJournal?.topic}</Text>
                          </View>
                        )}
                      </View>

                      <TouchableOpacity 
                        style={[styles.fillJournalActionBtn, isFilled && styles.fillJournalActionBtnEdit]}
                        onPress={() => handleOpenJournalForm(sched)}
                        activeOpacity={0.8}
                      >
                        <Feather name={isFilled ? 'edit-3' : 'plus-circle'} size={15} color="#FFF" />
                        <Text style={styles.fillJournalActionBtnText}>
                          {isFilled ? 'Edit Jurnal & Absensi KBM' : 'Isi Jurnal Mengajar'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  );
                })
              )}

              {/* History Section: Recent Teaching Journals */}
              <View style={[styles.sectionHeaderWrap, { marginTop: 24 }]}>
                <Text style={styles.sectionHeading}>Riwayat Jurnal Terakhir ({journalsList.length}):</Text>
              </View>

              {journalsList.slice(0, 8).map(j => (
                <View key={String(j.id)} style={styles.historyCard}>
                  <View style={styles.historyCardHeader}>
                    <View>
                      <Text style={styles.historySubjectText}>{j.subject?.name || 'Mata Pelajaran'}</Text>
                      <Text style={styles.historyMetaText}>
                        Kelas {j.class?.name || '-'} • {j.teacher?.name || '-'}
                      </Text>
                    </View>
                    <Text style={styles.historyDateText}>
                      {j.date ? String(j.date).split('T')[0] : '-'}
                    </Text>
                  </View>

                  <View style={styles.historyTopicWrap}>
                    <Text style={styles.historyTopicTitle}>Topik:</Text>
                    <Text style={styles.historyTopicContent}>{j.topic || 'Belum diisi'}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}

          {/* ======================================================== */}
          {/* TAB 3: MATA PELAJARAN                                     */}
          {/* ======================================================== */}
          {activeTab === 'subjects' && (
            <View style={{ flex: 1 }}>
              <View style={styles.statsBanner}>
                <View style={styles.statItem}>
                  <Text style={styles.statVal}>{totalSubjects}</Text>
                  <Text style={styles.statLbl}>Mata Pelajaran</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statVal}>{avgKkm}</Text>
                  <Text style={styles.statLbl}>Rata KKM</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statVal}>{totalHours} Jam</Text>
                  <Text style={styles.statLbl}>Total Beban / Minggu</Text>
                </View>
              </View>

              <FlatList
                data={filteredSubjects}
                keyExtractor={(item: SubjectItem) => String(item.id)}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
                showsVerticalScrollIndicator={false}
                renderItem={({ item, index }: { item: SubjectItem; index: number }) => (
                  <View style={styles.subjectCard}>
                    <View style={styles.subjectNumberCircle}>
                      <Text style={styles.subjectNumberText}>{index + 1}</Text>
                    </View>
                    <View style={styles.subjectInfo}>
                      <Text style={styles.subjectTitle}>{item.name}</Text>
                      <Text style={styles.subjectCode}>{item.code || '-'} • {item.group || 'Umum'}</Text>
                    </View>
                    <View style={styles.subjectMetaBadge}>
                      <Text style={styles.kkmLabel}>KKM: {item.kkm || 75}</Text>
                      <Text style={styles.hoursLabel}>{item.hours_per_week || 2} Jam/Mgg</Text>
                    </View>
                  </View>
                )}
              />
            </View>
          )}

          {/* ======================================================== */}
          {/* TAB 4: TIMELINE SLOT JP                                   */}
          {/* ======================================================== */}
          {activeTab === 'timeline' && (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
              <View style={styles.timelineCard}>
                <View style={styles.timelineHeader}>
                  <Feather name="clock" size={18} color="#D97706" />
                  <Text style={styles.timelineTitle}>Struktur Jam Pelajaran (JP)</Text>
                </View>
                <Text style={styles.timelineSubtitle}>Durasi 1 JP = 40 Menit Tatap Muka</Text>

                {[
                  { jp: 'JP 1', time: '07:00 - 07:40' },
                  { jp: 'JP 2', time: '07:40 - 08:20' },
                  { jp: 'JP 3', time: '08:20 - 09:00' },
                  { jp: 'Istirahat 1', time: '09:00 - 09:20', isBreak: true },
                  { jp: 'JP 4', time: '09:20 - 10:00' },
                  { jp: 'JP 5', time: '10:00 - 10:40' },
                  { jp: 'JP 6', time: '10:40 - 11:20' },
                  { jp: 'Istirahat 2 (Dzuhur)', time: '11:20 - 12:15', isBreak: true },
                  { jp: 'JP 7', time: '12:15 - 12:55' },
                  { jp: 'JP 8', time: '12:55 - 13:35' },
                  { jp: 'JP 9', time: '13:35 - 14:15' },
                  { jp: 'JP 10', time: '14:15 - 15:00' },
                ].map((slot, sIdx) => (
                  <View key={sIdx} style={[styles.timelineRow, slot.isBreak && styles.timelineRowBreak]}>
                    <View style={[styles.slotBadge, slot.isBreak && { backgroundColor: '#FEF3C7' }]}>
                      <Text style={[styles.slotBadgeText, slot.isBreak && { color: '#B45309', fontWeight: '800' }]}>
                        {slot.jp}
                      </Text>
                    </View>
                    <Text style={[styles.slotTimeText, slot.isBreak && { fontWeight: '700', color: '#B45309' }]}>
                      {slot.time}
                    </Text>
                    <View style={[styles.slotTypePill, slot.isBreak ? { backgroundColor: '#FDE68A' } : { backgroundColor: '#DCFCE7' }]}>
                      <Text style={[styles.slotTypePillText, slot.isBreak ? { color: '#92400E' } : { color: '#166534' }]}>
                        {slot.isBreak ? '☕ Istirahat' : '📚 KBM'}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </ScrollView>
          )}

        </View>
      )}

      {/* ======================================================== */}
      {/* MODAL 1: FORMULIR JURNAL MENGAJAR (KBM FULL FEATURED)     */}
      {/* ======================================================== */}
      <Modal visible={isJournalFormOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { maxHeight: '92%' }]}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <Feather name="edit-3" size={20} color="#D97706" />
                <Text style={styles.modalTitle}>Formulir Jurnal Mengajar</Text>
              </View>
              <TouchableOpacity onPress={() => setIsJournalFormOpen(false)}>
                <Feather name="x" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* KBM Header Info */}
              <View style={styles.journalFormHero}>
                <View style={styles.formHeroRow}>
                  <View style={styles.formClassPill}>
                    <Text style={styles.formClassPillText}>
                      Kelas {activeScheduleForJournal?.class?.name || '-'}
                    </Text>
                  </View>
                  <Text style={styles.formTimeText}>
                    {activeScheduleForJournal?.start_time} - {activeScheduleForJournal?.end_time} WIB
                  </Text>
                </View>

                <Text style={styles.formSubjectTitle}>
                  {activeScheduleForJournal?.subject?.name || 'Mata Pelajaran'}
                </Text>
                <Text style={styles.formTeacherSubtitle}>
                  Guru: {activeScheduleForJournal?.teacher?.name || '-'} • Tanggal: {journalDate}
                </Text>
              </View>

              {/* Input: Topik / Materi Pembelajaran */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>
                  Topik / Materi Pokok Pembelajaran <Text style={{ color: Colors.danger }}>*</Text>
                </Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="Misal: Teks Laporan Hasil Observasi (LHO)"
                  placeholderTextColor="#94A3B8"
                  value={journalTopic}
                  onChangeText={setJournalTopic}
                />
              </View>

              {/* Input: Deskripsi KBM / Capaian Pembelajaran */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Deskripsi Kegiatan & Capaian KBM</Text>
                <TextInput
                  style={[styles.formInput, { height: 75, textAlignVertical: 'top' }]}
                  placeholder="Uraikan aktivitas pembelajaran di kelas, tugas kelompok, atau pemahaman siswa..."
                  placeholderTextColor="#94A3B8"
                  multiline
                  value={journalDescription}
                  onChangeText={setJournalDescription}
                />
              </View>

              {/* Input: Metode Pembelajaran */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Metode Pembelajaran</Text>
                <View style={styles.chipsSelectorRow}>
                  {METHODS_LIST.map((m, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={[styles.methodChip, selectedMethod === m && styles.methodChipActive]}
                      onPress={() => setSelectedMethod(m)}
                    >
                      <Text style={[styles.methodChipText, selectedMethod === m && styles.methodChipTextActive]}>
                        {m}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Input: Media Pembelajaran */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Media / Sarana Pembelajaran</Text>
                <View style={styles.chipsSelectorRow}>
                  {MEDIA_LIST.map((med, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={[styles.methodChip, selectedMedia === med && styles.methodChipActive]}
                      onPress={() => setSelectedMedia(med)}
                    >
                      <Text style={[styles.methodChipText, selectedMedia === med && styles.methodChipTextActive]}>
                        {med}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Section: Presensi Siswa di Jam Tersebut */}
              <View style={styles.formAbsenceSection}>
                <View style={styles.absenceHeaderRow}>
                  <View>
                    <Text style={styles.absenceSectionTitle}>Presensi Siswa di Jam Ini</Text>
                    <Text style={styles.absenceSectionSubtitle}>
                      {classStudents.length} Siswa Terdaftar
                    </Text>
                  </View>
                  <TouchableOpacity 
                    style={styles.markAllHadirBtn} 
                    onPress={handleMarkAllHadir}
                    activeOpacity={0.8}
                  >
                    <Feather name="check" size={13} color="#059669" />
                    <Text style={styles.markAllHadirBtnText}>Semua Hadir</Text>
                  </TouchableOpacity>
                </View>

                {isLoadingStudents ? (
                  <View style={{ padding: 20, alignItems: 'center' }}>
                    <ActivityIndicator size="small" color="#D97706" />
                    <Text style={{ fontSize: 12, color: '#64748B', marginTop: 6 }}>Memuat siswa kelas...</Text>
                  </View>
                ) : (
                  <View style={styles.absenceStudentsList}>
                    {classStudents.map((st, i) => {
                      const cur = studentAbsences[st.id] || { status: 'H', notes: '' };
                      return (
                        <View key={st.id} style={styles.absenceStudentRow}>
                          <View style={styles.stRowLeft}>
                            <View style={styles.stAvatarSmall}>
                              {renderAvatar(st.gender, st.name)}
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.stRowName} numberOfLines={1}>{st.name}</Text>
                              <Text style={styles.stRowNis}>NIS: {st.nis || '-'}</Text>
                            </View>
                          </View>

                          {/* 4 segmented buttons: H, S, I, A */}
                          <View style={styles.stStatusSegment}>
                            {(['H', 'S', 'I', 'A'] as const).map(stCode => {
                              const isSelected = cur.status === stCode;
                              return (
                                <TouchableOpacity
                                  key={stCode}
                                  style={[
                                    styles.stSegmentBtn,
                                    isSelected && stCode === 'H' && styles.segBtnH,
                                    isSelected && stCode === 'S' && styles.segBtnS,
                                    isSelected && stCode === 'I' && styles.segBtnI,
                                    isSelected && stCode === 'A' && styles.segBtnA,
                                  ]}
                                  onPress={() => {
                                    setStudentAbsences(prev => ({
                                      ...prev,
                                      [st.id]: { ...cur, status: stCode }
                                    }));
                                  }}
                                >
                                  <Text style={[styles.stSegmentBtnText, isSelected && styles.stSegmentBtnTextActive]}>
                                    {stCode}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            </ScrollView>

            {/* Modal Bottom Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setIsJournalFormOpen(false)}
              >
                <Text style={styles.cancelBtnText}>Batal</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={handleSubmitJournal}
                disabled={isSavingJournal}
              >
                {isSavingJournal ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.confirmBtnText}>Simpan Jurnal & Absensi</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL 2: DETAIL JADWAL KBM                                */}
      {/* ======================================================== */}
      <Modal visible={!!selectedSchedule} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Informasi Jadwal KBM</Text>
              <TouchableOpacity onPress={() => setSelectedSchedule(null)}>
                <Feather name="x" size={20} color={Colors.secondary} />
              </TouchableOpacity>
            </View>

            {selectedSchedule && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.detailHero}>
                  <View style={styles.detailSubjectIcon}>
                    <MaterialCommunityIcons name="book-open-page-variant" size={32} color="#D97706" />
                  </View>
                  <Text style={styles.detailSubjectName}>{selectedSchedule.subject?.name || 'Mata Pelajaran'}</Text>
                  <Text style={styles.detailClassSubtitle}>
                    Kelas: <Text style={{ fontWeight: '800', color: Colors.secondary }}>{selectedSchedule.class?.name || '-'}</Text>
                  </Text>
                </View>

                <View style={styles.detailInfoBox}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Hari</Text>
                    <Text style={[styles.detailValue, { fontWeight: '700', color: '#D97706' }]}>
                      {getDayName(selectedSchedule.day_of_week)}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Waktu KBM</Text>
                    <Text style={[styles.detailValue, { fontWeight: '700' }]}>
                      {selectedSchedule.start_time} - {selectedSchedule.end_time} WIB
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Guru Pengampu</Text>
                    <Text style={[styles.detailValue, { fontWeight: '700', color: Colors.primary }]}>
                      {selectedSchedule.teacher?.name || '-'}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Standar KKM</Text>
                    <Text style={styles.detailValue}>{selectedSchedule.subject?.kkm || 75}</Text>
                  </View>
                </View>

                {/* Direct Action Button in Schedule Detail */}
                <TouchableOpacity
                  style={styles.modalOpenJournalBtn}
                  onPress={() => {
                    const sched = selectedSchedule;
                    setSelectedSchedule(null);
                    handleOpenJournalForm(sched);
                  }}
                  activeOpacity={0.8}
                >
                  <Feather name="edit-3" size={16} color="#FFF" />
                  <Text style={styles.modalOpenJournalBtnText}>Isi Jurnal Mengajar untuk Jadwal Ini</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
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
                  toastMessage?.type === 'error' ? '#EF4444' : '#D97706'
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
    backgroundColor: '#FAFAFA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    paddingHorizontal: 12,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.secondary,
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 6,
  },
  dotOnline: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  headerBadgeText: {
    fontSize: 11,
    color: Colors.textLight,
  },
  refreshButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // 4 Tabs
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 6,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    gap: 4,
  },
  tabButtonActive: {
    backgroundColor: '#D97706',
  },
  tabText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textLight,
  },
  tabTextActive: {
    color: '#FFF',
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
    color: Colors.textLight,
  },

  // Tab 1: Day Selector
  daySelectorContainer: {
    backgroundColor: '#FFF',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  dayScrollContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  dayCard: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  dayCardActive: {
    backgroundColor: '#FFFBEB',
    borderColor: '#D97706',
  },
  dayLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  dayLabelActive: {
    color: '#D97706',
  },
  dayCount: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 1,
  },
  dayCountActive: {
    color: '#B45309',
    fontWeight: '600',
  },

  // Class & Search
  filterBar: {
    backgroundColor: '#FFF',
    paddingVertical: 8,
  },
  classChipsContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  classChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  classChipActive: {
    backgroundColor: '#D97706',
    borderColor: '#D97706',
  },
  classChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  classChipTextActive: {
    color: '#FFF',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    marginHorizontal: 16,
    marginVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    height: 40,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    color: Colors.secondary,
  },

  // Schedule Cards
  scheduleCardWrapper: {
    marginBottom: 10,
  },
  scheduleCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 },
      android: { elevation: 1 },
    }),
  },
  timePillar: {
    width: 65,
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#F1F5F9',
    paddingRight: 8,
  },
  timeStart: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.secondary,
  },
  timeDivider: {
    width: 2,
    height: 10,
    backgroundColor: '#CBD5E1',
    marginVertical: 2,
  },
  timeEnd: {
    fontSize: 11,
    color: Colors.textLight,
  },
  scheduleContent: {
    flex: 1,
    paddingLeft: 10,
  },
  scheduleHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  classPillSmall: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  classPillSmallText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0284C7',
  },
  substituteBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  substituteBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#B45309',
  },
  subjectNameText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  teacherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  teacherNameText: {
    fontSize: 11,
    color: Colors.textLight,
  },
  cardJournalActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FDE68A',
    gap: 4,
  },
  cardJournalActionText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#D97706',
  },

  // Empty state
  emptyContainer: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
    marginTop: 10,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 4,
  },

  // Tab 2: Jurnal Mengajar
  journalDateRibbon: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  dateNavBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFBEB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateInfoCenter: {
    alignItems: 'center',
  },
  dateIconWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  journalDayTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#B45309',
  },
  journalDateText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  journalOverviewCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
  },
  journalOverviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  journalOverviewTitleGroup: {
    flex: 1,
  },
  journalOverviewTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  journalOverviewSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  journalDateBadge: {
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  journalDateBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#D97706',
  },
  journalStatsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  journalStatBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  journalStatVal: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  journalStatLbl: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
    textAlign: 'center',
  },
  sectionHeaderWrap: {
    marginBottom: 8,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  journalItemCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
  },
  journalCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  journalTimeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  journalTimeTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
  },
  journalBadgeFilled: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 4,
  },
  journalBadgeFilledText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#059669',
  },
  journalBadgeUnfilled: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 4,
  },
  journalBadgeUnfilledText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#D97706',
  },
  journalCardBody: {
    marginBottom: 12,
  },
  journalClassPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 4,
  },
  journalClassPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0284C7',
  },
  journalSubjectTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  journalTeacherText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  filledTopicBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 8,
    marginTop: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#059669',
  },
  filledTopicLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
  },
  filledTopicText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 1,
  },
  fillJournalActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D97706',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  fillJournalActionBtnEdit: {
    backgroundColor: '#0284C7',
  },
  fillJournalActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFF',
  },

  // History Card
  historyCard: {
    backgroundColor: '#FFF',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8,
  },
  historyCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  historySubjectText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  historyMetaText: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },
  historyDateText: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '600',
  },
  historyTopicWrap: {
    backgroundColor: '#F8FAFC',
    padding: 8,
    borderRadius: 6,
  },
  historyTopicTitle: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
  },
  historyTopicContent: {
    fontSize: 11,
    color: '#1E293B',
    marginTop: 1,
  },

  // Tab 3: Subjects
  statsBanner: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    marginHorizontal: 16,
    marginVertical: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statVal: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.secondary,
  },
  statLbl: {
    fontSize: 10,
    color: Colors.textLight,
    marginTop: 2,
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#F1F5F9',
  },
  subjectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  subjectNumberCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  subjectNumberText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#D97706',
  },
  subjectInfo: {
    flex: 1,
  },
  subjectTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.secondary,
  },
  subjectCode: {
    fontSize: 11,
    color: Colors.textLight,
    marginTop: 2,
  },
  subjectMetaBadge: {
    alignItems: 'flex-end',
  },
  kkmLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.primary,
  },
  hoursLabel: {
    fontSize: 10,
    color: Colors.textLight,
    marginTop: 2,
  },

  // Tab 4: Timeline
  timelineCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  timelineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  timelineTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.secondary,
  },
  timelineSubtitle: {
    fontSize: 11,
    color: Colors.textLight,
    marginBottom: 14,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  timelineRowBreak: {
    backgroundColor: '#FFFBEB',
    borderRadius: 8,
    paddingHorizontal: 8,
  },
  slotBadge: {
    width: 60,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  slotBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.secondary,
  },
  slotTimeText: {
    flex: 1,
    paddingHorizontal: 12,
    fontSize: 12,
    color: Colors.secondary,
  },
  slotTypePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  slotTypePillText: {
    fontSize: 10,
    fontWeight: '700',
  },

  // Modal Jurnal Mengajar Form
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalBox: {
    width: '100%',
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10 },
      android: { elevation: 6 },
    }),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
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
  journalFormHero: {
    backgroundColor: '#FFFBEB',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  formHeroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  formClassPill: {
    backgroundColor: '#D97706',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  formClassPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFF',
  },
  formTimeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
  },
  formSubjectTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#92400E',
  },
  formTeacherSubtitle: {
    fontSize: 11,
    color: '#B45309',
    marginTop: 2,
  },
  formGroup: {
    marginBottom: 12,
  },
  formLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 4,
  },
  formInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12,
    color: '#0F172A',
  },
  chipsSelectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  methodChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  methodChipActive: {
    backgroundColor: '#D97706',
  },
  methodChipText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#475569',
  },
  methodChipTextActive: {
    color: '#FFF',
    fontWeight: '700',
  },

  // Absence section inside form
  formAbsenceSection: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 4,
  },
  absenceHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  absenceSectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  absenceSectionSubtitle: {
    fontSize: 10,
    color: '#64748B',
  },
  markAllHadirBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  markAllHadirBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#059669',
  },
  absenceStudentsList: {
    gap: 8,
  },
  absenceStudentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  stRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
    marginRight: 8,
  },
  stAvatarSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#E2E8F0',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  stRowName: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E293B',
  },
  stRowNis: {
    fontSize: 9,
    color: '#94A3B8',
  },
  stStatusSegment: {
    flexDirection: 'row',
    gap: 3,
  },
  stSegmentBtn: {
    width: 26,
    height: 26,
    borderRadius: 5,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  segBtnH: { backgroundColor: '#10B981' },
  segBtnS: { backgroundColor: '#F59E0B' },
  segBtnI: { backgroundColor: '#3B82F6' },
  segBtnA: { backgroundColor: '#EF4444' },
  stSegmentBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  stSegmentBtnTextActive: {
    color: '#FFF',
    fontWeight: '900',
  },

  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  confirmBtn: {
    flex: 1.5,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#D97706',
    alignItems: 'center',
  },
  confirmBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFF',
  },

  // Modal 2: Schedule Detail
  detailHero: {
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 10,
  },
  detailSubjectIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#FFFBEB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailSubjectName: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.secondary,
    textAlign: 'center',
  },
  detailClassSubtitle: {
    fontSize: 12,
    color: Colors.textLight,
    marginTop: 2,
  },
  detailInfoBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  detailLabel: {
    fontSize: 11,
    color: Colors.textLight,
  },
  detailValue: {
    fontSize: 11,
    color: Colors.secondary,
  },
  modalOpenJournalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D97706',
    paddingVertical: 11,
    borderRadius: 8,
    gap: 6,
  },
  modalOpenJournalBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFF',
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
    backgroundColor: '#FFF',
    borderRadius: 18,
    padding: 22,
    alignItems: 'center',
  },
  noticeIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFFBEB',
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
    backgroundColor: '#D97706',
    paddingVertical: 11,
    paddingHorizontal: 30,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
  },
  noticeCloseText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 13,
  },
});
