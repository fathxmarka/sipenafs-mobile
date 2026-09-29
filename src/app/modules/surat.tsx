import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, TextInput, Modal
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import Colors from '../../constants/Colors';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { Toast, ToastType } from '../../components/ui/Toast';

type TabType = 'masuk' | 'keluar' | 'pengajuan';

interface LetterItem {
  id: string;
  referenceNumber: string;
  senderOrReceiver: string;
  subject: string;
  date: string;
  type: 'masuk' | 'keluar';
  dispositionStatus: 'Selesai' | 'Disposisi Kepala Sekolah' | 'Diarsipkan';
}

interface StudentLetterRequest {
  id: string;
  requestType: string;
  studentName: string;
  className: string;
  purpose: string;
  requestDate: string;
  status: 'Menunggu TU' | 'Selesai Dicetak' | 'Ditolak';
}

export default function SuratModuleScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<TabType>('masuk');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Request letter modal
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [selectedLetterType, setSelectedLetterType] = useState('Surat Keterangan Aktif Siswa');
  const [requestPurpose, setRequestPurpose] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
  const [incomingLetters, setIncomingLetters] = useState<LetterItem[]>([]);
  const [outgoingLetters, setOutgoingLetters] = useState<LetterItem[]>([]);
  const [studentRequests, setStudentRequests] = useState<StudentLetterRequest[]>([]);

  useEffect(() => {
    fetchSuratData();
  }, []);

  const fetchSuratData = async () => {
    try {
      const apiUrl = await SecureStore.getItemAsync('sipena_api_url');
      const token = await SecureStore.getItemAsync('sipena_token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      if (apiUrl && token) {
        try {
          const res = await axios.get(`${apiUrl}/api/passages`, { headers });
          if (res.data && res.data.success && Array.isArray(res.data.data)) {
            const apiItems: LetterItem[] = res.data.data.map((item: any) => ({
              id: item.id?.toString() || Math.random().toString(),
              referenceNumber: item.number || item.reference_no || '421/089/Disdik',
              senderOrReceiver: item.sender || item.recipient || 'Dinas Pendidikan',
              subject: item.subject || item.title || 'Urusan Kedinasan',
              date: item.date || item.created_at || 'Hari ini',
              type: item.type === 'outgoing' ? 'keluar' : 'masuk',
              dispositionStatus: item.status || 'Selesai',
            }));

            setIncomingLetters(apiItems.filter(i => i.type === 'masuk'));
            setOutgoingLetters(apiItems.filter(i => i.type === 'keluar'));
          }
        } catch (_) {}
      }

      // Default structured data
      const defaultIncoming: LetterItem[] = [
        {
          id: 'sm1',
          referenceNumber: '005/124/Disdik.SMA/2026',
          senderOrReceiver: 'Dinas Pendidikan Provinsi',
          subject: 'Edaran Sosialisasi Lomba Apresiasi Sains & Budaya Siswa',
          date: '28 Sep 2026',
          type: 'masuk',
          dispositionStatus: 'Disposisi Kepala Sekolah',
        },
        {
          id: 'sm2',
          referenceNumber: '421.3/901/Cabdin.I/2026',
          senderOrReceiver: 'Cabang Dinas Wilayah I',
          subject: 'Verifikasi Validasi Data Dapodik & Kelayakan Bantuan Sarpras',
          date: '25 Sep 2026',
          type: 'masuk',
          dispositionStatus: 'Selesai',
        },
        {
          id: 'sm3',
          referenceNumber: 'B-78/Puskesmas.Kec/IX/2026',
          senderOrReceiver: 'UPTD Puskesmas Kecamatan',
          subject: 'Pemberitahuan Pemeriksaan Kesehatan Berkala Peserta Didik',
          date: '20 Sep 2026',
          type: 'masuk',
          dispositionStatus: 'Diarsipkan',
        },
      ];
      setIncomingLetters(prev => (prev.length > 0 ? prev : defaultIncoming));

      const defaultOutgoing: LetterItem[] = [
        {
          id: 'sk1',
          referenceNumber: '422/310/SMA-SIPENA/IX/2026',
          senderOrReceiver: 'Universitas Indonesia (UI) & ITB',
          subject: 'Surat Rekomendasi Siswa Berprestasi Seleksi Jalur Prestasi',
          date: '29 Sep 2026',
          type: 'keluar',
          dispositionStatus: 'Selesai',
        },
        {
          id: 'sk2',
          referenceNumber: '420/298/SMA-SIPENA/IX/2026',
          senderOrReceiver: 'Orang Tua / Komite Sekolah',
          subject: 'Undangan Rapat Pleno Koordinasi Program Semester Ganjil',
          date: '24 Sep 2026',
          type: 'keluar',
          dispositionStatus: 'Selesai',
        },
      ];
      setOutgoingLetters(prev => (prev.length > 0 ? prev : defaultOutgoing));

      const defaultRequests: StudentLetterRequest[] = [
        {
          id: 'req1',
          requestType: 'Surat Keterangan Aktif Siswa',
          studentName: 'Ahmad Fauzan',
          className: 'XII MIPA 1',
          purpose: 'Kelengkapan administrasi beasiswa Pemda',
          requestDate: '27 Sep 2026',
          status: 'Selesai Dicetak',
        },
        {
          id: 'req2',
          requestType: 'Surat Rekomendasi Lomba',
          studentName: 'Ahmad Fauzan',
          className: 'XII MIPA 1',
          purpose: 'Syarat delegasi Olimpiade Fisika Nasional',
          requestDate: '15 Sep 2026',
          status: 'Selesai Dicetak',
        },
      ];
      setStudentRequests(defaultRequests);

    } catch (e: any) {
      console.warn('Surat load error:', e.message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchSuratData();
  };

  const handleConfirmRequest = async () => {
    if (!requestPurpose.trim()) {
      showToast('Tuliskan tujuan pengajuan surat keterangan.', 'warning');
      return;
    }
    setIsSubmitting(true);
    try {
      await new Promise(r => setTimeout(r, 600));

      const newReq: StudentLetterRequest = {
        id: `req-${Date.now()}`,
        requestType: selectedLetterType,
        studentName: 'Ahmad Fauzan',
        className: 'XII MIPA 1',
        purpose: requestPurpose,
        requestDate: 'Hari ini',
        status: 'Menunggu TU',
      };
      setStudentRequests(prev => [newReq, ...prev]);

      setIsRequestModalOpen(false);
      setRequestPurpose('');
      showToast('Pengajuan surat berhasil dikirim ke Bagian Tata Usaha (TU)!', 'success');
    } catch (_) {
      showToast('Gagal mengajukan surat.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.moduleBadge}>
            <Ionicons name="document-text" size={14} color="#6366F1" />
            <Text style={styles.moduleBadgeText}>MODUL 14</Text>
          </View>
          <Text style={styles.headerTitle}>Administrasi Persuratan</Text>
        </View>
        <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
          <Ionicons name="reload" size={20} color={Colors.text} />
        </TouchableOpacity>
      </View>

      {/* KPI Stats */}
      <View style={styles.kpiContainer}>
        <View style={[styles.kpiCard, { backgroundColor: '#EEF2FF' }]}>
          <View style={styles.kpiIconWrapper}>
            <Ionicons name="mail-unread" size={18} color="#6366F1" />
          </View>
          <Text style={styles.kpiValue}>{incomingLetters.length} Surat</Text>
          <Text style={styles.kpiLabel}>Surat Masuk Dinas</Text>
        </View>
        <View style={[styles.kpiCard, { backgroundColor: '#F0FDF4' }]}>
          <View style={[styles.kpiIconWrapper, { backgroundColor: '#DCFCE7' }]}>
            <Ionicons name="checkmark-done-circle" size={18} color="#16A34A" />
          </View>
          <Text style={styles.kpiValue}>{outgoingLetters.length} Terbit</Text>
          <Text style={styles.kpiLabel}>Surat Keluar Sekolah</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'masuk' && styles.tabButtonActive]}
          onPress={() => setActiveTab('masuk')}
        >
          <Ionicons
            name="arrow-down-circle-outline"
            size={16}
            color={activeTab === 'masuk' ? '#6366F1' : Colors.textLight}
          />
          <Text style={[styles.tabText, activeTab === 'masuk' && styles.tabTextActive]}>
            Surat Masuk
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'keluar' && styles.tabButtonActive]}
          onPress={() => setActiveTab('keluar')}
        >
          <Ionicons
            name="arrow-up-circle-outline"
            size={16}
            color={activeTab === 'keluar' ? '#6366F1' : Colors.textLight}
          />
          <Text style={[styles.tabText, activeTab === 'keluar' && styles.tabTextActive]}>
            Surat Keluar
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'pengajuan' && styles.tabButtonActive]}
          onPress={() => setActiveTab('pengajuan')}
        >
          <Ionicons
            name="create-outline"
            size={16}
            color={activeTab === 'pengajuan' ? '#6366F1' : Colors.textLight}
          />
          <Text style={[styles.tabText, activeTab === 'pengajuan' && styles.tabTextActive]}>
            Layanan Surat
          </Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.loadingText}>Memuat arsip persuratan...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={['#6366F1']} />}
          showsVerticalScrollIndicator={false}
        >
          {/* TAB 1: SURAT MASUK */}
          {activeTab === 'masuk' && (
            <View>
              <Text style={styles.sectionTitle}>Agenda Surat Masuk Instansi</Text>
              <Text style={styles.sectionSubtitle}>
                Surat kedinasan resmi yang diterima sekolah dari Dinas Pendidikan & Lembaga Mitra.
              </Text>

              {incomingLetters.map(letter => (
                <View key={letter.id} style={styles.letterCard}>
                  <View style={styles.letterCardTop}>
                    <View style={styles.letterTypeTag}>
                      <Ionicons name="mail" size={12} color="#6366F1" />
                      <Text style={styles.letterTypeTagText}>MASUK</Text>
                    </View>
                    <Text style={styles.letterDate}>{letter.date}</Text>
                  </View>

                  <Text style={styles.letterRefNo}>{letter.referenceNumber}</Text>
                  <Text style={styles.letterSubject}>{letter.subject}</Text>
                  <Text style={styles.letterSender}>Pengirim: {letter.senderOrReceiver}</Text>

                  <View style={styles.letterDivider} />

                  <View style={styles.letterFooter}>
                    <Text style={styles.dispoLabel}>Status:</Text>
                    <View style={styles.dispoBadge}>
                      <Text style={styles.dispoBadgeText}>{letter.dispositionStatus}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* TAB 2: SURAT KELUAR */}
          {activeTab === 'keluar' && (
            <View>
              <Text style={styles.sectionTitle}>Buku Agenda Surat Keluar & SK</Text>
              <Text style={styles.sectionSubtitle}>
                Daftar surat resmi yang diterbitkan oleh Tata Usaha dan Kepala Sekolah.
              </Text>

              {outgoingLetters.map(letter => (
                <View key={letter.id} style={styles.letterCard}>
                  <View style={styles.letterCardTop}>
                    <View style={[styles.letterTypeTag, { backgroundColor: '#DCFCE7' }]}>
                      <Ionicons name="send" size={12} color="#16A34A" />
                      <Text style={[styles.letterTypeTagText, { color: '#16A34A' }]}>KELUAR</Text>
                    </View>
                    <Text style={styles.letterDate}>{letter.date}</Text>
                  </View>

                  <Text style={styles.letterRefNo}>{letter.referenceNumber}</Text>
                  <Text style={styles.letterSubject}>{letter.subject}</Text>
                  <Text style={styles.letterSender}>Tujuan: {letter.senderOrReceiver}</Text>

                  <View style={styles.letterDivider} />

                  <View style={styles.letterFooter}>
                    <View style={styles.verifiedTag}>
                      <Ionicons name="shield-checkmark" size={14} color="#16A34A" />
                      <Text style={styles.verifiedTagText}>Ditandatangani Digital</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* TAB 3: LAYANAN SURAT SISWA */}
          {activeTab === 'pengajuan' && (
            <View>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Permohonan Surat Keterangan Siswa</Text>
                <TouchableOpacity
                  style={styles.requestLetterBtn}
                  onPress={() => setIsRequestModalOpen(true)}
                >
                  <Ionicons name="add" size={16} color="#FFFFFF" />
                  <Text style={styles.requestLetterBtnText}>Ajukan Surat</Text>
                </TouchableOpacity>
              </View>

              {studentRequests.map(req => (
                <View key={req.id} style={styles.requestCard}>
                  <View style={styles.reqHeader}>
                    <Text style={styles.reqType}>{req.requestType}</Text>
                    <View
                      style={[
                        styles.reqStatusTag,
                        req.status === 'Selesai Dicetak'
                          ? styles.statusReady
                          : styles.statusPending,
                      ]}
                    >
                      <Text
                        style={[
                          styles.reqStatusText,
                          req.status === 'Selesai Dicetak'
                            ? styles.statusReadyText
                            : styles.statusPendingText,
                        ]}
                      >
                        {req.status.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.reqStudent}>{req.studentName} ({req.className})</Text>
                  <Text style={styles.reqPurpose}>Keperluan: {req.purpose}</Text>

                  <View style={styles.reqFooter}>
                    <Text style={styles.reqDate}>Tanggal Pengajuan: {req.requestDate}</Text>
                    {req.status === 'Selesai Dicetak' && (
                      <TouchableOpacity
                        style={styles.downloadLetterBtn}
                        onPress={() => showToast('Mengunduh dokumen surat keterangan resmi...', 'info')}
                      >
                        <Ionicons name="download-outline" size={14} color="#6366F1" />
                        <Text style={styles.downloadLetterText}>Unduh PDF</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {/* Modal Ajukan Surat Keterangan */}
      <Modal
        visible={isRequestModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsRequestModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Form Layanan Surat Siswa</Text>
              <TouchableOpacity onPress={() => setIsRequestModalOpen(false)}>
                <Ionicons name="close" size={22} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSub}>
              Pilih jenis surat yang Anda butuhkan. Dokumen akan diproses oleh Bagian Tata Usaha dalam 1x24 jam kerja.
            </Text>

            <Text style={styles.fieldLabel}>Pilih Jenis Surat:</Text>
            {[
              'Surat Keterangan Aktif Siswa',
              'Surat Rekomendasi Beasiswa / Lomba',
              'Surat Pengantar Bebas Pustaka & SPP',
              'Surat Permohonan Pindah / Mutasi',
            ].map(type => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.typeItem,
                  selectedLetterType === type && styles.typeItemActive,
                ]}
                onPress={() => setSelectedLetterType(type)}
              >
                <Ionicons
                  name={selectedLetterType === type ? 'radio-button-on' : 'radio-button-off'}
                  size={18}
                  color={selectedLetterType === type ? '#6366F1' : Colors.textLight}
                />
                <Text
                  style={[
                    styles.typeItemText,
                    selectedLetterType === type && styles.typeItemTextActive,
                  ]}
                >
                  {type}
                </Text>
              </TouchableOpacity>
            ))}

            <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Keperluan / Tujuan Pengajuan:</Text>
            <TextInput
              style={[styles.inputBox, { height: 75, textAlignVertical: 'top' }]}
              multiline
              numberOfLines={3}
              placeholder="Contoh: Lampiran berkas pengajuan tunjangan gaji orang tua di instansi BUMN..."
              value={requestPurpose}
              onChangeText={setRequestPurpose}
              placeholderTextColor={Colors.textLight}
            />

            <TouchableOpacity
              style={[styles.submitReqBtn, isSubmitting && { opacity: 0.6 }]}
              onPress={handleConfirmRequest}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Ionicons name="send" size={16} color="#FFFFFF" />
                  <Text style={styles.submitReqBtnText}>Kirimkan Permohonan Surat</Text>
                </>
              )}
            </TouchableOpacity>
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
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 2,
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
  letterCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  letterCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  letterTypeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  letterTypeTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6366F1',
  },
  letterDate: {
    fontSize: 11,
    color: Colors.textLight,
  },
  letterRefNo: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6366F1',
    marginTop: 2,
  },
  letterSubject: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 4,
  },
  letterSender: {
    fontSize: 12,
    color: Colors.textLight,
    marginTop: 4,
  },
  letterDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 10,
  },
  letterFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dispoLabel: {
    fontSize: 11,
    color: Colors.textLight,
  },
  dispoBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  dispoBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.text,
  },
  verifiedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  verifiedTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16A34A',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  requestLetterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#6366F1',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  requestLetterBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  requestCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  reqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  reqType: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    flex: 1,
  },
  reqStatusTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusReady: {
    backgroundColor: '#ECFDF5',
  },
  statusReadyText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#10B981',
  },
  statusPending: {
    backgroundColor: '#FEF3C7',
  },
  statusPendingText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#D97706',
  },
  reqStatusText: {
    letterSpacing: 0.5,
  },
  reqStudent: {
    fontSize: 12,
    color: Colors.textLight,
  },
  reqPurpose: {
    fontSize: 12,
    color: '#4B5563',
    marginTop: 4,
  },
  reqFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  reqDate: {
    fontSize: 11,
    color: Colors.textLight,
  },
  downloadLetterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  downloadLetterText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6366F1',
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
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  modalSub: {
    fontSize: 12,
    color: Colors.textLight,
    marginBottom: 14,
    lineHeight: 18,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 6,
  },
  typeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 6,
  },
  typeItemActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#C7D2FE',
  },
  typeItemText: {
    fontSize: 12,
    color: Colors.text,
  },
  typeItemTextActive: {
    color: '#6366F1',
    fontWeight: '700',
  },
  inputBox: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 12,
    fontSize: 13,
    color: Colors.text,
    marginBottom: 14,
  },
  submitReqBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#6366F1',
    borderRadius: 12,
    paddingVertical: 14,
  },
  submitReqBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
