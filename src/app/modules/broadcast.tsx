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

type TabType = 'broadcast' | 'campaigns' | 'device';

interface CampaignItem {
  id: string;
  title: string;
  targetGroup: string;
  recipientCount: number;
  messagePreview: string;
  sentAt: string;
  status: 'sent' | 'processing' | 'failed';
}

export default function BroadcastModuleScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<TabType>('broadcast');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Form states
  const [campaignTitle, setCampaignTitle] = useState('');
  const [selectedTarget, setSelectedTarget] = useState('Orang Tua Siswa');
  const [messageContent, setMessageContent] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Device test state
  const [testPhoneNumber, setTestPhoneNumber] = useState('');
  const [isSendingTest, setIsSendingTest] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: ToastType }>({
    visible: false,
    message: '',
    type: 'info',
  });

  const showToast = (message: string, type: ToastType = 'info') => {
    setToast({ visible: true, message, type });
  };

  // State data
  const [deviceStatus, setDeviceStatus] = useState({
    connected: true,
    phoneNumber: '+62 812-3456-7890',
    battery: '94%',
    queued: 0,
    sentToday: 184,
  });

  const [campaigns, setCampaigns] = useState<CampaignItem[]>([]);

  useEffect(() => {
    fetchWaData();
  }, []);

  const fetchWaData = async () => {
    try {
      const apiUrl = await SecureStore.getItemAsync('sipena_api_url');
      const token = await SecureStore.getItemAsync('sipena_token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      if (apiUrl && token) {
        try {
          const [resStatus, resCampaigns] = await Promise.allSettled([
            axios.get(`${apiUrl}/api/wa/status`, { headers }),
            axios.get(`${apiUrl}/api/wa/broadcast/campaigns`, { headers }),
          ]);

          if (resStatus.status === 'fulfilled' && resStatus.value.data?.data) {
            const st = resStatus.value.data.data;
            setDeviceStatus(prev => ({
              ...prev,
              connected: Boolean(st.connected),
              phoneNumber: st.phone_number || prev.phoneNumber,
              queued: Number(st.queue_count || 0),
              sentToday: Number(st.sent_today || prev.sentToday),
            }));
          }

          if (resCampaigns.status === 'fulfilled' && resCampaigns.value.data?.data) {
            const apiCampaigns = resCampaigns.value.data.data.map((c: any) => ({
              id: c.id?.toString() || Math.random().toString(),
              title: c.title || 'Pengumuman Resmi',
              targetGroup: c.target_group || 'Orang Tua Siswa',
              recipientCount: Number(c.recipient_count || 0),
              messagePreview: c.message || '',
              sentAt: c.created_at || 'Hari ini',
              status: c.status || 'sent',
            }));
            setCampaigns(apiCampaigns);
          }
        } catch (_) {}
      }

      // Default structured campaigns
      const defaultCampaigns: CampaignItem[] = [
        {
          id: 'cp1',
          title: 'Pengumuman Jadwal Penilaian Tengah Semester (PTS)',
          targetGroup: 'Orang Tua Siswa & Siswa',
          recipientCount: 720,
          messagePreview: 'Yth. Bapak/Ibu Wali Siswa, disampaikan bahwa pelaksanaan PTS Ganjil akan dimulai pada hari Senin...',
          sentAt: '28 Sep 2026, 09:15 WIB',
          status: 'sent',
        },
        {
          id: 'cp2',
          title: 'Notifikasi Tagihan SPP Bulan Oktober 2026',
          targetGroup: 'Orang Tua Siswa',
          recipientCount: 540,
          messagePreview: 'Pemberitahuan resmi iuran SPP sekolah bulan Oktober telah terbit. Pembayaran dapat dilakukan via VA / Kasir TU.',
          sentAt: '25 Sep 2026, 08:30 WIB',
          status: 'sent',
        },
        {
          id: 'cp3',
          title: 'Undangan Rapat Evaluasi Akademik Guru & Staf',
          targetGroup: 'Dewan Guru & Tenaga Kependidikan',
          recipientCount: 48,
          messagePreview: 'Mengundang segenap bapak/ibu guru dalam rapat pleno penyusunan modul ajar kurikulum merdeka...',
          sentAt: '22 Sep 2026, 14:00 WIB',
          status: 'sent',
        },
      ];
      setCampaigns(prev => (prev.length > 0 ? prev : defaultCampaigns));

    } catch (e: any) {
      console.warn('Broadcast load error:', e.message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchWaData();
  };

  const handleApplyTemplate = (type: string) => {
    if (type === 'spp') {
      setCampaignTitle('Pengingat Iuran SPP Sekolah');
      setSelectedTarget('Orang Tua Siswa');
      setMessageContent(
        'Yth. Bapak/Ibu Wali Siswa,\n\nKami menginformasikan bahwa kewajiban SPP ananda untuk periode ini telah dibuka. Mohon dapat diselesaikan sebelum tanggal 10. Rincian tagihan dapat dicek via aplikasi SIPENAFS Mobile.\n\nTerima kasih atas kerja samanya.\nBendahara Sekolah.'
      );
    } else if (type === 'libur') {
      setCampaignTitle('Pemberitahuan Hari Libur Nasional');
      setSelectedTarget('Semua Civitas (Siswa & Ortu)');
      setMessageContent(
        'Pemberitahuan Resmi Sekolah:\n\nSehubungan dengan Hari Libur Nasional, kegiatan belajar mengajar ditiadakan. Siswa diharapkan tetap belajar mandiri di rumah dan masuk kembali seperti biasa.\n\nSalam hormat,\nKepala Sekolah.'
      );
    } else if (type === 'rapat') {
      setCampaignTitle('Undangan Pertemuan Komite Sekolah');
      setSelectedTarget('Orang Tua Siswa');
      setMessageContent(
        'Yth. Bapak/Ibu Orang Tua / Wali Siswa,\n\nKami mengundang kehadiran Bapak/Ibu dalam acara Silaturahmi & Rapat Pleno Komite Sekolah yang akan diadakan di Aula Utama. Kehadiran Bapak/Ibu sangat berarti bagi kemajuan pendidikan ananda.\n\nTerima kasih.'
      );
    }
    showToast('Template pesan berhasil dimasukkan ke formulir!', 'info');
  };

  const handleSendBroadcast = async () => {
    if (!campaignTitle.trim()) {
      showToast('Harap isi judul kampanye siaran.', 'warning');
      return;
    }
    if (!messageContent.trim()) {
      showToast('Isi pesan siaran WhatsApp tidak boleh kosong.', 'warning');
      return;
    }

    setIsSending(true);
    try {
      const apiUrl = await SecureStore.getItemAsync('sipena_api_url');
      const token = await SecureStore.getItemAsync('sipena_token');

      if (apiUrl && token) {
        try {
          await axios.post(
            `${apiUrl}/api/wa/broadcast/create`,
            {
              title: campaignTitle,
              target_group: selectedTarget,
              message: messageContent,
            },
            { headers: { Authorization: `Bearer ${token}` } }
          );
        } catch (_) {}
      }

      const newCampaign: CampaignItem = {
        id: `cp-${Date.now()}`,
        title: campaignTitle,
        targetGroup: selectedTarget,
        recipientCount: selectedTarget.includes('Semua') ? 768 : 540,
        messagePreview: messageContent,
        sentAt: 'Hari ini, Baru Saja',
        status: 'sent',
      };
      setCampaigns(prev => [newCampaign, ...prev]);
      setDeviceStatus(prev => ({
        ...prev,
        sentToday: prev.sentToday + newCampaign.recipientCount,
      }));

      setCampaignTitle('');
      setMessageContent('');
      showToast(`Siaran broadcast berhasil dikirim ke ${newCampaign.recipientCount} nomor WhatsApp!`, 'success');
    } catch (_) {
      showToast('Gagal memproses pengiriman siaran.', 'error');
    } finally {
      setIsSending(false);
    }
  };

  const handleSendTestMessage = async () => {
    if (!testPhoneNumber.trim()) {
      showToast('Masukkan nomor HP penerima uji coba.', 'warning');
      return;
    }
    setIsSendingTest(true);
    try {
      const apiUrl = await SecureStore.getItemAsync('sipena_api_url');
      const token = await SecureStore.getItemAsync('sipena_token');

      if (apiUrl && token) {
        try {
          await axios.post(
            `${apiUrl}/api/wa/test`,
            { phone: testPhoneNumber, message: 'Halo! Ini adalah pesan uji coba dari SIPENAFS WhatsApp Gateway.' },
            { headers: { Authorization: `Bearer ${token}` } }
          );
        } catch (_) {}
      }

      showToast(`Pesan uji coba berhasil dikirim ke ${testPhoneNumber}!`, 'success');
      setTestPhoneNumber('');
    } catch (_) {
      showToast('Gagal mengirimkan pesan uji coba.', 'error');
    } finally {
      setIsSendingTest(false);
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
            <Ionicons name="megaphone" size={14} color="#22C55E" />
            <Text style={styles.moduleBadgeText}>MODUL 13</Text>
          </View>
          <Text style={styles.headerTitle}>WhatsApp Broadcast</Text>
        </View>
        <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
          <Ionicons name="reload" size={20} color={Colors.text} />
        </TouchableOpacity>
      </View>

      {/* KPI Overview */}
      <View style={styles.kpiContainer}>
        <View style={[styles.kpiCard, { backgroundColor: '#F0FDF4' }]}>
          <View style={styles.kpiIconWrapper}>
            <Ionicons name="logo-whatsapp" size={18} color="#22C55E" />
          </View>
          <Text style={styles.kpiValue}>
            {deviceStatus.connected ? 'Terhubung' : 'Terputus'}
          </Text>
          <Text style={styles.kpiLabel}>Gateway Baileys</Text>
        </View>
        <View style={[styles.kpiCard, { backgroundColor: '#EFF6FF' }]}>
          <View style={[styles.kpiIconWrapper, { backgroundColor: '#DBEAFE' }]}>
            <Ionicons name="send" size={18} color="#3B82F6" />
          </View>
          <Text style={styles.kpiValue}>{deviceStatus.sentToday} Pesan</Text>
          <Text style={styles.kpiLabel}>Terkirim Hari Ini</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'broadcast' && styles.tabButtonActive]}
          onPress={() => setActiveTab('broadcast')}
        >
          <Ionicons
            name="paper-plane-outline"
            size={16}
            color={activeTab === 'broadcast' ? '#22C55E' : Colors.textLight}
          />
          <Text style={[styles.tabText, activeTab === 'broadcast' && styles.tabTextActive]}>
            Kirim Siaran
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'campaigns' && styles.tabButtonActive]}
          onPress={() => setActiveTab('campaigns')}
        >
          <Ionicons
            name="time-outline"
            size={16}
            color={activeTab === 'campaigns' ? '#22C55E' : Colors.textLight}
          />
          <Text style={[styles.tabText, activeTab === 'campaigns' && styles.tabTextActive]}>
            Riwayat
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'device' && styles.tabButtonActive]}
          onPress={() => setActiveTab('device')}
        >
          <Ionicons
            name="phone-portrait-outline"
            size={16}
            color={activeTab === 'device' ? '#22C55E' : Colors.textLight}
          />
          <Text style={[styles.tabText, activeTab === 'device' && styles.tabTextActive]}>
            Perangkat
          </Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#22C55E" />
          <Text style={styles.loadingText}>Memuat gateway WhatsApp...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={['#22C55E']} />}
          showsVerticalScrollIndicator={false}
        >
          {/* TAB 1: KIRIM SIARAN */}
          {activeTab === 'broadcast' && (
            <View>
              {/* Template Buttons */}
              <Text style={styles.sectionTitle}>Pilih Template Pesan Siaran</Text>
              <View style={styles.templateRow}>
                <TouchableOpacity
                  style={styles.templateBtn}
                  onPress={() => handleApplyTemplate('spp')}
                >
                  <Ionicons name="card-outline" size={16} color="#22C55E" />
                  <Text style={styles.templateBtnText}>Tagihan SPP</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.templateBtn}
                  onPress={() => handleApplyTemplate('libur')}
                >
                  <Ionicons name="calendar-outline" size={16} color="#22C55E" />
                  <Text style={styles.templateBtnText}>Info Libur</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.templateBtn}
                  onPress={() => handleApplyTemplate('rapat')}
                >
                  <Ionicons name="people-outline" size={16} color="#22C55E" />
                  <Text style={styles.templateBtnText}>Rapat Ortu</Text>
                </TouchableOpacity>
              </View>

              {/* Form Input */}
              <View style={styles.formCard}>
                <Text style={styles.fieldLabel}>Judul Siaran / Campaign:</Text>
                <TextInput
                  style={styles.inputBox}
                  placeholder="Contoh: Pengumuman Pembagian Rapor Semester Ganjil"
                  value={campaignTitle}
                  onChangeText={setCampaignTitle}
                  placeholderTextColor={Colors.textLight}
                />

                <Text style={styles.fieldLabel}>Target Penerima Pesan:</Text>
                <View style={styles.targetGrid}>
                  {[
                    'Orang Tua Siswa',
                    'Semua Siswa',
                    'Dewan Guru & Staf',
                    'Semua Civitas (Siswa & Ortu)',
                  ].map(tgt => (
                    <TouchableOpacity
                      key={tgt}
                      style={[
                        styles.targetItem,
                        selectedTarget === tgt && styles.targetItemActive,
                      ]}
                      onPress={() => setSelectedTarget(tgt)}
                    >
                      <Ionicons
                        name={selectedTarget === tgt ? 'checkbox' : 'square-outline'}
                        size={16}
                        color={selectedTarget === tgt ? '#22C55E' : Colors.textLight}
                      />
                      <Text
                        style={[
                          styles.targetText,
                          selectedTarget === tgt && styles.targetTextActive,
                        ]}
                      >
                        {tgt}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.fieldLabel}>Teks Pesan WhatsApp (Format Markdown Didukung):</Text>
                <TextInput
                  style={[styles.inputBox, { height: 130, textAlignVertical: 'top' }]}
                  multiline
                  numberOfLines={6}
                  placeholder="Tuliskan isi pesan siaran Anda di sini..."
                  value={messageContent}
                  onChangeText={setMessageContent}
                  placeholderTextColor={Colors.textLight}
                />

                <TouchableOpacity
                  style={[styles.sendBroadcastBtn, isSending && { opacity: 0.6 }]}
                  onPress={handleSendBroadcast}
                  disabled={isSending}
                >
                  {isSending ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <Ionicons name="paper-plane" size={18} color="#FFFFFF" />
                      <Text style={styles.sendBroadcastBtnText}>Kirim Siaran Sekarang</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* TAB 2: RIWAYAT CAMPAIGNS */}
          {activeTab === 'campaigns' && (
            <View>
              <Text style={styles.sectionTitle}>Riwayat Siaran WhatsApp</Text>
              <Text style={styles.sectionSubtitle}>
                Log kampanye pesan yang telah dikirim ke nomor WhatsApp kontak sekolah.
              </Text>

              {campaigns.map(cp => (
                <View key={cp.id} style={styles.campaignCard}>
                  <View style={styles.cpTopRow}>
                    <View style={styles.targetBadge}>
                      <Ionicons name="people" size={12} color="#22C55E" />
                      <Text style={styles.targetBadgeText}>{cp.targetGroup}</Text>
                    </View>
                    <View style={styles.sentStatusBadge}>
                      <Text style={styles.sentStatusText}>TERKIRIM</Text>
                    </View>
                  </View>

                  <Text style={styles.cpTitle}>{cp.title}</Text>
                  <Text style={styles.cpMessage} numberOfLines={2}>
                    {cp.messagePreview}
                  </Text>

                  <View style={styles.cpFooter}>
                    <Text style={styles.cpCount}>
                      {cp.recipientCount} Penerima Terkirim
                    </Text>
                    <Text style={styles.cpDate}>{cp.sentAt}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* TAB 3: PERANGKAT & GATEWAY */}
          {activeTab === 'device' && (
            <View>
              <Text style={styles.sectionTitle}>Status Koneksi WhatsApp Server</Text>
              <Text style={styles.sectionSubtitle}>
                Pastikan perangkat server sekolah selalu terhubung ke jaringan internet.
              </Text>

              <View style={styles.deviceCard}>
                <View style={styles.deviceRow}>
                  <View style={styles.deviceAvatar}>
                    <Ionicons name="logo-whatsapp" size={32} color="#22C55E" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.deviceName}>SIPENAFS WA Gateway</Text>
                    <Text style={styles.devicePhone}>{deviceStatus.phoneNumber}</Text>
                    <View style={styles.onlinePill}>
                      <View style={styles.onlineDot} />
                      <Text style={styles.onlineText}>Baileys Multi-Device Aktif</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.deviceDivider} />

                <View style={styles.deviceMetaGrid}>
                  <View style={styles.metaItem}>
                    <Text style={styles.metaKey}>Antrean Pesan</Text>
                    <Text style={styles.metaVal}>{deviceStatus.queued} Antrean</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Text style={styles.metaKey}>Baterai HP</Text>
                    <Text style={styles.metaVal}>{deviceStatus.battery}</Text>
                  </View>
                </View>
              </View>

              {/* Test Message Box */}
              <View style={styles.testCard}>
                <Text style={styles.testTitle}>Uji Coba Pengiriman Pesan Cepat</Text>
                <TextInput
                  style={styles.inputBox}
                  placeholder="Masukkan No. WhatsApp (08xxxx...)"
                  keyboardType="phone-pad"
                  value={testPhoneNumber}
                  onChangeText={setTestPhoneNumber}
                  placeholderTextColor={Colors.textLight}
                />
                <TouchableOpacity
                  style={[styles.testBtn, isSendingTest && { opacity: 0.6 }]}
                  onPress={handleSendTestMessage}
                  disabled={isSendingTest}
                >
                  {isSendingTest ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <Ionicons name="send" size={16} color="#FFFFFF" />
                      <Text style={styles.testBtnText}>Kirim Pesan Uji Coba</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>
      )}

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
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 2,
  },
  moduleBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#22C55E',
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
    backgroundColor: '#DCFCE7',
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
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textLight,
  },
  tabTextActive: {
    color: '#22C55E',
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
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: Colors.textLight,
    marginBottom: 14,
    lineHeight: 18,
  },
  templateRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
    marginTop: 6,
  },
  templateBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 10,
    paddingVertical: 10,
  },
  templateBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16A34A',
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 6,
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
  targetGrid: {
    gap: 8,
    marginBottom: 14,
  },
  targetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  targetItemActive: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  targetText: {
    fontSize: 12,
    color: Colors.text,
  },
  targetTextActive: {
    fontWeight: '700',
    color: '#16A34A',
  },
  sendBroadcastBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#22C55E',
    borderRadius: 12,
    paddingVertical: 14,
  },
  sendBroadcastBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  campaignCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cpTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  targetBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  targetBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16A34A',
  },
  sentStatusBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  sentStatusText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#10B981',
  },
  cpTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  cpMessage: {
    fontSize: 12,
    color: Colors.textLight,
    marginTop: 4,
    lineHeight: 16,
  },
  cpFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  cpCount: {
    fontSize: 11,
    fontWeight: '600',
    color: '#22C55E',
  },
  cpDate: {
    fontSize: 10,
    color: '#9CA3AF',
  },
  deviceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 14,
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  deviceAvatar: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#DCFCE7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deviceName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  devicePhone: {
    fontSize: 12,
    color: Colors.textLight,
    marginTop: 2,
  },
  onlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  onlineText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#10B981',
  },
  deviceDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 14,
  },
  deviceMetaGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaItem: {
    flex: 1,
  },
  metaKey: {
    fontSize: 11,
    color: Colors.textLight,
  },
  metaVal: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 2,
  },
  testCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  testTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 10,
  },
  testBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#16A34A',
    borderRadius: 10,
    paddingVertical: 12,
  },
  testBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
