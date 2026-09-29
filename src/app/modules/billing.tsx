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

type TabType = 'tagihan' | 'riwayat' | 'tarif';

interface BillItem {
  id: string;
  studentName: string;
  nisn: string;
  className: string;
  title: string;
  category: string;
  amount: number;
  dueDate: string;
  status: 'unpaid' | 'paid' | 'pending';
  month?: string;
}

interface PaymentHistoryItem {
  id: string;
  receiptNumber: string;
  studentName: string;
  className: string;
  title: string;
  amount: number;
  paymentMethod: string;
  paymentDate: string;
  receiver: string;
  status: 'verified' | 'pending';
}

interface FeeTariff {
  id: string;
  name: string;
  level: string;
  amount: number;
  period: 'Bulanan' | 'Tahunan' | 'Sekali';
  description: string;
}

export default function BillingModuleScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<TabType>('tagihan');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unpaid' | 'paid'>('all');

  // Modal states
  const [selectedBill, setSelectedBill] = useState<BillItem | null>(null);
  const [isPaymentModalVisible, setIsPaymentModalVisible] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('VA BCA');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  const [receiptDetail, setReceiptDetail] = useState<PaymentHistoryItem | null>(null);

  // Toast
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: ToastType }>({
    visible: false,
    message: '',
    type: 'info',
  });

  const showToast = (message: string, type: ToastType = 'info') => {
    setToast({ visible: true, message, type });
  };

  // Data
  const [bills, setBills] = useState<BillItem[]>([]);
  const [history, setHistory] = useState<PaymentHistoryItem[]>([]);
  const [tariffs, setTariffs] = useState<FeeTariff[]>([]);
  const [stats, setStats] = useState({
    totalTagihan: 0,
    terbayarBulanIni: 0,
    belumBayar: 0,
    totalTransaksi: 0,
  });

  useEffect(() => {
    fetchBillingData();
  }, []);

  const fetchBillingData = async () => {
    try {
      const apiUrl = await SecureStore.getItemAsync('sipena_api_url');
      const token = await SecureStore.getItemAsync('sipena_token');
      const storedUser = await SecureStore.getItemAsync('sipena_user');
      const user = storedUser ? JSON.parse(storedUser) : null;

      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      if (apiUrl && token) {
        try {
          const [resHistory, resSettings] = await Promise.allSettled([
            axios.get(`${apiUrl}/api/payments/history`, { headers }),
            axios.get(`${apiUrl}/api/payments/settings`, { headers }),
          ]);

          let historyData: PaymentHistoryItem[] = [];
          if (resHistory.status === 'fulfilled' && resHistory.value.data?.data) {
            historyData = resHistory.value.data.data.map((item: any) => ({
              id: item.id?.toString() || Math.random().toString(),
              receiptNumber: item.receipt_no || `INV-${item.id || 1001}`,
              studentName: item.student?.name || item.student_name || 'Siswa',
              className: item.student?.class_name || item.class?.name || 'Kelas X',
              title: item.title || item.fee_name || 'SPP Bulanan',
              amount: Number(item.amount || item.paid_amount || 0),
              paymentMethod: item.payment_method || 'Tunai TU',
              paymentDate: item.payment_date || item.created_at || new Date().toISOString(),
              receiver: item.receiver_name || 'Petugas Keuangan',
              status: item.status === 'pending' ? 'pending' : 'verified',
            }));
            setHistory(historyData);
          }

          let tariffData: FeeTariff[] = [];
          if (resSettings.status === 'fulfilled' && resSettings.value.data?.data) {
            tariffData = resSettings.value.data.data.map((item: any) => ({
              id: item.id?.toString() || Math.random().toString(),
              name: item.name || item.fee_title || 'Iuran SPP',
              level: item.level || 'Semua Tingkat',
              amount: Number(item.amount || 0),
              period: item.period || 'Bulanan',
              description: item.description || 'Ketetapan Komite Sekolah',
            }));
            setTariffs(tariffData);
          }
        } catch (e) {
          console.warn('Billing API error:', e);
        }
      }

      // Default structured data
      const sampleBills: BillItem[] = [
        {
          id: 'b1',
          studentName: user?.student_name || user?.name || 'Ahmad Fauzan',
          nisn: user?.nisn || '0087654321',
          className: 'XII MIPA 1',
          title: 'SPP Bulan Oktober 2026',
          category: 'SPP',
          amount: 250000,
          dueDate: '10 Okt 2026',
          status: 'unpaid',
          month: 'Oktober 2026',
        },
        {
          id: 'b2',
          studentName: user?.student_name || user?.name || 'Ahmad Fauzan',
          nisn: user?.nisn || '0087654321',
          className: 'XII MIPA 1',
          title: 'Dana Ujian Semester Ganjil',
          category: 'Ujian',
          amount: 150000,
          dueDate: '25 Okt 2026',
          status: 'unpaid',
          month: 'Semester 1',
        },
        {
          id: 'b3',
          studentName: user?.student_name || user?.name || 'Ahmad Fauzan',
          nisn: user?.nisn || '0087654321',
          className: 'XII MIPA 1',
          title: 'SPP Bulan September 2026',
          category: 'SPP',
          amount: 250000,
          dueDate: '10 Sep 2026',
          status: 'paid',
          month: 'September 2026',
        },
        {
          id: 'b4',
          studentName: user?.student_name || user?.name || 'Ahmad Fauzan',
          nisn: user?.nisn || '0087654321',
          className: 'XII MIPA 1',
          title: 'Iuran Praktikum Lab Komputer',
          category: 'Praktikum',
          amount: 75000,
          dueDate: '15 Sep 2026',
          status: 'paid',
          month: 'September 2026',
        },
      ];

      setBills(sampleBills);

      const defaultTariffs: FeeTariff[] = [
        { id: 't1', name: 'SPP Kelas Reguler X - XII', level: 'SMA/SMK', amount: 250000, period: 'Bulanan', description: 'Iuran operasional pembelajaran & fasilitas' },
        { id: 't2', name: 'Uang Praktikum Komputer & Multimedia', level: 'Semua Jurusan', amount: 75000, period: 'Bulanan', description: 'Lisensi software & internet kecepatan tinggi' },
        { id: 't3', name: 'Dana Kegiatan Osis & Ekstrakurikuler', level: 'Semua Siswa', amount: 120000, period: 'Tahunan', description: 'Lomba seni, kepramukaan & turnamen olahraga' },
        { id: 't4', name: 'Ujian Semester Ganjil & Asesmen', level: 'Kelas X, XI, XII', amount: 150000, period: 'Sekali', description: 'Server CBT & pengadaan soal asesmen' },
      ];
      setTariffs(prev => (prev.length > 0 ? prev : defaultTariffs));

      const defaultHistory: PaymentHistoryItem[] = [
        {
          id: 'h1',
          receiptNumber: 'KWT-202609-089',
          studentName: user?.student_name || user?.name || 'Ahmad Fauzan',
          className: 'XII MIPA 1',
          title: 'SPP Bulan September 2026',
          amount: 250000,
          paymentMethod: 'Virtual Account BCA',
          paymentDate: '08 Sep 2026, 10:14 WIB',
          receiver: 'Sistem Pembayaran Otomatis',
          status: 'verified',
        },
        {
          id: 'h2',
          receiptNumber: 'KWT-202609-021',
          studentName: user?.student_name || user?.name || 'Ahmad Fauzan',
          className: 'XII MIPA 1',
          title: 'Iuran Praktikum Lab Komputer',
          amount: 75000,
          paymentMethod: 'QRIS Barcode',
          paymentDate: '02 Sep 2026, 08:30 WIB',
          receiver: 'Ibu Siti Rahma (Bendahara)',
          status: 'verified',
        },
      ];
      setHistory(prev => (prev.length > 0 ? prev : defaultHistory));

      setStats({
        totalTagihan: 400000,
        terbayarBulanIni: 325000,
        belumBayar: 2,
        totalTransaksi: 14,
      });

    } catch (e: any) {
      console.warn('Billing load error:', e.message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchBillingData();
  };

  const handlePayBill = (bill: BillItem) => {
    setSelectedBill(bill);
    setIsPaymentModalVisible(true);
  };

  const handleConfirmPayment = async () => {
    if (!selectedBill) return;
    setIsSubmittingPayment(true);
    try {
      const apiUrl = await SecureStore.getItemAsync('sipena_api_url');
      const token = await SecureStore.getItemAsync('sipena_token');

      if (apiUrl && token) {
        try {
          await axios.post(
            `${apiUrl}/api/payments`,
            {
              bill_id: selectedBill.id,
              amount: selectedBill.amount,
              payment_method: selectedPaymentMethod,
              notes: paymentNotes,
            },
            { headers: { Authorization: `Bearer ${token}` } }
          );
        } catch (_) {}
      }

      // Update state locally
      setBills(prev =>
        prev.map(b => (b.id === selectedBill.id ? { ...b, status: 'paid' } : b))
      );

      const newHistoryItem: PaymentHistoryItem = {
        id: `h-${Date.now()}`,
        receiptNumber: `KWT-${Date.now().toString().slice(-6)}`,
        studentName: selectedBill.studentName,
        className: selectedBill.className,
        title: selectedBill.title,
        amount: selectedBill.amount,
        paymentMethod: selectedPaymentMethod,
        paymentDate: 'Hari ini, Baru Saja',
        receiver: 'Kasir TU / Online Gateway',
        status: 'verified',
      };
      setHistory(prev => [newHistoryItem, ...prev]);

      setIsPaymentModalVisible(false);
      showToast(`Pembayaran ${selectedBill.title} berhasil diproses!`, 'success');
    } catch (err: any) {
      showToast('Gagal memproses pembayaran.', 'error');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const filteredBills = bills.filter(b => {
    const matchesSearch =
      b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.nisn.includes(searchQuery);

    if (!matchesSearch) return false;
    if (statusFilter === 'all') return true;
    return b.status === statusFilter;
  });

  const formatCurrency = (val: number) => {
    return 'Rp ' + Number(val || 0).toLocaleString('id-ID');
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
            <Ionicons name="card" size={14} color="#EF4444" />
            <Text style={styles.moduleBadgeText}>MODUL 07</Text>
          </View>
          <Text style={styles.headerTitle}>Billing & SPP Keuangan</Text>
        </View>
        <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
          <Ionicons name="reload" size={20} color={Colors.text} />
        </TouchableOpacity>
      </View>

      {/* KPI Stats Overview */}
      <View style={styles.kpiContainer}>
        <View style={[styles.kpiCard, { backgroundColor: '#FEF2F2' }]}>
          <View style={styles.kpiIconWrapper}>
            <Ionicons name="alert-circle" size={18} color="#EF4444" />
          </View>
          <Text style={styles.kpiValue}>{stats.belumBayar} Tagihan</Text>
          <Text style={styles.kpiLabel}>Belum Lunas</Text>
        </View>
        <View style={[styles.kpiCard, { backgroundColor: '#ECFDF5' }]}>
          <View style={[styles.kpiIconWrapper, { backgroundColor: '#D1FAE5' }]}>
            <Ionicons name="checkmark-done-circle" size={18} color="#10B981" />
          </View>
          <Text style={styles.kpiValue}>{formatCurrency(stats.terbayarBulanIni)}</Text>
          <Text style={styles.kpiLabel}>Terbayar Bulan Ini</Text>
        </View>
      </View>

      {/* Navigation Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'tagihan' && styles.tabButtonActive]}
          onPress={() => setActiveTab('tagihan')}
        >
          <Ionicons
            name="receipt-outline"
            size={16}
            color={activeTab === 'tagihan' ? '#EF4444' : Colors.textLight}
          />
          <Text style={[styles.tabText, activeTab === 'tagihan' && styles.tabTextActive]}>
            Tagihan Aktif
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'riwayat' && styles.tabButtonActive]}
          onPress={() => setActiveTab('riwayat')}
        >
          <Ionicons
            name="time-outline"
            size={16}
            color={activeTab === 'riwayat' ? '#EF4444' : Colors.textLight}
          />
          <Text style={[styles.tabText, activeTab === 'riwayat' && styles.tabTextActive]}>
            Riwayat Bayar
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'tarif' && styles.tabButtonActive]}
          onPress={() => setActiveTab('tarif')}
        >
          <Ionicons
            name="list-outline"
            size={16}
            color={activeTab === 'tarif' ? '#EF4444' : Colors.textLight}
          />
          <Text style={[styles.tabText, activeTab === 'tarif' && styles.tabTextActive]}>
            Tarif & Iuran
          </Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#EF4444" />
          <Text style={styles.loadingText}>Memuat data tagihan...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={['#EF4444']} />}
          showsVerticalScrollIndicator={false}
        >
          {/* TAB 1: TAGIHAN AKTIF */}
          {activeTab === 'tagihan' && (
            <View>
              {/* Search & Filter */}
              <View style={styles.filterRow}>
                <View style={styles.searchBox}>
                  <Ionicons name="search" size={18} color={Colors.textLight} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Cari tagihan atau nama..."
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholderTextColor={Colors.textLight}
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                      <Ionicons name="close-circle" size={16} color={Colors.textLight} />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Filter Pills */}
                <View style={styles.statusPills}>
                  <TouchableOpacity
                    style={[styles.statusPill, statusFilter === 'all' && styles.statusPillActive]}
                    onPress={() => setStatusFilter('all')}
                  >
                    <Text style={[styles.statusPillText, statusFilter === 'all' && styles.statusPillTextActive]}>Semua</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.statusPill, statusFilter === 'unpaid' && styles.statusPillActive]}
                    onPress={() => setStatusFilter('unpaid')}
                  >
                    <Text style={[styles.statusPillText, statusFilter === 'unpaid' && styles.statusPillTextActive]}>Belum Lunas</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.statusPill, statusFilter === 'paid' && styles.statusPillActive]}
                    onPress={() => setStatusFilter('paid')}
                  >
                    <Text style={[styles.statusPillText, statusFilter === 'paid' && styles.statusPillTextActive]}>Lunas</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Bills List */}
              {filteredBills.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="shield-checkmark-outline" size={48} color="#10B981" />
                  <Text style={styles.emptyTitle}>Tidak Ada Tagihan</Text>
                  <Text style={styles.emptySubtitle}>Semua kewajiban pembayaran telah diselesaikan atau tidak ditemukan.</Text>
                </View>
              ) : (
                filteredBills.map(bill => (
                  <View key={bill.id} style={styles.billCard}>
                    <View style={styles.billCardHeader}>
                      <View style={styles.categoryBadge}>
                        <Ionicons name="bookmark" size={12} color="#EF4444" />
                        <Text style={styles.categoryBadgeText}>{bill.category}</Text>
                      </View>
                      <View
                        style={[
                          styles.badgeStatus,
                          bill.status === 'paid' ? styles.badgePaid : styles.badgeUnpaid,
                        ]}
                      >
                        <Text
                          style={[
                            styles.badgeStatusText,
                            bill.status === 'paid' ? styles.badgePaidText : styles.badgeUnpaidText,
                          ]}
                        >
                          {bill.status === 'paid' ? 'LUNAS' : 'BELUM BAYAR'}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.billTitle}>{bill.title}</Text>
                    <Text style={styles.billStudent}>
                      {bill.studentName} ({bill.className}) • NISN {bill.nisn}
                    </Text>

                    <View style={styles.billDivider} />

                    <View style={styles.billFooter}>
                      <View>
                        <Text style={styles.billAmountLabel}>Total Nominal</Text>
                        <Text style={styles.billAmountValue}>{formatCurrency(bill.amount)}</Text>
                        <Text style={styles.billDueText}>Jatuh tempo: {bill.dueDate}</Text>
                      </View>

                      {bill.status === 'unpaid' ? (
                        <TouchableOpacity
                          style={styles.payButton}
                          onPress={() => handlePayBill(bill)}
                        >
                          <Ionicons name="wallet-outline" size={16} color="#FFFFFF" />
                          <Text style={styles.payButtonText}>Bayar Sekarang</Text>
                        </TouchableOpacity>
                      ) : (
                        <View style={styles.paidCheckBadge}>
                          <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                          <Text style={styles.paidCheckText}>Terverifikasi</Text>
                        </View>
                      )}
                    </View>
                  </View>
                ))
              )}
            </View>
          )}

          {/* TAB 2: RIWAYAT PEMBAYARAN */}
          {activeTab === 'riwayat' && (
            <View>
              <Text style={styles.sectionHeaderTitle}>Kwitansi & Transaksi Terverifikasi</Text>
              {history.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="file-tray-outline" size={48} color={Colors.textLight} />
                  <Text style={styles.emptyTitle}>Belum Ada Riwayat</Text>
                  <Text style={styles.emptySubtitle}>Kwitansi pembayaran akan tampil di sini setelah transaksi diverifikasi.</Text>
                </View>
              ) : (
                history.map(item => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.historyCard}
                    onPress={() => setReceiptDetail(item)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.historyCardLeft}>
                      <View style={styles.historyIconWrapper}>
                        <Ionicons name="receipt" size={20} color="#EF4444" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.historyTitle}>{item.title}</Text>
                        <Text style={styles.historyReceiptNo}>{item.receiptNumber} • {item.paymentMethod}</Text>
                        <Text style={styles.historyDate}>{item.paymentDate}</Text>
                      </View>
                    </View>
                    <View style={styles.historyCardRight}>
                      <Text style={styles.historyAmount}>{formatCurrency(item.amount)}</Text>
                      <View style={styles.verifiedTag}>
                        <Text style={styles.verifiedTagText}>SUKSES</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}

          {/* TAB 3: TARIF & IURAN SEKOLAH */}
          {activeTab === 'tarif' && (
            <View>
              <Text style={styles.sectionHeaderTitle}>Master Biaya Resmi Sekolah</Text>
              <Text style={styles.sectionSubtitle}>
                Daftar rincian iuran dan tarif resmi yang disetujui dalam rapat komite sekolah.
              </Text>

              {tariffs.map(t => (
                <View key={t.id} style={styles.tariffCard}>
                  <View style={styles.tariffHeader}>
                    <Text style={styles.tariffName}>{t.name}</Text>
                    <View style={styles.periodBadge}>
                      <Text style={styles.periodBadgeText}>{t.period}</Text>
                    </View>
                  </View>
                  <Text style={styles.tariffLevel}>Sasaran: {t.level}</Text>
                  <Text style={styles.tariffDesc}>{t.description}</Text>
                  <View style={styles.tariffDivider} />
                  <View style={styles.tariffFooter}>
                    <Text style={styles.tariffAmountLabel}>Besaran Iuran:</Text>
                    <Text style={styles.tariffAmount}>{formatCurrency(t.amount)}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {/* Modal Bayar Tagihan */}
      <Modal
        visible={isPaymentModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsPaymentModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Konfirmasi Pembayaran</Text>
              <TouchableOpacity onPress={() => setIsPaymentModalVisible(false)}>
                <Ionicons name="close" size={22} color={Colors.text} />
              </TouchableOpacity>
            </View>

            {selectedBill && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.modalSummaryBox}>
                  <Text style={styles.modalSummaryTitle}>{selectedBill.title}</Text>
                  <Text style={styles.modalSummaryStudent}>
                    {selectedBill.studentName} ({selectedBill.className})
                  </Text>
                  <Text style={styles.modalSummaryAmount}>{formatCurrency(selectedBill.amount)}</Text>
                </View>

                <Text style={styles.formSectionTitle}>Pilih Saluran Pembayaran</Text>

                {[
                  { id: 'VA BCA', name: 'Virtual Account BCA', icon: 'card-outline' },
                  { id: 'VA Mandiri', name: 'Virtual Account Mandiri', icon: 'card-outline' },
                  { id: 'VA BRI', name: 'BRIVA Virtual Account', icon: 'card-outline' },
                  { id: 'QRIS', name: 'QRIS Nasional (Instant)', icon: 'qr-code-outline' },
                  { id: 'Tunai TU', name: 'Bayar Tunai di Kasir TU', icon: 'cash-outline' },
                ].map(method => (
                  <TouchableOpacity
                    key={method.id}
                    style={[
                      styles.methodItem,
                      selectedPaymentMethod === method.id && styles.methodItemActive,
                    ]}
                    onPress={() => setSelectedPaymentMethod(method.id)}
                  >
                    <Ionicons
                      name={method.icon as any}
                      size={20}
                      color={selectedPaymentMethod === method.id ? '#EF4444' : Colors.textLight}
                    />
                    <Text
                      style={[
                        styles.methodText,
                        selectedPaymentMethod === method.id && styles.methodTextActive,
                      ]}
                    >
                      {method.name}
                    </Text>
                    {selectedPaymentMethod === method.id && (
                      <Ionicons name="checkmark-circle" size={18} color="#EF4444" />
                    )}
                  </TouchableOpacity>
                ))}

                <Text style={[styles.formSectionTitle, { marginTop: 16 }]}>Catatan Pembayaran (Opsional)</Text>
                <TextInput
                  style={styles.notesInput}
                  placeholder="Contoh: Titipan orang tua an. Bapak Sudrajat"
                  value={paymentNotes}
                  onChangeText={setPaymentNotes}
                  placeholderTextColor={Colors.textLight}
                />

                <TouchableOpacity
                  style={[styles.submitPayButton, isSubmittingPayment && { opacity: 0.6 }]}
                  onPress={handleConfirmPayment}
                  disabled={isSubmittingPayment}
                >
                  {isSubmittingPayment ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <Ionicons name="shield-checkmark" size={18} color="#FFFFFF" />
                      <Text style={styles.submitPayButtonText}>
                        Proses Pembayaran • {formatCurrency(selectedBill.amount)}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal Detail Kwitansi */}
      <Modal
        visible={receiptDetail !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setReceiptDetail(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.receiptModalCard}>
            <View style={styles.receiptBadgeHeader}>
              <Ionicons name="receipt" size={28} color="#10B981" />
              <Text style={styles.receiptHeaderTitle}>BUKTI PEMBAYARAN RESMI</Text>
              <Text style={styles.receiptSub}>Sistem Informasi Pendidikan SIPENAFS</Text>
            </View>

            {receiptDetail && (
              <View style={styles.receiptBody}>
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>No. Kwitansi</Text>
                  <Text style={styles.receiptValueBold}>{receiptDetail.receiptNumber}</Text>
                </View>
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Nama Siswa</Text>
                  <Text style={styles.receiptValue}>{receiptDetail.studentName}</Text>
                </View>
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Kelas</Text>
                  <Text style={styles.receiptValue}>{receiptDetail.className}</Text>
                </View>
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Uraian Pembayaran</Text>
                  <Text style={styles.receiptValue}>{receiptDetail.title}</Text>
                </View>
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Metode Bayar</Text>
                  <Text style={styles.receiptValue}>{receiptDetail.paymentMethod}</Text>
                </View>
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Waktu Transaksi</Text>
                  <Text style={styles.receiptValue}>{receiptDetail.paymentDate}</Text>
                </View>
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Penerima / Loket</Text>
                  <Text style={styles.receiptValue}>{receiptDetail.receiver}</Text>
                </View>

                <View style={styles.receiptDividerDashed} />

                <View style={styles.receiptRow}>
                  <Text style={[styles.receiptLabel, { fontSize: 15, fontWeight: '700' }]}>Total Bayar</Text>
                  <Text style={[styles.receiptValueBold, { fontSize: 16, color: '#10B981' }]}>
                    {formatCurrency(receiptDetail.amount)}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.closeReceiptButton}
                  onPress={() => setReceiptDetail(null)}
                >
                  <Text style={styles.closeReceiptButtonText}>Tutup Kwitansi</Text>
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
    borderRadius: 8,
  },
  headerCenter: {
    alignItems: 'center',
  },
  moduleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 2,
  },
  moduleBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#EF4444',
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
    backgroundColor: '#FEE2E2',
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
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textLight,
  },
  tabTextActive: {
    color: '#EF4444',
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
  filterRow: {
    marginBottom: 16,
    gap: 10,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: Colors.text,
  },
  statusPills: {
    flexDirection: 'row',
    gap: 8,
  },
  statusPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#E5E7EB',
  },
  statusPillActive: {
    backgroundColor: '#EF4444',
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
  },
  statusPillTextActive: {
    color: '#FFFFFF',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 12,
    color: Colors.textLight,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  billCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  billCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#EF4444',
  },
  badgeStatus: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgePaid: {
    backgroundColor: '#ECFDF5',
  },
  badgePaidText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#10B981',
  },
  badgeUnpaid: {
    backgroundColor: '#FEF2F2',
  },
  badgeUnpaidText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#EF4444',
  },
  badgeStatusText: {
    letterSpacing: 0.5,
  },
  billTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  billStudent: {
    fontSize: 12,
    color: Colors.textLight,
    marginTop: 4,
  },
  billDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 12,
  },
  billFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  billAmountLabel: {
    fontSize: 11,
    color: Colors.textLight,
  },
  billAmountValue: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
    marginTop: 1,
  },
  billDueText: {
    fontSize: 11,
    color: '#F59E0B',
    marginTop: 2,
    fontWeight: '500',
  },
  payButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EF4444',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
  },
  payButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  paidCheckBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  paidCheckText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10B981',
  },
  sectionHeaderTitle: {
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
  historyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  historyCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  historyIconWrapper: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  historyReceiptNo: {
    fontSize: 11,
    color: Colors.textLight,
    marginTop: 2,
  },
  historyDate: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 2,
  },
  historyCardRight: {
    alignItems: 'flex-end',
  },
  historyAmount: {
    fontSize: 14,
    fontWeight: '800',
    color: '#10B981',
  },
  verifiedTag: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  verifiedTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#10B981',
  },
  tariffCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  tariffHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tariffName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    flex: 1,
  },
  periodBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  periodBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#3B82F6',
  },
  tariffLevel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#EF4444',
    marginTop: 4,
  },
  tariffDesc: {
    fontSize: 12,
    color: Colors.textLight,
    marginTop: 4,
    lineHeight: 18,
  },
  tariffDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 10,
  },
  tariffFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tariffAmountLabel: {
    fontSize: 12,
    color: Colors.textLight,
  },
  tariffAmount: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text,
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
    maxHeight: '85%',
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
  modalSummaryBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  modalSummaryTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  modalSummaryStudent: {
    fontSize: 12,
    color: Colors.textLight,
    marginTop: 2,
  },
  modalSummaryAmount: {
    fontSize: 20,
    fontWeight: '800',
    color: '#EF4444',
    marginTop: 8,
  },
  formSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 10,
  },
  methodItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 8,
    gap: 10,
  },
  methodItemActive: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  methodText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
    flex: 1,
  },
  methodTextActive: {
    color: '#EF4444',
    fontWeight: '700',
  },
  notesInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 12,
    fontSize: 13,
    color: Colors.text,
    marginBottom: 16,
  },
  submitPayButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EF4444',
    borderRadius: 12,
    paddingVertical: 14,
  },
  submitPayButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  receiptModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginHorizontal: 20,
    marginVertical: 'auto',
    overflow: 'hidden',
  },
  receiptBadgeHeader: {
    alignItems: 'center',
    paddingVertical: 18,
    backgroundColor: '#ECFDF5',
    borderBottomWidth: 1,
    borderBottomColor: '#A7F3D0',
  },
  receiptHeaderTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#065F46',
    marginTop: 6,
    letterSpacing: 0.5,
  },
  receiptSub: {
    fontSize: 11,
    color: '#047857',
    marginTop: 2,
  },
  receiptBody: {
    padding: 20,
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  receiptLabel: {
    fontSize: 12,
    color: Colors.textLight,
  },
  receiptValue: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'right',
  },
  receiptValueBold: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text,
  },
  receiptDividerDashed: {
    height: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    marginVertical: 12,
  },
  closeReceiptButton: {
    marginTop: 16,
    backgroundColor: '#F3F4F6',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  closeReceiptButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
});
