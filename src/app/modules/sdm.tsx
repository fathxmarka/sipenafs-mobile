import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  ActivityIndicator, RefreshControl, Image, TextInput, Platform, Modal, FlatList 
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Colors from '../../constants/Colors';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';

type TabType = 'teachers' | 'workload' | 'retirement';

const avatarMale = require('../../../assets/images/avatar_male.png');
const avatarFemale = require('../../../assets/images/avatar_female.png');

export default function SdmScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<TabType>('teachers');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Teachers State
  const [teachersList, setTeachersList] = useState<any[]>([]);
  const [totalTeachers, setTotalTeachers] = useState<number>(0);
  const [isAccessDenied, setIsAccessDenied] = useState<boolean>(false);

  // Retirement State
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [retirementData, setRetirementData] = useState<any>({ details: [], settings: {} });
  const [isLoadingRetirement, setIsLoadingRetirement] = useState(false);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all'); // all, PNS, PPPK, Honor

  // Detail Modal & Action states
  const [selectedTeacher, setSelectedTeacher] = useState<any>(null);
  const [isGeneratingAcc, setIsGeneratingAcc] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  useEffect(() => {
    fetchAllData();
  }, []);

  useEffect(() => {
    if (activeTab === 'retirement') {
      fetchRetirementData(selectedYear);
    }
  }, [selectedYear, activeTab]);

  const fetchAllData = async () => {
    try {
      const userRaw = await SecureStore.getItemAsync('sipena_user');
      const user = userRaw ? JSON.parse(userRaw) : null;
      const roleStr = (user?.role || '').toLowerCase();
      const jabStr = (user?.jabatan || '').toLowerCase();
      const caps: string[] = Array.isArray(user?.capabilities) ? user.capabilities.map((c: any) => String(c).toLowerCase()) : [];

      const isAllowed = 
        roleStr.includes('admin') || 
        roleStr.includes('operator') || 
        roleStr.includes('kepala') || 
        jabStr.includes('kepala sekolah') || 
        jabStr.includes('wakil') || 
        jabStr.includes('sdm') || 
        jabStr.includes('tata usaha') ||
        caps.includes('sdm');

      if (!isAllowed) {
        setIsAccessDenied(true);
        setIsLoading(false);
        return;
      }

      const apiUrl = await SecureStore.getItemAsync('sipena_api_url');
      const token = await SecureStore.getItemAsync('sipena_token');

      if (!apiUrl || !token) {
        setIsLoading(false);
        return;
      }

      const headers = { Authorization: `Bearer ${token}` };

      // Load Teachers & Retirement in parallel
      const [resTeachers, resRetire] = await Promise.allSettled([
        axios.get(`${apiUrl}/api/teachers?perPage=all`, { headers }),
        axios.get(`${apiUrl}/api/retirement?year=${selectedYear}`, { headers })
      ]);

      if (resTeachers.status === 'fulfilled' && resTeachers.value.data) {
        const teachersArr = resTeachers.value.data.data || [];
        setTeachersList(teachersArr);
        setTotalTeachers(teachersArr.length);
      }

      if (resRetire.status === 'fulfilled' && resRetire.value.data) {
        setRetirementData(resRetire.value.data || { details: [], settings: {} });
      }
    } catch (e: any) {
      console.warn('Gagal memuat data SDM & Guru:', e.message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const fetchRetirementData = async (yr: number) => {
    setIsLoadingRetirement(true);
    try {
      const apiUrl = await SecureStore.getItemAsync('sipena_api_url');
      const token = await SecureStore.getItemAsync('sipena_token');
      if (!apiUrl || !token) return;

      const res = await axios.get(`${apiUrl}/api/retirement?year=${yr}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data) {
        setRetirementData(res.data);
      }
    } catch (e: any) {
      console.warn('Gagal memuat data pensiun:', e.message);
    } finally {
      setIsLoadingRetirement(false);
    }
  };

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchAllData();
  };

  // Mass Account Generation for Teachers
  const handleGenerateAccounts = async () => {
    setIsGeneratingAcc(true);
    try {
      const apiUrl = await SecureStore.getItemAsync('sipena_api_url');
      const token = await SecureStore.getItemAsync('sipena_token');
      const headers = { Authorization: `Bearer ${token}` };

      const res = await axios.post(`${apiUrl}/api/teachers/generate-accounts`, {}, { headers });
      setActionFeedback(res.data?.message || 'Akun untuk seluruh tenaga pendidik berhasil digenerate dengan password default 123456.');
      fetchAllData();
    } catch (e: any) {
      setActionFeedback(e.response?.data?.message || 'Gagal generate akun guru masal.');
    } finally {
      setIsGeneratingAcc(false);
    }
  };

  // Helpers
  const getTeacherGender = (teacher: any): 'L' | 'P' => {
    const g = teacher?.teacher_profiles?.gender || teacher?.gender || 'L';
    return (g.toUpperCase() === 'P' || g.toLowerCase().startsWith('p')) ? 'P' : 'L';
  };

  const getTeacherAvatar = (teacher: any) => {
    const isMale = getTeacherGender(teacher) === 'L';
    const defaultAsset = isMale ? avatarMale : avatarFemale;

    if (teacher?.photo && teacher?.photo_url && !teacher.photo_url.includes('defaults/avatar_')) {
      return { uri: teacher.photo_url };
    }
    return defaultAsset;
  };

  const getTeacherEmploymentStatus = (teacher: any): string => {
    const emp = teacher?.teacher_employments?.[0];
    return emp?.mst_status_kepegawaian?.name || 'Honorer';
  };

  const getTeacherJabatan = (teacher: any): string => {
    const emp = teacher?.teacher_employments?.[0];
    return emp?.mst_jabatan?.name || 'Guru';
  };

  // Filtered teachers list
  const filteredTeachers = teachersList.filter(t => {
    const q = searchQuery.toLowerCase().trim();
    const nameMatch = (t.formatted_name || t.name || '').toLowerCase().includes(q);
    const nipMatch = (t.nip || '').includes(q);
    const subjectMatch = (t.subjects_list || []).some((sub: string) => sub.toLowerCase().includes(q));
    const matchesSearch = !q || nameMatch || nipMatch || subjectMatch;

    if (selectedStatus !== 'all') {
      const status = getTeacherEmploymentStatus(t).toLowerCase();
      if (selectedStatus === 'pns') return matchesSearch && status.includes('pns');
      if (selectedStatus === 'pppk') return matchesSearch && status.includes('pppk');
      if (selectedStatus === 'honor') return matchesSearch && (status.includes('honor') || status.includes('gtt'));
    }
    return matchesSearch;
  });

  // Calculate workload stats
  const totalJP = teachersList.reduce((acc, t) => acc + (t._count?.schedules || 0), 0);
  const avgJP = teachersList.length > 0 ? (totalJP / teachersList.length).toFixed(1) : '0';
  const meetingNormTeachers = teachersList.filter(t => (t._count?.schedules || 0) >= 24).length;
  const criticalTeachers = teachersList.filter(t => (t._count?.schedules || 0) < 24).length;

  const renderTeacherItem = ({ item }: { item: any }) => {
    const isMale = getTeacherGender(item) === 'L';
    const statusText = getTeacherEmploymentStatus(item);
    const jabatanText = getTeacherJabatan(item);
    const jpCount = item._count?.schedules || 0;
    const subjects = item.subjects_list || [];

    const isPns = statusText.toLowerCase().includes('pns');
    const isPppk = statusText.toLowerCase().includes('pppk');

    return (
      <TouchableOpacity 
        style={styles.teacherCard}
        onPress={() => setSelectedTeacher(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.avatarContainer, { borderColor: isMale ? '#93C5FD' : '#F472B6' }]}>
          <Image 
            source={getTeacherAvatar(item)} 
            style={styles.avatarImage}
            resizeMode="cover"
          />
        </View>

        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.teacherName} numberOfLines={1}>{item.formatted_name || item.name}</Text>
          <Text style={styles.teacherNip}>
            {item.nip ? `NIP: ${item.nip}` : 'NIP: -'}
          </Text>

          {/* Jabatan & Mapel badges */}
          <View style={styles.tagRow}>
            <View style={styles.jabatanBadge}>
              <Text style={styles.jabatanBadgeText}>{jabatanText}</Text>
            </View>
            {subjects.slice(0, 2).map((sub: string, sIdx: number) => (
              <View key={sIdx} style={styles.subjectBadge}>
                <Text style={styles.subjectBadgeText} numberOfLines={1}>{sub}</Text>
              </View>
            ))}
            {subjects.length > 2 && (
              <Text style={styles.moreSubjectsText}>+{subjects.length - 2}</Text>
            )}
          </View>
        </View>

        <View style={{ alignItems: 'flex-end', justifyContent: 'center', gap: 5 }}>
          {/* Status Kepegawaian */}
          <View style={[
            styles.statusPill, 
            isPns ? styles.statusPns : (isPppk ? styles.statusPppk : styles.statusHonorer)
          ]}>
            <Text style={[
              styles.statusPillText, 
              isPns ? styles.statusPnsText : (isPppk ? styles.statusPppkText : styles.statusHonorerText)
            ]}>
              {statusText}
            </Text>
          </View>

          {/* Jam Pelajaran (JP) */}
          <View style={[
            styles.jpBadge, 
            jpCount >= 24 ? styles.jpOptimal : styles.jpUnder
          ]}>
            <Feather 
              name="clock" 
              size={10} 
              color={jpCount >= 24 ? '#166534' : '#991B1B'} 
              style={{ marginRight: 3 }} 
            />
            <Text style={[styles.jpBadgeText, { color: jpCount >= 24 ? '#166534' : '#991B1B' }]}>
              {jpCount} JP
            </Text>
          </View>
        </View>
      </TouchableOpacity>
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
          <Text style={styles.headerTitle}>SDM & Guru</Text>
          <View style={styles.headerBadge}>
            <View style={[styles.dotOnline, { backgroundColor: '#3B82F6' }]} />
            <Text style={styles.headerBadgeText}>Data PTK, Beban Kerja & Pensiun</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.refreshButton} onPress={onRefresh} activeOpacity={0.7}>
          <Feather name="rotate-cw" size={18} color={Colors.secondary} />
        </TouchableOpacity>
      </View>

      {/* Tab Segment Selector */}
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'teachers' && styles.tabButtonActive]}
          onPress={() => setActiveTab('teachers')}
        >
          <Feather name="users" size={15} color={activeTab === 'teachers' ? '#FFF' : Colors.textLight} />
          <Text style={[styles.tabText, activeTab === 'teachers' && styles.tabTextActive]}>Data Guru ({totalTeachers})</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'workload' && styles.tabButtonActive]}
          onPress={() => setActiveTab('workload')}
        >
          <Feather name="clock" size={15} color={activeTab === 'workload' ? '#FFF' : Colors.textLight} />
          <Text style={[styles.tabText, activeTab === 'workload' && styles.tabTextActive]}>Beban JP</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'retirement' && styles.tabButtonActive]}
          onPress={() => setActiveTab('retirement')}
        >
          <Ionicons name="warning-outline" size={15} color={activeTab === 'retirement' ? '#FFF' : Colors.textLight} />
          <Text style={[styles.tabText, activeTab === 'retirement' && styles.tabTextActive]}>Pensiun</Text>
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      {isAccessDenied ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 28, marginTop: 40 }}>
          <View style={{ width: 68, height: 68, borderRadius: 34, backgroundColor: '#FEE2E2', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
            <Ionicons name="lock-closed" size={32} color="#EF4444" />
          </View>
          <Text style={{ fontSize: 18, fontWeight: '700', color: Colors.text, marginBottom: 8, textAlign: 'center' }}>
            Akses Dibatasi
          </Text>
          <Text style={{ fontSize: 13, color: Colors.textLight, textAlign: 'center', lineHeight: 20, marginBottom: 24, paddingHorizontal: 16 }}>
            Modul Manajemen SDM & Kepegawaian hanya dapat diakses oleh Administrator, Pimpinan Sekolah, dan Tata Usaha.
          </Text>
          <TouchableOpacity
            style={{ backgroundColor: Colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 }}
            onPress={() => router.back()}
            activeOpacity={0.8}
          >
            <Text style={{ color: '#FFF', fontWeight: '600', fontSize: 14 }}>Kembali ke Beranda</Text>
          </TouchableOpacity>
        </View>
      ) : isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Memuat direktori SDM & Guru...</Text>
        </View>
      ) : (
        <View style={{ flex: 1 }}>

          {/* TAB 1: DATA GURU & PTK */}
          {activeTab === 'teachers' && (
            <View style={{ flex: 1 }}>
              {/* Search & Status Filters */}
              <View style={styles.filterSection}>
                <View style={styles.searchBox}>
                  <Feather name="search" size={18} color={Colors.textLight} style={{ marginRight: 8 }} />
                  <TextInput 
                    style={styles.searchInput}
                    placeholder="Cari nama guru, NIP, atau mata pelajaran..."
                    placeholderTextColor="#94A3B8"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                  />
                  {searchQuery ? (
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                      <Feather name="x" size={16} color={Colors.textLight} />
                    </TouchableOpacity>
                  ) : null}
                </View>

                {/* Status Filter Pills */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statusPillsContainer}>
                  <TouchableOpacity 
                    style={[styles.statusFilterPill, selectedStatus === 'all' && styles.statusFilterPillActive]}
                    onPress={() => setSelectedStatus('all')}
                  >
                    <Text style={[styles.statusFilterPillText, selectedStatus === 'all' && styles.statusFilterPillTextActive]}>
                      Semua PTK ({totalTeachers})
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[styles.statusFilterPill, selectedStatus === 'pns' && styles.statusFilterPillActive]}
                    onPress={() => setSelectedStatus('pns')}
                  >
                    <Text style={[styles.statusFilterPillText, selectedStatus === 'pns' && styles.statusFilterPillTextActive]}>
                      PNS
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[styles.statusFilterPill, selectedStatus === 'pppk' && styles.statusFilterPillActive]}
                    onPress={() => setSelectedStatus('pppk')}
                  >
                    <Text style={[styles.statusFilterPillText, selectedStatus === 'pppk' && styles.statusFilterPillTextActive]}>
                      PPPK
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[styles.statusFilterPill, selectedStatus === 'honor' && styles.statusFilterPillActive]}
                    onPress={() => setSelectedStatus('honor')}
                  >
                    <Text style={[styles.statusFilterPillText, selectedStatus === 'honor' && styles.statusFilterPillTextActive]}>
                      Honorer / GTT
                    </Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>

              {/* Teachers FlatList */}
              <FlatList
                data={filteredTeachers}
                keyExtractor={(item, index) => String(item.id || index)}
                renderItem={renderTeacherItem}
                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 50, gap: 10 }}
                refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
                showsVerticalScrollIndicator={false}
                initialNumToRender={15}
                maxToRenderPerBatch={15}
                windowSize={7}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Feather name="user-x" size={44} color="#CBD5E1" />
                    <Text style={styles.emptyText}>Tidak ada data guru yang sesuai kriteria</Text>
                  </View>
                }
              />
            </View>
          )}

          {/* TAB 2: ANALISIS BEBAN MENGAJAR (JP) */}
          {activeTab === 'workload' && (
            <ScrollView 
              contentContainerStyle={{ padding: 20, paddingBottom: 60, gap: 14 }}
              refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
              showsVerticalScrollIndicator={false}
            >
              {/* Stat Summary Cards */}
              <View style={styles.workloadStatsRow}>
                <View style={[styles.workloadCard, { backgroundColor: '#EFF6FF', borderColor: '#DBEAFE' }]}>
                  <Text style={styles.workloadStatLabel}>Rata-rata Beban</Text>
                  <Text style={[styles.workloadStatNumber, { color: '#1D4ED8' }]}>{avgJP} <Text style={{ fontSize: 13 }}>JP</Text></Text>
                  <Text style={styles.workloadStatSub}>Target standar 24 JP</Text>
                </View>

                <View style={[styles.workloadCard, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
                  <Text style={styles.workloadStatLabel}>Tuntas Sertifikasi</Text>
                  <Text style={[styles.workloadStatNumber, { color: '#059669' }]}>{meetingNormTeachers} <Text style={{ fontSize: 13 }}>Guru</Text></Text>
                  <Text style={styles.workloadStatSub}>Beban ≥ 24 Jam</Text>
                </View>

                <View style={[styles.workloadCard, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
                  <Text style={styles.workloadStatLabel}>Belum Memenuhi</Text>
                  <Text style={[styles.workloadStatNumber, { color: '#DC2626' }]}>{criticalTeachers} <Text style={{ fontSize: 13 }}>Guru</Text></Text>
                  <Text style={styles.workloadStatSub}>Beban &lt; 24 Jam</Text>
                </View>
              </View>

              <View style={styles.sectionHeaderRow}>
                <Text style={styles.cardHeaderTitle}>Distribusi Beban Jam Pelajaran (JP)</Text>
                <Text style={{ fontSize: 12, color: Colors.textLight }}>Standar BNSP: 24-40 JP</Text>
              </View>

              {/* Workload List */}
              {teachersList
                .slice()
                .sort((a, b) => (b._count?.schedules || 0) - (a._count?.schedules || 0))
                .map((t, idx) => {
                  const jp = t._count?.schedules || 0;
                  const isOptimal = jp >= 24 && jp <= 35;
                  const isHigh = jp > 35;
                  const isLow = jp < 24;
                  const percent = Math.min(100, Math.round((jp / 40) * 100));

                  return (
                    <View key={t.id || idx} style={styles.workloadRowCard}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <View style={{ flex: 1, marginRight: 10 }}>
                          <Text style={styles.workloadTeacherName} numberOfLines={1}>{t.formatted_name || t.name}</Text>
                          <Text style={styles.workloadTeacherMapel}>
                            {(t.subjects_list && t.subjects_list.length > 0) ? t.subjects_list.join(', ') : 'Belum Terjadwal'}
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={[
                            styles.workloadJpText, 
                            { color: isOptimal ? '#059669' : (isHigh ? '#D97706' : '#DC2626') }
                          ]}>
                            {jp} JP
                          </Text>
                          <Text style={[
                            styles.workloadStatusText,
                            { color: isOptimal ? '#059669' : (isHigh ? '#D97706' : '#DC2626') }
                          ]}>
                            {isOptimal ? 'Memenuhi' : (isHigh ? 'Beban Tinggi' : 'Kurang JP')}
                          </Text>
                        </View>
                      </View>

                      {/* Progress Bar */}
                      <View style={styles.workloadBarBg}>
                        <View 
                          style={[
                            styles.workloadBarFill, 
                            { 
                              width: `${percent}%`,
                              backgroundColor: isOptimal ? '#10B981' : (isHigh ? '#F59E0B' : '#EF4444')
                            }
                          ]} 
                        />
                      </View>
                    </View>
                  );
                })}
            </ScrollView>
          )}

          {/* TAB 3: WASPADA PENSIUN */}
          {activeTab === 'retirement' && (
            <ScrollView 
              contentContainerStyle={{ padding: 20, paddingBottom: 60, gap: 14 }}
              refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
              showsVerticalScrollIndicator={false}
            >
              {/* Year Selector Pills */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={styles.cardHeaderTitle}>Prediksi Purna Tugas Pegawai</Text>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {[currentYear, currentYear + 1, currentYear + 2].map((yr) => (
                    <TouchableOpacity 
                      key={yr}
                      style={[styles.yearPill, selectedYear === yr && styles.yearPillActive]}
                      onPress={() => setSelectedYear(yr)}
                    >
                      <Text style={[styles.yearPillText, selectedYear === yr && styles.yearPillTextActive]}>{yr}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Retirement Info Banner */}
              <View style={styles.retireInfoBanner}>
                <Ionicons name="information-circle-outline" size={20} color="#0284C7" style={{ marginRight: 8 }} />
                <Text style={styles.retireInfoText}>
                  Batas Usia Pensiun (BUP): Guru/Kepsek <Text style={{ fontWeight: '700' }}>60 Thn</Text>, Staf TU <Text style={{ fontWeight: '700' }}>58 Thn</Text>.
                </Text>
              </View>

              {isLoadingRetirement ? (
                <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color={Colors.primary} />
                </View>
              ) : (retirementData.details || []).length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="checkmark-done-circle-outline" size={48} color="#10B981" />
                  <Text style={[styles.emptyText, { fontWeight: '700', color: Colors.secondary }]}>
                    Nihil Pensiun di Tahun {selectedYear}
                  </Text>
                  <Text style={{ fontSize: 12, color: Colors.textLight, marginTop: 4 }}>
                    Tidak ada tenaga pendidik yang mencapai BUP pada tahun ini.
                  </Text>
                </View>
              ) : (
                (retirementData.details || []).map((ret: any, idx: number) => {
                  const birthFormatted = ret.birth_date ? new Date(ret.birth_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-';
                  const retireFormatted = ret.retire_date ? new Date(ret.retire_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-';

                  return (
                    <View key={ret.id || idx} style={styles.retireCard}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <View style={styles.retireAlertBadge}>
                          <Ionicons name="time-outline" size={13} color="#C2410C" style={{ marginRight: 4 }} />
                          <Text style={styles.retireAlertText}>Purna Tugas {selectedYear}</Text>
                        </View>
                        <Text style={styles.retireAgeText}>BUP: {ret.retire_age} Tahun</Text>
                      </View>

                      <Text style={styles.retireName}>{ret.name}</Text>
                      <Text style={styles.retireSub}>NIP: {ret.nip || '-'} • Jabatan: {ret.jabatan || 'Guru'}</Text>

                      <View style={styles.retireDatesRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.retireDateLabel}>Lahir</Text>
                          <Text style={styles.retireDateValue}>{birthFormatted}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.retireDateLabel}>TMT Pensiun</Text>
                          <Text style={[styles.retireDateValue, { color: '#C2410C', fontWeight: '700' }]}>{retireFormatted}</Text>
                        </View>
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>
          )}

        </View>
      )}

      {/* DETAIL GURU MODAL */}
      <Modal visible={!!selectedTeacher} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.detailCard}>
            <View style={styles.detailHeader}>
              <Text style={styles.detailHeaderTitle}>Profil Lengkap Guru / PTK</Text>
              <TouchableOpacity onPress={() => setSelectedTeacher(null)} style={styles.closeDetailBtn}>
                <Feather name="x" size={20} color={Colors.secondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              {/* Profile Avatar & Name */}
              <View style={styles.detailHero}>
                <View style={[
                  styles.detailAvatarContainer, 
                  { borderColor: getTeacherGender(selectedTeacher) === 'L' ? '#93C5FD' : '#F472B6' }
                ]}>
                  <Image 
                    source={getTeacherAvatar(selectedTeacher)}
                    style={styles.detailAvatarImage}
                    resizeMode="cover"
                  />
                </View>
                <Text style={styles.detailName}>{selectedTeacher?.formatted_name || selectedTeacher?.name}</Text>
                <Text style={styles.detailNip}>
                  NIP: {selectedTeacher?.nip || '-'}
                  {selectedTeacher?.nik ? ` | NIK: ${selectedTeacher.nik}` : ''}
                </Text>
              </View>

              {/* Data Fields */}
              <View style={styles.detailInfoBox}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Jabatan PTK</Text>
                  <Text style={[styles.detailValue, { fontWeight: '700', color: Colors.primary }]}>
                    {getTeacherJabatan(selectedTeacher)}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Status Kepegawaian</Text>
                  <Text style={[styles.detailValue, { fontWeight: '700' }]}>
                    {getTeacherEmploymentStatus(selectedTeacher)}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Beban Jam Mengajar</Text>
                  <Text style={[styles.detailValue, { fontWeight: '700', color: '#166534' }]}>
                    {selectedTeacher?._count?.schedules || 0} JP / Minggu
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Mata Pelajaran Diampu</Text>
                  <Text style={styles.detailValue}>
                    {(selectedTeacher?.subjects_list && selectedTeacher.subjects_list.length > 0) 
                      ? selectedTeacher.subjects_list.join(', ') 
                      : '-'}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Jenis Kelamin</Text>
                  <Text style={styles.detailValue}>
                    {getTeacherGender(selectedTeacher) === 'L' ? 'Laki-laki' : 'Perempuan'}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Pangkat / Golongan</Text>
                  <Text style={styles.detailValue}>
                    {selectedTeacher?.teacher_profiles?.mst_pangkat_golongan?.name || '-'}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Sertifikasi Guru</Text>
                  <Text style={[
                    styles.detailValue, 
                    { color: selectedTeacher?.teacher_profiles?.is_certified ? '#059669' : '#64748B', fontWeight: '700' }
                  ]}>
                    {selectedTeacher?.teacher_profiles?.is_certified ? 'Tersertifikasi' : 'Belum Sertifikasi'}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>No. Handphone / WA</Text>
                  <Text style={styles.detailValue}>
                    {selectedTeacher?.teacher_profiles?.phone || selectedTeacher?.phone || '-'}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Email</Text>
                  <Text style={styles.detailValue}>
                    {selectedTeacher?.teacher_profiles?.email || selectedTeacher?.email || '-'}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Status Aktif</Text>
                  <Text style={[
                    styles.detailValue, 
                    { color: selectedTeacher?.is_active ? '#166534' : '#DC2626', fontWeight: '700' }
                  ]}>
                    {selectedTeacher?.is_active ? 'Aktif Mengajar' : 'Nonaktif'}
                  </Text>
                </View>
              </View>

              {/* Admin Action: Generate Account / Quick Info */}
              <TouchableOpacity 
                style={styles.adminActionBtn}
                onPress={handleGenerateAccounts}
                disabled={isGeneratingAcc}
                activeOpacity={0.8}
              >
                {isGeneratingAcc ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <>
                    <Feather name="key" size={16} color="#FFF" style={{ marginRight: 8 }} />
                    <Text style={styles.adminActionBtnText}>Generate Akun Login Guru (Password 123456)</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* FEEDBACK MODAL */}
      <Modal visible={!!actionFeedback} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.feedbackCard}>
            <View style={styles.feedbackIconCircle}>
              <Feather name="check-circle" size={24} color={Colors.primary} />
            </View>
            <Text style={styles.feedbackTitle}>Informasi Sistem</Text>
            <Text style={styles.feedbackSubtitle}>{actionFeedback}</Text>
            <TouchableOpacity 
              style={styles.feedbackCloseBtn}
              onPress={() => setActionFeedback(null)}
              activeOpacity={0.8}
            >
              <Text style={styles.feedbackCloseText}>Tutup</Text>
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
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  backButton: {
    padding: 6,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.secondary,
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  dotOnline: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  headerBadgeText: {
    fontSize: 11,
    color: Colors.textLight,
    fontWeight: '500',
  },
  refreshButton: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#F8F9FA',
  },
  tabButtonActive: {
    backgroundColor: '#3B82F6',
  },
  tabText: {
    fontSize: 12,
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
  },
  loadingText: {
    fontSize: 13,
    color: Colors.textLight,
    marginTop: 10,
  },
  filterSection: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 6,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    marginBottom: 10,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: '#EEEEEE',
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: Colors.secondary,
  },
  statusPillsContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 10,
  },
  statusFilterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  statusFilterPillActive: {
    backgroundColor: '#3B82F6',
  },
  statusFilterPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.secondary,
  },
  statusFilterPillTextActive: {
    color: '#FFF',
    fontWeight: '700',
  },
  teacherCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EEEEEE',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 },
      android: { elevation: 1 },
    }),
  },
  avatarContainer: {
    width: 46,
    height: 46,
    borderRadius: 23,
    overflow: 'hidden',
    borderWidth: 1.5,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  teacherName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.secondary,
    marginBottom: 2,
  },
  teacherNip: {
    fontSize: 11,
    color: Colors.textLight,
    marginBottom: 4,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap',
  },
  jabatanBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  jabatanBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  subjectBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  subjectBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#475569',
  },
  moreSubjectsText: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '600',
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  statusPns: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  statusPnsText: {
    color: '#1D4ED8',
  },
  statusPppk: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  statusPppkText: {
    color: '#15803D',
  },
  statusHonorer: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  statusHonorerText: {
    color: '#B45309',
  },
  jpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  jpOptimal: {
    backgroundColor: '#DCFCE7',
  },
  jpUnder: {
    backgroundColor: '#FEE2E2',
  },
  jpBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  workloadStatsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  workloadCard: {
    flex: 1,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  workloadStatLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textLight,
  },
  workloadStatNumber: {
    fontSize: 18,
    fontWeight: '800',
    marginVertical: 2,
  },
  workloadStatSub: {
    fontSize: 10,
    color: Colors.textLight,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  cardHeaderTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.secondary,
  },
  workloadRowCard: {
    backgroundColor: '#FFF',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  workloadTeacherName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.secondary,
  },
  workloadTeacherMapel: {
    fontSize: 11,
    color: Colors.textLight,
    marginTop: 1,
  },
  workloadJpText: {
    fontSize: 15,
    fontWeight: '800',
  },
  workloadStatusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  workloadBarBg: {
    height: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 6,
  },
  workloadBarFill: {
    height: 6,
    borderRadius: 3,
  },
  yearPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  yearPillActive: {
    backgroundColor: '#3B82F6',
  },
  yearPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.secondary,
  },
  yearPillTextActive: {
    color: '#FFF',
    fontWeight: '700',
  },
  retireInfoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  retireInfoText: {
    fontSize: 12,
    color: '#0369A1',
    flex: 1,
  },
  retireCard: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  retireAlertBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEDD5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  retireAlertText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#C2410C',
  },
  retireAgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textLight,
  },
  retireName: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.secondary,
    marginTop: 2,
  },
  retireSub: {
    fontSize: 12,
    color: Colors.textLight,
    marginTop: 2,
  },
  retireDatesRow: {
    flexDirection: 'row',
    backgroundColor: '#F8F9FA',
    padding: 10,
    borderRadius: 10,
    marginTop: 10,
  },
  retireDateLabel: {
    fontSize: 10,
    color: Colors.textLight,
  },
  retireDateValue: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.secondary,
    marginTop: 1,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyText: {
    fontSize: 13,
    color: Colors.textLight,
    marginTop: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  detailCard: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '88%',
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  detailHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.secondary,
  },
  closeDetailBtn: {
    padding: 4,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
  detailHero: {
    alignItems: 'center',
    marginBottom: 20,
  },
  detailAvatarContainer: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 2.5,
    overflow: 'hidden',
    backgroundColor: '#F1F5F9',
    marginBottom: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailAvatarImage: {
    width: 76,
    height: 76,
    borderRadius: 38,
  },
  detailName: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.secondary,
    textAlign: 'center',
  },
  detailNip: {
    fontSize: 12,
    color: Colors.textLight,
    marginTop: 2,
  },
  detailInfoBox: {
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  detailLabel: {
    fontSize: 12,
    color: Colors.textLight,
  },
  detailValue: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.secondary,
    maxWidth: '60%',
    textAlign: 'right',
  },
  adminActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
    paddingVertical: 14,
    borderRadius: 14,
  },
  adminActionBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  feedbackCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    margin: 24,
    alignSelf: 'center',
    width: '85%',
  },
  feedbackIconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  feedbackTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.secondary,
    marginBottom: 6,
  },
  feedbackSubtitle: {
    fontSize: 13,
    color: Colors.secondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  feedbackCloseBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 28,
    borderRadius: 12,
  },
  feedbackCloseText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
