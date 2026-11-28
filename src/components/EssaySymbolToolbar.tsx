import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import RichCbtContent from './RichCbtContent';
import { hasArabicScript, hasComplexCbtHtmlOrMath } from '../utils/cbtFormatter';

interface SymbolTabItem {
  id: string;
  label: string;
  isRtl?: boolean;
  isTemplate?: boolean;
  items: Array<string | { label: string; insert: string }>;
}

interface HarakatKey {
  display: string;
  name: string;
  insert: string;
}

const ARABIC_HARAKAT_BASIC: HarakatKey[] = [
  { display: '◌َ', name: 'Fathah', insert: '\u064E' },
  { display: '◌ِ', name: 'Kasrah', insert: '\u0650' },
  { display: '◌ُ', name: 'Dammah', insert: '\u064F' },
  { display: '◌ً', name: 'Fathatain', insert: '\u064B' },
  { display: '◌ٍ', name: 'Kasratain', insert: '\u064D' },
  { display: '◌ٌ', name: 'Dammatain', insert: '\u064C' },
  { display: '◌ْ', name: 'Sukun', insert: '\u0652' },
  { display: '◌ّ', name: 'Tasydid', insert: '\u0651' },
  { display: '◌ٰ', name: 'Alif Mad', insert: '\u0670' },
  { display: '◌ٓ', name: 'Maddah', insert: '\u0653' },
];

const ARABIC_HARAKAT_COMBO: HarakatKey[] = [
  { display: '◌َّ', name: 'Syad+A', insert: '\u0651\u064E' },
  { display: '◌ِّ', name: 'Syad+I', insert: '\u0651\u0650' },
  { display: '◌ُّ', name: 'Syad+U', insert: '\u0651\u064F' },
  { display: '◌ًّ', name: 'Syad+An', insert: '\u0651\u064B' },
  { display: '◌ٍّ', name: 'Syad+In', insert: '\u0651\u064D' },
  { display: '◌ٌّ', name: 'Syad+Un', insert: '\u0651\u064C' },
];

const ARABIC_LETTERS: string[] = [
  'ا', 'ب', 'ت', 'ث', 'ج', 'ح', 'خ', 'د', 'ذ', 'ر', 'ز', 'س', 'ش', 'ص',
  'ض', 'ط', 'ظ', 'ع', 'غ', 'ف', 'ق', 'ك', 'ل', 'م', 'ن', 'ه', 'و', 'ي',
  'ة', 'ى', 'ء', 'أ', 'إ', 'آ', 'ؤ', 'ئ', 'لا', 'اللّٰه', '،', '؛', '؟',
];

const ARABIC_DIGITS: string[] = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

