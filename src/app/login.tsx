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

  // School Selection State
  const [schools, setSchools] = useState<School[]>([]);
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [isSchoolModalVisible, setIsSchoolModalVisible] = useState(false);
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
  }, []);

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
      alert("Pilih sekolah Anda terlebih dahulu!");
      return;
    }

    // Validasi Form
    if (!username || !password) {
      alert("Harap isi Username dan " + (loginType === 'civitas' ? "Password" : "PIN"));
      return;
    }

    // Validasi Captcha
    if (parseInt(captchaAnswer) !== captchaNum1 + captchaNum2) {
      setCaptchaError(true);
      generateCaptcha();
      return;
    }

    try {
      setIsLoadingLogin(true);
      let loginSuccess = false;
      let userData = null;
      let token = null;

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
        // TODO: Endpoint parent login belum tersedia di backend
        throw new Error("Fitur login Orang Tua sedang dalam pengembangan.");
      }

      if (loginSuccess && userData && token) {
        // Simpan data sesi ke SecureStore
        await SecureStore.setItemAsync('sipena_api_url', selectedSchool.api_url);
        await SecureStore.setItemAsync('sipena_school_name', selectedSchool.name);
        await SecureStore.setItemAsync('sipena_token', token);
        await SecureStore.setItemAsync('sipena_user', JSON.stringify(userData));
        
        setIsLoadingLogin(false);
        router.replace('/(tabs)');
      } else {
        throw new Error("Respon server tidak valid");
      }

    } catch (error: any) {
      setIsLoadingLogin(false);
      alert(error.message || "Gagal masuk. Periksa kembali data Anda.");
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
        </View>

      </ScrollView>

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
  }
});
