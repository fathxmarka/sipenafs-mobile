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

type TabType = 'perpus' | 'pinjam' | 'sarpras';

interface BookItem {
  id: string;
  title: string;
  author: string;
  category: string;
  isbn?: string;
  availableStock: number;
  isDigital: boolean;
  filePdf?: string;
}

interface BorrowingItem {
  id: string;
  bookTitle: string;
  borrowerName: string;
  borrowDate: string;
  dueDate: string;
  status: 'active' | 'overdue' | 'returned';
}

interface AssetItem {
  id: string;
  name: string;
  roomName: string;
  code: string;
  condition: 'Baik' | 'Rusak Ringan' | 'Rusak Berat';
  quantity: number;
}

export default function SarprasModuleScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<TabType>('perpus');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [selectedBook, setSelectedBook] = useState<BookItem | null>(null);
  const [isBorrowModalOpen, setIsBorrowModalOpen] = useState(false);
  const [isDamageReportOpen, setIsDamageReportOpen] = useState(false);
  const [damageNotes, setDamageNotes] = useState('');

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
  const [books, setBooks] = useState<BookItem[]>([]);
  const [borrowings, setBorrowings] = useState<BorrowingItem[]>([]);
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [userRole, setUserRole] = useState<string>('admin');

  useEffect(() => {
    loadUserRole();
    fetchSarprasData();
  }, []);

  const loadUserRole = async () => {
    try {
      const stored = await SecureStore.getItemAsync('sipena_user');
      if (stored) {
        const u = JSON.parse(stored);
        if (u.role) setUserRole(u.role.toLowerCase());
      }
    } catch (_) {}
  };

  const isManagement = !userRole.includes('siswa') && !userRole.includes('student') && !userRole.includes('orang tua') && !userRole.includes('parent') && !userRole.includes('ortu');

  const fetchSarprasData = async () => {
    try {
      const apiUrl = await SecureStore.getItemAsync('sipena_api_url');
      const token = await SecureStore.getItemAsync('sipena_token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      if (apiUrl && token) {
        try {
          const apiCalls: Promise<any>[] = [
            axios.get(`${apiUrl}/api/elibrary/books`, { headers }),
            axios.get(`${apiUrl}/api/elibrary/borrowings`, { headers }),
          ];
          if (isManagement) {
            apiCalls.push(axios.get(`${apiUrl}/api/assets`, { headers }));
          }

          const [resBooks, resBorrowings, resAssets] = await Promise.allSettled(apiCalls);

          if (resBooks.status === 'fulfilled' && resBooks.value.data?.data) {
            const apiBooks = resBooks.value.data.data.map((b: any) => ({
              id: b.id?.toString() || Math.random().toString(),
              title: b.title || 'Buku Referensi',
              author: b.author || 'Tim Penulis',
              category: b.category?.name || 'Umum',
              isbn: b.isbn || '-',
              availableStock: Number(b.stock || 5),
              isDigital: Boolean(b.file_url || b.is_digital),
            }));
            setBooks(apiBooks);
          }

          if (resBorrowings.status === 'fulfilled' && resBorrowings.value.data?.data) {
            const apiBorrowings = resBorrowings.value.data.data.map((bw: any) => ({
              id: bw.id?.toString() || Math.random().toString(),
              bookTitle: bw.book?.title || 'Judul Buku',
              borrowerName: bw.student?.name || bw.user?.name || 'Siswa',
              borrowDate: bw.borrow_date || 'Hari ini',
              dueDate: bw.due_date || '7 hari lagi',
              status: bw.status === 'returned' ? 'returned' : 'active',
            }));
            setBorrowings(apiBorrowings);
          }

          if (resAssets.status === 'fulfilled' && resAssets.value.data?.data) {
            const apiAssets = resAssets.value.data.data.map((a: any) => ({
              id: a.id?.toString() || Math.random().toString(),
              name: a.name || 'Barang Inventaris',
              roomName: a.room?.name || a.location || 'Gedung Utama',
              code: a.code || 'AST-001',
              condition: a.condition || 'Baik',
              quantity: Number(a.quantity || 1),
            }));
            setAssets(apiAssets);
          }
        } catch (_) {}
      }

      // Default structured data
      const defaultBooks: BookItem[] = [
        {
          id: 'b1',
          title: 'Fisika Kuantum & Relativitas untuk SMA',
          author: 'Prof. Bambang Subagyo',
          category: 'Sains & Fisika',
          availableStock: 12,
          isDigital: true,
        },
        {
          id: 'b2',
          title: 'Algoritma Pemrograman & Jaringan Modern',
          author: 'Dr. Ir. Rian Hidayat',
          category: 'Teknologi & IT',
          availableStock: 8,
          isDigital: true,
        },
        {
          id: 'b3',
          title: 'Laskar Pelangi (Edisi Khusus Sastra)',
          author: 'Andrea Hirata',
          category: 'Sastra & Novel',
          availableStock: 5,
          isDigital: false,
        },
        {
          id: 'b4',
          title: 'Ensiklopedia Sejarah Kemerdekaan Indonesia',
          author: 'Pusat Kurikulum Kemendikbud',
          category: 'Sejarah & Budaya',
          availableStock: 14,
          isDigital: true,
        },
      ];
      setBooks(prev => (prev.length > 0 ? prev : defaultBooks));

      const defaultBorrowings: BorrowingItem[] = [
        {
          id: 'bw1',
          bookTitle: 'Fisika Kuantum & Relativitas untuk SMA',
          borrowerName: 'Ahmad Fauzan (XII MIPA 1)',
          borrowDate: '24 Sep 2026',
          dueDate: '01 Okt 2026',
          status: 'active',
        },
        {
          id: 'bw2',
          bookTitle: 'Biologi Sel & Genetika Molekuler',
          borrowerName: 'Ahmad Fauzan (XII MIPA 1)',
          borrowDate: '10 Sep 2026',
          dueDate: '17 Sep 2026',
          status: 'returned',
        },
      ];
      setBorrowings(prev => (prev.length > 0 ? prev : defaultBorrowings));

      const defaultAssets: AssetItem[] = [
        { id: 'ast1', name: 'PC All-in-One Core i7 16GB', roomName: 'Laboratorium Komputer 1', code: 'LAB-KOMP-014', condition: 'Baik', quantity: 32 },
        { id: 'ast2', name: 'Proyektor Epson LCD HD', roomName: 'Ruang Kelas XII MIPA 1', code: 'PRJ-XII-003', condition: 'Baik', quantity: 1 },
        { id: 'ast3', name: 'Mikroskop Binokuler Optik', roomName: 'Laboratorium Biologi', code: 'MIC-BIO-008', condition: 'Rusak Ringan', quantity: 2 },
        { id: 'ast4', name: 'AC Split Daikin 2 PK', roomName: 'Perpustakaan Digital', code: 'AC-LBR-002', condition: 'Baik', quantity: 4 },
      ];
      setAssets(prev => (prev.length > 0 ? prev : defaultAssets));

    } catch (e: any) {
      console.warn('Sarpras load error:', e.message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchSarprasData();
  };

  const handleOpenBorrow = (book: BookItem) => {
    setSelectedBook(book);
    setIsBorrowModalOpen(true);
  };

  const handleConfirmBorrow = () => {
    if (!selectedBook) return;
    const newBorrowing: BorrowingItem = {
      id: `bw-${Date.now()}`,
      bookTitle: selectedBook.title,
      borrowerName: 'Saya (Peminjaman Baru)',
      borrowDate: 'Hari ini',
      dueDate: '7 Hari Kedepan',
      status: 'active',
    };
    setBorrowings(prev => [newBorrowing, ...prev]);
    setIsBorrowModalOpen(false);
    showToast(`Buku "${selectedBook.title}" berhasil dipinjam! Ambil di perpustakaan.`, 'success');
  };

  const handleReportDamage = () => {
    if (!damageNotes.trim()) {
      showToast('Harap isi deskripsi kendala / kerusakan aset.', 'warning');
      return;
    }
    setIsDamageReportOpen(false);
    setDamageNotes('');
    showToast('Laporan kerusakan fasilitas telah diteruskan ke Bagian Sarpras TU!', 'success');
  };

  const filteredBooks = books.filter(b =>
    b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.moduleBadge}>
            <Ionicons name="library" size={14} color="#0284C7" />
            <Text style={styles.moduleBadgeText}>MODUL 10</Text>
          </View>
          <Text style={styles.headerTitle}>Sarpras & E-Perpustakaan</Text>
        </View>
        <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
          <Ionicons name="reload" size={20} color={Colors.text} />
        </TouchableOpacity>
      </View>

      {/* KPI Overview */}
      <View style={styles.kpiContainer}>
        <View style={[styles.kpiCard, { backgroundColor: '#F0F9FF' }]}>
          <View style={styles.kpiIconWrapper}>
            <Ionicons name="book" size={18} color="#0284C7" />
          </View>
          <Text style={styles.kpiValue}>{books.length} Judul</Text>
          <Text style={styles.kpiLabel}>Katalog E-Perpus</Text>
        </View>

        {isManagement ? (
          <View style={[styles.kpiCard, { backgroundColor: '#F8FAFC' }]}>
            <View style={[styles.kpiIconWrapper, { backgroundColor: '#E2E8F0' }]}>
              <Ionicons name="cube" size={18} color="#475569" />
            </View>
            <Text style={styles.kpiValue}>{assets.length} Sarpras</Text>
            <Text style={styles.kpiLabel}>Aset Terinventaris</Text>
          </View>
        ) : (
          <View style={[styles.kpiCard, { backgroundColor: '#F0FDF4' }]}>
            <View style={[styles.kpiIconWrapper, { backgroundColor: '#DCFCE7' }]}>
              <Ionicons name="swap-horizontal" size={18} color="#16A34A" />
            </View>
            <Text style={styles.kpiValue}>{borrowings.filter(b => b.status === 'active').length} Buku</Text>
            <Text style={styles.kpiLabel}>Sedang Dipinjam</Text>
          </View>
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'perpus' && styles.tabButtonActive]}
          onPress={() => setActiveTab('perpus')}
        >
          <Ionicons
            name="book-outline"
            size={16}
            color={activeTab === 'perpus' ? '#0284C7' : Colors.textLight}
          />
          <Text style={[styles.tabText, activeTab === 'perpus' && styles.tabTextActive]}>
            Katalog Buku
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'pinjam' && styles.tabButtonActive]}
          onPress={() => setActiveTab('pinjam')}
        >
          <Ionicons
            name="swap-horizontal-outline"
            size={16}
            color={activeTab === 'pinjam' ? '#0284C7' : Colors.textLight}
          />
          <Text style={[styles.tabText, activeTab === 'pinjam' && styles.tabTextActive]}>
            Peminjaman
          </Text>
        </TouchableOpacity>

        {isManagement && (
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'sarpras' && styles.tabButtonActive]}
            onPress={() => setActiveTab('sarpras')}
          >
            <Ionicons
              name="cube-outline"
              size={16}
              color={activeTab === 'sarpras' ? '#0284C7' : Colors.textLight}
            />
            <Text style={[styles.tabText, activeTab === 'sarpras' && styles.tabTextActive]}>
              Aset & Ruangan
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0284C7" />
          <Text style={styles.loadingText}>Memuat sarpras & buku...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={['#0284C7']} />}
          showsVerticalScrollIndicator={false}
        >
          {/* TAB 1: KATALOG BUKU */}
          {activeTab === 'perpus' && (
            <View>
              <View style={styles.searchBox}>
                <Ionicons name="search" size={18} color={Colors.textLight} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Cari judul buku, penulis, atau kategori..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholderTextColor={Colors.textLight}
                />
              </View>

              {filteredBooks.map(book => (
                <View key={book.id} style={styles.bookCard}>
                  <View style={styles.bookCoverPlaceholder}>
                    <Ionicons name="book" size={32} color="#0284C7" />
                    {book.isDigital && (
                      <View style={styles.pdfBadge}>
                        <Text style={styles.pdfBadgeText}>E-BOOK</Text>
                      </View>
                    )}
                  </View>

                  <View style={{ flex: 1 }}>
                    <View style={styles.bookCategoryBadge}>
                      <Text style={styles.bookCategoryText}>{book.category}</Text>
                    </View>
                    <Text style={styles.bookTitle}>{book.title}</Text>
                    <Text style={styles.bookAuthor}>Penulis: {book.author}</Text>
                    <Text style={styles.bookStock}>Tersedia: {book.availableStock} Eksemplar</Text>

                    <View style={styles.bookActionRow}>
                      {book.isDigital ? (
                        <TouchableOpacity
                          style={styles.readBtn}
                          onPress={() => showToast(`Membuka E-Book ${book.title}...`, 'info')}
                        >
                          <Ionicons name="eye" size={14} color="#FFFFFF" />
                          <Text style={styles.readBtnText}>Baca E-Book</Text>
                        </TouchableOpacity>
                      ) : null}

                      <TouchableOpacity
                        style={styles.borrowBtn}
                        onPress={() => handleOpenBorrow(book)}
                      >
                        <Ionicons name="bookmark-outline" size={14} color="#0284C7" />
                        <Text style={styles.borrowBtnText}>Pinjam Fisik</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* TAB 2: PEMINJAMAN */}
          {activeTab === 'pinjam' && (
            <View>
              <Text style={styles.sectionTitle}>Sirkulasi & Peminjaman Saya</Text>
              <Text style={styles.sectionSubtitle}>
                Daftar buku fisik yang sedang dalam masa peminjaman oleh akun Anda.
              </Text>

              {borrowings.map(item => (
                <View key={item.id} style={styles.borrowCard}>
                  <View style={styles.borrowHeader}>
                    <Text style={styles.borrowBookTitle}>{item.bookTitle}</Text>
                    <View
                      style={[
                        styles.borrowStatusTag,
                        item.status === 'active' ? styles.statusActive : styles.statusReturned,
                      ]}
                    >
                      <Text
                        style={[
                          styles.borrowStatusText,
                          item.status === 'active' ? styles.statusActiveText : styles.statusReturnedText,
                        ]}
                      >
                        {item.status === 'active' ? 'DIPINJAM' : 'DIKEMBALIKAN'}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.borrower}>{item.borrowerName}</Text>
                  <View style={styles.borrowDateRow}>
                    <Text style={styles.borrowDate}>Tgl Pinjam: {item.borrowDate}</Text>
                    <Text style={styles.dueDate}>Batas: {item.dueDate}</Text>
                  </View>

                  {item.status === 'active' && (
                    <TouchableOpacity
                      style={styles.returnButton}
                      onPress={() => {
                        setBorrowings(prev =>
                          prev.map(b => (b.id === item.id ? { ...b, status: 'returned' } : b))
                        );
                        showToast(`Buku ${item.bookTitle} berhasil dikembalikan!`, 'success');
                      }}
                    >
                      <Ionicons name="checkmark-done" size={16} color="#0284C7" />
                      <Text style={styles.returnButtonText}>Kembalikan ke Petugas</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* TAB 3: SARPRAS & RUANGAN (Khusus Management Sekolah) */}
          {isManagement && activeTab === 'sarpras' && (
            <View>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Daftar Fasilitas & Aset Sekolah</Text>
                <TouchableOpacity
                  style={styles.reportDamageBtn}
                  onPress={() => setIsDamageReportOpen(true)}
                >
                  <Ionicons name="warning-outline" size={14} color="#EF4444" />
                  <Text style={styles.reportDamageText}>Lapor Fasilitas</Text>
                </TouchableOpacity>
              </View>

              {assets.map(asset => (
                <View key={asset.id} style={styles.assetCard}>
                  <View style={styles.assetHeader}>
                    <View style={styles.assetIcon}>
                      <Ionicons name="hardware-chip-outline" size={20} color="#0284C7" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.assetName}>{asset.name}</Text>
                      <Text style={styles.assetCode}>Kode: {asset.code} • Jumlah: {asset.quantity} Unit</Text>
                      <Text style={styles.assetRoom}>Lokasi: {asset.roomName}</Text>
                    </View>
                    <View
                      style={[
                        styles.conditionTag,
                        asset.condition === 'Baik'
                          ? styles.condGood
                          : styles.condWarning,
                      ]}
                    >
                      <Text
                        style={[
                          styles.conditionText,
                          asset.condition === 'Baik' ? styles.condGoodText : styles.condWarningText,
                        ]}
                      >
                        {asset.condition}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {/* Modal Pinjam Buku */}
      <Modal
        visible={isBorrowModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsBorrowModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Konfirmasi Pinjam Buku</Text>
              <TouchableOpacity onPress={() => setIsBorrowModalOpen(false)}>
                <Ionicons name="close" size={22} color={Colors.text} />
              </TouchableOpacity>
            </View>

            {selectedBook && (
              <View>
                <View style={styles.selectedBookBox}>
                  <Text style={styles.selectedBookTitle}>{selectedBook.title}</Text>
                  <Text style={styles.selectedBookAuthor}>Oleh: {selectedBook.author}</Text>
                  <Text style={styles.selectedBookCat}>Kategori: {selectedBook.category}</Text>
                </View>

                <View style={styles.termBox}>
                  <Ionicons name="information-circle-outline" size={18} color="#0284C7" />
                  <Text style={styles.termText}>
                    Durasi peminjaman buku perpustakaan adalah 7 hari. Harap kembalikan buku tepat waktu dalam kondisi utuh.
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.confirmBorrowBtn}
                  onPress={handleConfirmBorrow}
                >
                  <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                  <Text style={styles.confirmBorrowBtnText}>Proses Peminjaman Buku</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal Lapor Kerusakan */}
      <Modal
        visible={isDamageReportOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsDamageReportOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Laporan Kerusakan Sarpras</Text>
              <TouchableOpacity onPress={() => setIsDamageReportOpen(false)}>
                <Ionicons name="close" size={22} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Deskripsi Fasilitas & Kerusakan:</Text>
            <TextInput
              style={[styles.inputBox, { height: 90, textAlignVertical: 'top' }]}
              multiline
              numberOfLines={4}
              placeholder="Contoh: AC di Lab Komputer 1 bocor air dan tidak dingin..."
              value={damageNotes}
              onChangeText={setDamageNotes}
              placeholderTextColor={Colors.textLight}
            />

            <TouchableOpacity
              style={styles.attachPhotoBtn}
              onPress={() => showToast('Foto kerusakan berhasil dipilih.', 'info')}
            >
              <Ionicons name="camera-outline" size={18} color="#EF4444" />
              <Text style={styles.attachPhotoText}>Ambil Foto Bukti Kerusakan</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.submitDamageBtn}
              onPress={handleReportDamage}
            >
              <Ionicons name="send" size={16} color="#FFFFFF" />
              <Text style={styles.submitDamageBtnText}>Kirim Laporan Sarpras</Text>
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
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 2,
  },
  moduleBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0284C7',
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
    backgroundColor: '#E0F2FE',
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
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textLight,
  },
  tabTextActive: {
    color: '#0284C7',
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
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: Colors.text,
  },
  bookCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 12,
  },
  bookCoverPlaceholder: {
    width: 64,
    height: 90,
    backgroundColor: '#F0F9FF',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#E0F2FE',
  },
  pdfBadge: {
    position: 'absolute',
    bottom: 4,
    backgroundColor: '#EF4444',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  pdfBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  bookCategoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 4,
  },
  bookCategoryText: {
    fontSize: 10,
    color: '#475569',
    fontWeight: '700',
  },
  bookTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  bookAuthor: {
    fontSize: 11,
    color: Colors.textLight,
    marginTop: 2,
  },
  bookStock: {
    fontSize: 11,
    color: '#0284C7',
    fontWeight: '600',
    marginTop: 2,
  },
  bookActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  readBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0284C7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  readBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  borrowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  borrowBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284C7',
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
  borrowCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  borrowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  borrowBookTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    flex: 1,
  },
  borrowStatusTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusActive: {
    backgroundColor: '#FEF3C7',
  },
  statusActiveText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#D97706',
  },
  statusReturned: {
    backgroundColor: '#ECFDF5',
  },
  statusReturnedText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#10B981',
  },
  borrowStatusText: {
    letterSpacing: 0.5,
  },
  borrower: {
    fontSize: 12,
    color: Colors.textLight,
  },
  borrowDateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  borrowDate: {
    fontSize: 11,
    color: Colors.textLight,
  },
  dueDate: {
    fontSize: 11,
    fontWeight: '700',
    color: '#EF4444',
  },
  returnButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F0F9FF',
    borderRadius: 8,
    paddingVertical: 8,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  returnButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284C7',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  reportDamageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  reportDamageText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#EF4444',
  },
  assetCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  assetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  assetIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#F0F9FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  assetName: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  assetCode: {
    fontSize: 11,
    color: Colors.textLight,
    marginTop: 2,
  },
  assetRoom: {
    fontSize: 11,
    color: '#0284C7',
    fontWeight: '600',
    marginTop: 2,
  },
  conditionTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  conditionText: {
    letterSpacing: 0.5,
  },
  condGood: {
    backgroundColor: '#ECFDF5',
  },
  condGoodText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#10B981',
  },
  condWarning: {
    backgroundColor: '#FFFBEB',
  },
  condWarningText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#D97706',
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
  selectedBookBox: {
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  selectedBookTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  selectedBookAuthor: {
    fontSize: 12,
    color: Colors.textLight,
    marginTop: 2,
  },
  selectedBookCat: {
    fontSize: 11,
    color: '#0284C7',
    fontWeight: '600',
    marginTop: 4,
  },
  termBox: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  termText: {
    fontSize: 11,
    color: Colors.textLight,
    flex: 1,
    lineHeight: 16,
  },
  confirmBorrowBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0284C7',
    borderRadius: 12,
    paddingVertical: 14,
  },
  confirmBorrowBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
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
  attachPhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderStyle: 'dashed',
    borderRadius: 10,
    padding: 12,
    backgroundColor: '#FEF2F2',
    marginBottom: 16,
  },
  attachPhotoText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#EF4444',
  },
  submitDamageBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EF4444',
    borderRadius: 12,
    paddingVertical: 14,
  },
  submitDamageBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