const SYMBOL_TABS: SymbolTabItem[] = [
  {
    id: 'arabic',
    label: 'Arab & Harakat',
    isRtl: true,
    items: ARABIC_LETTERS,
  },
  {
    id: 'math',
    label: 'Matematika',
    items: [
      '+', '−', '×', '÷', '±', '=', '≠', '≈', '≤', '≥', '<', '>',
      '√', '∛', '∞', '%', '°', '′', '″', '|', '(', ')', '[', ']', '{', '}',
    ],
  },
  {
    id: 'power_chem',
    label: 'Pangkat & Kimia',
    items: [
      '⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹', 'ⁿ', 'ˣ', 'ʸ', '⁺', '⁻',
      '₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉', '₊', '₋',
      '½', '⅓', '⅔', '¼', '¾', '→', '←', '↔', '⇌', '↑', '↓', '°C', '°K', 'µm', '♂', '♀',
    ],
  },
  {
    id: 'greek_set',
    label: 'Yunani & Kalkulus',
    items: [
      '∑', '∏', '∫', '∂', '∆', '∇', '∈', '∉', '⊂', '⊃', '⊆', '⊇',
      '∪', '∩', '∅', '∀', '∃', '∴', '∵', '∠', '⊥', '∥', '≅', '⇒', '⇔',
      'α', 'β', 'γ', 'δ', 'ε', 'θ', 'λ', 'μ', 'π', 'ρ', 'σ', 'τ', 'φ', 'ω', 'Δ', 'Σ', 'Ω', 'Φ', 'Ψ',
    ],
  },
  {
    id: 'latex',
    label: 'Rumus LaTeX',
    isTemplate: true,
    items: [
      { label: 'Pecahan a/b', insert: '$\\frac{a}{b}$' },
      { label: 'Akar √x', insert: '$\\sqrt{x}$' },
      { label: 'Akar ⁿ√x', insert: '$\\sqrt[n]{x}$' },
      { label: 'Pangkat xⁿ', insert: '$x^{n}$' },
      { label: 'Indeks xₙ', insert: '$x_{n}$' },
      { label: 'Integral ∫', insert: '$\\int_{a}^{b} f(x)\\,dx$' },
      { label: 'Sigma ∑', insert: '$\\sum_{i=1}^{n} x_i$' },
      { label: 'Limit', insert: '$\\lim_{x \\to 0} f(x)$' },
      { label: 'Reaksi ⇌', insert: '$A + B \\rightleftharpoons C + D$' },
    ],
  },
];

interface EssaySymbolToolbarProps {
  value: string;
  apiUrl: string;
  isArabicContext?: boolean;
  questionKey?: string;
  onInsert: (text: string) => void;
  onBackspace?: () => void;
  onStripLastHarakat?: () => void;
}

