import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import RichCbtContent from './RichCbtContent';
import { hasComplexCbtHtmlOrMath } from '../utils/cbtFormatter';

interface SymbolTabItem {
  id: string;
  label: string;
  isRtl?: boolean;
  isTemplate?: boolean;
  items: Array<string | { label: string; insert: string }>;
}

const SYMBOL_TABS: SymbolTabItem[] = [
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
  {
    id: 'arabic',
    label: 'Arab & Harakat',
    isRtl: true,
    items: [
      'ا', 'ب', 'ت', 'ث', 'ج', 'ح', 'خ', 'د', 'ذ', 'ر', 'ز', 'س', 'ش', 'ص',
      'ض', 'ط', 'ظ', 'ع', 'غ', 'ف', 'ق', 'ك', 'ل', 'م', 'ن', 'ه', 'و', 'ي',
      'ة', 'ى', 'ء', 'أ', 'إ', 'آ', 'ؤ', 'ئ', 'لا',
      'َ', 'ِ', 'ُ', 'ً', 'ٍ', 'ٌ', 'ْ', 'ّ', '،', '؛', '؟',
    ],
  },
];

interface EssaySymbolToolbarProps {
  value: string;
  apiUrl: string;
  onInsert: (text: string) => void;
  onBackspace?: () => void;
}

export default function EssaySymbolToolbar({
  value,
  apiUrl,
  onInsert,
  onBackspace,
}: EssaySymbolToolbarProps) {
  const [activeTab, setActiveTab] = useState<string>('math');
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  const currentTab = SYMBOL_TABS.find((t) => t.id === activeTab) || SYMBOL_TABS[0];
  const showPreview = hasComplexCbtHtmlOrMath(value);

  return (
    <View style={styles.wrapper}>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <View style={styles.headerTitleBox}>
            <Ionicons name="calculator-outline" size={14} color="#0284C7" />
            <Text style={styles.headerTitle}>Panel Simbol & Bahasa</Text>
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

            <View
              style={[
                styles.symbolsGrid,
                currentTab.isRtl && { flexDirection: 'row-reverse' },
              ]}
            >
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
                      currentTab.isRtl && styles.arabicBtn,
                    ]}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.symbolText,
                        currentTab.isTemplate && styles.templateText,
                        currentTab.isRtl && styles.arabicText,
                      ]}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}

              {currentTab.isRtl && (
                <>
                  <TouchableOpacity
                    onPress={() => onInsert(' ')}
                    style={[styles.symbolBtn, styles.actionKeyBtn]}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.actionKeyText}>Spasi</Text>
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
                </>
              )}
            </View>
          </>
        )}
      </View>

      {showPreview && (
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
    minWidth: 36,
    height: 36,
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
    fontSize: 18,
    fontWeight: '600',
  },
  actionKeyBtn: {
    paddingHorizontal: 12,
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
});
