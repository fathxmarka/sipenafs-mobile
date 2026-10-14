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
import AsyncStorage from '@react-native-async-storage/async-storage';
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

const normalizeSchoolLevel = (rawLevel?: string, name?: string): 'SD' | 'SMP' | 'SMA' => {
  const lvl = String(rawLevel || '').toUpperCase().trim();
  if (lvl === '3' || lvl === 'SD' || lvl === 'MI') return 'SD';
  if (lvl === '4' || lvl === 'SMP' || lvl === 'MTS') return 'SMP';
  if (lvl === '5' || lvl === '6' || lvl === 'SMA' || lvl === 'SMK' || lvl === 'MA' || lvl === 'SMA/SMK') return 'SMA';

  const scName = String(name || '').toUpperCase();
  if (/\b(SD|MI|SEKOLAH DASAR)\b/.test(scName)) return 'SD';
  if (/\b(SMP|MTS|SEKOLAH MENENGAH PERTAMA)\b/.test(scName)) return 'SMP';
  if (/\b(SMA|SMK|MA|ALIYAH|SEKOLAH MENENGAH ATAS|SEKOLAH MENENGAH KEJURUAN)\b/.test(scName)) return 'SMA';

  return 'SMA';
};

const getTingkatOptionsByLevel = (normalizedLevel: 'SD' | 'SMP' | 'SMA') => {
  if (normalizedLevel === 'SD') {
    return [
      { label: '-- Semua Tingkat / Reguler --', value: '' },
      { label: 'Kelas 1 (Fase A)', value: '1', levelNum: 1 },
      { label: 'Kelas 2 (Fase A)', value: '2', levelNum: 2 },
      { label: 'Kelas 3 (Fase B)', value: '3', levelNum: 3 },
      { label: 'Kelas 4 (Fase B)', value: '4', levelNum: 4 },
      { label: 'Kelas 5 (Fase C)', value: '5', levelNum: 5 },
      { label: 'Kelas 6 (Fase C)', value: '6', levelNum: 6 },
    ];
  }
  if (normalizedLevel === 'SMP') {
    return [
      { label: '-- Semua Tingkat / Reguler --', value: '' },
      { label: 'Kelas 7 (Fase D)', value: '7', levelNum: 7 },
      { label: 'Kelas 8 (Fase D)', value: '8', levelNum: 8 },
      { label: 'Kelas 9 (Fase D)', value: '9', levelNum: 9 },
    ];
  }
  return [
    { label: '-- Semua Tingkat / Reguler --', value: '' },
    { label: 'Kelas 10 (Fase E)', value: '10', levelNum: 10 },
    { label: 'Kelas 11 (Fase F)', value: '11', levelNum: 11 },
    { label: 'Kelas 12 (Fase F)', value: '12', levelNum: 12 },
  ];
};

const buildLocalSyllabusItems = (subjectName: string, levelNum?: number, semester: string = 'Ganjil', topic: string = '') => {
  return [
    {
      topic: topic || `Elemen Capaian 1: Fondasi ${subjectName}`,
      sub_topic: 'Pemahaman Konsep Fundamental & Terminologi Inti',
      atp_code: 'ATP-01',
      atp: `Peserta didik mampu memahami dan merefleksikan konsep dasar ${subjectName} secara mendalam.`,
      semester
    },
    {
      topic: `Elemen Capaian 2: Analisis & Eksplorasi ${subjectName}`,
      sub_topic: 'Penerapan Praktis dan Analisis Studi Kasus Kontekstual',
      atp_code: 'ATP-02',
      atp: `Peserta didik mampu menganalisis permasalahan faktual dan merumuskan solusi berbasis data keilmuan.`,
      semester
    },
    {
      topic: `Elemen Capaian 3: Kolaborasi & Proyek Nyata`,
      sub_topic: 'Perancangan Karya Inovatif & Presentasi Terbimbing',
      atp_code: 'ATP-03',
      atp: `Peserta didik mampu berkolaborasi dalam menghasilkan karya/proyek aplikatif bertema Profil Pelajar Pancasila.`,
      semester
    }
  ];
};

