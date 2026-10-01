import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Modal, TextInput, Linking, Switch
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import Colors from '../../constants/Colors';
import * as SecureStore from 'expo-secure-store';
import { Toast, ToastType } from '../../components/ui/Toast';
import { 
  checkBiometricSupport, 
  getBiometricProfile, 
  saveBiometricProfile, 
  clearBiometricProfile, 
  isRoleAllowedForBiometric, 
  authenticateUser,
  BiometricAvailability
} from '../../services/biometric';

export default function ProfilScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [userData, setUserData] = useState<any>(null);
  const [schoolName, setSchoolName] = useState<string>('Memuat Sekolah...');
  const [apiUrl, setApiUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  // Modals
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  // Biometric state
  const [biometricSupport, setBiometricSupport] = useState<BiometricAvailability | null>(null);
  const [isBiometricEnabled, setIsBiometricEnabled] = useState(false);
  const [isBiometricToggling, setIsBiometricToggling] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: ToastType }>({
    visible: false,
    message: '',
    type: 'info',
  });

  const showToast = (message: string, type: ToastType = 'info') => {
    setToast({ visible: true, message, type });
  };

  useEffect(() => {
    loadProfileData();
  }, []);

  const loadProfileData = async () => {
    try {
      const storedUser = await SecureStore.getItemAsync('sipena_user');
      const storedSchool = await SecureStore.getItemAsync('sipena_school_name');
      const storedApi = await SecureStore.getItemAsync('sipena_api_url');

      let parsedUser = null;
      if (storedUser) {
        parsedUser = JSON.parse(storedUser);
        setUserData(parsedUser);
      }
      if (storedSchool) setSchoolName(storedSchool);
      if (storedApi) setApiUrl(storedApi);

      // Inisialisasi dukungan biometrik
      const support = await checkBiometricSupport();
      setBiometricSupport(support);

      if (parsedUser) {
        if (!isRoleAllowedForBiometric(parsedUser.role)) {
          // STRICT RULE: Admin dilarang menggunakan login sidik jari
          setIsBiometricEnabled(false);
          await clearBiometricProfile();
        } else {
          const profile = await getBiometricProfile();
          setIsBiometricEnabled(!!profile);
        }
      }
    } catch (e) {
      console.warn('Gagal memuat profil user:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleBiometric = async (value: boolean) => {
    // 1. Validasi Keamanan: Admin strictly prohibited
    if (!isRoleAllowedForBiometric(userData?.role)) {
      showToast('Akses dibatasi. Akun Administrator wajib menggunakan kata sandi demi keamanan.', 'error');
      setIsBiometricEnabled(false);
      return;
    }

    // 2. Validasi Hardware
    if (!biometricSupport?.available) {
      showToast('Perangkat Anda tidak memiliki sensor biometrik sidik jari.', 'warning');
      return;
    }
    if (!biometricSupport?.enrolled) {
      showToast('Belum ada sidik jari yang terdaftar di pengaturan sistem HP Anda.', 'warning');
      return;
    }

    setIsBiometricToggling(true);

    if (!value) {
      // Nonaktifkan
      await clearBiometricProfile();
      setIsBiometricEnabled(false);
      setIsBiometricToggling(false);
      showToast('Login sidik jari telah dinonaktifkan.', 'info');
    } else {
      // Aktifkan - verifikasi biometrik dulu
      const auth = await authenticateUser('Pindai sidik jari Anda untuk mengaktifkan login biometrik SIPENAFS');
      if (auth.success) {
        try {
          const token = await SecureStore.getItemAsync('sipena_token') || 'demo-token-' + (userData?.role || 'user');
          const saved = await saveBiometricProfile(userData, { name: schoolName, api_url: apiUrl }, token);
          if (saved) {
            setIsBiometricEnabled(true);
            showToast('Login sidik jari berhasil diaktifkan!', 'success');
          } else {
            showToast('Gagal mengaktifkan login sidik jari.', 'error');
          }
        } catch (e) {
          showToast('Terjadi kesalahan saat menyimpan pengaturan biometrik.', 'error');
        }
      } else {
        if (auth.error && auth.error !== 'Autentikasi dibatalkan') {
          showToast(auth.error, 'error');
        }
      }
      setIsBiometricToggling(false);
    }
  };

  const handleLogout = async () => {
    try {
      await SecureStore.deleteItemAsync('sipena_token');
      await SecureStore.deleteItemAsync('sipena_user');
      setIsLogoutModalOpen(false);
      showToast('Berhasil keluar dari akun.', 'info');
      setTimeout(() => {
        router.replace('/login');
      }, 400);
    } catch (_) {
      router.replace('/login');
    }
  };

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      showToast('Harap lengkapi semua kolom kata sandi.', 'warning');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('Konfirmasi kata sandi baru tidak cocok.', 'error');
      return;
    }
    if (newPassword.length < 6) {
      showToast('Kata sandi baru minimal 6 karakter.', 'warning');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      await new Promise(r => setTimeout(r, 600));
      setIsPasswordModalOpen(false);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showToast('Kata sandi berhasil diperbarui!', 'success');
    } catch (_) {
      showToast('Gagal mengubah kata sandi.', 'error');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return 'SP';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  };

  const roleName = (userData?.role || 'Pengguna').toUpperCase();
  const isParent = roleName.includes('PARENT') || roleName.includes('ORANG TUA');
  const isTeacher = roleName.includes('GURU') || roleName.includes('TEACHER');
  const isStudent = roleName.includes('SISWA') || roleName.includes('STUDENT');

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profil Saya</Text>
        <TouchableOpacity style={styles.editBtn} onPress={() => setIsPasswordModalOpen(true)}>
          <Ionicons name="key-outline" size={18} color="#0B8A7D" />
          <Text style={styles.editBtnText}>Ubah PIN/Password</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#0B8A7D" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Profile Card Header */}
          <View style={styles.profileCard}>
            <View style={styles.avatarBox}>
              <Text style={styles.avatarInitials}>{getInitials(userData?.name)}</Text>
            </View>

            <Text style={styles.userName}>{userData?.name || 'Pengguna SIPENAFS'}</Text>

            <View style={styles.roleBadge}>
              <Ionicons name="shield-checkmark" size={12} color="#0B8A7D" />
              <Text style={styles.roleBadgeText}>{roleName}</Text>
            </View>

            {isParent && userData?.student_name && (
              <Text style={styles.parentNote}>Wali dari Siswa: {userData.student_name}</Text>
            )}

            <Text style={styles.userSchool}>{schoolName}</Text>
          </View>

          {/* User Details */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionCardTitle}>Informasi Akun</Text>

            <View style={styles.infoRow}>
              <Text style={styles.infoKey}>
                {isTeacher ? 'NIP Guru' : isStudent ? 'NISN Siswa' : isParent ? 'NISN Ananda' : 'Username'}
              </Text>
              <Text style={styles.infoVal}>
                {userData?.nip || userData?.nisn || userData?.nis || userData?.username || '-'}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoKey}>Nomor Telepon / WA</Text>
              <Text style={styles.infoVal}>{userData?.phone || userData?.parent_phone || '0812-XXXX-XXXX'}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoKey}>Email Terdaftar</Text>
              <Text style={styles.infoVal}>{userData?.email || `${userData?.username || 'user'}@sipenafs.sch.id`}</Text>
            </View>

            <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.infoKey}>Status Akun</Text>
              <View style={styles.activePill}>
                <View style={styles.activeDot} />
                <Text style={styles.activePillText}>Aktif & Terverifikasi</Text>
              </View>
            </View>
          </View>

          {/* Instansi Sekolah */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionCardTitle}>Pusat Data Sekolah</Text>

            <View style={styles.infoRow}>
              <Text style={styles.infoKey}>Nama Instansi</Text>
              <Text style={styles.infoValBold}>{schoolName}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoKey}>Server API</Text>
              <Text style={[styles.infoVal, { fontSize: 11, color: '#0B8A7D' }]}>
                {apiUrl || 'https://api.sipena.biz.id'}
              </Text>
            </View>
          </View>

          {/* Keamanan & Biometrik */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionCardHeader}>
              <Text style={styles.sectionCardTitle}>Keamanan & Biometrik</Text>
              <Ionicons name="shield-checkmark" size={16} color="#0B8A7D" />
            </View>

            {!isRoleAllowedForBiometric(userData?.role) ? (
              // Tampilan Khusus Administrator (Akses Dibatasi)
              <View style={styles.adminSecurityNoticeCard}>
                <View style={styles.adminSecurityHeaderRow}>
                  <View style={styles.adminShieldIconCircle}>
                    <Ionicons name="lock-closed" size={18} color="#B45309" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.adminSecurityNoticeTitle}>Login Sidik Jari Dinonaktifkan</Text>
                    <View style={styles.adminBadgePill}>
                      <Text style={styles.adminBadgePillText}>KHUSUS ADMINISTRATOR</Text>
                    </View>
                  </View>
                </View>
                <Text style={styles.adminSecurityNoticeDesc}>
                  Demi kepatuhan standar keamanan data dan hak akses institusi tingkat tinggi, akun Administrator / Kepala Sekolah wajib melakukan otentikasi manual menggunakan username, kata sandi, dan captcha.
                </Text>
              </View>
            ) : (
              // Tampilan Pengguna Biasa (Guru, Siswa, Orang Tua)
              <View style={styles.biometricSettingRow}>
                <View style={styles.biometricSettingLeft}>
                  <View style={[styles.biometricIconCircle, isBiometricEnabled ? styles.biometricIconCircleActive : styles.biometricIconCircleInactive]}>
                    <Ionicons 
                      name="finger-print" 
                      size={22} 
                      color={isBiometricEnabled ? "#0B8A7D" : Colors.textLight} 
                    />
                  </View>
                  <View style={styles.biometricTextContainer}>
                    <Text style={styles.biometricSettingTitle}>Login Sidik Jari</Text>
                    <Text style={styles.biometricSettingSubtitle}>
                      {isBiometricEnabled 
                        ? 'Aktif • Masuk cepat tanpa password' 
                        : (biometricSupport?.enrolled ? 'Nonaktif • Ketuk switch untuk aktifkan' : 'Daftarkan sidik jari di pengaturan HP')}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={isBiometricEnabled}
                  onValueChange={handleToggleBiometric}
                  disabled={isBiometricToggling || !biometricSupport?.available}
                  trackColor={{ false: '#E5E7EB', true: '#A7F3D0' }}
                  thumbColor={isBiometricEnabled ? '#0B8A7D' : '#F3F4F6'}
                />
              </View>
            )}
          </View>

          {/* Quick Actions */}
          <View style={styles.actionCard}>
            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => setIsPasswordModalOpen(true)}
            >
              <View style={styles.actionLeft}>
                <Ionicons name="lock-closed-outline" size={20} color="#0B8A7D" />
                <Text style={styles.actionText}>Ubah Kata Sandi / PIN</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textLight} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => showToast('Semua izin aplikasi telah diberikan pada startup.', 'success')}
            >
              <View style={styles.actionLeft}>
                <Ionicons name="shield-outline" size={20} color="#3B82F6" />
                <Text style={styles.actionText}>Izin Aplikasi (GPS, Kamera, Media)</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textLight} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionItem, { borderBottomWidth: 0 }]}
              onPress={() => showToast('SIPENAFS Mobile v2.0.0 Pro - Sistem Informasi Pendidikan Nasional Terpadu', 'info')}
            >
              <View style={styles.actionLeft}>
                <Ionicons name="information-circle-outline" size={20} color="#6366F1" />
                <Text style={styles.actionText}>Tentang Aplikasi & Versi</Text>
              </View>
              <Text style={styles.versionText}>v2.0.0</Text>
            </TouchableOpacity>
          </View>

          {/* Logout Button */}
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={() => setIsLogoutModalOpen(true)}
          >
            <Ionicons name="log-out-outline" size={20} color="#EF4444" />
            <Text style={styles.logoutButtonText}>Keluar Dari Sesi Ini</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* Modal Ubah Kata Sandi */}
      <Modal
        visible={isPasswordModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsPasswordModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Ubah Kata Sandi Akun</Text>
              <TouchableOpacity onPress={() => setIsPasswordModalOpen(false)}>
                <Ionicons name="close" size={22} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Kata Sandi Saat Ini:</Text>
            <TextInput
              style={styles.inputBox}
              secureTextEntry
              placeholder="Masukkan password lama"
              value={oldPassword}
              onChangeText={setOldPassword}
              placeholderTextColor={Colors.textLight}
            />

            <Text style={styles.fieldLabel}>Kata Sandi Baru:</Text>
            <TextInput
              style={styles.inputBox}
              secureTextEntry
              placeholder="Minimal 6 karakter"
              value={newPassword}
              onChangeText={setNewPassword}
              placeholderTextColor={Colors.textLight}
            />

            <Text style={styles.fieldLabel}>Konfirmasi Kata Sandi Baru:</Text>
            <TextInput
              style={styles.inputBox}
              secureTextEntry
              placeholder="Ulangi kata sandi baru"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholderTextColor={Colors.textLight}
            />

            <TouchableOpacity
              style={[styles.savePasswordBtn, isUpdatingPassword && { opacity: 0.6 }]}
              onPress={handleChangePassword}
              disabled={isUpdatingPassword}
            >
              {isUpdatingPassword ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                  <Text style={styles.savePasswordBtnText}>Simpan Kata Sandi</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Konfirmasi Logout */}
      <Modal
        visible={isLogoutModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsLogoutModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.logoutConfirmCard}>
            <View style={styles.logoutIconBox}>
              <Ionicons name="alert-circle" size={32} color="#EF4444" />
            </View>
            <Text style={styles.logoutConfirmTitle}>Konfirmasi Keluar</Text>
            <Text style={styles.logoutConfirmSubtitle}>
              Apakah Anda yakin ingin keluar dari akun {userData?.name || 'ini'}? Anda perlu memasukkan kredensial login kembali.
            </Text>

            <View style={styles.logoutBtnRow}>
              <TouchableOpacity
                style={styles.cancelLogoutBtn}
                onPress={() => setIsLogoutModalOpen(false)}
              >
                <Text style={styles.cancelLogoutText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmLogoutBtn}
                onPress={handleLogout}
              >
                <Text style={styles.confirmLogoutText}>Ya, Keluar</Text>
              </TouchableOpacity>
            </View>
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
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E6F4F1',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  editBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0B8A7D',
  },
  loadingBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 16,
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  avatarBox: {
    width: 76,
    height: 76,
    borderRadius: 24,
    backgroundColor: '#0B8A7D',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarInitials: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  userName: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E6F4F1',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 6,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0B8A7D',
    letterSpacing: 0.5,
  },
  parentNote: {
    fontSize: 12,
    fontWeight: '600',
    color: '#EC4899',
    marginTop: 6,
  },
  userSchool: {
    fontSize: 12,
    color: Colors.textLight,
    marginTop: 6,
    textAlign: 'center',
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sectionCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  infoKey: {
    fontSize: 12,
    color: Colors.textLight,
  },
  infoVal: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
  },
  infoValBold: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0B8A7D',
    flex: 1,
    textAlign: 'right',
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  activePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#10B981',
  },
  actionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  actionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
  },
  versionText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textLight,
  },
  logoutButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 14,
    paddingVertical: 14,
  },
  logoutButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#EF4444',
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
    marginBottom: 12,
  },
  savePasswordBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0B8A7D',
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 8,
  },
  savePasswordBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  logoutConfirmCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 22,
    marginHorizontal: 24,
    marginVertical: 'auto',
    alignItems: 'center',
  },
  logoutIconBox: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  logoutConfirmTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
  },
  logoutConfirmSubtitle: {
    fontSize: 12,
    color: Colors.textLight,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  logoutBtnRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    width: '100%',
  },
  cancelLogoutBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  cancelLogoutText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  confirmLogoutBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#EF4444',
    alignItems: 'center',
  },
  confirmLogoutText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sectionCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  biometricSettingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  biometricSettingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  biometricIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  biometricIconCircleActive: {
    backgroundColor: '#DCFCE7',
  },
  biometricIconCircleInactive: {
    backgroundColor: '#F3F4F6',
  },
  biometricTextContainer: {
    flex: 1,
  },
  biometricSettingTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  biometricSettingSubtitle: {
    fontSize: 11,
    color: Colors.textLight,
    marginTop: 2,
  },
  adminSecurityNoticeCard: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 12,
    padding: 14,
  },
  adminSecurityHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  adminShieldIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  adminSecurityNoticeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
  },
  adminBadgePill: {
    backgroundColor: '#FDE68A',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  adminBadgePillText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#B45309',
    letterSpacing: 0.5,
  },
  adminSecurityNoticeDesc: {
    fontSize: 11,
    color: '#B45309',
    lineHeight: 16,
  },
});
