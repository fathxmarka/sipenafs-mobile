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

type TabType = 'students' | 'classes' | 'mutations';

const avatarMale = require('../../../assets/images/avatar_male.png');
const avatarFemale = require('../../../assets/images/avatar_female.png');

export default function KesiswaanScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<TabType>('students');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Data states
  const [studentsList, setStudentsList] = useState<any[]>([]);
  const [classesList, setClassesList] = useState<any[]>([]);
  const [mutationsList, setMutationsList] = useState<any[]>([]);
  const [totalStudents, setTotalStudents] = useState<number>(0);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  
  // Detail Modal & Action states
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [isResettingPass, setIsResettingPass] = useState(false);
  const [isResettingFace, setIsResettingFace] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      const apiUrl = await SecureStore.getItemAsync('sipena_api_url');
      const token = await SecureStore.getItemAsync('sipena_token');

      if (!apiUrl || !token) {
        setIsLoading(false);
        return;
      }

      const headers = { Authorization: `Bearer ${token}` };

      // Load Students (all), Classes, and Mutations in parallel
      const [resStudents, resClasses, resMutations] = await Promise.allSettled([
        axios.get(`${apiUrl}/api/students?perPage=1000`, { headers }),
        axios.get(`${apiUrl}/api/classes?perPage=all`, { headers }),
        axios.get(`${apiUrl}/api/mutations`, { headers })
      ]);

      if (resStudents.status === 'fulfilled' && resStudents.value.data) {
        const dataArr = resStudents.value.data.data || [];
        setStudentsList(dataArr);
        setTotalStudents(resStudents.value.data.total || dataArr.length);
      }
      if (resClasses.status === 'fulfilled' && resClasses.value.data) {
        setClassesList(resClasses.value.data.data || []);
      }
      if (resMutations.status === 'fulfilled' && resMutations.value.data) {
        setMutationsList(resMutations.value.data.data || []);
      }
    } catch (e: any) {
      console.warn('Gagal memuat data kesiswaan:', e.message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchAllData();
  };

  // Helper to extract student class name reliably
  const getStudentClassName = (student: any): string => {
    if (!student) return '-';
    if (student.enrollments && Array.isArray(student.enrollments) && student.enrollments.length > 0) {
      const activeEnrollment = student.enrollments.find((e: any) => !e.deleted_at) || student.enrollments[0];
      if (activeEnrollment?.class?.name) {
        return activeEnrollment.class.name;
      }
    }
    if (student.classes?.name) return student.classes.name;
    if (student.class_name) return student.class_name;
    return 'Belum Ada Kelas';
  };

  // Helper to get avatar source: real photo or gender-based avatar
  const getStudentAvatar = (student: any) => {
    const isMale = student?.gender === 'L' || (student?.gender || '').toLowerCase().startsWith('l');
    const defaultAsset = isMale ? avatarMale : avatarFemale;

    if (student?.photo && student?.photo_url && !student.photo_url.includes('defaults/avatar_')) {
      return { uri: student.photo_url };
    }
    return defaultAsset;
  };

  // Reset Student Password (Admin Action)
  const handleResetStudentPassword = async (studentId: string, studentName: string) => {
    setIsResettingPass(true);
    try {
      const apiUrl = await SecureStore.getItemAsync('sipena_api_url');
      const token = await SecureStore.getItemAsync('sipena_token');
      const headers = { Authorization: `Bearer ${token}` };

      const res = await axios.post(`${apiUrl}/api/students/${studentId}/reset-password`, {}, { headers });
      setSelectedStudent(null);
      setActionFeedback(res.data?.message || `Password untuk siswa "${studentName}" berhasil direset ke: 123456`);
    } catch (e: any) {
      setActionFeedback(e.response?.data?.message || 'Gagal mereset password siswa.');
    } finally {
      setIsResettingPass(false);
    }
  };

  // Reset Student Face ID (Admin Action)
  const handleResetStudentFace = async (studentId: string, studentName: string) => {
    setIsResettingFace(true);
    try {
      const apiUrl = await SecureStore.getItemAsync('sipena_api_url');
      const token = await SecureStore.getItemAsync('sipena_token');
      const headers = { Authorization: `Bearer ${token}` };

      const res = await axios.post(`${apiUrl}/api/students/${studentId}/reset-face`, {}, { headers });
      setSelectedStudent(null);
      setActionFeedback(res.data?.message || `Data Face ID milik siswa "${studentName}" berhasil direset.`);
    } catch (e: any) {
      setActionFeedback(e.response?.data?.message || 'Gagal mereset Face ID siswa.');
    } finally {
      setIsResettingFace(false);
    }
  };

  // Filter students based on search and selected class
  const filteredStudents = studentsList.filter(s => {
    const q = searchQuery.toLowerCase().trim();
    const nameMatch = (s.name || '').toLowerCase().includes(q);
    const nisnMatch = (s.nisn || '').toLowerCase().includes(q);
    const matchesSearch = !q || nameMatch || nisnMatch;

    if (selectedClassId !== 'all') {
      const activeEnrollment = s.enrollments?.find((e: any) => !e.deleted_at) || s.enrollments?.[0];
      const studentClassId = String(activeEnrollment?.class_id || activeEnrollment?.class?.id || s.class_id || '');
      return matchesSearch && studentClassId === selectedClassId;
    }
    return matchesSearch;
  });

  const renderStudentItem = ({ item }: { item: any }) => {
    const isMale = item.gender === 'L' || (item.gender || '').toLowerCase().startsWith('l');
    const className = getStudentClassName(item);
    const hasClass = className !== 'Belum Ada Kelas' && className !== '-';
    const avatarSource = getStudentAvatar(item);

    return (
      <TouchableOpacity 
        style={styles.studentCard}
        onPress={() => setSelectedStudent(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.avatarContainer, { borderColor: isMale ? '#BFDBFE' : '#FBCFE8' }]}>
          <Image 
            source={avatarSource} 
            style={styles.avatarImage}
            resizeMode="cover"
          />
        </View>
        
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.studentName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.studentNisn}>
            NISN: <Text style={{ fontWeight: '600', color: Colors.secondary }}>{item.nisn || '-'}</Text>
            {item.nis ? <Text style={{ color: '#94A3B8' }}> | NIS: {item.nis}</Text> : null}
          </Text>
        </View>

        <View style={{ alignItems: 'flex-end', justifyContent: 'center', gap: 4 }}>
          <View style={[styles.classBadge, hasClass ? styles.classBadgeAssigned : styles.classBadgeUnassigned]}>
            <Text style={[styles.classBadgeText, hasClass ? styles.classBadgeAssignedText : styles.classBadgeUnassignedText]}>
              {className}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={[
              styles.statusBadge, 
              item.status === 'Aktif' ? styles.statusAktif : (item.status === 'Lulus' ? styles.statusLulus : styles.statusNonAktif)
            ]}>
              <Text style={[
                styles.statusBadgeText,
                item.status === 'Aktif' ? styles.statusAktifText : (item.status === 'Lulus' ? styles.statusLulusText : styles.statusNonAktifText)
              ]}>
                {item.status || 'Aktif'}
              </Text>
            </View>
            <View style={[styles.genderBadge, { backgroundColor: isMale ? '#EFF6FF' : '#FDF2F8' }]}>
              <Text style={[styles.genderBadgeText, { color: isMale ? '#2563EB' : '#DB2777' }]}>
                {isMale ? 'L' : 'P'}
              </Text>
            </View>
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
          <Text style={styles.headerTitle}>Kesiswaan</Text>
          <View style={styles.headerBadge}>
            <View style={[styles.dotOnline, { backgroundColor: '#10B981' }]} />
            <Text style={styles.headerBadgeText}>Data Master Siswa & Rombel</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.refreshButton} onPress={onRefresh} activeOpacity={0.7}>
          <Feather name="rotate-cw" size={18} color={Colors.secondary} />
        </TouchableOpacity>
      </View>

      {/* Tab Segment Selector */}
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'students' && styles.tabButtonActive]}
          onPress={() => setActiveTab('students')}
        >
          <Feather name="users" size={15} color={activeTab === 'students' ? '#FFF' : Colors.textLight} />
          <Text style={[styles.tabText, activeTab === 'students' && styles.tabTextActive]}>Data Siswa</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'classes' && styles.tabButtonActive]}
          onPress={() => setActiveTab('classes')}
        >
          <MaterialCommunityIcons name="google-classroom" size={15} color={activeTab === 'classes' ? '#FFF' : Colors.textLight} />
          <Text style={[styles.tabText, activeTab === 'classes' && styles.tabTextActive]}>Rombel ({classesList.length})</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'mutations' && styles.tabButtonActive]}
          onPress={() => setActiveTab('mutations')}
        >
          <Ionicons name="swap-horizontal" size={15} color={activeTab === 'mutations' ? '#FFF' : Colors.textLight} />
          <Text style={[styles.tabText, activeTab === 'mutations' && styles.tabTextActive]}>Mutasi Siswa</Text>
        </TouchableOpacity>
      </View>

      {/* Main Content Area */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Memuat database kesiswaan...</Text>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          
          {/* TAB 1: DATA SISWA */}
          {activeTab === 'students' && (
            <View style={{ flex: 1 }}>
              {/* Search & Class Filter */}
              <View style={styles.filterSection}>
                <View style={styles.searchBox}>
                  <Feather name="search" size={18} color={Colors.textLight} style={{ marginRight: 8 }} />
                  <TextInput 
                    style={styles.searchInput}
                    placeholder="Cari siswa (Nama / NISN)..."
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

                {/* Class Pills Horizontal Scroll */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.classPillsContainer}>
                  <TouchableOpacity 
                    style={[styles.classPill, selectedClassId === 'all' && styles.classPillActive]}
                    onPress={() => setSelectedClassId('all')}
                  >
                    <Text style={[styles.classPillText, selectedClassId === 'all' && styles.classPillTextActive]}>
                      Semua Kelas ({totalStudents})
                    </Text>
                  </TouchableOpacity>

                  {classesList.map((cls) => {
                    const isSelected = selectedClassId === String(cls.id);
                    return (
                      <TouchableOpacity 
                        key={cls.id} 
                        style={[styles.classPill, isSelected && styles.classPillActive]}
                        onPress={() => setSelectedClassId(String(cls.id))}
                      >
                        <Text style={[styles.classPillText, isSelected && styles.classPillTextActive]}>
                          {cls.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Students List via FlatList */}
              <FlatList
                data={filteredStudents}
                keyExtractor={(item, index) => String(item.id || index)}
                renderItem={renderStudentItem}
                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 50, gap: 10 }}
                refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
                showsVerticalScrollIndicator={false}
                initialNumToRender={15}
                maxToRenderPerBatch={15}
                windowSize={7}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Feather name="user-x" size={44} color="#CBD5E1" />
                    <Text style={styles.emptyText}>Tidak ada siswa yang sesuai kriteria</Text>
                  </View>
                }
              />
            </View>
          )}

          {/* TAB 2: MANAJEMEN ROMBEL (KELAS) */}
          {activeTab === 'classes' && (
            <ScrollView 
              contentContainerStyle={{ padding: 20, paddingBottom: 50, gap: 12 }}
              refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.cardHeaderTitle}>Daftar Rombel Aktif</Text>
                <Text style={{ fontSize: 12, color: Colors.textLight }}>Total: {classesList.length} Rombongan Belajar</Text>
              </View>

              {classesList.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <MaterialCommunityIcons name="google-classroom" size={44} color="#CBD5E1" />
                  <Text style={styles.emptyText}>Belum ada rombel yang terdaftar</Text>
                </View>
              ) : (
                classesList.map((cls, idx) => {
                  const studentCount = cls._count?.enrollments ?? studentsList.filter(s => {
                    const activeEnrollment = s.enrollments?.find((e: any) => !e.deleted_at) || s.enrollments?.[0];
                    const sClassId = String(activeEnrollment?.class_id || activeEnrollment?.class?.id || s.class_id || '');
                    return sClassId === String(cls.id);
                  }).length;
                  return (
                    <View key={cls.id || idx} style={styles.classCard}>
                      <View style={styles.classIconBg}>
                        <MaterialCommunityIcons name="google-classroom" size={24} color={Colors.primary} />
                      </View>
                      <View style={{ flex: 1, marginLeft: 14 }}>
                        <Text style={styles.classNameText}>{cls.name}</Text>
                        <Text style={styles.classLevelText}>
                          Tingkat: <Text style={{ fontWeight: '700', color: Colors.secondary }}>{cls.level || '-'}</Text>
                          {cls.teacher?.name ? <Text style={{ color: '#64748B' }}> • Wali: {cls.teacher.name}</Text> : null}
                        </Text>
                      </View>
                      <View style={styles.studentCountBadge}>
                        <Text style={styles.studentCountNumber}>{studentCount}</Text>
                        <Text style={styles.studentCountLabel}>Siswa</Text>
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>
          )}

          {/* TAB 3: MUTASI SISWA */}
          {activeTab === 'mutations' && (
            <ScrollView 
              contentContainerStyle={{ padding: 20, paddingBottom: 50, gap: 12 }}
              refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.cardHeaderTitle}>Riwayat Mutasi Masuk / Keluar</Text>
                <Text style={{ fontSize: 12, color: Colors.textLight }}>{mutationsList.length} Pengajuan</Text>
              </View>

              {mutationsList.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="swap-horizontal" size={44} color="#CBD5E1" />
                  <Text style={styles.emptyText}>Tidak ada riwayat mutasi siswa</Text>
                </View>
              ) : (
                mutationsList.map((m, idx) => (
                  <View key={m.id || idx} style={styles.mutationCard}>
                    <View style={styles.mutationHeader}>
                      <View style={[styles.mutationTypeBadge, { backgroundColor: m.type === 'MASUK' ? '#E8F5E9' : '#FFF3E0' }]}>
                        <Text style={[styles.mutationTypeText, { color: m.type === 'MASUK' ? '#2E7D32' : '#E65100' }]}>
                          MUTASI {m.type || 'KELUAR'}
                        </Text>
                      </View>
                      <Text style={styles.mutationDate}>
                        {m.created_at ? new Date(m.created_at).toLocaleDateString('id-ID') : '-'}
                      </Text>
                    </View>
                    <Text style={styles.mutationStudentName}>{m.student?.name || m.student_name || 'Nama Siswa'}</Text>
                    <Text style={styles.mutationDetail}>Sekolah Tujuan/Asal: <Text style={{ fontWeight: '600', color: Colors.secondary }}>{m.school_destination || m.school_origin || '-'}</Text></Text>
                  </View>
                ))
              )}
            </ScrollView>
          )}

        </View>
      )}

      {/* DETAIL SISWA MODAL */}
      <Modal visible={!!selectedStudent} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.detailCard}>
            <View style={styles.detailHeader}>
              <Text style={styles.detailHeaderTitle}>Biodata Siswa</Text>
              <TouchableOpacity onPress={() => setSelectedStudent(null)} style={styles.closeDetailBtn}>
                <Feather name="x" size={20} color={Colors.secondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              {/* Profile Avatar & Name */}
              <View style={styles.detailHero}>
                <View style={[
                  styles.detailAvatarContainer, 
                  { borderColor: (selectedStudent?.gender === 'L' || (selectedStudent?.gender || '').toLowerCase().startsWith('l')) ? '#93C5FD' : '#F472B6' }
                ]}>
                  <Image 
                    source={getStudentAvatar(selectedStudent)}
                    style={styles.detailAvatarImage}
                    resizeMode="cover"
                  />
                </View>
                <Text style={styles.detailName}>{selectedStudent?.name}</Text>
                <Text style={styles.detailNisn}>
                  NISN: {selectedStudent?.nisn || '-'}
                  {selectedStudent?.nis ? ` | NIS: ${selectedStudent.nis}` : ''}
                </Text>
              </View>

              {/* Data Fields */}
              <View style={styles.detailInfoBox}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Kelas / Rombel</Text>
                  <Text style={[styles.detailValue, { fontWeight: '700', color: Colors.primary }]}>
                    {getStudentClassName(selectedStudent)}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Jenis Kelamin</Text>
                  <Text style={styles.detailValue}>
                    {(selectedStudent?.gender === 'L' || (selectedStudent?.gender || '').toLowerCase().startsWith('l')) ? 'Laki-laki' : 'Perempuan'}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Tempat, Tanggal Lahir</Text>
                  <Text style={styles.detailValue}>
                    {selectedStudent?.birth_place ? `${selectedStudent.birth_place}, ` : ''}
                    {selectedStudent?.birth_date ? new Date(selectedStudent.birth_date).toLocaleDateString('id-ID') : '-'}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Agama</Text>
                  <Text style={styles.detailValue}>{selectedStudent?.religion || 'Islam'}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Orang Tua / Wali</Text>
                  <Text style={styles.detailValue}>{selectedStudent?.parent_name || '-'}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>No. HP Orang Tua</Text>
                  <Text style={styles.detailValue}>{selectedStudent?.parent_phone || '-'}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Status Siswa</Text>
                  <Text style={[
                    styles.detailValue, 
                    { 
                      color: selectedStudent?.status === 'Aktif' ? '#166534' : '#991B1B', 
                      fontWeight: '700' 
                    }
                  ]}>
                    {selectedStudent?.status || 'Aktif'}
                  </Text>
                </View>
              </View>

              {/* Admin Actions */}
              <View style={{ gap: 10 }}>
                {/* Reset Password */}
                <TouchableOpacity 
                  style={styles.adminActionBtn}
                  onPress={() => handleResetStudentPassword(selectedStudent?.id, selectedStudent?.name)}
                  disabled={isResettingPass || isResettingFace}
                  activeOpacity={0.8}
                >
                  {isResettingPass ? (
                    <ActivityIndicator color="#FFF" size="small" />
                  ) : (
                    <>
                      <Feather name="key" size={16} color="#FFF" style={{ marginRight: 8 }} />
                      <Text style={styles.adminActionBtnText}>Reset Password Akun Siswa (123456)</Text>
                    </>
                  )}
                </TouchableOpacity>

                {/* Reset Face ID */}
                <TouchableOpacity 
                  style={[styles.adminActionBtn, { backgroundColor: '#059669' }]}
                  onPress={() => handleResetStudentFace(selectedStudent?.id, selectedStudent?.name)}
                  disabled={isResettingPass || isResettingFace}
                  activeOpacity={0.8}
                >
                  {isResettingFace ? (
                    <ActivityIndicator color="#FFF" size="small" />
                  ) : (
                    <>
                      <Feather name="user-check" size={16} color="#FFF" style={{ marginRight: 8 }} />
                      <Text style={styles.adminActionBtnText}>Reset Face ID Siswa</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
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
            <Text style={styles.feedbackTitle}>Berhasil</Text>
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
    backgroundColor: '#10B981',
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
  classPillsContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 10,
  },
  classPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  classPillActive: {
    backgroundColor: '#10B981',
  },
  classPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.secondary,
  },
  classPillTextActive: {
    color: '#FFF',
    fontWeight: '700',
  },
  studentCard: {
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
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1.5,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  studentName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.secondary,
    marginBottom: 2,
  },
  studentNisn: {
    fontSize: 12,
    color: Colors.textLight,
  },
  classBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  classBadgeText: {
    fontSize: 11,
  },
  classBadgeAssigned: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  classBadgeAssignedText: {
    fontWeight: '800',
    color: '#1D4ED8',
  },
  classBadgeUnassigned: {
    backgroundColor: '#F1F5F9',
  },
  classBadgeUnassignedText: {
    fontWeight: '600',
    color: '#94A3B8',
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  statusAktif: {
    backgroundColor: '#DCFCE7',
  },
  statusAktifText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#166534',
  },
  statusLulus: {
    backgroundColor: '#F3E8FF',
  },
  statusLulusText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6B21A8',
  },
  statusNonAktif: {
    backgroundColor: '#FEE2E2',
  },
  statusNonAktifText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#991B1B',
  },
  genderBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  genderBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardHeaderTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.secondary,
  },
  classCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  classIconBg: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#E6F4F1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  classNameText: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.secondary,
    marginBottom: 2,
  },
  classLevelText: {
    fontSize: 12,
    color: Colors.textLight,
  },
  studentCountBadge: {
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  studentCountNumber: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.primary,
  },
  studentCountLabel: {
    fontSize: 10,
    color: Colors.textLight,
  },
  mutationCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  mutationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  mutationTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  mutationTypeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  mutationDate: {
    fontSize: 11,
    color: Colors.textLight,
  },
  mutationStudentName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.secondary,
    marginBottom: 4,
  },
  mutationDetail: {
    fontSize: 12,
    color: Colors.textLight,
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
    maxHeight: '85%',
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
  },
  detailNisn: {
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
  },
  adminActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D97706',
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
    backgroundColor: '#E0F2F1',
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
