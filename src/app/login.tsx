import React, { useState, useEffect, useRef } from 'react';
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
import { 
  checkBiometricSupport, 
  getBiometricProfile, 
  saveBiometricProfile, 
  clearBiometricProfile, 
  isRoleAllowedForBiometric, 
  authenticateUser,
  BiometricProfile,
  BiometricAvailability
} from '../services/biometric';

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
  const [isCaptchaFocused, setIsCaptchaFocused] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

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

  // Biometric State
  const [biometricProfile, setBiometricProfile] = useState<BiometricProfile | null>(null);
  const [biometricSupport, setBiometricSupport] = useState<BiometricAvailability | null>(null);

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
    checkBiometrics();

    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setIsKeyboardVisible(true)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setIsKeyboardVisible(false)
    );

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const checkBiometrics = async () => {
    try {
      const support = await checkBiometricSupport();
      setBiometricSupport(support);
      if (support.available && support.enrolled) {
        const profile = await getBiometricProfile();
        // Strict guard: Admin role is never allowed for biometric login
        if (profile && isRoleAllowedForBiometric(profile.user?.role)) {
          setBiometricProfile(profile);
        } else {
          setBiometricProfile(null);
        }
      }
    } catch (e) {
      console.warn('Check biometric error:', e);
    }
  };

  const handleBiometricLogin = async () => {
    if (!biometricProfile) {
      showToast('Tidak ada data akun tersimpan untuk login sidik jari.', 'warning');
      return;
    }

    // Security guard: Admin prohibited
    if (!isRoleAllowedForBiometric(biometricProfile.user?.role)) {
      showToast('Akun Administrator wajib masuk menggunakan username dan kata sandi.', 'error');
      await clearBiometricProfile();
      setBiometricProfile(null);
      return;
    }

    const auth = await authenticateUser(
      `Verifikasi Sidik Jari untuk ${biometricProfile.user?.name || 'SIPENAFS'}`
    );

    if (auth.success) {
      try {
        setIsLoadingLogin(true);
        const bioApiUrl = (biometricProfile.school.api_url || '').trim().replace(/\/+$/, '');
        await SecureStore.setItemAsync('sipena_api_url', bioApiUrl);
        await SecureStore.setItemAsync('sipena_school_name', biometricProfile.school.name);
        await SecureStore.setItemAsync('sipena_token', biometricProfile.token);
        await SecureStore.setItemAsync('sipena_user', JSON.stringify(biometricProfile.user));

        showToast(`Sidik jari terverifikasi! Selamat datang, ${biometricProfile.user?.name || ''}`, 'success');
        setTimeout(() => {
          router.replace('/(tabs)');
        }, 350);
      } catch (e) {
        setIsLoadingLogin(false);
        showToast('Gagal memproses sesi login biometrik.', 'error');
      }
    } else if (auth.error && auth.error !== 'Autentikasi dibatalkan') {
      showToast(auth.error, 'error');
    }
  };

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

      // Biometric policy: Strictly prohibited for Admin
      if (isRoleAllowedForBiometric(role)) {
        await saveBiometricProfile(demoUser, { name: 'SMA SIPENA', api_url: 'https://apidev.sipena.biz.id' }, 'demo-token-' + role);
      } else {
        await clearBiometricProfile();
      }

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
        const sanitized = response.data.map((item: any) => ({
          ...item,
          api_url: (item.api_url || '').trim().replace(/\/+$/, '')
        }));
        setSchools(sanitized);
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

    const schoolApiUrl = (selectedSchool.api_url || '').trim().replace(/\/+$/, '');

    try {
      setIsLoadingLogin(true);
      let loginSuccess = false;
      let userData: any = null;
      let token: string | null = null;

      if (loginType === 'civitas') {
        // Coba login sebagai Guru/Admin dulu
        try {
          const res = await axios.post(`${schoolApiUrl}/api/auth/login`, { username, password });
          if (res.data && res.data.success) {
            loginSuccess = true;
            userData = res.data.user;
            token = res.data.token;
          }
        } catch (e: any) {
          // Jika gagal, coba login sebagai Siswa
          if (e.response && (e.response.status === 401 || e.response.status === 404)) {
            try {
              const resStudent = await axios.post(`${schoolApiUrl}/api/auth/student/login`, { username, password });
              if (resStudent.data && resStudent.data.success) {
                loginSuccess = true;
                userData = resStudent.data.user;
                token = resStudent.data.token;
              }
            } catch (errStudent: any) {
              throw new Error(errStudent.response?.data?.message || "Username atau Password salah");
            }
          } else {
            throw new Error(e.response?.data?.message || "Gagal terhubung ke server sekolah");
          }
        }
      } else {
        // Login Orang Tua / Wali Siswa (Mendukung /parent/login dan /parents/login)
        try {
          let resParent: any = null;
          try {
            resParent = await axios.post(`${schoolApiUrl}/api/parent/login`, {
              username: username.trim(),
              pin: password.trim()
            });
          } catch (errP: any) {
            if (errP.response?.status === 404) {
              resParent = await axios.post(`${schoolApiUrl}/api/parents/login`, {
                username: username.trim(),
                pin: password.trim()
              });
            } else {
              throw errP;
            }
          }

          if (resParent && resParent.data && resParent.data.success) {
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
            throw new Error(resParent?.data?.message || "PIN Wali atau NISN tidak valid");
          }
        } catch (errParent: any) {
          throw new Error(errParent.response?.data?.message || errParent.message || "NISN/NIS atau PIN Wali salah.");
        }
      }

      if (loginSuccess && userData && token) {
        // Simpan data sesi ke SecureStore
        await SecureStore.setItemAsync('sipena_api_url', schoolApiUrl);
        await SecureStore.setItemAsync('sipena_school_name', selectedSchool.name);
        await SecureStore.setItemAsync('sipena_token', token);
        await SecureStore.setItemAsync('sipena_user', JSON.stringify(userData));

        // Kebijakan Biometrik: HANYA untuk non-admin (Guru, Siswa, Orang Tua)
        if (isRoleAllowedForBiometric(userData.role)) {
          if (biometricSupport?.available && biometricSupport?.enrolled) {
            await saveBiometricProfile(userData, { ...selectedSchool, api_url: schoolApiUrl }, token);
          }
        } else {
          // Akun Administrator WAJIB login manual dan tidak boleh disimpan biometriknya
          await clearBiometricProfile();
        }
        
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
        ref={scrollViewRef}
        contentContainerStyle={[
          styles.scrollContent, 
          { 
            paddingTop: insets.top + (isKeyboardVisible ? 10 : 20), 
            paddingBottom: isKeyboardVisible ? 260 : insets.bottom + 20,
            justifyContent: isKeyboardVisible ? 'flex-start' : 'center',
          }
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {/* Header & Logo */}
        <View style={[styles.header, isKeyboardVisible && styles.headerCompact]}>
          {!isKeyboardVisible && (
            <View style={styles.logoBadge}>
              <Image 
                source={require('@/assets/images/logo_emblem.png')} 
                style={styles.logoImage} 
                resizeMode="contain" 
              />
            </View>
          )}
          <Text style={[styles.title, isKeyboardVisible && styles.titleCompact]}>SIPENAFS</Text>
          {!isKeyboardVisible && <Text style={styles.subtitle}>Smart School Ecosystem</Text>}
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
                onFocus={() => {
                  setTimeout(() => {
                    scrollViewRef.current?.scrollTo({ y: 140, animated: true });
                  }, 200);
                }}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ padding: 4 }}>
                <Ionicons 
                  name={showPassword ? "eye-outline" : "eye-off-outline"} 
                  size={20} 
                  color={Colors.textLight} 
                />
              </TouchableOpacity>
            </View>
            {username.trim().toLowerCase().includes('admin') && (
              <View style={styles.adminSecurityNotice}>
                <Ionicons name="shield-outline" size={15} color="#D97706" />
                <Text style={styles.adminSecurityNoticeText}>
                  Akun Administrator wajib verifikasi manual (login sidik jari dinonaktifkan).
                </Text>
              </View>
            )}
          </View>

          {/* Captcha */}
          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Text style={[styles.label, { marginBottom: 0, marginLeft: 0 }]}>Verifikasi Keamanan</Text>
              <TouchableOpacity onPress={generateCaptcha} style={styles.reloadCaptchaBtn} activeOpacity={0.7}>
                <Ionicons name="refresh" size={13} color={Colors.primary} />
                <Text style={styles.reloadCaptchaText}>Ganti Soal</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.captchaRow}>
              <View style={styles.captchaBox}>
                <Text style={styles.captchaText}>{captchaNum1} + {captchaNum2} = ?</Text>
              </View>
              <TextInput 
                style={[styles.captchaInput, captchaError && styles.inputError]}
                placeholder={isCaptchaFocused ? "" : "Hasil"}
                placeholderTextColor={Colors.border}
                keyboardType="numeric"
                value={captchaAnswer}
                underlineColorAndroid="transparent"
                onChangeText={(text) => {
                  setCaptchaAnswer(text);
                  setCaptchaError(false);
                }}
                onFocus={() => {
                  setIsCaptchaFocused(true);
                  setTimeout(() => {
                    scrollViewRef.current?.scrollToEnd({ animated: true });
                  }, 200);
                }}
                onBlur={() => setIsCaptchaFocused(false)}
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

          {/* Quick Biometric Fingerprint Login (Non-Admin Only) */}
          {biometricProfile && isRoleAllowedForBiometric(biometricProfile.user?.role) && (
            <View style={styles.biometricSection}>
              <View style={styles.biometricDividerContainer}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>MASUK CEPAT BIOMETRIK</Text>
                <View style={styles.dividerLine} />
              </View>

              <TouchableOpacity 
                style={styles.biometricCardButton} 
                onPress={handleBiometricLogin}
                disabled={isLoadingLogin}
                activeOpacity={0.82}
              >
                <View style={styles.biometricIconCircle}>
                  <Ionicons name="finger-print" size={26} color="#0B8A7D" />
                </View>
                <View style={styles.biometricCardInfo}>
                  <View style={styles.biometricCardHeader}>
                    <Text style={styles.biometricCardTitle}>Masuk dengan Sidik Jari</Text>
                    <View style={styles.biometricRolePill}>
                      <Text style={styles.biometricRolePillText}>
                        {biometricProfile.user?.role?.toUpperCase() || 'CIVITAS'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.biometricCardUser} numberOfLines={1}>
                    {biometricProfile.user?.name || biometricProfile.user?.username} • {biometricProfile.school?.name || 'Sekolah'}
                  </Text>
                </View>
                <Ionicons name="scan-outline" size={20} color="#0B8A7D" />
              </TouchableOpacity>
            </View>
          )}

          {/* Quick Demo Preview Access (Hidden) */}
        </View>

      </ScrollView>

      {/* Demo Role Selection Modal (Hidden) */}

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
                      const cleanItem = {
                        ...item,
                        api_url: (item.api_url || '').trim().replace(/\/+$/, '')
                      };
                      setSelectedSchool(cleanItem);
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
  headerCompact: {
    marginBottom: 12,
    marginTop: 0,
  },
  logoBadge: {
    width: 88,
    height: 88,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
  },
  logoImage: {
    width: 64,
    height: 64,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: 0.5,
  },
  titleCompact: {
    fontSize: 22,
    fontWeight: '700',
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
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    marginLeft: 4,
  },
  reloadCaptchaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#E8F5E9',
  },
  reloadCaptchaText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },
  captchaInput: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E9ECEF',
    borderRadius: 12,
    height: 52,
    padding: 0,
    paddingHorizontal: 0,
    paddingVertical: 0,
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
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
  noBiometricBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: '#FECACA',
  },
  noBiometricBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#DC2626',
    letterSpacing: 0.3,
  },
  adminSecurityNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#FDE68A',
    gap: 6,
  },
  adminSecurityNoticeText: {
    fontSize: 11,
    color: '#B45309',
    fontWeight: '500',
    flex: 1,
  },
  biometricSection: {
    marginTop: 4,
  },
  biometricDividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 14,
  },
  biometricCardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1.5,
    borderColor: '#A7F3D0',
    borderRadius: 14,
    padding: 12,
    shadowColor: '#0B8A7D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  biometricIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#DCFCE7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  biometricCardInfo: {
    flex: 1,
  },
  biometricCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  biometricCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#065F46',
  },
  biometricRolePill: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  biometricRolePillText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#047857',
    letterSpacing: 0.5,
  },
  biometricCardUser: {
    fontSize: 12,
    color: '#047857',
    marginTop: 2,
    fontWeight: '500',
  },
  adminNoBioTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 5,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  adminNoBioText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#B45309',
  },
});
