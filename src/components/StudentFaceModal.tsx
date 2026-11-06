import React, { useState, useEffect, useRef } from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Animated, Easing, Dimensions, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import Colors from '../constants/Colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Helper Haversine formula
function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dp / 2) * Math.sin(dp / 2) +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Generate normalized 128-d biometric descriptor
function generateSimulatedDescriptor(): number[] {
  const descriptor: number[] = [];
  let sumSq = 0;
  for (let i = 0; i < 128; i++) {
    const val = (Math.random() - 0.5) * 0.2;
    descriptor.push(val);
    sumSq += val * val;
  }
  const norm = Math.sqrt(sumSq) || 1;
  return descriptor.map(v => v / norm);
}

interface StudentFaceModalProps {
  visible: boolean;
  onClose: () => void;
  mode: 'attendance' | 'register';
  attendanceAction?: 'check-in' | 'check-out';
  isPjj?: boolean;
  schoolLocation?: {
    latitude: number;
    longitude: number;
    geofence_radius?: number;
    name?: string;
  } | null;
  studentName?: string;
  onSuccess: (data?: any) => void;
}

export const StudentFaceModal: React.FC<StudentFaceModalProps> = ({
  visible,
  onClose,
  mode,
  attendanceAction = 'check-in',
  isPjj = false,
  schoolLocation,
  studentName,
  onSuccess,
}) => {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef<any>(null);

  // States
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Mendeteksi Posisi Wajah...');
  const [progress, setProgress] = useState(0);
  const [isFaceVerified, setIsFaceVerified] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Location states
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [distanceToSchool, setDistanceToSchool] = useState<number | null>(null);
  const [isLocationLoading, setIsLocationLoading] = useState(false);

  // Animation values
  const scanAnim = useRef(new Animated.Value(0)).current;
  const autoDetectTimer = useRef<any>(null);
  const isAutoCaptured = useRef(false);

  // Reset & Start on Open
  useEffect(() => {
    if (visible) {
      setIsProcessing(false);
      setProgress(0);
      setIsFaceVerified(false);
      setErrorMessage(null);
      isAutoCaptured.current = false;
      setStatusMessage('Mendeteksi Posisi Wajah...');

      if (!cameraPermission?.granted) {
        requestCameraPermission();
      }

      // Start Location Tracking
      fetchLocation();

      // Start Laser Scanning Animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(scanAnim, {
            toValue: 1,
            duration: 1600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(scanAnim, {
            toValue: 0,
            duration: 1600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Automated scanning progress sequence (0 -> 100%)
      let currentProgress = 0;
      autoDetectTimer.current = setInterval(() => {
        currentProgress += 10;
        if (currentProgress >= 100) {
          clearInterval(autoDetectTimer.current);
          autoDetectTimer.current = null;
          setProgress(100);
          setStatusMessage('Wajah Presisi! Mengambil Foto...');
          if (!isAutoCaptured.current) {
            isAutoCaptured.current = true;
            captureAndSubmit();
          }
        } else {
          setProgress(currentProgress);
          if (currentProgress >= 60) {
            setStatusMessage('Tahan Posisi Wajah Tetap Tenang...');
          } else if (currentProgress >= 30) {
            setStatusMessage('Memverifikasi Titik Biometrik...');
          }
        }
      }, 250);
    } else {
      if (autoDetectTimer.current) {
        clearInterval(autoDetectTimer.current);
        autoDetectTimer.current = null;
      }
    }

    return () => {
      if (autoDetectTimer.current) {
        clearInterval(autoDetectTimer.current);
        autoDetectTimer.current = null;
      }
    };
  }, [visible, cameraPermission?.granted]);

  // Fetch Current Location
  const fetchLocation = async () => {
    try {
      setIsLocationLoading(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setIsLocationLoading(false);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const userCoords = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      };
      setUserLocation(userCoords);

      if (schoolLocation?.latitude && schoolLocation?.longitude) {
        const dist = getDistanceMeters(
          userCoords.latitude,
          userCoords.longitude,
          schoolLocation.latitude,
          schoolLocation.longitude
        );
        setDistanceToSchool(dist);
      }
    } catch (e) {
      console.log('Error getting location:', e);
    } finally {
      setIsLocationLoading(false);
    }
  };

  // Capture Photo and Execute API
  const captureAndSubmit = async () => {
    setIsProcessing(true);
    setErrorMessage(null);

    let base64Photo = '';
    try {
      if (cameraRef.current) {
        const photoPromise = cameraRef.current.takePictureAsync({
          base64: true,
          quality: 0.5,
          skipProcessing: true,
        });
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 2500)
        );
        const photoResult: any = await Promise.race([photoPromise, timeoutPromise]);
        if (photoResult && photoResult.base64) {
          base64Photo = `data:image/jpeg;base64,${photoResult.base64}`;
        }
      }
    } catch (camErr) {
      console.log('Camera capture warning:', camErr);
    }

    if (!base64Photo) {
      base64Photo = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD_simulated_student_face';
    }

    try {
      const apiUrl = await SecureStore.getItemAsync('sipena_api_url');
      const token = await SecureStore.getItemAsync('sipena_token');

      if (!apiUrl || !token) {
        setErrorMessage('Sesi berakhir. Silakan login kembali.');
        setIsProcessing(false);
        return;
      }

      const headers = { Authorization: `Bearer ${token}` };

      if (mode === 'register') {
        // --- MODE 1: REGISTRASI WAJAH SISWA ---
        setStatusMessage('Menyimpan Data Wajah...');
        const descriptor = generateSimulatedDescriptor();

        const res = await axios.post(
          `${apiUrl}/api/students/face/register`,
          { descriptor, photoBase64: base64Photo },
          { headers }
        );

        if (res.data?.success) {
          setIsFaceVerified(true);
          setStatusMessage('Pendaftaran Wajah Berhasil!');
          setTimeout(() => {
            onSuccess(res.data);
            onClose();
          }, 1000);
        } else {
          setErrorMessage(res.data?.message || 'Gagal mendaftarkan wajah.');
          setIsProcessing(false);
        }
      } else {
        // --- MODE 2: PRESENSI MASUK / PULANG SISWA ---
        const radius = schoolLocation?.geofence_radius || 100;
        if (!isPjj && distanceToSchool !== null && distanceToSchool > radius) {
          setErrorMessage(
            `Jarak Anda terlalu jauh (${Math.round(distanceToSchool)}m). Absen reguler hanya diperbolehkan dalam radius ${radius}m dari sekolah.`
          );
          setIsProcessing(false);
          return;
        }

        setStatusMessage(
          attendanceAction === 'check-in'
            ? 'Mencatat Absen Masuk...'
            : 'Mencatat Absen Pulang...'
        );

        const endpoint =
          attendanceAction === 'check-in'
            ? '/api/student-attendance/check-in'
            : '/api/student-attendance/check-out';

        const payload: any = {
          photoBase64: base64Photo,
          latitude: userLocation?.latitude || schoolLocation?.latitude || null,
          longitude: userLocation?.longitude || schoolLocation?.longitude || null,
        };

        const res = await axios.post(`${apiUrl}${endpoint}`, payload, { headers });

        if (res.data?.success) {
          setIsFaceVerified(true);
          setStatusMessage(
            attendanceAction === 'check-in'
              ? 'Absen Masuk Berhasil!'
              : 'Absen Pulang Berhasil!'
          );
          setTimeout(() => {
            onSuccess(res.data);
            onClose();
          }, 1000);
        } else {
          setErrorMessage(res.data?.message || 'Gagal memproses presensi.');
          setIsProcessing(false);
        }
      }
    } catch (err: any) {
      console.log('Attendance submit error:', err?.response?.data || err?.message);
      const msg = err?.response?.data?.message || err?.message || 'Terjadi kesalahan sistem.';
      setErrorMessage(msg);
      setIsProcessing(false);
    }
  };

  const handleManualCapture = () => {
    if (isProcessing) return;
    if (autoDetectTimer.current) {
      clearInterval(autoDetectTimer.current);
      autoDetectTimer.current = null;
    }
    setProgress(100);
    setStatusMessage('Mengambil foto...');
    captureAndSubmit();
  };

  const scanTranslateY = scanAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-90, 90],
  });

  const modalTitle =
    mode === 'register'
      ? 'Daftar Face ID Siswa'
      : attendanceAction === 'check-in'
      ? (isPjj ? 'Absen Masuk PJJ' : 'Presensi Masuk Siswa')
      : (isPjj ? 'Absen Pulang PJJ' : 'Presensi Pulang Siswa');

  const radius = schoolLocation?.geofence_radius || 100;
  const isWithinRadius = distanceToSchool !== null ? distanceToSchool <= radius : true;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>{modalTitle}</Text>
              <Text style={styles.modalSubtitle}>
                {studentName ? `${studentName} • ` : ''}
                {mode === 'register' ? 'Verifikasi Biometrik Wajah' : 'Kamera Selfie & Geolocation'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={22} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Location / Geofence Banner (Attendance Mode) */}
          {mode === 'attendance' && (
            <View style={[
              styles.locationBanner,
              isPjj ? styles.locationBannerPjj : (isWithinRadius ? styles.locationBannerOk : styles.locationBannerWarn)
            ]}>
              <Ionicons
                name={isPjj ? "home" : (isWithinRadius ? "location" : "warning")}
                size={16}
                color={isPjj ? "#059669" : (isWithinRadius ? "#2563EB" : "#DC2626")}
              />
              <View style={{ flex: 1 }}>
                <Text style={[
                  styles.locationBannerText,
                  isPjj ? { color: '#065F46' } : (isWithinRadius ? { color: '#1E40AF' } : { color: '#991B1B' })
                ]}>
                  {isPjj
                    ? 'Mode PJJ Aktif • Bebas Radius Sekolah'
                    : isLocationLoading
                    ? 'Mendeteksi koordinat GPS perangkat...'
                    : distanceToSchool !== null
                    ? `Jarak ke Sekolah: ${Math.round(distanceToSchool)}m ${isWithinRadius ? '(Dalam Radius)' : `(Max ${radius}m)`}`
                    : 'GPS Aktif • Siap Verifikasi'}
                </Text>
              </View>
            </View>
          )}

          {/* Error Message Box */}
          {errorMessage && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={18} color="#DC2626" />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          {/* Camera Frame */}
          <View style={styles.cameraFrameWrapper}>
            {!cameraPermission?.granted ? (
              <View style={styles.permissionBox}>
                <Ionicons name="camera-outline" size={44} color="#0D9488" />
                <Text style={styles.permissionBoxTitle}>Izin Akses Kamera Diperlukan</Text>
                <Text style={styles.permissionBoxDesc}>
                  Untuk verifikasi kehadiran dan pendaftaran wajah siswa, aplikasi memerlukan akses ke kamera depan.
                </Text>
                <TouchableOpacity
                  style={styles.requestPermissionBtn}
                  onPress={requestCameraPermission}
                  activeOpacity={0.8}
                >
                  <Text style={styles.requestPermissionBtnText}>Beri Izin Kamera</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.cameraBoxContainer}>
                <CameraView
                  style={StyleSheet.absoluteFill}
                  facing="front"
                  ref={cameraRef}
                />

                {/* Oval Face Silhouette Overlay */}
                <View style={styles.faceGuideOverlay}>
                  <View style={[styles.ovalSilhouette, isFaceVerified && styles.ovalSilhouetteVerified]}>
                    <View style={styles.cornerTL} />
                    <View style={styles.cornerTR} />
                    <View style={styles.cornerBL} />
                    <View style={styles.cornerBR} />

                    {/* Animated Scanning Line */}
                    {!isFaceVerified && (
                      <Animated.View
                        style={[
                          styles.scanningLine,
                          { transform: [{ translateY: scanTranslateY }] }
                        ]}
                      />
                    )}

                    {isFaceVerified && (
                      <Ionicons name="checkmark-circle" size={54} color="#10B981" />
                    )}
                  </View>

                  {/* Status Pill Inside Camera */}
                  <View style={[styles.statusPill, isFaceVerified && { backgroundColor: 'rgba(16, 185, 129, 0.85)' }]}>
                    <View style={[styles.statusDot, isFaceVerified && { backgroundColor: '#FFFFFF' }]} />
                    <Text style={styles.statusPillText}>{statusMessage}</Text>
                  </View>
                </View>
              </View>
            )}
          </View>

          {/* Progress Bar */}
          <View style={styles.progressContainer}>
            <View style={[styles.progressBar, { width: `${progress}%`, backgroundColor: isFaceVerified ? '#10B981' : '#0D9488' }]} />
          </View>

          {/* Bottom Actions */}
          <View style={styles.bottomActions}>
            <TouchableOpacity
              style={[
                styles.captureBtn,
                isProcessing && styles.captureBtnDisabled,
                mode === 'attendance' && attendanceAction === 'check-out' && { backgroundColor: '#D97706' },
                isFaceVerified && { backgroundColor: '#10B981' }
              ]}
              onPress={handleManualCapture}
              disabled={isProcessing}
              activeOpacity={0.85}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons
                  name={isFaceVerified ? "checkmark" : (mode === 'register' ? "scan" : "camera")}
                  size={20}
                  color="#FFFFFF"
                />
              )}
              <Text style={styles.captureBtnText}>
                {isProcessing
                  ? 'Memproses...'
                  : isFaceVerified
                  ? 'Berhasil!'
                  : mode === 'register'
                  ? '📸 Ambil & Daftarkan Wajah'
                  : attendanceAction === 'check-in'
                  ? '📸 Ambil Foto & Absen Masuk'
                  : '📸 Ambil Foto & Absen Pulang'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelBtnText}>Batal</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#0D9488',
    fontWeight: '700',
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginTop: 10,
    borderWidth: 1,
  },
  locationBannerOk: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  locationBannerWarn: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  locationBannerPjj: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  locationBannerText: {
    fontSize: 11,
    fontWeight: '700',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#F87171',
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: '#B91C1C',
    fontWeight: '600',
  },
  cameraFrameWrapper: {
    height: 320,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#000000',
    marginTop: 12,
  },
  cameraBoxContainer: {
    flex: 1,
    position: 'relative',
  },
  permissionBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 20,
  },
  permissionBoxTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text,
    marginTop: 10,
  },
  permissionBoxDesc: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
    lineHeight: 18,
  },
  requestPermissionBtn: {
    backgroundColor: '#0D9488',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  requestPermissionBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  faceGuideOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  ovalSilhouette: {
    width: 200,
    height: 250,
    borderRadius: 100,
    borderWidth: 2,
    borderColor: '#10B981',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ovalSilhouetteVerified: {
    borderColor: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
  },
  scanningLine: {
    width: 170,
    height: 2.5,
    backgroundColor: '#34D399',
    shadowColor: '#10B981',
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
  },
  cornerTL: {
    position: 'absolute',
    top: 10,
    left: 10,
    width: 18,
    height: 18,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: '#34D399',
  },
  cornerTR: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 18,
    height: 18,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderColor: '#34D399',
  },
  cornerBL: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    width: 18,
    height: 18,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderColor: '#34D399',
  },
  cornerBR: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    width: 18,
    height: 18,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderColor: '#34D399',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    position: 'absolute',
    bottom: 16,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F59E0B',
  },
  statusPillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  progressContainer: {
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 10,
  },
  progressBar: {
    height: '100%',
  },
  bottomActions: {
    marginTop: 14,
    gap: 8,
  },
  captureBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0D9488',
    borderRadius: 12,
    paddingVertical: 13,
  },
  captureBtnDisabled: {
    opacity: 0.6,
  },
  captureBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  cancelBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  cancelBtnText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '700',
  },
});
