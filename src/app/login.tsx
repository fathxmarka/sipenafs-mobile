import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, Image, TouchableOpacity, Dimensions, 
  TextInput, KeyboardAvoidingView, Platform, ScrollView, Modal, 
  FlatList, ActivityIndicator, Keyboard 
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../constants/Colors';
import { Button } from '../components/ui/Button';
import { Toast, ToastType } from '../components/ui/Toast';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const { width, height } = Dimensions.get('window');

type School = {
  school_id: string;
  npsn: string;
  name: string;
  api_url: string;
  logo_url: string;
  level: string;
};

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  // State
  const [loginType, setLoginType] = useState<'civitas' | 'parent'>('civitas');
  
  // Form State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  // Captcha State
  const [captchaNum1, setCaptchaNum1] = useState(0);
  const [captchaNum2, setCaptchaNum2] = useState(0);
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [captchaError, setCaptchaError] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Toast State
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: ToastType }>({
    visible: false,
    message: '',
    type: 'info',
  });

  const showToast = (message: string, type: ToastType = 'error') => {
    setToast({ visible: true, message, type });
  };

  // School Selection State
  const [schools, setSchools] = useState<School[]>([]);
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [isSchoolModalVisible, setIsSchoolModalVisible] = useState(false);
  const [isDemoModalVisible, setIsDemoModalVisible] = useState(false);
  const [isLoadingSchools, setIsLoadingSchools] = useState(false);
  const [searchSchool, setSearchSchool] = useState('');
  
  const [isLoadingLogin, setIsLoadingLogin] = useState(false);

  // Initialize Captcha
  const generateCaptcha = () => {
    setCaptchaNum1(Math.floor(Math.random() * 10) + 1);
    setCaptchaNum2(Math.floor(Math.random() * 10) + 1);
    setCaptchaAnswer('');
    setCaptchaError(false);
  };

  useEffect(() => {
    generateCaptcha();
    fetchSchools();
    checkExistingSession();
  }, []);

  const checkExistingSession = async () => {
    try {
      const token = await SecureStore.getItemAsync('sipena_token');
      const user = await SecureStore.getItemAsync('sipena_user');
      if (token && user) {
        router.replace('/(tabs)');
      }
    } catch (err) {
      console.warn('Check session error:', err);
    }
  };

  const handleDemoLogin = async (role: 'guru' | 'siswa' | 'orang tua' | 'admin') => {
    setIsDemoModalVisible(false);
    setIsLoadingLogin(true);
    let demoUser: any = {};

    if (role === 'guru') {
      demoUser = {
        id: 101,
        name: 'Budi Santoso, M.Pd',
        role: 'guru',
        nip: '198503152010011002',
        email: 'budi.santoso@sipena.biz.id',
        phone: '081234567890',
        teaching_classes: ['XII MIPA 1', 'XII MIPA 2', 'XI MIPA 3'],
        subject: 'Fisika & Matematika Lanjut',
      };
    } else if (role === 'siswa') {
      demoUser = {
        id: 202,
        name: 'Ahmad Fauzan',
        role: 'siswa',
        nis: '2024101',
        nisn: '0078129384',
        kelas: 'XII MIPA 1',
        email: 'fauzan@student.sipena.biz.id',
      };
    } else if (role === 'orang tua') {
      demoUser = {
        id: 303,
        name: 'Drs. H. Mulyono',
        role: 'orang tua',
        student_name: 'Ahmad Fauzan',
        student_id: 202,
        nisn: '0078129384',
        nis: '2024101',
        phone: '081298765432',
        student_class: 'XII MIPA 1',
      };
    } else {
      demoUser = {
        id: 1,
        name: 'Dr. H. Subagyo, M.Pd',
        role: 'admin',
        nip: '197001011995031001',
        email: 'admin@sipena.biz.id',
        title: 'Kepala Sekolah SMA SIPENA',
      };
    }

    try {
      await SecureStore.setItemAsync('sipena_api_url', 'https://apidev.sipena.biz.id');
      await SecureStore.setItemAsync('sipena_school_name', 'SMA SIPENA');
      await SecureStore.setItemAsync('sipena_token', 'demo-token-' + role);
      await SecureStore.setItemAsync('sipena_user', JSON.stringify(demoUser));

      setIsLoadingLogin(false);
      showToast(`Masuk sebagai ${demoUser.name} (${role.toUpperCase()})`, 'success');
      setTimeout(() => {
        router.replace('/(tabs)');
      }, 350);
    } catch (e: any) {
      setIsLoadingLogin(false);
      showToast('Gagal memproses sesi demo.', 'error');
    }
  };

  const fetchSchools = async () => {
    setIsLoadingSchools(true);
    try {
      const response = await axios.get('https://api.sipena.biz.id/api/schools');
      if (response.data && Array.isArray(response.data)) {
        setSchools(response.data);
      }
    } catch (error) {
      console.error("Gagal mengambil daftar sekolah:", error);
    } finally {
      setIsLoadingSchools(false);
    }
  };

  const handleLogin = async () => {
    Keyboard.dismiss();
    
    // Validasi Sekolah
    if (!selectedSchool) {
      showToast("Pilih sekolah Anda terlebih dahulu!", "warning");
      return;
    }

    // Validasi Form
    if (!username || !password) {
      showToast("Harap isi " + (loginType === 'civitas' ? "Username dan Password" : "NISN/NIS dan PIN Wali"), "warning");
      return;
    }

    // Validasi Captcha
    if (parseInt(captchaAnswer) !== captchaNum1 + captchaNum2) {
      setCaptchaError(true);
      generateCaptcha();
      showToast("Hasil penjumlahan Captcha belum tepat.", "error");
      return;
    }

    try {
      setIsLoadingLogin(true);
      let loginSuccess = false;
      let userData: any = null;
      let token: string | null = null;

      if (loginType === 'civitas') {
        // Coba login sebagai Guru/Admin dulu
        try {
          const res = await axios.post(`${selectedSchool.api_url}/api/auth/login`, { username, password });
          if (res.data && res.data.success) {
            loginSuccess = true;
            userData = res.data.user;
            token = res.data.token;
          }
        } catch (e: any) {
          // Jika gagal, coba login sebagai Siswa
          if (e.response && e.response.status === 401) {
            try {
              const resStudent = await axios.post(`${selectedSchool.api_url}/api/auth/student/login`, { username, password });
              if (resStudent.data && resStudent.data.success) {
                loginSuccess = true;
                userData = resStudent.data.user;
                token = resStudent.data.token;
              }
            } catch (errStudent) {
              throw new Error("Username atau Password salah");
            }
          } else {
            throw new Error("Gagal terhubung ke server sekolah");
          }
        }
      } else {
        // Login Orang Tua / Wali Siswa
        try {
          const resParent = await axios.post(`${selectedSchool.api_url}/api/parent/login`, {
            username: username.trim(),
            pin: password.trim()
          });
          if (resParent.data && resParent.data.success) {
            loginSuccess = true;
            token = resParent.data.token;
            userData = {
              ...resParent.data.data,
              role: 'orang tua',
              name: resParent.data.data?.parent_name || 'Orang Tua / Wali',
              student_name: resParent.data.data?.name || resParent.data.name,
              student_id: resParent.data.data?.id,
              nisn: resParent.data.data?.nisn,
              nis: resParent.data.data?.nis,
            };
          } else {
            throw new Error(resParent.data?.message || "PIN Wali atau NISN tidak valid");
          }
        } catch (errParent: any) {
          throw new Error(errParent.response?.data?.message || "NISN/NIS atau PIN Wali salah.");
        }
      }

      if (loginSuccess && userData && token) {
        // Simpan data sesi ke SecureStore
        await SecureStore.setItemAsync('sipena_api_url', selectedSchool.api_url);
        await SecureStore.setItemAsync('sipena_school_name', selectedSchool.name);
        await SecureStore.setItemAsync('sipena_token', token);
        await SecureStore.setItemAsync('sipena_user', JSON.stringify(userData));
        
        setIsLoadingLogin(false);
        showToast("Login berhasil! Mengalihkan...", "success");
        setTimeout(() => {
          router.replace('/(tabs)');
        }, 500);
      } else {
        throw new Error("Respon server tidak valid");
      }

    } catch (error: any) {
      setIsLoadingLogin(false);
      showToast(error.message || "Gagal masuk. Periksa kembali data Anda.", "error");
    }
  };

  const filteredSchools = schools.filter(s => 
    s.name.toLowerCase().includes(searchSchool.toLowerCase()) || 
    s.npsn.includes(searchSchool)
  );

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView 
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header & Logo */}
        <View style={styles.header}>
          <View style={styles.logoBadge}>
            <Ionicons name="school" size={40} color={Colors.white} />
          </View>
          <Text style={styles.title}>SIPENAFS</Text>
          <Text style={styles.subtitle}>Mobile App</Text>
        </View>

        {/* Login Card */}
        <View style={styles.card}>
          
          {/* Toggle Type */}
          <View style={styles.toggleContainer}>
            <TouchableOpacity 
              style={[styles.toggleButton, loginType === 'civitas' && styles.toggleActive]}
              onPress={() => setLoginType('civitas')}
            >
              <Ionicons name="people" size={18} color={loginType === 'civitas' ? Colors.white : Colors.textLight} />
              <Text style={[styles.toggleText, loginType === 'civitas' && styles.toggleTextActive]}>Civitas</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[
                styles.toggleButton, 
                loginType === 'parent' && styles.toggleActive
              ]}
              onPress={() => setLoginType('parent')}
            >
              <Ionicons name="heart" size={18} color={loginType === 'parent' ? '#FF4757' : Colors.textLight} />
              <Text style={[styles.toggleText, loginType === 'parent' && styles.toggleTextActive]}>Orang Tua</Text>
            </TouchableOpacity>
          </View>

          {/* School Selector */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Sekolah Tujuan</Text>
            <TouchableOpacity 
              style={styles.schoolSelector} 
              onPress={() => setIsSchoolModalVisible(true)}
            >
              {selectedSchool ? (
                <View style={styles.selectedSchoolContent}>
                  {selectedSchool.logo_url ? (
                    <Image source={{ uri: selectedSchool.logo_url }} style={styles.schoolSmallLogo} />
                  ) : (
                    <View style={styles.schoolSmallLogoPlaceholder}><Ionicons name="school" size={12} color="#fff" /></View>
                  )}
                  <Text style={styles.selectedSchoolText} numberOfLines={1}>{selectedSchool.name}</Text>
                </View>
              ) : (
                <Text style={styles.placeholderText}>Pilih Sekolah Anda...</Text>
              )}
              <Ionicons name="chevron-down" size={20} color={Colors.textLight} />
            </TouchableOpacity>
          </View>

          {/* Username */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Username / NIS / NIP</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="person-outline" size={20} color={Colors.textLight} style={styles.inputIcon} />
              <TextInput 
                style={styles.input}
                placeholder="Masukkan identifier Anda"
                placeholderTextColor={Colors.border}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
              />
            </View>
          </View>

          {/* Password / PIN */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>{loginType === 'civitas' ? 'Password' : 'PIN 6 Angka'}</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={20} color={Colors.textLight} style={styles.inputIcon} />
              <TextInput 
                style={styles.input}
                placeholder={loginType === 'civitas' ? "Masukkan password" : "••••••"}
                placeholderTextColor={Colors.border}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                keyboardType={loginType === 'parent' ? 'numeric' : 'default'}
                maxLength={loginType === 'parent' ? 6 : undefined}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ padding: 4 }}>
                <Ionicons 
                  name={showPassword ? "eye-off-outline" : "eye-outline"} 
                  size={20} 
                  color={Colors.textLight} 
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Captcha */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Verifikasi Keamanan</Text>
            <View style={styles.captchaRow}>
              <View style={styles.captchaBox}>
                <Text style={styles.captchaText}>{captchaNum1} + {captchaNum2} = ?</Text>
              </View>
              <TextInput 
                style={[styles.input, styles.captchaInput, captchaError && styles.inputError]}
                placeholder="Hasil"
                placeholderTextColor={Colors.border}
                keyboardType="numeric"
                value={captchaAnswer}
                onChangeText={(text) => {
                  setCaptchaAnswer(text);
                  setCaptchaError(false);
                }}
              />
            </View>
            {captchaError && <Text style={styles.errorText}>Jawaban matematika salah!</Text>}
          </View>

          <Button 
            title={isLoadingLogin ? "Memproses..." : "Masuk"} 
            onPress={handleLogin} 
            style={styles.loginButton} 
            disabled={isLoadingLogin}
          />

          {/* Quick Demo Preview Access */}
          <View style={styles.demoDividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>ATAU UJI COBA</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity 
            style={styles.demoTriggerButton} 
            onPress={() => setIsDemoModalVisible(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="sparkles" size={18} color={Colors.primary} style={{ marginRight: 8 }} />
            <Text style={styles.demoTriggerText}>Pratinjau Dashboard Cepat (Demo)</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* Demo Role Selection Modal */}
      <Modal visible={isDemoModalVisible} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.demoModalContent, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>⚡ Pilih Mode Demo</Text>
                <Text style={styles.demoModalSubtitle}>Coba langsung dashboard untuk setiap peran</Text>
              </View>
              <TouchableOpacity onPress={() => setIsDemoModalVisible(false)} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.demoRoleList}>
              <TouchableOpacity 
                style={[styles.demoRoleCard, { borderLeftColor: '#2B8767' }]}
                onPress={() => handleDemoLogin('guru')}
                activeOpacity={0.7}
              >
                <View style={[styles.demoRoleIcon, { backgroundColor: '#E8F5E9' }]}>
                  <Ionicons name="school-outline" size={24} color="#2B8767" />
                </View>
                <View style={styles.demoRoleDetails}>
                  <Text style={styles.demoRoleTitle}>👨‍🏫 Akun Guru</Text>
                  <Text style={styles.demoRoleDesc}>Budi Santoso, M.Pd • Fisika & Matematika Lanjut</Text>
                  <Text style={styles.demoRoleBadge}>Jurnal Mengajar, Nilai, Presensi Kelas</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#9E9E9E" />
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.demoRoleCard, { borderLeftColor: '#3B82F6' }]}
                onPress={() => handleDemoLogin('siswa')}
                activeOpacity={0.7}
              >
                <View style={[styles.demoRoleIcon, { backgroundColor: '#EFF6FF' }]}>
                  <Ionicons name="book-outline" size={24} color="#3B82F6" />
                </View>
                <View style={styles.demoRoleDetails}>
                  <Text style={styles.demoRoleTitle}>🎒 Akun Siswa</Text>
                  <Text style={styles.demoRoleDesc}>Ahmad Fauzan • XII MIPA 1 (NISN: 0078129384)</Text>
                  <Text style={styles.demoRoleBadge}>Jadwal, E-Learning, Tugas, Voting OSIS</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#9E9E9E" />
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.demoRoleCard, { borderLeftColor: '#FF6B6B' }]}
                onPress={() => handleDemoLogin('orang tua')}
                activeOpacity={0.7}
              >
                <View style={[styles.demoRoleIcon, { backgroundColor: '#FFF0F0' }]}>
                  <Ionicons name="heart-outline" size={24} color="#FF6B6B" />
                </View>
                <View style={styles.demoRoleDetails}>
                  <Text style={styles.demoRoleTitle}>👨‍👩‍👧 Akun Orang Tua / Wali</Text>
                  <Text style={styles.demoRoleDesc}>Drs. H. Mulyono • Wali dari Ahmad Fauzan</Text>
                  <Text style={styles.demoRoleBadge}>Monitoring Presensi Anak, SPP, Izin Sakit</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#9E9E9E" />
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.demoRoleCard, { borderLeftColor: '#8B5CF6' }]}
                onPress={() => handleDemoLogin('admin')}
                activeOpacity={0.7}
              >
                <View style={[styles.demoRoleIcon, { backgroundColor: '#F3E8FF' }]}>
                  <Ionicons name="shield-checkmark-outline" size={24} color="#8B5CF6" />
                </View>
                <View style={styles.demoRoleDetails}>
                  <Text style={styles.demoRoleTitle}>👔 Akun Kepala Sekolah / Admin</Text>
                  <Text style={styles.demoRoleDesc}>Dr. H. Subagyo, M.Pd • Kepala Sekolah</Text>
                  <Text style={styles.demoRoleBadge}>Ringkasan Eksekutif, Broadcast, Sarpras</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#9E9E9E" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* School Modal */}
      <Modal visible={isSchoolModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { marginTop: insets.top + 50, paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Pilih Sekolah</Text>
              <TouchableOpacity onPress={() => setIsSchoolModalVisible(false)} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.searchWrapper}>
              <Ionicons name="search" size={20} color={Colors.textLight} style={styles.searchIcon} />
              <TextInput 
                style={styles.searchInput}
                placeholder="Cari nama atau NPSN..."
                placeholderTextColor={Colors.border}
                value={searchSchool}
                onChangeText={setSearchSchool}
              />
            </View>

            {isLoadingSchools ? (
              <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 50 }} />
            ) : (
              <FlatList 
                data={filteredSchools}
                keyExtractor={(item) => item.school_id}
                contentContainerStyle={styles.schoolList}
                renderItem={({ item }) => (
                  <TouchableOpacity 
                    style={styles.schoolItem}
                    onPress={() => {
                      setSelectedSchool(item);
                      setIsSchoolModalVisible(false);
                    }}
                  >
                    {item.logo_url ? (
                      <Image source={{ uri: item.logo_url }} style={styles.schoolLogo} />
                    ) : (
                      <View style={styles.schoolLogoPlaceholder}>
                        <Ionicons name="school" size={20} color="#fff" />
                      </View>
                    )}
                    <View style={styles.schoolInfo}>
                      <Text style={styles.schoolName}>{item.name}</Text>
                      <Text style={styles.schoolNpsn}>NPSN: {item.npsn} • {item.level}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={Colors.border} />
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <Text style={styles.emptyText}>Tidak ada sekolah ditemukan.</Text>
                }
              />
            )}
          </View>
        </View>
      </Modal>

      <Toast 
        visible={toast.visible} 
        message={toast.message} 
        type={toast.type} 
        onDismiss={() => setToast(prev => ({ ...prev, visible: false }))} 
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA', // Sangat cerah dan modern
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  logoBadge: {
    width: 80,
    height: 80,
    borderRadius: 25,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textLight,
    marginTop: 5,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 24,
    elevation: 5,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F3F5',
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  toggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  toggleActive: {
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  toggleActiveParent: {
    backgroundColor: '#FF4757',
    shadowColor: '#FF4757',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textLight,
  },
  toggleTextActive: {
    color: Colors.white,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
    marginLeft: 4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E9ECEF',
    borderRadius: 12,
    height: 52,
    paddingHorizontal: 16,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
    height: '100%',
  },
  schoolSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E9ECEF',
    borderRadius: 12,
    height: 52,
    paddingHorizontal: 16,
  },
  placeholderText: {
    color: Colors.border,
    fontSize: 15,
  },
  selectedSchoolContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  schoolSmallLogo: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 10,
    backgroundColor: '#fff',
  },
  schoolSmallLogoPlaceholder: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 10,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedSchoolText: {
    fontSize: 15,
    color: Colors.text,
    fontWeight: '500',
    flex: 1,
  },
  captchaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  captchaBox: {
    flex: 1,
    height: 52,
    backgroundColor: '#E8F0FE',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D2E3FC',
  },
  captchaText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1967D2',
    letterSpacing: 2,
  },
  captchaInput: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E9ECEF',
    borderRadius: 12,
    height: 52,
    paddingHorizontal: 16,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '600',
  },
  inputError: {
    borderColor: '#FF4757',
    backgroundColor: '#FFF0F1',
  },
  errorText: {
    color: '#FF4757',
    fontSize: 12,
    marginTop: 6,
    marginLeft: 4,
  },
  loginButton: {
    marginTop: 10,
    height: 54,
    borderRadius: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F3F5',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  closeButton: {
    padding: 4,
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    margin: 20,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
  },
  schoolList: {
    paddingHorizontal: 20,
  },
  schoolItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F3F5',
  },
  schoolLogo: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#F1F3F5',
  },
  schoolLogoPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 16,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  schoolInfo: {
    flex: 1,
  },
  schoolName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  schoolNpsn: {
    fontSize: 13,
    color: Colors.textLight,
  },
  emptyText: {
    textAlign: 'center',
    color: Colors.textLight,
    marginTop: 40,
    fontSize: 15,
  },
  demoDividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 1,
  },
  demoTriggerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: '#E6F4EA',
    borderWidth: 1.5,
    borderColor: '#A8D5BA',
  },
  demoTriggerText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
  },
  demoModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  demoModalSubtitle: {
    fontSize: 12,
    color: Colors.textLight,
    marginTop: 3,
  },
  demoRoleList: {
    marginTop: 18,
    gap: 12,
  },
  demoRoleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    borderLeftWidth: 4.5,
  },
  demoRoleIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  demoRoleDetails: {
    flex: 1,
  },
  demoRoleTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  demoRoleDesc: {
    fontSize: 12,
    color: Colors.textLight,
    marginTop: 2,
  },
  demoRoleBadge: {
    fontSize: 11,
    color: Colors.primary,
    fontWeight: '600',
    marginTop: 4,
  },
});