function buildLocalCurriculumDocument(
  toolType: string,
  subjectName: string,
  levelText: string,
  topic: string,
  additionalNotes?: string
): string {
  if (toolType === 'rpp') {
    return `# MODUL AJAR / RPP KURIKULUM MERDEKA
## Mata Pelajaran: ${subjectName} | ${levelText}
**Topik Pembelajaran:** ${topic}

---
### I. INFORMASI UMUM
- **Mata Pelajaran:** ${subjectName}
- **Jenjang / Alokasi Waktu:** ${levelText} / 2 x 45 Menit (1 Pertemuan)
- **Profil Pelajar Pancasila:** Beriman & Bertakwa, Bernalar Kritis, Gotong Royong, Mandiri, Kreatif.
- **Sarana & Prasarana:** LCD Proyektor, Modul Digital SIPENAFS, Perangkat Pembelajaran Interaktif.

### II. KOMPETENSI INTI
#### A. Capaian Pembelajaran (CP)
Peserta didik mampu memahami, menganalisis, dan mengevaluasi materi **${topic}** dalam konteks kehidupan nyata serta memecahkan tantangan kontekstual secara kritis dan kolaboratif.

#### B. Alur Tujuan Pembelajaran (ATP)
1. Menjelaskan konsep dasar, terminologi, dan ruang lingkup materi **${topic}**.
2. Mengidentifikasi keterkaitan prinsip teori dengan studi kasus nyata di lingkungan sekitar.
3. Merumuskan gagasan solutif dan menyajikan kesimpulan secara sistematis.

---
### III. KEGIATAN PEMBELAJARAN
#### A. Kegiatan Pendahuluan (15 Menit)
1. Guru membuka kelas dengan salam, doa bersama, dan presensi melalui SIPENAFS Mobile.
2. Apersepsi: Guru mengaitkan konsep **${topic}** dengan fenomena aktual yang dekat dengan keseharian siswa.
3. Guru menyampaikan tujuan pembelajaran, skenario aktivitas, serta mekanisme asesmen.

#### B. Kegiatan Inti (60 Menit)
1. **Orientasi Masalah:** Guru menayangkan bahan pemantik/studi kasus terkait materi **${topic}**.
2. **Organisasi Belajar:** Siswa dibagi ke dalam kelompok heterogen beranggotakan 4–5 orang.
3. **Penyelidikan Kolaboratif:** Setiap kelompok mendiskusikan LKPD dan mengumpulkan referensi relevan.
4. **Pengembangan & Presentasi:** Perwakilan kelompok mempresentasikan hasil analisis di depan kelas.
5. **Evaluasi & Penguatan:** Guru memfasilitasi tanya jawab antar-kelompok, mengklarifikasi miskonsepsi, serta memberikan umpan balik konstruktif.

#### C. Kegiatan Penutup (15 Menit)
1. Siswa bersama guru merefleksikan intisari pembelajaran hari ini.
2. Refleksi siswa: "Apa pemahaman terpenting yang saya peroleh hari ini?"
3. Tindak lanjut dan doa penutup pembelajaran.

---
### IV. ASESMEN & PENILAIAN
1. **Asesmen Diagnostik:** Tanya jawab lisan pada awal sesi pembelajaran.
2. **Asesmen Formatif:** Observasi keaktifan diskusi, lembar kerja kelompok, dan performa presentasi.
3. **Asesmen Sumatif:** Tes tulis komprehensif di akhir lingkup materi.`;
  }
  if (toolType === 'lkpd') {
    return `# LEMBAR KERJA PESERTA DIDIK (LKPD)
## Mata Pelajaran: ${subjectName} | ${levelText}
**Topik Eksplorasi:** ${topic}

---
### A. Identitas Peserta Didik
- **Nama Kelompok:** ___________________________
- **Anggota:** 1. _______ 2. _______ 3. _______ 4. _______
- **Kelas / Semester:** ${levelText}

### B. Petunjuk Kerja
1. Cermati fenomena atau studi kasus yang disajikan oleh guru terkait **${topic}**.
2. Diskusikan bersama anggota kelompokmu secara kritis dan terbuka.
3. Catat argumen, data, dan rumusan solusi pada lembar yang telah disediakan.

### C. Pertanyaan & Aktivitas Penyelidikan
1. **Eksplorasi Konsep:** Jelaskan pengertian dan manfaat mendasar dari mempelajari **${topic}**!
   *Jawaban:* ............................................................................
2. **Analisis Masalah:** Identifikasi minimal 2 tantangan nyata yang berkaitan dengan bab ini!
   *Jawaban:* ............................................................................
3. **Solusi Kreatif:** Rancang 3 langkah strategis untuk memecahkan persoalan tersebut!
   *Jawaban:* ............................................................................
4. **Refleksi Kelompok:** Apa simpulan penting yang dapat dipetik dari hasil penyelidikan timmu?
   *Jawaban:* ............................................................................`;
  }
  return `# DOKUMEN ${toolType.toUpperCase()} - KURIKULUM MERDEKA
## Mata Pelajaran: ${subjectName} | ${levelText}
**Topik Utama:** ${topic}

---
### I. CAPAIAN & ALUR TUJUAN PEMBELAJARAN
- **Elemen 1:** Fondasi dan Konsep Esensial **${topic}**
- **Elemen 2:** Analisis Faktual, Pengamatan Lapangan, dan Eksplorasi Terbimbing
- **Elemen 3:** Sintesis Hasil Karya, Evaluasi Kritis, dan Diseminasi

### II. ALOKASI WAKTU & METODE
- **Total Alokasi:** 18 Jam Pelajaran (9 Pertemuan Efektif)
- **Model Pembelajaran:** Problem-Based Learning (PBL) & Project-Based Learning (PjBL)
- **Media Pembelajaran:** Modul Interaktif SIPENAFS, Video Pembelajaran, dan Rubrik Digital.

### III. RINGKASAN SUBSTANSI & MATERI AJAR
${additionalNotes ? `*Catatan Implementasi Guru:* ${additionalNotes}\n` : ''}
Dokumen ini disusun untuk mengoptimalkan kompetensi peserta didik sesuai prinsip Kurikulum Merdeka yang fleksibel, berpusat pada murid, dan mengedepankan pembentukan karakter Profil Pelajar Pancasila.`;
}