export default function EssaySymbolToolbar({
  value,
  apiUrl,
  isArabicContext = false,
  questionKey,
  onInsert,
  onBackspace,
  onStripLastHarakat,
}: EssaySymbolToolbarProps) {
  const [activeTab, setActiveTab] = useState<string>(isArabicContext ? 'arabic' : 'math');
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [showArabicLetters, setShowArabicLetters] = useState<boolean>(true);
  const [showArabicDigits, setShowArabicDigits] = useState<boolean>(false);

  useEffect(() => {
    if (isArabicContext) {
      setActiveTab('arabic');
    }
  }, [isArabicContext, questionKey]);

  const currentTab = SYMBOL_TABS.find((t) => t.id === activeTab) || SYMBOL_TABS[0];
  const showMathPreview = hasComplexCbtHtmlOrMath(value);
  const showArabicPreview = !showMathPreview && hasArabicScript(value);

  return (
    <View style={styles.wrapper}>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <View style={styles.headerTitleBox}>
            <Ionicons
              name={activeTab === 'arabic' ? 'language-outline' : 'calculator-outline'}
              size={14}
              color="#0284C7"
            />
            <Text style={styles.headerTitle}>
              {activeTab === 'arabic' ? 'Panel Harakat & Huruf Arab' : 'Panel Simbol & Bahasa'}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setIsCollapsed((p) => !p)}
            style={styles.toggleBtn}
            activeOpacity={0.7}
          >
            <Text style={styles.toggleBtnText}>{isCollapsed ? 'Tampilkan' : 'Sembunyikan'}</Text>
            <Ionicons
              name={isCollapsed ? 'chevron-down' : 'chevron-up'}
              size={14}
              color="#475569"
            />
          </TouchableOpacity>
        </View>

        {!isCollapsed && (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tabsScroll}
              keyboardShouldPersistTaps="always"
            >
              {SYMBOL_TABS.map((tab) => {
                const isActive = tab.id === activeTab;
                return (
                  <TouchableOpacity
                    key={tab.id}
                    onPress={() => setActiveTab(tab.id)}
                    style={[styles.tabPill, isActive && styles.tabPillActive]}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.tabPillText, isActive && styles.tabPillTextActive]}>
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {currentTab.id === 'arabic' ? (
              <View style={styles.arabicPanel}>
                {/* BARIS 1: HARAKAT DASAR (Tampak Jelas dengan Nama & Lingkaran Titik) */}
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionCaption}>
                    Harakat (Ketuk huruf dulu lalu ketuk harakat)
                  </Text>
                  {Boolean(onStripLastHarakat) && (
                    <TouchableOpacity
                      onPress={onStripLastHarakat}
                      style={styles.miniDangerBtn}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="close-circle-outline" size={12} color="#B91C1C" />
                      <Text style={styles.miniDangerText}>Hapus Harakat</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <View style={styles.harakatGrid}>
                  {ARABIC_HARAKAT_BASIC.map((hk, idx) => (
                    <TouchableOpacity
                      key={`hk-${idx}`}
                      onPress={() => onInsert(hk.insert)}
                      style={styles.harakatBtn}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.harakatSymbol}>{hk.display}</Text>
                      <Text style={styles.harakatName} numberOfLines={1}>
                        {hk.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* BARIS 2: HARAKAT TASYDID GABUNGAN (1-Tap) */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.comboRow}
                  keyboardShouldPersistTaps="always"
                >
                  {ARABIC_HARAKAT_COMBO.map((hk, idx) => (
                    <TouchableOpacity
                      key={`hkc-${idx}`}
                      onPress={() => onInsert(hk.insert)}
                      style={styles.harakatComboBtn}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.harakatComboSymbol}>{hk.display}</Text>
                      <Text style={styles.harakatComboName}>{hk.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* TOGGLE HURUF HIJAIYAH & ANGKA ARAB */}
                <View style={styles.arabicSubToggleRow}>
                  <TouchableOpacity
                    onPress={() => setShowArabicLetters((p) => !p)}
                    style={[styles.subToggleBtn, showArabicLetters && styles.subToggleBtnActive]}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.subToggleText,
                        showArabicLetters && styles.subToggleTextActive,
                      ]}
                    >
                      {showArabicLetters ? '▼ Huruf Hijaiyah' : '▶ Huruf Hijaiyah'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setShowArabicDigits((p) => !p)}
                    style={[styles.subToggleBtn, showArabicDigits && styles.subToggleBtnActive]}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.subToggleText,
                        showArabicDigits && styles.subToggleTextActive,
                      ]}
                    >
                      Angka Arab (٠-٩)
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => onInsert(' ')}
                    style={[styles.symbolBtn, styles.actionKeyBtn]}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.actionKeyText}>Spasi</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => onInsert('\n')}
                    style={[styles.symbolBtn, styles.actionKeyBtn]}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.actionKeyText}>↵</Text>
                  </TouchableOpacity>
                  {Boolean(onBackspace) && (
                    <TouchableOpacity
                      onPress={onBackspace}
                      style={[styles.symbolBtn, styles.backspaceBtn]}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="backspace-outline" size={16} color="#DC2626" />
                    </TouchableOpacity>
                  )}
                </View>

                {showArabicDigits && (
                  <View style={[styles.symbolsGrid, { flexDirection: 'row-reverse' }]}>
                    {ARABIC_DIGITS.map((digit, idx) => (
                      <TouchableOpacity
                        key={`ad-${idx}`}
                        onPress={() => onInsert(digit)}
                        style={[styles.symbolBtn, styles.arabicBtn]}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.symbolText, styles.arabicText]}>{digit}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {showArabicLetters && (
                  <View style={[styles.symbolsGrid, { flexDirection: 'row-reverse' }]}>
                    {ARABIC_LETTERS.map((letter, idx) => {
                      const isWide = letter.length > 2;
                      return (
                        <TouchableOpacity
                          key={`al-${idx}`}
                          onPress={() => onInsert(letter)}
                          style={[
                            styles.symbolBtn,
                            styles.arabicBtn,
                            isWide && styles.arabicWideBtn,
                          ]}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.symbolText, styles.arabicText]}>{letter}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.symbolsGrid}>
                {currentTab.items.map((item, idx) => {
                  const label = typeof item === 'string' ? item : item.label;
                  const insertText = typeof item === 'string' ? item : item.insert;
                  return (
                    <TouchableOpacity
                      key={`${currentTab.id}-${idx}`}
                      onPress={() => onInsert(insertText)}
                      style={[
                        styles.symbolBtn,
                        currentTab.isTemplate && styles.templateBtn,
                      ]}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.symbolText,
                          currentTab.isTemplate && styles.templateText,
                        ]}
                      >
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </>
        )}
      </View>

      {showMathPreview && (
        <View style={styles.previewBox}>
          <Text style={styles.previewLabel}>Pratinjau Rumus Jawaban Anda:</Text>
          <RichCbtContent
            content={value}
            apiUrl={apiUrl}
            fontSize={14}
            textColor="#0F172A"
          />
        </View>
      )}

      {showArabicPreview && (
        <View style={styles.arabicPreviewBox}>
          <Text style={styles.arabicPreviewLabel}>Pratinjau Tulisan Arab Berharakat:</Text>
          <Text style={styles.arabicPreviewText}>{value}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 10,
    gap: 8,
  },
  container: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    padding: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  headerTitleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#E2E8F0',
  },
  toggleBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  tabsScroll: {
    gap: 6,
    paddingBottom: 8,
  },
  tabPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  tabPillActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#0284C7',
  },
  tabPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  tabPillTextActive: {
    color: '#0369A1',
    fontWeight: '700',
  },
  arabicPanel: {
    gap: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  sectionCaption: {
    fontSize: 11,
    fontWeight: '600',
    color: '#047857',
    flex: 1,
  },
  miniDangerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  miniDangerText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#B91C1C',
  },
  harakatGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 5,
  },
  harakatBtn: {
    minWidth: 56,
    paddingHorizontal: 6,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#6EE7B7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  harakatSymbol: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    color: '#065F46',
    includeFontPadding: true,
  },
  harakatName: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#047857',
    marginTop: 1,
  },
  comboRow: {
    gap: 5,
    paddingVertical: 1,
  },
  harakatComboBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  harakatComboSymbol: {
    fontSize: 19,
    lineHeight: 25,
    fontWeight: '700',
    color: '#92400E',
    includeFontPadding: true,
  },
  harakatComboName: {
    fontSize: 10,
    fontWeight: '700',
    color: '#B45309',
  },
  arabicSubToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  subToggleBtn: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 7,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  subToggleBtnActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#38BDF8',
  },
  subToggleText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  subToggleTextActive: {
    color: '#0369A1',
  },
  symbolsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  symbolBtn: {
    minWidth: 33,
    height: 33,
    paddingHorizontal: 6,
    borderRadius: 7,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  templateBtn: {
    minWidth: undefined,
    paddingHorizontal: 10,
  },
  arabicBtn: {
    minWidth: 38,
    height: 38,
  },
  arabicWideBtn: {
    minWidth: 56,
    paddingHorizontal: 10,
  },
  symbolText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
  },
  templateText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0369A1',
  },
  arabicText: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '600',
    includeFontPadding: true,
  },
  actionKeyBtn: {
    paddingHorizontal: 11,
    backgroundColor: '#F1F5F9',
  },
  actionKeyText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  backspaceBtn: {
    paddingHorizontal: 10,
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  previewBox: {
    backgroundColor: '#F0F9FF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    padding: 10,
  },
  previewLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0369A1',
    marginBottom: 4,
  },
  arabicPreviewBox: {
    backgroundColor: '#F0FDF4',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  arabicPreviewLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
    marginBottom: 4,
  },
  arabicPreviewText: {
    fontSize: 24,
    lineHeight: 46,
    color: '#0F172A',
    writingDirection: 'rtl',
    textAlign: 'right',
    includeFontPadding: true,
  },
});
