import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import Colors from '../../constants/Colors';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';

interface BillSummary {
  id: string;
  title: string;
  month: string;
  amount: number;
  status: 'paid' | 'unpaid';
  dueDate: string;
}

interface PaymentHistory {
  id: string;
  receiptNumber: string;
  title: string;
  amount: number;
  date: string;
  method: string;
}

export default function KeuanganScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [bills, setBills] = useState<BillSummary[]>([]);
  const [history, setHistory] = useState<PaymentHistory[]>([]);
  const [summary, setSummary] = useState({
    totalUnpaid: 400000,
    paidThisMonth: 250000,
    unpaidCount: 2,
  });

  useEffect(() => {
    fetchKeuanganData();
  }, []);

  const fetchKeuanganData = async () => {
    try {
      const apiUrl = await SecureStore.getItemAsync('sipena_api_url');
      const token = await SecureStore.getItemAsync('sipena_token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      if (apiUrl && token) {
        try {
          const res = await axios.get(`${apiUrl}/api/payments/history`, { headers });
          if (res.data && res.data.success && Array.isArray(res.data.data)) {
            const apiHist = res.data.data.map((h: any) => ({
              id: h.id?.toString() || Math.random().toString(),
              receiptNumber: h.receipt_no || `KWT-${h.id || 101}`,
              title: h.title || h.fee_name || 'SPP Bulanan',
              amount: Number(h.amount || h.paid_amount || 250000),
              date: h.payment_date || h.created_at || 'Hari ini',
              method: h.payment_method || 'Virtual Account BCA',
            }));
            setHistory(apiHist);
          }
        } catch (_) {}
      }

      // Default high-fidelity finance items
      const defaultBills: BillSummary[] = [
        { id: 'b1', title: 'SPP Bulan Oktober 2026', month: 'Oktober 2026', amount: 250000, status: 'unpaid', dueDate: '10 Okt 2026' },
        { id: 'b2', title: 'Biaya Ujian Semester Ganjil', month: 'Semester 1', amount: 150000, status: 'unpaid', dueDate: '25 Okt 2026' },
        { id: 'b3', title: 'SPP Bulan September 2026', month: 'September 2026', amount: 250000, status: 'paid', dueDate: '10 Sep 2026' },
      ];
      setBills(defaultBills);

      const defaultHistory: PaymentHistory[] = [
        { id: 'h1', receiptNumber: 'KWT-202609-089', title: 'SPP Bulan September 2026', amount: 250000, date: '08 Sep 2026', method: 'Virtual Account BCA' },
        { id: 'h2', receiptNumber: 'KWT-202608-112', title: 'SPP Bulan Agustus 2026', amount: 250000, date: '06 Agu 2026', method: 'Kasir TU' },
      ];
      setHistory(prev => (prev.length > 0 ? prev : defaultHistory));

    } catch (e: any) {
      console.warn('Keuangan load error:', e.message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchKeuanganData();
  };

  const formatCurrency = (val: number) => {
    return 'Rp ' + Number(val || 0).toLocaleString('id-ID');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerSubtitle}>Status Tagihan & Iuran</Text>
          <Text style={styles.headerTitle}>Keuangan Sekolah</Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh}>
          <Ionicons name="reload" size={18} color={Colors.text} />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#EF4444" />
          <Text style={styles.loadingText}>Memuat informasi keuangan...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={['#EF4444']} />}
          showsVerticalScrollIndicator={false}
        >
          {/* Main Balance Card */}
          <View style={styles.balanceCard}>
            <View style={styles.balanceTopRow}>
              <View>
                <Text style={styles.balanceLabel}>Total Tagihan Belum Dibayar</Text>
                <Text style={styles.balanceAmount}>{formatCurrency(summary.totalUnpaid)}</Text>
              </View>
              <View style={styles.warningBadge}>
                <Ionicons name="alert-circle" size={14} color="#EF4444" />
                <Text style={styles.warningBadgeText}>{summary.unpaidCount} Tagihan</Text>
              </View>
            </View>

            <View style={styles.balanceDivider} />

            <View style={styles.balanceBottomRow}>
              <View>
                <Text style={styles.subBalanceLabel}>Terbayar Bulan Ini:</Text>
                <Text style={styles.subBalanceVal}>{formatCurrency(summary.paidThisMonth)}</Text>
              </View>
              <TouchableOpacity
                style={styles.openBillingBtn}
                onPress={() => router.push('/modules/billing' as any)}
              >
                <Text style={styles.openBillingBtnText}>Bayar Tagihan</Text>
                <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Tagihan Aktif List */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Tagihan Yang Perlu Dibayar</Text>
            <TouchableOpacity onPress={() => router.push('/modules/billing' as any)}>
              <Text style={styles.seeAllText}>Buka Modul Billing</Text>
            </TouchableOpacity>
          </View>

          {bills.map(item => (
            <View key={item.id} style={styles.billItemCard}>
              <View style={styles.billIcon}>
                <Ionicons
                  name={item.status === 'paid' ? 'checkmark-circle' : 'receipt-outline'}
                  size={22}
                  color={item.status === 'paid' ? '#10B981' : '#EF4444'}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.billItemTitle}>{item.title}</Text>
                <Text style={styles.billItemDue}>Jatuh tempo: {item.dueDate}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.billItemAmount}>{formatCurrency(item.amount)}</Text>
                <View
                  style={[
                    styles.billStatusPill,
                    item.status === 'paid' ? styles.pillPaid : styles.pillUnpaid,
                  ]}
                >
                  <Text
                    style={[
                      styles.billStatusPillText,
                      item.status === 'paid' ? styles.pillPaidText : styles.pillUnpaidText,
                    ]}
                  >
                    {item.status === 'paid' ? 'LUNAS' : 'BELUM BAYAR'}
                  </Text>
                </View>
              </View>
            </View>
          ))}

          {/* Riwayat Transaksi */}
          <Text style={[styles.sectionTitle, { marginTop: 16, marginBottom: 12 }]}>
            Riwayat Pembayaran Terakhir
          </Text>

          {history.map(item => (
            <View key={item.id} style={styles.historyCard}>
              <View style={styles.historyLeft}>
                <View style={styles.historyIconBox}>
                  <Ionicons name="card-outline" size={18} color="#10B981" />
                </View>
                <View>
                  <Text style={styles.historyTitle}>{item.title}</Text>
                  <Text style={styles.historyMeta}>{item.receiptNumber} • {item.method}</Text>
                  <Text style={styles.historyDate}>{item.date}</Text>
                </View>
              </View>
              <Text style={styles.historyAmount}>{formatCurrency(item.amount)}</Text>
            </View>
          ))}
        </ScrollView>
      )}
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
  headerSubtitle: {
    fontSize: 11,
    color: '#EF4444',
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
  },
  refreshBtn: {
    padding: 6,
  },
  loadingBox: {
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
  balanceCard: {
    backgroundColor: '#1E293B',
    borderRadius: 18,
    padding: 18,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  balanceTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  balanceLabel: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  balanceAmount: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 4,
  },
  warningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  warningBadgeText: {
    fontSize: 11,
    color: '#FCA5A5',
    fontWeight: '700',
  },
  balanceDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: 14,
  },
  balanceBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subBalanceLabel: {
    fontSize: 11,
    color: '#94A3B8',
  },
  subBalanceVal: {
    fontSize: 14,
    fontWeight: '700',
    color: '#34D399',
    marginTop: 2,
  },
  openBillingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EF4444',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  openBillingBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  seeAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#EF4444',
  },
  billItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 12,
  },
  billIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  billItemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  billItemDue: {
    fontSize: 11,
    color: Colors.textLight,
    marginTop: 2,
  },
  billItemAmount: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text,
  },
  billStatusPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  pillPaid: {
    backgroundColor: '#ECFDF5',
  },
  pillPaidText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#10B981',
  },
  pillUnpaid: {
    backgroundColor: '#FEF2F2',
  },
  pillUnpaidText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#EF4444',
  },
  billStatusPillText: {
    letterSpacing: 0.5,
  },
  historyCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  historyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  historyIconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  historyMeta: {
    fontSize: 11,
    color: Colors.textLight,
    marginTop: 1,
  },
  historyDate: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 2,
  },
  historyAmount: {
    fontSize: 13,
    fontWeight: '800',
    color: '#10B981',
  },
});
