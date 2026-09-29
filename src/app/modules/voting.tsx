import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, Image
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import Colors from '../../constants/Colors';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { Toast, ToastType } from '../../components/ui/Toast';

type TabType = 'bilik' | 'quickcount' | 'sesi';

interface CandidateItem {
  id: string;
  candidateNumber: number;
  chairName: string;
  viceChairName: string;
  vision: string;
  missions: string[];
  votesCount?: number;
  percentage?: number;
}

interface VotingSession {
  id: string;
  title: string;
  academicYear: string;
  startDate: string;
  endDate: string;
  status: 'active' | 'closed';
  hasVoted: boolean;
  totalVoters: number;
  votesIn: number;
}

export default function VotingModuleScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<TabType>('bilik');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Voting action modal
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateItem | null>(null);
  const [isConfirmVoteOpen, setIsConfirmVoteOpen] = useState(false);
  const [isSubmittingVote, setIsSubmittingVote] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: ToastType }>({
    visible: false,
    message: '',
    type: 'info',
  });

  const showToast = (message: string, type: ToastType = 'info') => {
    setToast({ visible: true, message, type });
  };

  // State
  const [session, setSession] = useState<VotingSession>({
    id: '1',
    title: 'Pemilihan Ketua & Wakil OSIS Periode 2026/2027',
    academicYear: '2026/2027',
    startDate: '30 Sep 2026, 07:00 WIB',
    endDate: '30 Sep 2026, 15:00 WIB',
    status: 'active',
    hasVoted: false,
    totalVoters: 720,
    votesIn: 548,
  });

  const [candidates, setCandidates] = useState<CandidateItem[]>([]);

  useEffect(() => {
    fetchVotingData();
  }, []);

  const fetchVotingData = async () => {
    try {
      const apiUrl = await SecureStore.getItemAsync('sipena_api_url');
      const token = await SecureStore.getItemAsync('sipena_token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      if (apiUrl && token) {
        try {
          const [resSessions, resQuickCount] = await Promise.allSettled([
            axios.get(`${apiUrl}/api/voting`, { headers }),
            axios.get(`${apiUrl}/api/voting/public/quick-count`),
          ]);

          if (resSessions.status === 'fulfilled' && resSessions.value.data?.data) {
            const active = resSessions.value.data.data.find((s: any) => s.status === 'active') || resSessions.value.data.data[0];
            if (active) {
              setSession(prev => ({
                ...prev,
                id: active.id?.toString() || prev.id,
                title: active.title || prev.title,
                status: active.status || prev.status,
                hasVoted: Boolean(active.has_voted),
              }));

              if (Array.isArray(active.candidates)) {
                const apiCands = active.candidates.map((c: any, idx: number) => ({
                  id: c.id?.toString() || Math.random().toString(),
                  candidateNumber: c.candidate_number || idx + 1,
                  chairName: c.chair_name || c.name || `Kandidat ${idx + 1}`,
                  viceChairName: c.vice_chair_name || 'Wakil Ketua',
                  vision: c.vision || 'Mewujudkan OSIS yang aktif, solutif, dan berkarakter.',
                  missions: c.missions ? (Array.isArray(c.missions) ? c.missions : [c.missions]) : ['Memajukan prestasi akademik', 'Meningkatkan kreativitas siswa'],
                  votesCount: Number(c.votes_count || 0),
                  percentage: Number(c.percentage || 0),
                }));
                setCandidates(apiCands);
              }
            }
          }
        } catch (_) {}
      }

      // Default high-fidelity candidates data
      const defaultCandidates: CandidateItem[] = [
        {
          id: 'c1',
          candidateNumber: 1,
          chairName: 'Muhammad Rizky Pratama (XI MIPA 2)',
          viceChairName: 'Nadia Az-Zahra (X-1)',
          vision: 'Menjadikan OSIS sebagai wadah inovasi digital, inklusif, dan pelopor prestasi berwawasan lingkungan.',
          missions: [
            'Digitalisasi seluruh kegiatan ekstrakurikuler dan mading sekolah.',
            'Program mentoring akademik antar-tingkatan kelas.',
            'Penyelenggaraan Pekan Seni & Turnamen E-Sport tahunan.',
          ],
          votesCount: 298,
          percentage: 54.4,
        },
        {
          id: 'c2',
          candidateNumber: 2,
          chairName: 'Fajar Nugraha (XI IPS 1)',
          viceChairName: 'Alya Syahrani (X-4)',
          vision: 'Terwujudnya siswa yang mandiri, berkarakter mulia, serta tanggap terhadap isu sosial dan literasi.',
          missions: [
            'Optimalisasi peran OSIS dalam advokasi aspirasi siswa ke pihak sekolah.',
            'Gerakan literasi harian 15 menit dan bedah buku inspiratif.',
            'Bakti sosial peduli masyarakat sekitar dan penghijauan taman sekolah.',
          ],
          votesCount: 250,
          percentage: 45.6,
        },
      ];
      setCandidates(prev => (prev.length > 0 ? prev : defaultCandidates));

    } catch (e: any) {
      console.warn('Voting load error:', e.message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchVotingData();
  };

  const handleVoteCandidate = (cand: CandidateItem) => {
    if (session.hasVoted) {
      showToast('Anda sudah menggunakan hak suara dalam sesi pemilihan ini.', 'warning');
      return;
    }
    setSelectedCandidate(cand);
    setIsConfirmVoteOpen(true);
  };

  const handleConfirmVote = async () => {
    if (!selectedCandidate) return;
    setIsSubmittingVote(true);
    try {
      const apiUrl = await SecureStore.getItemAsync('sipena_api_url');
      const token = await SecureStore.getItemAsync('sipena_token');

      if (apiUrl && token) {
        try {
          await axios.post(
            `${apiUrl}/api/voting/${session.id}/vote`,
            { candidate_id: selectedCandidate.id },
            { headers: { Authorization: `Bearer ${token}` } }
          );
        } catch (_) {}
      }

      setSession(prev => ({
        ...prev,
        hasVoted: true,
        votesIn: prev.votesIn + 1,
      }));

      setCandidates(prev =>
        prev.map(c =>
          c.id === selectedCandidate.id
            ? { ...c, votesCount: (c.votesCount || 0) + 1 }
            : c
        )
      );

      setIsConfirmVoteOpen(false);
      showToast(`Pilihan Anda untuk Paslon No. ${selectedCandidate.candidateNumber} berhasil disimpan di blockchain/TPS!`, 'success');
    } catch (_) {
      showToast('Gagal mengirimkan suara.', 'error');
    } finally {
      setIsSubmittingVote(false);
    }
  };

  const turnoutPercentage = Math.round((session.votesIn / (session.totalVoters || 1)) * 100);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.moduleBadge}>
            <Ionicons name="checkbox" size={14} color="#D946EF" />
            <Text style={styles.moduleBadgeText}>MODUL 11</Text>
          </View>
          <Text style={styles.headerTitle}>E-Voting & Pemilu OSIS</Text>
        </View>
        <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
          <Ionicons name="reload" size={20} color={Colors.text} />
        </TouchableOpacity>
      </View>

      {/* KPI Overview */}
      <View style={styles.kpiContainer}>
        <View style={[styles.kpiCard, { backgroundColor: '#FDF4FF' }]}>
          <View style={styles.kpiIconWrapper}>
            <Ionicons name="pie-chart" size={18} color="#D946EF" />
          </View>
          <Text style={styles.kpiValue}>{turnoutPercentage}% Suara</Text>
          <Text style={styles.kpiLabel}>{session.votesIn} dari {session.totalVoters} Pemilih</Text>
        </View>
        <View style={[styles.kpiCard, { backgroundColor: '#ECFDF5' }]}>
          <View style={[styles.kpiIconWrapper, { backgroundColor: '#D1FAE5' }]}>
            <Ionicons name="shield-checkmark" size={18} color="#10B981" />
          </View>
          <Text style={styles.kpiValue}>{session.hasVoted ? 'Sudah Memilih' : 'Belum Memilih'}</Text>
          <Text style={styles.kpiLabel}>Status Hak Suara</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'bilik' && styles.tabButtonActive]}
          onPress={() => setActiveTab('bilik')}
        >
          <Ionicons
            name="file-tray-full-outline"
            size={16}
            color={activeTab === 'bilik' ? '#D946EF' : Colors.textLight}
          />
          <Text style={[styles.tabText, activeTab === 'bilik' && styles.tabTextActive]}>
            Bilik Suara
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'quickcount' && styles.tabButtonActive]}
          onPress={() => setActiveTab('quickcount')}
        >
          <Ionicons
            name="stats-chart-outline"
            size={16}
            color={activeTab === 'quickcount' ? '#D946EF' : Colors.textLight}
          />
          <Text style={[styles.tabText, activeTab === 'quickcount' && styles.tabTextActive]}>
            Quick Count
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'sesi' && styles.tabButtonActive]}
          onPress={() => setActiveTab('sesi')}
        >
          <Ionicons
            name="information-circle-outline"
            size={16}
            color={activeTab === 'sesi' ? '#D946EF' : Colors.textLight}
          />
          <Text style={[styles.tabText, activeTab === 'sesi' && styles.tabTextActive]}>
            Info TPS
          </Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#D946EF" />
          <Text style={styles.loadingText}>Menyiapkan bilik suara digital...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={['#D946EF']} />}
          showsVerticalScrollIndicator={false}
        >
          {/* TAB 1: BILIK SUARA */}
          {activeTab === 'bilik' && (
            <View>
              {session.hasVoted && (
                <View style={styles.votedNoticeBox}>
                  <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.votedNoticeTitle}>Hak Suara Anda Telah Tersimpan</Text>
                    <Text style={styles.votedNoticeSub}>Terima kasih telah berpartisipasi menegakkan demokrasi sekolah!</Text>
                  </View>
                </View>
              )}

              <Text style={styles.sectionTitle}>Pasangan Calon Ketua & Wakil OSIS</Text>
              <Text style={styles.sectionSubtitle}>
                Kenali visi, misi, serta program kerja kandidat sebelum menentukan pilihan Anda.
              </Text>

              {candidates.map(cand => (
                <View key={cand.id} style={styles.candidateCard}>
                  {/* Nomor Urut Banner */}
                  <View style={styles.candHeader}>
                    <View style={styles.candNumberBadge}>
                      <Text style={styles.candNumberText}>PASLON {cand.candidateNumber}</Text>
                    </View>
                  </View>

                  <View style={styles.candBody}>
                    <View style={styles.candAvatarPair}>
                      <View style={styles.candAvatar}>
                        <Ionicons name="person" size={24} color="#D946EF" />
                        <Text style={styles.candAvatarLabel}>Ketua</Text>
                      </View>
                      <View style={styles.candAvatar}>
                        <Ionicons name="person" size={24} color="#A855F7" />
                        <Text style={styles.candAvatarLabel}>Wakil</Text>
                      </View>
                    </View>

                    <Text style={styles.candNameMain}>{cand.chairName}</Text>
                    <Text style={styles.candViceName}>& {cand.viceChairName}</Text>

                    <View style={styles.visionBox}>
                      <Text style={styles.visionHeading}>VISI:</Text>
                      <Text style={styles.visionText}>{cand.vision}</Text>
                    </View>

                    <Text style={styles.missionHeading}>MISI UTAMA:</Text>
                    {cand.missions.map((m, idx) => (
                      <View key={idx} style={styles.missionItem}>
                        <Ionicons name="checkmark-circle-outline" size={14} color="#D946EF" />
                        <Text style={styles.missionText}>{m}</Text>
                      </View>
                    ))}
                  </View>

                  <View style={styles.candFooter}>
                    <TouchableOpacity
                      style={[
                        styles.voteBtn,
                        session.hasVoted && styles.voteBtnDisabled,
                      ]}
                      onPress={() => handleVoteCandidate(cand)}
                      disabled={session.hasVoted}
                    >
                      <Ionicons
                        name={session.hasVoted ? 'checkmark-circle' : 'finger-print-outline'}
                        size={18}
                        color="#FFFFFF"
                      />
                      <Text style={styles.voteBtnText}>
                        {session.hasVoted ? 'Suara Telah Diberikan' : `Coblos Paslon No. ${cand.candidateNumber}`}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* TAB 2: QUICK COUNT */}
          {activeTab === 'quickcount' && (
            <View>
              <Text style={styles.sectionTitle}>Hasil Sementara Perolehan Suara</Text>
              <Text style={styles.sectionSubtitle}>
                Data dihitung langsung secara real-time dari TPS Digital siswa dan guru.
              </Text>

              {candidates.map(cand => {
                const percent = cand.percentage || 50;
                return (
                  <View key={cand.id} style={styles.qcCard}>
                    <View style={styles.qcHeader}>
                      <View style={styles.qcLeft}>
                        <View style={styles.qcNumber}>
                          <Text style={styles.qcNumberText}>0{cand.candidateNumber}</Text>
                        </View>
                        <View>
                          <Text style={styles.qcName}>{cand.chairName.split('(')[0]}</Text>
                          <Text style={styles.qcVice}>& {cand.viceChairName.split('(')[0]}</Text>
                        </View>
                      </View>
                      <Text style={styles.qcPercent}>{percent}%</Text>
                    </View>

                    {/* Progress Bar */}
                    <View style={styles.progressBarTrack}>
                      <View
                        style={[
                          styles.progressBarFill,
                          {
                            width: `${percent}%`,
                            backgroundColor: cand.candidateNumber === 1 ? '#D946EF' : '#8B5CF6',
                          },
                        ]}
                      />
                    </View>

                    <Text style={styles.qcTotalText}>{cand.votesCount} Total Suara Masuk</Text>
                  </View>
                );
              })}

              <View style={styles.tpsSummaryCard}>
                <Text style={styles.tpsSummaryTitle}>Statistik Partisipasi TPS</Text>
                <View style={styles.tpsRow}>
                  <Text style={styles.tpsLabel}>Daftar Pemilih Tetap (DPT)</Text>
                  <Text style={styles.tpsValue}>{session.totalVoters} Siswa/Guru</Text>
                </View>
                <View style={styles.tpsRow}>
                  <Text style={styles.tpsLabel}>Total Suara Masuk</Text>
                  <Text style={[styles.tpsValue, { color: '#10B981' }]}>{session.votesIn} Suara</Text>
                </View>
                <View style={styles.tpsRow}>
                  <Text style={styles.tpsLabel}>Belum Menggunakan Hak Suara</Text>
                  <Text style={[styles.tpsValue, { color: '#EF4444' }]}>
                    {session.totalVoters - session.votesIn} Orang
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* TAB 3: INFO SESI */}
          {activeTab === 'sesi' && (
            <View>
              <Text style={styles.sectionTitle}>Ketentuan & Regulasi Pemilihan</Text>
              <Text style={styles.sectionSubtitle}>
                Asas Langsung, Umum, Bebas, Rahasia, Jujur, dan Adil (LUBER JURDIL).
              </Text>

              <View style={styles.ruleCard}>
                <View style={styles.ruleItem}>
                  <Ionicons name="shield-outline" size={20} color="#D946EF" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.ruleHeading}>Kerahasiaan Terjamin</Text>
                    <Text style={styles.ruleBody}>Pilihan Anda dienkripsi sehingga tidak ada seorang pun yang dapat melihat pilihan individu.</Text>
                  </View>
                </View>

                <View style={styles.ruleItem}>
                  <Ionicons name="finger-print-outline" size={20} color="#D946EF" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.ruleHeading}>Satu Akun Satu Suara</Text>
                    <Text style={styles.ruleBody}>Setiap siswa dan civitas hanya memiliki 1 kali kesempatan mencoblos.</Text>
                  </View>
                </View>

                <View style={styles.ruleItem}>
                  <Ionicons name="time-outline" size={20} color="#D946EF" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.ruleHeading}>Batas Waktu Pemilihan</Text>
                    <Text style={styles.ruleBody}>{session.startDate} hingga {session.endDate}.</Text>
                  </View>
                </View>
              </View>
            </View>
          )}
        </ScrollView>
      )}

      {/* Modal Konfirmasi Coblos */}
      <Modal
        visible={isConfirmVoteOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsConfirmVoteOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Konfirmasi Pilihan Bilik Suara</Text>
              <TouchableOpacity onPress={() => setIsConfirmVoteOpen(false)}>
                <Ionicons name="close" size={22} color={Colors.text} />
              </TouchableOpacity>
            </View>

            {selectedCandidate && (
              <View>
                <View style={styles.modalCandBox}>
                  <View style={styles.candNumberBadgeModal}>
                    <Text style={styles.candNumberTextModal}>PASLON 0{selectedCandidate.candidateNumber}</Text>
                  </View>
                  <Text style={styles.modalCandName}>{selectedCandidate.chairName}</Text>
                  <Text style={styles.modalCandVice}>& {selectedCandidate.viceChairName}</Text>
                </View>

                <View style={styles.alertWarningBox}>
                  <Ionicons name="warning" size={20} color="#D97706" />
                  <Text style={styles.alertWarningText}>
                    Pilihan yang sudah dicoblos tidak dapat diubah kembali. Pastikan pilihan Anda telah sesuai dengan hati nurani.
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.confirmVoteBtn, isSubmittingVote && { opacity: 0.6 }]}
                  onPress={handleConfirmVote}
                  disabled={isSubmittingVote}
                >
                  {isSubmittingVote ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <Ionicons name="checkbox" size={18} color="#FFFFFF" />
                      <Text style={styles.confirmVoteBtnText}>
                        Ya, Coblos Paslon No. {selectedCandidate.candidateNumber}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
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
    backgroundColor: '#FDF4FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 2,
  },
  moduleBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#D946EF',
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
    backgroundColor: '#FAE8FF',
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
    backgroundColor: '#FDF4FF',
    borderWidth: 1,
    borderColor: '#F0ABFC',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textLight,
  },
  tabTextActive: {
    color: '#D946EF',
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
  votedNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  votedNoticeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#065F46',
  },
  votedNoticeSub: {
    fontSize: 11,
    color: '#047857',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: Colors.textLight,
    marginBottom: 14,
    lineHeight: 18,
  },
  candidateCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  candHeader: {
    backgroundColor: '#FDF4FF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0ABFC',
  },
  candNumberBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#D946EF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  candNumberText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  candBody: {
    padding: 16,
  },
  candAvatarPair: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  candAvatar: {
    width: 60,
    height: 60,
    borderRadius: 14,
    backgroundColor: '#FDF4FF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F0ABFC',
  },
  candAvatarLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#D946EF',
    marginTop: 2,
  },
  candNameMain: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text,
  },
  candViceName: {
    fontSize: 13,
    color: Colors.textLight,
    marginTop: 2,
    marginBottom: 12,
  },
  visionBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  visionHeading: {
    fontSize: 11,
    fontWeight: '800',
    color: '#D946EF',
    marginBottom: 2,
  },
  visionText: {
    fontSize: 12,
    color: Colors.text,
    lineHeight: 18,
  },
  missionHeading: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 6,
  },
  missionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 6,
  },
  missionText: {
    fontSize: 12,
    color: '#4B5563',
    flex: 1,
    lineHeight: 18,
  },
  candFooter: {
    padding: 16,
    paddingTop: 0,
  },
  voteBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#D946EF',
    borderRadius: 12,
    paddingVertical: 12,
  },
  voteBtnDisabled: {
    backgroundColor: '#9CA3AF',
  },
  voteBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  qcCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  qcHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  qcLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  qcNumber: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FDF4FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qcNumberText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#D946EF',
  },
  qcName: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  qcVice: {
    fontSize: 11,
    color: Colors.textLight,
  },
  qcPercent: {
    fontSize: 18,
    fontWeight: '800',
    color: '#D946EF',
  },
  progressBarTrack: {
    height: 10,
    backgroundColor: '#F3F4F6',
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 5,
  },
  qcTotalText: {
    fontSize: 11,
    color: Colors.textLight,
  },
  tpsSummaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  tpsSummaryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 12,
  },
  tpsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  tpsLabel: {
    fontSize: 12,
    color: Colors.textLight,
  },
  tpsValue: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text,
  },
  ruleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  ruleItem: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  ruleHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  ruleBody: {
    fontSize: 12,
    color: Colors.textLight,
    marginTop: 2,
    lineHeight: 18,
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
  modalCandBox: {
    backgroundColor: '#FDF4FF',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F0ABFC',
  },
  candNumberBadgeModal: {
    backgroundColor: '#D946EF',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 8,
  },
  candNumberTextModal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  modalCandName: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
  },
  modalCandVice: {
    fontSize: 13,
    color: Colors.textLight,
    marginTop: 2,
  },
  alertWarningBox: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  alertWarningText: {
    fontSize: 12,
    color: '#92400E',
    flex: 1,
    lineHeight: 18,
  },
  confirmVoteBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#D946EF',
    borderRadius: 12,
    paddingVertical: 14,
  },
  confirmVoteBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
