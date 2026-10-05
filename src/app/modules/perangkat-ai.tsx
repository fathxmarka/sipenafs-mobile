import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  ActivityIndicator, TextInput, Platform, Modal, FlatList, Share, Linking
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Colors from '../../constants/Colors';
import { Toast, ToastType } from '../../components/ui/Toast';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';

const TOOLS = [
  'Modul Ajar / RPP',
  'Silabus',
  'Program Tahunan (Prota)',
  'Program Semester (Prosem)',
  'LKPD (Lembar Kerja)',
  'Kerangka Presentasi',
  'Ringkasan Teks'
];

const TOOL_MAP: Record<string, string> = {
  'Modul Ajar / RPP': 'rpp',
  'Silabus': 'silabus',
  'Program Tahunan (Prota)': 'prota',
  'Program Semester (Prosem)': 'prosem',
  'LKPD (Lembar Kerja)': 'lkpd',
  'Kerangka Presentasi': 'presentasi',
  'Ringkasan Teks': 'ringkasan'
};

export default function PerangkatAjarAIScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ mapel?: string }>();

  const [activeTool, setActiveTool] = useState<string>('Modul Ajar / RPP');
  const [selectedMapel, setSelectedMapel] = useState<string>(params.mapel || '');
  const [selectedTingkat, setSelectedTingkat] = useState<string>('Kelas X (Fase E)');
  const [selectedSemester, setSelectedSemester] = useState<string>('Ganjil');
  const [selectedTopic, setSelectedTopic] = useState<string>('');
  const [additionalNotes, setAdditionalNotes] = useState<string>('');
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedResult, setGeneratedResult] = useState<string | null>(null);
  const [extractedSyllabuses, setExtractedSyllabuses] = useState<any[]>([]);
  const [resultTab, setResultTab] = useState<'preview' | 'edit'>('preview');

  const [mySubjects, setMySubjects] = useState<string[]>([]);
  const [subjectObjects, setSubjectObjects] = useState<Array<{ id: number; name: string }>>([]);
  const [isSelectMapelOpen, setIsSelectMapelOpen] = useState(false);

  useEffect(() => {
    fetchMySubjects();
  }, []);

  const fetchMySubjects = async () => {
    try {
      const storedUser = await SecureStore.getItemAsync('sipena_user');
      const token = await SecureStore.getItemAsync('sipena_token');
      const apiUrl = await SecureStore.getItemAsync('sipena_api_url');
      
      if (storedUser && token && apiUrl) {
        const user = JSON.parse(storedUser);
        const roleStr = (user.role || '').toLowerCase();
        
        // Fetch both master subjects and schedules
        const [resSubjects, resSchedules] = await Promise.allSettled([
          axios.get(`${apiUrl}/api/subjects`, { headers: { Authorization: `Bearer ${token}` } }),
          axios.get(`${apiUrl}/api/schedules`, { headers: { Authorization: `Bearer ${token}` } })
        ]);

        let masterSubjs: Array<{ id: number; name: string }> = [];
        if (resSubjects.status === 'fulfilled' && resSubjects.value.data?.data) {
          masterSubjs = resSubjects.value.data.data.map((s: any) => ({ id: Number(s.id), name: s.name }));
          setSubjectObjects(masterSubjs);
        }

        let teacherSubjects: string[] = [];
        if (resSchedules.status === 'fulfilled' && resSchedules.value.data?.data) {
          const schedules = resSchedules.value.data.data;
          if (roleStr.includes('guru') && user.teacher_id) {
            const myScheds = schedules.filter((s: any) => String(s.teacher_id) === String(user.teacher_id));
            const unique = new Set<string>();
            myScheds.forEach((s: any) => {
              if (s.subject?.name) unique.add(s.subject.name);
            });
            teacherSubjects = Array.from(unique);
          }
        }

        let finalSubjects = (roleStr.includes('guru') && teacherSubjects.length > 0) ? teacherSubjects : masterSubjs.map(s => s.name);
        
        if (finalSubjects.length === 0) {
           finalSubjects = ['Bahasa Indonesia', 'Matematika Peminatan', 'Fisika Terapan & Gelombang', 'Pendidikan Agama Islam'];
        }

        setMySubjects(finalSubjects);
        
        if (!params.mapel && finalSubjects.length > 0) {
          setSelectedMapel(finalSubjects[0]);
        } else if (params.mapel) {
          if (!finalSubjects.includes(params.mapel)) {
            setMySubjects(prev => [params.mapel!, ...prev]);
          }
        }
      }
    } catch (e) {
      console.warn('Gagal memuat mata pelajaran guru:', e);
    }
  };

  const [toast, setToast] = useState<{ visible: boolean; message: string; type: ToastType }>({
    visible: false,
    message: '',
    type: 'info',
  });

  const showToast = (message: string, type: ToastType = 'info') => {
    setToast({ visible: true, message, type });
  };

  const handleGenerate = async () => {
    if (!selectedMapel) {
      showToast('Harap pilih Mata Pelajaran terlebih dahulu', 'warning');
      return;
    }
    
    setIsGenerating(true);
    setGeneratedResult(null);
    
    try {
      const token = await SecureStore.getItemAsync('sipena_token');
      const apiUrl = await SecureStore.getItemAsync('sipena_api_url');

      const matchedSubj = subjectObjects.find(s => s.name === selectedMapel);
      const levelNumber = selectedTingkat.includes('10') || selectedTingkat.includes('X') ? 10 : (selectedTingkat.includes('11') || selectedTingkat.includes('XI') ? 11 : (selectedTingkat.includes('12') || selectedTingkat.includes('XII') ? 12 : undefined));

      const payload = {
        tool_type: TOOL_MAP[activeTool] || 'rpp',
        subject_id: matchedSubj ? matchedSubj.id : undefined,
        level: levelNumber,
        semester: selectedSemester,
        custom_topic: selectedTopic || selectedMapel,
        additional_notes: additionalNotes
      };

      const res = await axios.post(`${apiUrl}/api/syllabuses/generate-ai`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data?.success && res.data?.data) {
        setGeneratedResult(res.data.data);
        setExtractedSyllabuses(res.data.extracted_syllabuses || []);
        setResultTab('preview');
        showToast(`Dokumen ${activeTool} berhasil disintesis oleh AI!`, 'success');
      } else {
        showToast(res.data?.error || 'Gagal menghasilkan perangkat ajar', 'error');
      }
    } catch (err: any) {
      console.error('AI Generate Error:', err);
      showToast('Gagal menyambung ke generator AI: ' + (err.response?.data?.error || err.message), 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!generatedResult) return;
    try {
      await Share.share({
        title: activeTool,
        message: generatedResult
      });
      showToast('Pilihan salin/bagikan telah dibuka!', 'info');
    } catch (e: any) {
      showToast('Gagal membagikan teks', 'error');
    }
  };

  const handleDownloadWord = async () => {
    if (!generatedResult) return;
    try {
      showToast('Memproses berkas Word (.docx)...', 'info');
      const token = await SecureStore.getItemAsync('sipena_token');
      const apiUrl = await SecureStore.getItemAsync('sipena_api_url');
      const res = await axios.post(`${apiUrl}/api/syllabuses/export-docx`, {
        tool_type: TOOL_MAP[activeTool] || 'rpp',
        subject_name: selectedMapel || 'Mata Pelajaran',
        level: selectedTingkat,
        topic: selectedTopic || selectedMapel,
        content: generatedResult,
        return_url: true
      }, { headers: { Authorization: `Bearer ${token}` } });

      if (res.data?.download_url) {
        await Linking.openURL(`${apiUrl}${res.data.download_url}`);
        showToast('Mengunduh berkas Word (.docx) lengkap...', 'success');
      } else {
        showToast('Berkas Word berhasil diproses.', 'info');
      }
    } catch (e: any) {
      showToast('Gagal mengunduh berkas: ' + e.message, 'error');
    }
  };

  const handleSaveMasterSilabus = async () => {
    if (!extractedSyllabuses || extractedSyllabuses.length === 0) {
      showToast('Tidak ada struktur silabus yang dapat disimpan dari dokumen ini.', 'warning');
      return;
    }
    try {
      const token = await SecureStore.getItemAsync('sipena_token');
      const apiUrl = await SecureStore.getItemAsync('sipena_api_url');
      const matched = subjectObjects.find(s => s.name === selectedMapel);
      const subjId = matched ? matched.id : 1;
      await axios.post(`${apiUrl}/api/syllabuses`, {
        subject_id: Number(subjId),
        level: selectedTingkat.includes('10') ? '10' : (selectedTingkat.includes('11') ? '11' : (selectedTingkat.includes('12') ? '12' : '')),
        semester: selectedSemester,
        bulk_data: extractedSyllabuses
      }, { headers: { Authorization: `Bearer ${token}` } });
      showToast(`Berhasil menyimpan ${extractedSyllabuses.length} elemen ke Master Silabus!`, 'success');
    } catch (e: any) {
      showToast('Gagal menyimpan ke Master: ' + e.message, 'error');
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#1E293B" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Perangkat Ajar AI</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Banner */}
        <View style={styles.bannerContainer}>
          <View style={styles.bannerIconWrapper}>
            <Ionicons name="sparkles" size={24} color="#0EA5E9" />
          </View>
          <View style={styles.bannerTextContainer}>
            <Text style={styles.bannerTitle}>Generator Perangkat Ajar & Modul AI</Text>
            <Text style={styles.bannerSubtitle}>Asisten cerdas pendukung instruksi pedagogis guru berstandar Kurikulum Merdeka</Text>
          </View>
        </View>

        {/* Tools Selector Card */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardIconBox}>
              <Ionicons name="book-outline" size={20} color="#0EA5E9" />
            </View>
            <View>
              <Text style={styles.cardTitle}>Perangkat Ajar</Text>
              <Text style={styles.cardSubtitleBadge}>7 TOOLS</Text>
            </View>
          </View>
          
          <Text style={styles.cardDesc}>Dari RPP hingga LKPD — semua bahan ajar siap dalam hitungan detik.</Text>
          
          <View style={styles.toolsContainer}>
            {TOOLS.map((tool) => {
              const isActive = activeTool === tool;
              return (
                <TouchableOpacity 
                  key={tool} 
                  style={[styles.toolChip, isActive && styles.toolChipActive]}
                  onPress={() => setActiveTool(tool)}
                  activeOpacity={0.7}
                >
                  {isActive && <Ionicons name="sparkles" size={14} color="#FFF" style={{ marginRight: 6 }} />}
                  <Text style={[styles.toolChipText, isActive && styles.toolChipTextActive]}>
                    {tool}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Form Parameter AI */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRowSmall}>
            <Ionicons name="options-outline" size={18} color="#0EA5E9" />
            <Text style={styles.cardTitleSmall}>Parameter AI Generator</Text>
            <View style={{ flex: 1 }} />
            <View style={styles.activeToolBadge}>
              <Text style={styles.activeToolBadgeText}>{activeTool}</Text>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>1. MATA PELAJARAN <Text style={styles.required}>*</Text></Text>
            <TouchableOpacity style={styles.selectBox} onPress={() => setIsSelectMapelOpen(true)}>
              <Text style={selectedMapel ? styles.selectTextActive : styles.selectTextPlaceholder}>
                {selectedMapel || '-- Pilih atau Cari Mata Pelajaran --'}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>2. TINGKAT / KELAS (JENJANG SMA)</Text>
            <TouchableOpacity style={styles.selectBox} onPress={() => setSelectedTingkat(selectedTingkat ? '' : 'Kelas X (Fase E)')}>
              <Text style={selectedTingkat ? styles.selectTextActive : styles.selectTextPlaceholder}>
                {selectedTingkat || '-- Semua Tingkat / Reguler --'}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          {activeTool.includes('Prota') || activeTool.includes('Prosem') ? (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>3. PILIH SEMESTER (GANJIL / GENAP) <Text style={styles.required}>*</Text></Text>
              <TouchableOpacity style={styles.selectBox}>
                <Text style={styles.selectTextActive}>Semester Ganjil</Text>
                <Ionicons name="chevron-down" size={20} color="#94A3B8" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>3. REFERENSI TOPIK DARI SILABUS</Text>
              <TouchableOpacity style={styles.selectBox}>
                <Text style={selectedMapel ? styles.selectTextActive : styles.selectTextPlaceholder}>
                  {selectedMapel ? `Semua Topik ${selectedMapel} (Otomatis)` : '-- Pilih Mapel Dulu --'}
                </Text>
                <Ionicons name="chevron-down" size={20} color="#94A3B8" />
              </TouchableOpacity>
              <Text style={styles.inputHelpText}>AI akan mengadopsi Capaian Pembelajaran (CP) dan Alur Tujuan Pembelajaran (ATP) dari silabus terpilih.</Text>
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>4. INSTRUKSI TAMBAHAN (OPSIONAL)</Text>
            <TextInput 
              style={[styles.selectBox, { height: 80, alignItems: 'flex-start', paddingTop: 12, paddingBottom: 12, fontSize: 13, color: '#334155' }]} 
              placeholder="Contoh: 'Fokuskan pada studi kasus teknologi terbaru', atau 'Sertakan rubrik penilaian yang komprehensif'..."
              placeholderTextColor="#94A3B8"
              multiline
              textAlignVertical="top"
              value={additionalNotes}
              onChangeText={setAdditionalNotes}
            />
          </View>
          
          <TouchableOpacity 
            style={[styles.generateButton, isGenerating && styles.generateButtonDisabled, { backgroundColor: '#059669' }]} 
            onPress={handleGenerate}
            disabled={isGenerating}
            activeOpacity={0.8}
          >
            {isGenerating ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <>
                <Ionicons name="sparkles" size={18} color="#FFF" />
                <Text style={styles.generateButtonText}>Generate dengan Gemini AI</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Output Preview */}
        <View style={[styles.card, styles.outputCard]}>
          <View style={styles.cardHeaderRowSmall}>
            <Ionicons name="document-text-outline" size={18} color="#10B981" />
            <Text style={styles.cardTitleSmall}>Hasil Rancangan Dokumen</Text>
          </View>
          
          <View style={styles.previewArea}>
            {isGenerating ? (
              <View style={styles.emptyPreviewState}>
                <ActivityIndicator size="large" color="#0EA5E9" style={{ marginBottom: 16 }} />
                <Text style={styles.generatingTitle}>AI Sedang Mensintesis...</Text>
                <Text style={styles.generatingDesc}>Menganalisis kurikulum, memformulasikan tujuan pembelajaran, dan menyusun kerangka dokumen yang komprehensif.</Text>
              </View>
            ) : generatedResult ? (
              <View style={[styles.resultContainer, { padding: 0, backgroundColor: '#FFF' }]}>
                {/* Header Actions */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, gap: 8 }}>
                  <TouchableOpacity 
                    style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, gap: 4 }}
                    onPress={handleCopy}
                  >
                    <Ionicons name="copy-outline" size={14} color="#475569" />
                    <Text style={{ fontSize: 11, color: '#475569', fontWeight: '600' }}>Salin / Bagikan</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#0F766E', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, gap: 4 }}
                    onPress={handleDownloadWord}
                  >
                    <Ionicons name="download-outline" size={14} color="#FFF" />
                    <Text style={{ fontSize: 11, color: '#FFF', fontWeight: '600' }}>Download Word (.docx)</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#059669', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, gap: 4 }}
                    onPress={handleSaveMasterSilabus}
                  >
                    <Ionicons name="save-outline" size={14} color="#FFF" />
                    <Text style={{ fontSize: 11, color: '#FFF', fontWeight: '600' }}>Simpan Master Silabus</Text>
                  </TouchableOpacity>
                </View>

                {/* Tabs */}
                <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#E2E8F0', paddingHorizontal: 16 }}>
                  <TouchableOpacity 
                    style={[{ paddingBottom: 8, marginRight: 16 }, resultTab === 'preview' && { borderBottomWidth: 2, borderBottomColor: '#059669' }]}
                    onPress={() => setResultTab('preview')}
                  >
                    <Text style={[{ fontSize: 12, fontWeight: '700' }, resultTab === 'preview' ? { color: '#059669' } : { color: '#64748B' }]}>
                      Tampilan Pratinjau (Preview)
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[{ flexDirection: 'row', alignItems: 'center', paddingBottom: 8 }, resultTab === 'edit' && { borderBottomWidth: 2, borderBottomColor: '#059669' }]}
                    onPress={() => setResultTab('edit')}
                  >
                    <Text style={[{ fontSize: 12, fontWeight: '500' }, resultTab === 'edit' ? { color: '#059669', fontWeight: '700' } : { color: '#64748B' }]}>
                      Edit Teks Manual
                    </Text>
                    <View style={{ backgroundColor: '#FEF3C7', paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4, marginLeft: 6 }}>
                      <Text style={{ fontSize: 9, color: '#D97706', fontWeight: 'bold' }}>Live</Text>
                    </View>
                  </TouchableOpacity>
                </View>

                {/* Content Area - Scrollable */}
                {resultTab === 'preview' ? (
                  <ScrollView 
                    style={{ maxHeight: 380 }} 
                    contentContainerStyle={{ padding: 16 }}
                    showsVerticalScrollIndicator={true}
                    nestedScrollEnabled={true}
                  >
                    <Text style={{ fontSize: 13, color: '#1E293B', lineHeight: 22, textAlign: 'justify' }}>
                      {generatedResult}
                    </Text>
                  </ScrollView>
                ) : (
                  <View style={{ padding: 16 }}>
                    <TextInput
                      style={{
                        borderWidth: 1,
                        borderColor: '#E2E8F0',
                        borderRadius: 8,
                        padding: 12,
                        fontSize: 12,
                        color: '#1E293B',
                        height: 300,
                        textAlignVertical: 'top'
                      }}
                      multiline
                      value={generatedResult}
                      onChangeText={setGeneratedResult}
                    />
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.emptyPreviewState}>
                <View style={styles.emptyIconCircle}>
                  <MaterialCommunityIcons name="magic-staff" size={28} color="#94A3B8" />
                </View>
                <Text style={styles.emptyPreviewTitle}>Area Pratinjau AI</Text>
                <Text style={styles.emptyPreviewDesc}>Pilih parameter di atas lalu ketuk tombol Generate untuk menyajikan bahan ajar</Text>
              </View>
            )}
          </View>
        </View>
        
        <View style={{ height: 40 }} />
      </ScrollView>

      {toast.visible && (
        <Toast
          visible={toast.visible}
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast({ ...toast, visible: false })}
        />
      )}

      {/* Modal Pilih Mapel */}
      <Modal visible={isSelectMapelOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Pilih Mata Pelajaran</Text>
              <TouchableOpacity onPress={() => setIsSelectMapelOpen(false)} style={styles.closeModalBtn}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              {mySubjects.length === 0 ? (
                <View style={styles.emptyPreviewState}>
                  <Text style={styles.emptyPreviewDesc}>Tidak ada data mata pelajaran yang ditemukan dari jadwal mengajar Anda.</Text>
                </View>
              ) : (
                <FlatList
                  data={mySubjects}
                  keyExtractor={(item, index) => String(index)}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.mapelListItem}
                      onPress={() => {
                        setSelectedMapel(item);
                        setIsSelectMapelOpen(false);
                      }}
                    >
                      <View style={[styles.radioCircle, selectedMapel === item && styles.radioCircleActive]}>
                        {selectedMapel === item && <View style={styles.radioInner} />}
                      </View>
                      <Text style={[styles.mapelListText, selectedMapel === item && styles.mapelListTextActive]}>{item}</Text>
                    </TouchableOpacity>
                  )}
                />
              )}
            </View>
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
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
      },
      android: { elevation: 2 },
    }),
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  scrollContent: {
    padding: 16,
  },
  bannerContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  bannerIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#E0F2FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  bannerTextContainer: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  bannerSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
    lineHeight: 18,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 8,
      },
      android: { elevation: 1 },
    }),
  },
  outputCard: {
    minHeight: 300,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#E0F2FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  cardSubtitleBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  cardDesc: {
    fontSize: 13,
    color: '#475569',
    marginBottom: 16,
    lineHeight: 20,
  },
  toolsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 0,
  },
  toolChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  toolChipActive: {
    backgroundColor: '#0F766E', // Teal green
    borderColor: '#0F766E',
    ...Platform.select({
      ios: {
        shadowColor: '#0F766E',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
      },
      android: {
        elevation: 6,
        shadowColor: '#0F766E',
      },
    }),
  },
  toolChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  toolChipTextActive: {
    color: '#FFF',
    fontWeight: '700',
  },
  cardHeaderRowSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  cardTitleSmall: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E293B',
  },
  activeToolBadge: {
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  activeToolBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0284C7',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  required: {
    color: '#EF4444',
  },
  selectBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#F8FAFC',
  },
  selectTextPlaceholder: {
    fontSize: 13,
    color: '#94A3B8',
  },
  selectTextActive: {
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '600',
  },
  inputHelpText: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 6,
    lineHeight: 16,
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0EA5E9',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
    gap: 8,
  },
  generateButtonDisabled: {
    backgroundColor: '#94A3B8',
  },
  generateButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
  previewArea: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    padding: 20,
  },
  emptyPreviewState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyPreviewTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
  },
  emptyPreviewDesc: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 20,
  },
  generatingTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0EA5E9',
    marginBottom: 8,
  },
  generatingDesc: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 10,
  },
  resultContainer: {
    flex: 1,
  },
  resultText: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 22,
    marginBottom: 20,
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    gap: 8,
  },
  downloadButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0284C7',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    minHeight: '40%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  closeModalBtn: {
    padding: 4,
  },
  modalBody: {
    padding: 16,
  },
  mapelListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  radioCircleActive: {
    borderColor: '#0EA5E9',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#0EA5E9',
  },
  mapelListText: {
    fontSize: 14,
    color: '#334155',
  },
  mapelListTextActive: {
    fontWeight: '700',
    color: '#0F172A',
  }
});
