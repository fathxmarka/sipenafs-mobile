import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  ActivityIndicator, RefreshControl, Image, TextInput, Platform, Modal 
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Colors from '../../constants/Colors';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';

type TabType = 'profile' | 'users' | 'audit';

export default function SystemSettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<TabType>('profile');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Data states
  const [schoolData, setSchoolData] = useState<any>(null);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [searchUser, setSearchUser] = useState('');

  // Admin action states
  const [resettingUser, setResettingUser] = useState<any>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  useEffect(() => {
    fetchAllData();
  }, []);

  const handleConfirmReset = async () => {
    if (!resettingUser) return;
    setIsResetting(true);
    try {
      const apiUrl = await SecureStore.getItemAsync('sipena_api_url');
      const token = await SecureStore.getItemAsync('sipena_token');
      const headers = { Authorization: `Bearer ${token}` };

      const res = await axios.put(`${apiUrl}/api/users/${resettingUser.id}/reset-password`, {}, { headers });
      setResettingUser(null);
      setActionFeedback(res.data?.message || `Password untuk ${resettingUser.username} berhasil direset ke: 123456`);
    } catch (e: any) {
      setActionFeedback(e.response?.data?.message || 'Gagal mereset password.');
    } finally {
      setIsResetting(false);
    }
  };

  const fetchAllData = async () => {
    try {
      const apiUrl = await SecureStore.getItemAsync('sipena_api_url');
      const token = await SecureStore.getItemAsync('sipena_token');

      if (!apiUrl || !token) {
        setIsLoading(false);
        return;
      }

      const headers = { Authorization: `Bearer ${token}` };

      // Fetch School Profile, Users, Audit Logs simultaneously
      const [resSchool, resUsers, resAudit] = await Promise.allSettled([
        axios.get(`${apiUrl}/api/school`, { headers }),
        axios.get(`${apiUrl}/api/users?limit=all`, { headers }),
        axios.get(`${apiUrl}/api/audit`, { headers })
      ]);

      if (resSchool.status === 'fulfilled' && resSchool.value.data?.data) {
        setSchoolData(resSchool.value.data.data);
      }
      if (resUsers.status === 'fulfilled' && resUsers.value.data?.data) {
        setUsersList(resUsers.value.data.data);
      }
      if (resAudit.status === 'fulfilled' && resAudit.value.data?.data) {
        setAuditLogs(resAudit.value.data.data);
      }
    } catch (e: any) {
      console.warn('Gagal memuat pengaturan sistem:', e.message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchAllData();
  };

  // Filter users by search
  const filteredUsers = usersList.filter(u => {
    if (!searchUser.trim()) return true;
    const q = searchUser.toLowerCase();
    const nameMatch = (u.name || '').toLowerCase().includes(q);
    const userMatch = (u.username || '').toLowerCase().includes(q);
    const roleMatch = (u.roles?.name || u.role || '').toLowerCase().includes(q);
    return nameMatch || userMatch || roleMatch;
  });

  const getRoleBadgeColor = (role: string = '') => {
    const r = role.toLowerCase();
    if (r.includes('admin') || r.includes('operator')) return { bg: '#E0F2F1', text: '#00796B' };
    if (r.includes('guru') || r.includes('teacher')) return { bg: '#E3F2FD', text: '#1565C0' };
    if (r.includes('kepala')) return { bg: '#FFF3E0', text: '#E65100' };
    return { bg: '#F5F5F5', text: '#616161' };
  };

  const getActionColor = (action: string = '') => {
    const a = action.toUpperCase();
    if (a.includes('CREATE')) return { bg: '#E8F5E9', text: '#2E7D32', label: 'TAMBAH' };
    if (a.includes('UPDATE')) return { bg: '#E3F2FD', text: '#1565C0', label: 'UBAH' };
    if (a.includes('DELETE')) return { bg: '#FFEBEE', text: '#C62828', label: 'HAPUS' };
    if (a.includes('APPROVE')) return { bg: '#F3E5F5', text: '#6A1B9A', label: 'SETUJUI' };
    return { bg: '#FFF8E1', text: '#F57F17', label: action };
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
          <Feather name="chevron-left" size={26} color={Colors.secondary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>1. Pengaturan Sistem</Text>
          <View style={styles.headerBadge}>
            <View style={styles.dotOnline} />
            <Text style={styles.headerBadgeText}>Pusat Kontrol</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.refreshButton} onPress={onRefresh} activeOpacity={0.7}>
          <Feather name="rotate-cw" size={18} color={Colors.secondary} />
        </TouchableOpacity>
      </View>

      {/* Tab Segment Selector */}
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'profile' && styles.tabButtonActive]}
          onPress={() => setActiveTab('profile')}
        >
          <Feather name="home" size={15} color={activeTab === 'profile' ? '#FFF' : Colors.textLight} />
          <Text style={[styles.tabText, activeTab === 'profile' && styles.tabTextActive]}>Profil Sekolah</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'users' && styles.tabButtonActive]}
          onPress={() => setActiveTab('users')}
        >
          <Feather name="users" size={15} color={activeTab === 'users' ? '#FFF' : Colors.textLight} />
          <Text style={[styles.tabText, activeTab === 'users' && styles.tabTextActive]}>User SSO</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'audit' && styles.tabButtonActive]}
          onPress={() => setActiveTab('audit')}
        >
          <Feather name="shield" size={15} color={activeTab === 'audit' ? '#FFF' : Colors.textLight} />
          <Text style={[styles.tabText, activeTab === 'audit' && styles.tabTextActive]}>Audit Log</Text>
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Memuat data konfigurasi...</Text>
        </View>
      ) : (
        <ScrollView 
          contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
          showsVerticalScrollIndicator={false}
        >
          {/* TAB 1: PROFIL SEKOLAH */}
          {activeTab === 'profile' && (
            <View>
              {/* School Hero Card */}
              <View style={styles.heroCard}>
                <View style={styles.heroTop}>
                  {schoolData?.logoUrl ? (
                    <Image source={{ uri: schoolData.logoUrl }} style={styles.schoolLogo} resizeMode="contain" />
                  ) : (
                    <View style={styles.schoolLogoFallback}>
                      <Ionicons name="school" size={28} color="#FFF" />
                    </View>
                  )}
                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <Text style={styles.schoolNameText}>{schoolData?.name || 'Nama Sekolah Belum Diset'}</Text>
                    <Text style={styles.schoolNpsnText}>NPSN: <Text style={{ fontWeight: '700', color: Colors.secondary }}>{schoolData?.npsn || '-'}</Text></Text>
                    <View style={styles.badgeRow}>
                      <View style={styles.jenjangBadge}>
                        <Text style={styles.jenjangBadgeText}>{schoolData?.level || 'SMA'}</Text>
                      </View>
                      <View style={[styles.jenjangBadge, { backgroundColor: '#E8F5E9' }]}>
                        <Text style={[styles.jenjangBadgeText, { color: '#2E7D32' }]}>{schoolData?.status_sekolah || schoolData?.status || 'Negeri'}</Text>
                      </View>
                    </View>
                  </View>
                </View>
              </View>

              {/* Detail Info Card */}
              <View style={styles.infoCard}>
                <Text style={styles.cardHeaderTitle}>Kepemimpinan & Verifikasi</Text>
                
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Kepala Sekolah</Text>
                  <Text style={styles.infoValue}>
                    {schoolData?.headmaster?.name ? 
                      `${schoolData.headmaster.gelar_depan ? schoolData.headmaster.gelar_depan + ' ' : ''}${schoolData.headmaster.name}${schoolData.headmaster.gelar_belakang ? ', ' + schoolData.headmaster.gelar_belakang : ''}`
                      : schoolData?.headmaster_name || '-'}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>NIP Kepala Sekolah</Text>
                  <Text style={styles.infoValue}>{schoolData?.headmaster?.nip || schoolData?.headmaster_nip || '-'}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Batas Usia Pensiun</Text>
                  <Text style={styles.infoValue}>Guru: {schoolData?.retire_age_teacher || 60} Thn / Staf: {schoolData?.retire_age_staff || 58} Thn</Text>
                </View>
              </View>

              {/* Alamat & Kontak Card */}
              <View style={styles.infoCard}>
                <Text style={styles.cardHeaderTitle}>Alamat & Kontak Resmi</Text>
                
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Alamat Jalan</Text>
                  <Text style={styles.infoValue}>{schoolData?.address || '-'}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Kode Pos</Text>
                  <Text style={styles.infoValue}>{schoolData?.postal_code || '-'}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Email Sekolah</Text>
                  <Text style={styles.infoValue}>{schoolData?.email || '-'}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Telepon / HP</Text>
                  <Text style={styles.infoValue}>{schoolData?.phone || '-'}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Website</Text>
                  <Text style={styles.infoValue}>{schoolData?.website || '-'}</Text>
                </View>
              </View>

              {/* Kebijakan Jam Kerja & Presensi */}
              <View style={styles.infoCard}>
                <Text style={styles.cardHeaderTitle}>Kebijakan Jam Kerja & Presensi</Text>
                
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Jam Kerja Sekolah</Text>
                  <Text style={styles.infoValue}>{schoolData?.working_hour_start || '07:00'} - {schoolData?.working_hour_end || '14:30'}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Toleransi Keterlambatan</Text>
                  <Text style={styles.infoValue}>{schoolData?.grace_period || 15} Menit</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Toleransi Jurnal Mengajar</Text>
                  <Text style={styles.infoValue}>{schoolData?.journal_grace_period || 15} Menit</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Radius Geofence GPS</Text>
                  <Text style={styles.infoValue}>{schoolData?.geofence_radius || 100} Meter</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Verifikasi Wajah (Face ID)</Text>
                  <Text style={[styles.infoValue, { color: schoolData?.is_face_journal ? Colors.primary : Colors.textLight }]}>
                    {schoolData?.is_face_journal ? 'Aktif' : 'Non-aktif'}
                  </Text>
                </View>
              </View>

              {/* Rekening & Legalitas */}
              {(schoolData?.nama_bank || schoolData?.rekening_bos || schoolData?.sk_pendirian_sekolah) && (
                <View style={styles.infoCard}>
                  <Text style={styles.cardHeaderTitle}>Rekening & Legalitas Sekolah</Text>
                  
                  {schoolData?.nama_bank ? (
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Bank Operasional</Text>
                      <Text style={styles.infoValue}>{schoolData.nama_bank} {schoolData.nama_kcp_unit ? `(${schoolData.nama_kcp_unit})` : ''}</Text>
                    </View>
                  ) : null}
                  {schoolData?.rekening_bos ? (
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>No. Rekening BOS</Text>
                      <Text style={styles.infoValue}>{schoolData.rekening_bos}</Text>
                    </View>
                  ) : null}
                  {schoolData?.atas_nama_rekening ? (
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Atas Nama Rekening</Text>
                      <Text style={styles.infoValue}>{schoolData.atas_nama_rekening}</Text>
                    </View>
                  ) : null}
                  {schoolData?.no_izin_operasional ? (
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>No. Izin Operasional</Text>
                      <Text style={styles.infoValue}>{schoolData.no_izin_operasional}</Text>
                    </View>
                  ) : null}
                  {schoolData?.sk_pendirian_sekolah ? (
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>SK Pendirian</Text>
                      <Text style={styles.infoValue}>{schoolData.sk_pendirian_sekolah}</Text>
                    </View>
                  ) : null}
                </View>
              )}
            </View>
          )}

          {/* TAB 2: USER SSO & AKSES */}
          {activeTab === 'users' && (
            <View>
              {/* Search Bar */}
              <View style={styles.searchBox}>
                <Feather name="search" size={18} color={Colors.textLight} style={{ marginRight: 8 }} />
                <TextInput 
                  style={styles.searchInput}
                  placeholder="Cari user (nama, username, peran)..."
                  placeholderTextColor="#94A3B8"
                  value={searchUser}
                  onChangeText={setSearchUser}
                />
                {searchUser ? (
                  <TouchableOpacity onPress={() => setSearchUser('')}>
                    <Feather name="x" size={16} color={Colors.textLight} />
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* Counter Pill */}
              <View style={styles.statsSummaryRow}>
                <View style={styles.statPill}>
                  <Text style={styles.statPillNumber}>{usersList.length}</Text>
                  <Text style={styles.statPillLabel}>Total Akun</Text>
                </View>
                <View style={[styles.statPill, { backgroundColor: '#E0F2F1' }]}>
                  <Text style={[styles.statPillNumber, { color: Colors.primary }]}>
                    {usersList.filter(u => (u.roles?.name || u.role || '').toLowerCase().includes('admin')).length}
                  </Text>
                  <Text style={styles.statPillLabel}>Admin</Text>
                </View>
                <View style={[styles.statPill, { backgroundColor: '#E3F2FD' }]}>
                  <Text style={[styles.statPillNumber, { color: '#1565C0' }]}>
                    {usersList.filter(u => (u.roles?.name || u.role || '').toLowerCase().includes('guru')).length}
                  </Text>
                  <Text style={styles.statPillLabel}>Guru</Text>
                </View>
              </View>

              {/* Users List */}
              <View style={{ gap: 12 }}>
                {filteredUsers.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <Feather name="user-x" size={40} color="#CBD5E1" />
                    <Text style={styles.emptyText}>Tidak ada user yang cocok</Text>
                  </View>
                ) : (
                  filteredUsers.map((item, idx) => {
                    const roleText = item.roles?.name || item.role || 'User';
                    const badge = getRoleBadgeColor(roleText);
                    const initial = (item.name || item.username || 'U').charAt(0).toUpperCase();

                    return (
                      <View key={item.id || idx} style={styles.userCard}>
                        <View style={styles.userAvatar}>
                          <Text style={styles.userAvatarText}>{initial}</Text>
                        </View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text style={styles.userName}>{item.name || '-'}</Text>
                          <Text style={styles.userHandle}>@{item.username || '-'}</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end', gap: 6 }}>
                          <View style={[styles.roleBadge, { backgroundColor: badge.bg }]}>
                            <Text style={[styles.roleBadgeText, { color: badge.text }]}>{roleText}</Text>
                          </View>
                          {/* Quick Admin Action: Reset Password */}
                          <TouchableOpacity 
                            style={styles.resetBtn}
                            onPress={() => setResettingUser(item)}
                            activeOpacity={0.7}
                          >
                            <Feather name="key" size={11} color="#D97706" />
                            <Text style={styles.resetBtnText}>Reset PIN</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            </View>
          )}

          {/* TAB 3: AUDIT LOG KEAMANAN */}
          {activeTab === 'audit' && (
            <View>
              <View style={styles.auditHeaderRow}>
                <Text style={styles.cardHeaderTitle}>Log Aktivitas Sistem</Text>
                <Text style={{ fontSize: 12, color: Colors.textLight }}>{auditLogs.length} Aktivitas Tercatat</Text>
              </View>

              <View style={{ gap: 12, marginTop: 12 }}>
                {auditLogs.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <Feather name="shield" size={40} color="#CBD5E1" />
                    <Text style={styles.emptyText}>Belum ada riwayat log audit</Text>
                  </View>
                ) : (
                  auditLogs.slice(0, 50).map((log, idx) => {
                    const actStyle = getActionColor(log.action);
                    const dateFormatted = log.created_at ? new Date(log.created_at).toLocaleString('id-ID', {
                      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                    }) : '-';

                    return (
                      <View key={log.id || idx} style={styles.auditCard}>
                        <View style={styles.auditCardTop}>
                          <View style={[styles.actionBadge, { backgroundColor: actStyle.bg }]}>
                            <Text style={[styles.actionBadgeText, { color: actStyle.text }]}>{actStyle.label}</Text>
                          </View>
                          <Text style={styles.auditTimeText}>{dateFormatted}</Text>
                        </View>
                        <Text style={styles.auditNoteText}>{log.note || `${log.action} pada ${log.table_name}`}</Text>
                        <View style={styles.auditFooter}>
                          <Feather name="user" size={12} color={Colors.textLight} />
                          <Text style={styles.auditUserText}>Oleh: <Text style={{ fontWeight: '600', color: Colors.secondary }}>{log.user_name || 'Sistem'}</Text></Text>
                          <Text style={styles.auditTableText}>• Tabel: {log.table_name || '-'}</Text>
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

      {/* Modal Konfirmasi Reset Password */}
      <Modal visible={!!resettingUser} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.keyIconCircle}>
              <Feather name="key" size={24} color="#D97706" />
            </View>
            <Text style={styles.modalTitle}>Reset Password Akun</Text>
            <Text style={styles.modalSubtitle}>
              Apakah Anda yakin ingin mereset password untuk <Text style={{ fontWeight: '700', color: Colors.secondary }}>{resettingUser?.name || resettingUser?.username}</Text>?
            </Text>
            <Text style={styles.modalNote}>
              Password akan direset ke default sistem: <Text style={{ fontWeight: '800', color: Colors.primary }}>123456</Text>
            </Text>

            <View style={styles.modalActionRow}>
              <TouchableOpacity 
                style={styles.modalCancelBtn}
                onPress={() => setResettingUser(null)}
                disabled={isResetting}
              >
                <Text style={styles.modalCancelText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.modalConfirmBtn}
                onPress={handleConfirmReset}
                disabled={isResetting}
              >
                {isResetting ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Text style={styles.modalConfirmText}>Ya, Reset</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Feedback Notifikasi */}
      <Modal visible={!!actionFeedback} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={[styles.keyIconCircle, { backgroundColor: '#E0F2F1' }]}>
              <Feather name="check-circle" size={24} color={Colors.primary} />
            </View>
            <Text style={styles.modalTitle}>Informasi Sistem</Text>
            <Text style={styles.modalSubtitle}>{actionFeedback}</Text>
            <TouchableOpacity 
              style={[styles.modalConfirmBtn, { width: '100%', marginTop: 16 }]}
              onPress={() => setActionFeedback(null)}
            >
              <Text style={styles.modalConfirmText}>Tutup</Text>
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
    backgroundColor: '#10B981',
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
    backgroundColor: Colors.primary,
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
  heroCard: {
    backgroundColor: '#FFF',
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#EEEEEE',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 },
      android: { elevation: 2 },
    }),
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  schoolLogo: {
    width: 56,
    height: 56,
    borderRadius: 12,
  },
  schoolLogoFallback: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  schoolNameText: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.secondary,
    marginBottom: 2,
  },
  schoolNpsnText: {
    fontSize: 12,
    color: Colors.textLight,
    marginBottom: 6,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  jenjangBadge: {
    backgroundColor: '#E0F2F1',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  jenjangBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },
  infoCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  cardHeaderTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.secondary,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F8F9FA',
  },
  infoLabel: {
    fontSize: 12,
    color: Colors.textLight,
    flex: 1,
  },
  infoValue: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.secondary,
    flex: 1.4,
    textAlign: 'right',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#EEEEEE',
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: Colors.secondary,
  },
  statsSummaryRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  statPill: {
    flex: 1,
    backgroundColor: '#FFF',
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  statPillNumber: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.secondary,
  },
  statPillLabel: {
    fontSize: 11,
    color: Colors.textLight,
    marginTop: 2,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  userAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#E0F2F1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userAvatarText: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.primary,
  },
  userName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.secondary,
  },
  userHandle: {
    fontSize: 12,
    color: Colors.textLight,
    marginTop: 1,
  },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 13,
    color: Colors.textLight,
    marginTop: 10,
  },
  auditHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  auditCard: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  auditCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  actionBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  auditTimeText: {
    fontSize: 11,
    color: Colors.textLight,
  },
  auditNoteText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.secondary,
    lineHeight: 18,
    marginBottom: 8,
  },
  auditFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  auditUserText: {
    fontSize: 11,
    color: Colors.textLight,
  },
  auditTableText: {
    fontSize: 11,
    color: Colors.textLight,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  resetBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#D97706',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12 },
      android: { elevation: 6 },
    }),
  },
  keyIconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.secondary,
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 13,
    color: Colors.secondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 6,
  },
  modalNote: {
    fontSize: 12,
    color: Colors.textLight,
    textAlign: 'center',
    marginBottom: 20,
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textLight,
  },
  modalConfirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  modalConfirmText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
  },
});