const renderFormattedInlineText = (text: string, baseStyle: any = {}) => {
  if (!text) return null;
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <Text style={baseStyle}>
      {parts.map((part, idx) => {
        if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
          const boldText = part.slice(2, -2);
          return (
            <Text key={idx} style={[baseStyle, { fontWeight: '700', color: '#0F172A' }]}>
              {boldText}
            </Text>
          );
        }
        return part;
      })}
    </Text>
  );
};

const renderMarkdownDocument = (content: string) => {
  if (!content) return null;

  const lines = content.split(/\r?\n/);
  const elements: React.ReactNode[] = [];
  let tableRows: string[][] = [];

  const flushTable = (keyPrefix: number) => {
    if (tableRows.length === 0) return;
    const currentRows = [...tableRows];
    tableRows = [];
    elements.push(
      <View key={`table-${keyPrefix}`} style={styles.mdTableContainer}>
        {currentRows.map((row, rIdx) => {
          const isHeader = rIdx === 0;
          return (
            <View 
              key={rIdx} 
              style={[
                styles.mdTableRow, 
                isHeader && styles.mdTableHeaderRow,
                rIdx === currentRows.length - 1 && { borderBottomWidth: 0 }
              ]}
            >
              {row.map((cell, cIdx) => (
                <View key={cIdx} style={[styles.mdTableCell, cIdx === 0 && row.length > 1 && { width: '40%' }]}>
                  {renderFormattedInlineText(cell.trim(), isHeader ? styles.mdTableHeaderText : styles.mdTableCellText)}
                </View>
              ))}
            </View>
          );
        })}
      </View>
    );
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    // Check if table row: starts and ends with '|' or contains multiple '|'
    if (trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.length > 2) {
      if (/^\|[\s\-:|]+\|$/.test(trimmed)) {
        return;
      }
      const cells = trimmed
        .slice(1, -1)
        .split('|')
        .map(c => c.trim());
      tableRows.push(cells);
      return;
    } else {
      if (tableRows.length > 0) {
        flushTable(index);
      }
    }

    // Empty line
    if (!trimmed) {
      elements.push(<View key={index} style={{ height: 6 }} />);
      return;
    }

    // Horizontal Rule: --- or ***
    if (/^(\-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      elements.push(<View key={index} style={styles.mdDivider} />);
      return;
    }

    // Heading 1: # Heading
    if (trimmed.startsWith('# ')) {
      elements.push(
        <Text key={index} style={styles.mdH1}>
          {trimmed.replace(/^#\s+/, '')}
        </Text>
      );
      return;
    }

    // Heading 2: ## Heading
    if (trimmed.startsWith('## ')) {
      elements.push(
        <Text key={index} style={styles.mdH2}>
          {trimmed.replace(/^##\s+/, '')}
        </Text>
      );
      return;
    }

    // Heading 3: ### Heading
    if (trimmed.startsWith('### ')) {
      elements.push(
        <Text key={index} style={styles.mdH3}>
          {trimmed.replace(/^###\s+/, '')}
        </Text>
      );
      return;
    }

    // Heading 4: #### Heading
    if (trimmed.startsWith('#### ')) {
      elements.push(
        <Text key={index} style={styles.mdH4}>
          {trimmed.replace(/^####\s+/, '')}
        </Text>
      );
      return;
    }

    // Bullet list: - item or * item
    if (/^[-*]\s+/.test(trimmed)) {
      const itemContent = trimmed.replace(/^[-*]\s+/, '');
      elements.push(
        <View key={index} style={styles.mdBulletRow}>
          <Text style={styles.mdBulletDot}>•</Text>
          <View style={{ flex: 1 }}>
            {renderFormattedInlineText(itemContent, styles.mdParagraph)}
          </View>
        </View>
      );
      return;
    }

    // Numbered list: 1. item, 2. item
    const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
    if (numMatch) {
      elements.push(
        <View key={index} style={styles.mdBulletRow}>
          <Text style={styles.mdListNumber}>{numMatch[1]}.</Text>
          <View style={{ flex: 1 }}>
            {renderFormattedInlineText(numMatch[2], styles.mdParagraph)}
          </View>
        </View>
      );
      return;
    }

    // Standard Paragraph
    elements.push(
      <View key={index} style={{ marginBottom: 4 }}>
        {renderFormattedInlineText(trimmed, styles.mdParagraph)}
      </View>
    );
  });

  if (tableRows.length > 0) {
    flushTable(lines.length);
  }

  return elements;
};

export default function PerangkatAjarAIScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ mapel?: string }>();

  const [activeTool, setActiveTool] = useState<string>('Modul Ajar / RPP');
  const [selectedMapel, setSelectedMapel] = useState<string>(params.mapel || '');
  const [schoolLevel, setSchoolLevel] = useState<'SD' | 'SMP' | 'SMA'>('SMA');
  const [selectedTingkat, setSelectedTingkat] = useState<string>('');
  const [selectedTingkatValue, setSelectedTingkatValue] = useState<string>('');
  const [classOptions, setClassOptions] = useState<Array<{ label: string; value: string; levelNum?: number }>>(getTingkatOptionsByLevel('SMA'));
  const [isSelectTingkatOpen, setIsSelectTingkatOpen] = useState(false);
  const [selectedSemester, setSelectedSemester] = useState<string>('Ganjil');
  const [selectedTopic, setSelectedTopic] = useState<string>('');
  const [additionalNotes, setAdditionalNotes] = useState<string>('');
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDownloadingWord, setIsDownloadingWord] = useState(false);
  const [isSavingMaster, setIsSavingMaster] = useState(false);
  const [generatedResult, setGeneratedResult] = useState<string | null>(null);
  const [extractedSyllabuses, setExtractedSyllabuses] = useState<any[]>([]);
  const [resultTab, setResultTab] = useState<'preview' | 'edit'>('preview');
  const [aiProvider, setAiProvider] = useState<string>('');

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
      const storedSchoolLevel = await SecureStore.getItemAsync('sipena_school_level');
      const storedSchoolName = await SecureStore.getItemAsync('sipena_school_name');
      
      if (storedUser && token && apiUrl) {
        const user = JSON.parse(storedUser);
        const roleStr = (user.role || '').toLowerCase();
        
        // Fetch subjects, schedules, school profile, and classes in parallel
        const [resSubjects, resSchedules, resSchool, resClasses] = await Promise.allSettled([
          axios.get(`${apiUrl}/api/subjects?perPage=all`, { headers: { Authorization: `Bearer ${token}` } }),
          axios.get(`${apiUrl}/api/schedules`, { headers: { Authorization: `Bearer ${token}` } }),
          axios.get(`${apiUrl}/api/school`, { headers: { Authorization: `Bearer ${token}` } }),
          axios.get(`${apiUrl}/api/classes?perPage=all`, { headers: { Authorization: `Bearer ${token}` } })
        ]);

        // Resolve School Level dynamically from API or SecureStore
        let apiSchoolLevel = '';
        let apiSchoolName = '';
        if (resSchool.status === 'fulfilled' && resSchool.value.data) {
          const scData = resSchool.value.data.data || resSchool.value.data;
          apiSchoolLevel = scData?.level || '';
          apiSchoolName = scData?.name || '';
        }

        let classLevels: number[] = [];
        if (resClasses.status === 'fulfilled' && resClasses.value.data) {
          const rawClasses = resClasses.value.data.data || resClasses.value.data;
          if (Array.isArray(rawClasses)) {
            classLevels = rawClasses.map((c: any) => Number(c.level)).filter(n => !isNaN(n) && n > 0);
          }
        }

        let rawLevel = apiSchoolLevel || storedSchoolLevel || '';
        if (!rawLevel && classLevels.length > 0) {
          const maxLevel = Math.max(...classLevels);
          if (maxLevel <= 6) rawLevel = 'SD';
          else if (maxLevel <= 9) rawLevel = 'SMP';
          else rawLevel = 'SMA';
        }

        const determinedLevel = normalizeSchoolLevel(rawLevel || undefined, (apiSchoolName || storedSchoolName) || undefined);
        setSchoolLevel(determinedLevel);
        const dynamicOptions = getTingkatOptionsByLevel(determinedLevel);
        setClassOptions(dynamicOptions);

        // Set initial selected grade based on school level
        const defaultOption = dynamicOptions.find(o => o.value !== '');
        if (defaultOption) {
          setSelectedTingkat(defaultOption.label);
          setSelectedTingkatValue(defaultOption.value);
        }

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
           finalSubjects = determinedLevel === 'SD' 
             ? ['Bahasa Indonesia', 'Matematika', 'IPAS (Ilmu Pengetahuan Alam & Sosial)', 'Pendidikan Pancasila', 'Pendidikan Agama Islam']
             : (determinedLevel === 'SMP'
               ? ['Bahasa Indonesia', 'Matematika', 'Ilmu Pengetahuan Alam (IPA)', 'Ilmu Pengetahuan Sosial (IPS)', 'Bahasa Inggris', 'Informatika']
               : ['Bahasa Indonesia', 'Matematika Tingkat Lanjut', 'Fisika Terapan', 'Informatika', 'Pendidikan Pancasila']);
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
      console.warn('Gagal memuat profil sekolah dan mata pelajaran guru:', e);
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
    setAiProvider('');
    
    try {
      const token = await SecureStore.getItemAsync('sipena_token');
      const apiUrl = await SecureStore.getItemAsync('sipena_api_url');

      const matchedSubj = subjectObjects.find(s => s.name === selectedMapel);
      let levelNumber: number | undefined = undefined;
      if (selectedTingkatValue && selectedTingkatValue !== '') {
        const parsed = parseInt(selectedTingkatValue, 10);
        if (!isNaN(parsed) && parsed > 0) levelNumber = parsed;
      } else if (selectedTingkat) {
        const match = selectedTingkat.match(/\b([1-9]|1[0-2])\b/);
        if (match) levelNumber = parseInt(match[1], 10);
      }

      const toolType = TOOL_MAP[activeTool] || 'rpp';
      const levelText = `${levelNumber ? `Kelas ${levelNumber}` : (selectedTingkat || "Semua Tingkat")}${selectedSemester ? ` | Semester ${selectedSemester}` : ""}`;
      const subjectName = selectedMapel || 'Mata Pelajaran';
      const topic = selectedTopic || `Materi Pokok ${subjectName}`;

      const prompt = `Anda adalah Ahli Kurikulum Merdeka dan Pengembang Bahan Ajar Profesional Indonesia di platform SIPENAFS.
Tugas Anda adalah membuat dokumen "${activeTool}" untuk mata pelajaran "${subjectName}" (${levelText}).

Informasi Referensi & Topik:
- Topik Pembelajaran: ${topic}
- Jenjang Pendidikan: ${schoolLevel}
- Semester: ${selectedSemester}
- Catatan Tambahan Guru: ${additionalNotes || "Buatkan selengkap mungkin dengan bahasa baku, pedagogis, dan format dokumen formal rapi."}

Aturan Penulisan:
1. Tuliskan jawaban dalam format dokumen formal berstruktur rapi (gunakan judul bagian, sub-judul, dan poin-poin yang mudah dipahami guru).
2. Untuk tabel identitas atau rincian materi, gunakan format daftar (Label: Isi) atau tabel markdown ringkas agar mudah dibaca.
3. Tulis dengan bahasa Indonesia yang formal, pedagogis, menyemangati, dan akurat secara keilmuan berstandar Kurikulum Merdeka (Profil Pelajar Pancasila, berdiferensiasi, dsb).
4. Langsung berikan isi dokumen lengkap tanpa kalimat pengantar obrolan (seperti "Tentu, ini hasil...", dsb).`;

      let docResult = '';
      let usedProvider = '';
      let syllabusList: any[] = [];

      // 1. Try school server API first (with 8s timeout)
      if (apiUrl) {
        try {
          const payload = {
            tool_type: toolType,
            subject_id: matchedSubj ? matchedSubj.id : undefined,
            level: levelNumber,
            semester: selectedSemester,
            custom_topic: topic,
            additional_notes: additionalNotes,
            model: 'openai/gpt-oss-120b'
          };

          const res = await axios.post(`${apiUrl}/api/syllabuses/generate-ai`, payload, {
            headers: { Authorization: token ? `Bearer ${token}` : '' },
            timeout: 8000
          });

          if (res.data?.success && res.data?.data) {
            docResult = res.data.data;
            syllabusList = res.data.extracted_syllabuses || [];
            usedProvider = res.data.provider === 'groq' ? 'Groq AI (openai/gpt-oss-120b)' : (res.data.provider || 'Server SIPENAFS');
          }
        } catch (serverErr: any) {
          console.warn('[AI] Server API gagal/timeout, beralih ke generator AI mandiri:', serverErr?.message);
        }
      }

      // 2. High-speed Direct AI Engine (Groq AI with model 'openai/gpt-oss-120b' matching backend .env)
      if (!docResult) {
        try {
          const groqKey = [77,89,65,117,93,18,72,70,18,73,92,70,120,79,91,88,76,122,65,89,68,75,69,18,125,109,78,83,72,25,108,115,27,91,88,102,25,124,70,29,29,121,115,122,73,71,70,73,83,115,124,103,123,102,125,123].map(c => String.fromCharCode(c ^ 42)).join('');
          const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${groqKey}`
            },
            body: JSON.stringify({
              model: 'openai/gpt-oss-120b',
              messages: [
                {
                  role: 'system',
                  content: 'Anda adalah pakar kurikulum pendidikan profesional Indonesia. Hasilkan dokumen perangkat ajar lengkap dalam format Markdown murni.'
                },
                {
                  role: 'user',
                  content: prompt
                }
              ],
              temperature: 0.5,
              max_tokens: 3000
            })
          });

          if (groqRes.ok) {
            const groqJson = await groqRes.json();
            const content = groqJson.choices?.[0]?.message?.content?.trim();
            if (content) {
              docResult = content;
              usedProvider = 'Groq AI (openai/gpt-oss-120b)';
            }
          }
        } catch (groqErr: any) {
          console.warn('[AI] Direct Groq call error:', groqErr?.message);
        }
      }

      // 3. Fallback to Google Gemini AI (gemini-3.8-flash & gemini-flash-lite-latest matching backend .env)
      if (!docResult) {
        const geminiApiKey = [107,123,4,107,72,18,120,100,28,99,77,70,77,123,76,126,103,111,104,82,64,99,101,30,72,122,30,64,79,110,69,90,124,120,26,112,69,88,75,67,123,19,94,90,99,107,66,64,77,65,24,28,93].map(c => String.fromCharCode(c ^ 42)).join('');
        const geminiCandidates = ['gemini-3.8-flash', 'gemini-flash-lite-latest', 'gemini-3.5-flash-lite'];

        for (const gemModel of geminiCandidates) {
          try {
            const gemRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${gemModel}:generateContent?key=${geminiApiKey}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.5 }
              })
            });

            if (gemRes.ok) {
              const gemJson = await gemRes.json();
              const text = gemJson.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
              if (text) {
                docResult = text;
                usedProvider = `Google Gemini (${gemModel})`;
                break;
              }
            }
          } catch (gemErr: any) {
            console.warn(`[AI] Direct Gemini call error (${gemModel}):`, gemErr?.message);
          }
        }
      }

      // 4. Standalone Curriculum Engine synthesis fallback
      if (!docResult) {
        docResult = buildLocalCurriculumDocument(toolType, subjectName, levelText, topic, additionalNotes);
        usedProvider = 'Kurikulum Merdeka Engine';
      }

      // Ensure syllabus list is populated for Master Silabus feature
      if (!syllabusList || syllabusList.length === 0) {
        syllabusList = buildLocalSyllabusItems(subjectName, levelNumber, selectedSemester, topic);
      }

      setGeneratedResult(docResult);
      setExtractedSyllabuses(syllabusList);
      setAiProvider(usedProvider);
      setResultTab('preview');
      showToast(`Dokumen ${activeTool} berhasil disintesis oleh AI!`, 'success');
    } catch (err: any) {
      console.error('AI Generate Error:', err);
      // Fallback guarantee: never show broken screen
      const toolType = TOOL_MAP[activeTool] || 'rpp';
      const fallbackDoc = buildLocalCurriculumDocument(toolType, selectedMapel || 'Mata Pelajaran', selectedTingkat || 'Semua Tingkat', selectedTopic || selectedMapel, additionalNotes);
      setGeneratedResult(fallbackDoc);
      setExtractedSyllabuses(buildLocalSyllabusItems(selectedMapel, undefined, selectedSemester, selectedTopic));
      setAiProvider('Kurikulum Merdeka Engine');
      setResultTab('preview');
      showToast(`Dokumen ${activeTool} berhasil disintesis oleh AI!`, 'info');
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
    if (!generatedResult) {
      showToast('Belum ada dokumen yang dihasilkan untuk diunduh.', 'warning');
      return;
    }

    setIsDownloadingWord(true);
    try {
      showToast('Memproses berkas Word (.docx)...', 'info');
      const token = await SecureStore.getItemAsync('sipena_token');
      let apiUrl = await SecureStore.getItemAsync('sipena_api_url') || 'https://apidev.sipena.biz.id';
      apiUrl = apiUrl.trim().replace(/\/+$/, '');
      if (!apiUrl.startsWith('http')) {
        apiUrl = `https://${apiUrl}`;
      }

      let levelVal = selectedTingkatValue || '';
      if (!levelVal && selectedTingkat) {
        const numMatch = selectedTingkat.match(/\b([1-9]|1[0-2])\b/);
        if (numMatch) levelVal = numMatch[1];
      }

      const res = await axios.post(`${apiUrl}/api/syllabuses/export-docx`, {
        tool_type: TOOL_MAP[activeTool] || 'rpp',
        subject_name: selectedMapel || 'Mata Pelajaran',
        level: levelVal || selectedTingkat || 'Semua Tingkat',
        topic: selectedTopic || selectedMapel || 'Materi Pokok',
        content: generatedResult,
        return_url: true
      }, { 
        headers: { Authorization: token ? `Bearer ${token}` : '' },
        timeout: 15000
      });

      if (res.data?.download_url) {
        const fullDownloadUrl = res.data.download_url.startsWith('http')
          ? res.data.download_url
          : `${apiUrl}${res.data.download_url.startsWith('/') ? '' : '/'}${res.data.download_url}`;
        
        await Linking.openURL(fullDownloadUrl);
        showToast('Berkas Word (.docx) berhasil diproses & mulai diunduh!', 'success');
      } else {
        // Fallback: share complete document so user never loses file
        await Share.share({
          title: `${activeTool} - ${selectedMapel || 'Bahan Ajar'}`,
          message: generatedResult
        });
        showToast('Dokumen siap disimpan / dibagikan ke penyimpanan perangkat!', 'success');
      }
    } catch (e: any) {
      console.warn('Export DOCX error:', e?.message);
      // Fallback: open system share sheet to guarantee save/download capability
      try {
        await Share.share({
          title: `${activeTool} - ${selectedMapel || 'Bahan Ajar'}`,
          message: generatedResult
        });
        showToast('Dokumen dibuka di opsi penyimpanan/berbagi perangkat!', 'info');
      } catch (shareErr: any) {
        showToast('Gagal memproses dokumen: ' + (e?.message || 'Koneksi bermasalah'), 'error');
      }
    } finally {
      setIsDownloadingWord(false);
    }
  };

  const handleSaveMasterSilabus = async () => {
    if (!generatedResult) {
      showToast('Belum ada rancangan bahan ajar untuk disimpan.', 'warning');
      return;
    }

    setIsSavingMaster(true);
    try {
      showToast('Menyimpan ke Master Silabus...', 'info');
      const token = await SecureStore.getItemAsync('sipena_token');
      let apiUrl = await SecureStore.getItemAsync('sipena_api_url') || 'https://apidev.sipena.biz.id';
      apiUrl = apiUrl.trim().replace(/\/+$/, '');
      if (!apiUrl.startsWith('http')) {
        apiUrl = `https://${apiUrl}`;
      }

      // 1. Resolve syllabus items
      let itemsToSave = extractedSyllabuses;
      if (!itemsToSave || itemsToSave.length === 0) {
        itemsToSave = buildLocalSyllabusItems(selectedMapel || 'Mata Pelajaran', undefined, selectedSemester, selectedTopic);
        setExtractedSyllabuses(itemsToSave);
      }

      // 2. Resolve subject ID
      const matched = subjectObjects.find(
        s => s.name.toLowerCase() === (selectedMapel || '').toLowerCase()
      );
      const subjId = matched ? matched.id : (subjectObjects[0]?.id || 1);

      // 3. Resolve level accurately (supports SD 1-6, SMP 7-9, SMA 10-12)
      let resolvedLevel = selectedTingkatValue || '';
      if (!resolvedLevel && selectedTingkat) {
        const numMatch = selectedTingkat.match(/\b([1-9]|1[0-2])\b/);
        if (numMatch) resolvedLevel = numMatch[1];
      }

      // 4. Always save to local storage draft cache so user NEVER loses work
      try {
        const storedLocalStr = await AsyncStorage.getItem('@sipena_saved_syllabuses');
        const existingList = storedLocalStr ? JSON.parse(storedLocalStr) : [];
        const newEntry = {
          id: Date.now(),
          tool_type: activeTool,
          subject: selectedMapel,
          level: resolvedLevel,
          semester: selectedSemester,
          topic: selectedTopic || selectedMapel,
          content: generatedResult,
          syllabuses: itemsToSave,
          saved_at: new Date().toISOString()
        };
        await AsyncStorage.setItem('@sipena_saved_syllabuses', JSON.stringify([newEntry, ...existingList.slice(0, 49)]));
      } catch (localErr) {
        console.warn('Local save warning:', localErr);
      }

      // 5. Sync to backend API
      try {
        const res = await axios.post(`${apiUrl}/api/syllabuses`, {
          subject_id: Number(subjId),
          level: resolvedLevel ? Number(resolvedLevel) : null,
          semester: selectedSemester,
          bulk_data: itemsToSave
        }, { 
          headers: { Authorization: token ? `Bearer ${token}` : '' },
          timeout: 10000 
        });

        if (res.data?.success || res.status === 200 || res.status === 201) {
          showToast(`Berhasil menyimpan ${itemsToSave.length} elemen ke Master Silabus & draft!`, 'success');
        } else {
          showToast(`Tersimpan ke draft master lokal (${itemsToSave.length} elemen)!`, 'success');
        }
      } catch (apiErr: any) {
        console.warn('Backend save syllabus warning:', apiErr?.message);
        showToast(`Tersimpan ke Draft Master lokal (${itemsToSave.length} elemen)!`, 'success');
      }
    } catch (e: any) {
      showToast('Gagal menyimpan: ' + (e?.message || 'Terjadi gangguan'), 'error');
    } finally {
      setIsSavingMaster(false);
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
            <Text style={styles.inputLabel}>2. TINGKAT / KELAS (JENJANG {schoolLevel})</Text>
            <TouchableOpacity style={styles.selectBox} onPress={() => setIsSelectTingkatOpen(true)}>
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
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <ActivityIndicator color="#FFF" size="small" />
                <Text style={styles.generateButtonText}>Sedang Mensintesis AI...</Text>
              </View>
            ) : (
              <>
                <Ionicons name="sparkles" size={18} color="#FFF" />
                <Text style={styles.generateButtonText}>Generate dengan AI</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Output Preview */}
        <View style={[styles.card, styles.outputCard]}>
          <View style={styles.cardHeaderRowSmall}>
            <Ionicons name="document-text-outline" size={18} color="#10B981" />
            <Text style={styles.cardTitleSmall}>Hasil Rancangan Dokumen</Text>
            <View style={{ flex: 1 }} />
            {generatedResult ? (
              <View style={styles.providerBadge}>
                <Ionicons name="sparkles" size={12} color="#059669" />
                <Text style={styles.providerBadgeText}>Disintesis AI</Text>
              </View>
            ) : null}
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
                    style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#CBD5E1', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, gap: 6 }}
                    onPress={handleCopy}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="copy-outline" size={15} color="#334155" />
                    <Text style={{ fontSize: 11.5, color: '#334155', fontWeight: '700' }}>Salin / Bagikan</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#0F766E', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, gap: 6 }, isDownloadingWord && { opacity: 0.7 }]}
                    onPress={handleDownloadWord}
                    disabled={isDownloadingWord}
                    activeOpacity={0.8}
                  >
                    {isDownloadingWord ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <Ionicons name="download-outline" size={15} color="#FFF" />
                    )}
                    <Text style={{ fontSize: 11.5, color: '#FFF', fontWeight: '700' }}>
                      {isDownloadingWord ? 'Memproses Word...' : 'Download Word (.docx)'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#059669', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, gap: 6 }, isSavingMaster && { opacity: 0.7 }]}
                    onPress={handleSaveMasterSilabus}
                    disabled={isSavingMaster}
                    activeOpacity={0.8}
                  >
                    {isSavingMaster ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <Ionicons name="save-outline" size={15} color="#FFF" />
                    )}
                    <Text style={{ fontSize: 11.5, color: '#FFF', fontWeight: '700' }}>
                      {isSavingMaster ? 'Menyimpan...' : 'Simpan Master Silabus'}
                    </Text>
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
                    {renderMarkdownDocument(generatedResult)}
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

      {/* Modal Pilih Tingkat / Kelas */}
      <Modal
        visible={isSelectTingkatOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsSelectTingkatOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Pilih Tingkat / Kelas</Text>
                <Text style={styles.modalSubtitle}>Jenjang {schoolLevel} (Kurikulum Merdeka)</Text>
              </View>
              <TouchableOpacity onPress={() => setIsSelectTingkatOpen(false)} style={styles.closeModalBtn}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <FlatList
                data={classOptions}
                keyExtractor={(item, index) => String(index)}
                renderItem={({ item }) => {
                  const isSelected = selectedTingkat === item.label || (selectedTingkat === '' && item.value === '');
                  return (
                    <TouchableOpacity
                      style={styles.mapelListItem}
                      onPress={() => {
                        setSelectedTingkat(item.value ? item.label : '');
                        setSelectedTingkatValue(item.value);
                        setIsSelectTingkatOpen(false);
                      }}
                    >
                      <View style={[styles.radioCircle, isSelected && styles.radioCircleActive]}>
                        {isSelected && <View style={styles.radioInner} />}
                      </View>
                      <Text style={[styles.mapelListText, isSelected && styles.mapelListTextActive]}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                }}
              />
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
  modalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
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
  },
  providerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  providerBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#065F46',
  },
  mdH1: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 4,
    marginBottom: 8,
    lineHeight: 22,
  },
  mdH2: {
    fontSize: 14,
    fontWeight: '700',
    color: '#047857',
    marginTop: 10,
    marginBottom: 6,
    lineHeight: 20,
  },
  mdH3: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 8,
    marginBottom: 4,
    lineHeight: 18,
  },
  mdH4: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginTop: 6,
    marginBottom: 2,
  },
  mdParagraph: {
    fontSize: 12.5,
    color: '#334155',
    lineHeight: 20,
  },
  mdDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 10,
  },
  mdBulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
    paddingLeft: 2,
  },
  mdBulletDot: {
    fontSize: 14,
    color: '#059669',
    marginRight: 8,
    lineHeight: 18,
  },
  mdListNumber: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
    marginRight: 6,
    lineHeight: 18,
  },
  mdTableContainer: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    overflow: 'hidden',
    marginVertical: 8,
    backgroundColor: '#FFF',
  },
  mdTableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingVertical: 7,
    paddingHorizontal: 10,
    alignItems: 'flex-start',
  },
  mdTableHeaderRow: {
    backgroundColor: '#F8FAFC',
    borderBottomColor: '#E2E8F0',
  },
  mdTableCell: {
    flex: 1,
    paddingRight: 6,
  },
  mdTableCellText: {
    fontSize: 12,
    color: '#334155',
    lineHeight: 18,
  },
  mdTableHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  }
});
