import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

export interface BiometricAvailability {
  available: boolean;
  enrolled: boolean;
  biometryType: 'fingerprint' | 'facial' | 'biometric' | 'none';
  label: string;
}

export interface BiometricProfile {
  user: any;
  school: {
    school_id?: string;
    npsn?: string;
    name: string;
    api_url: string;
    logo_url?: string;
  };
  token: string;
}

const STORAGE_KEY_ENABLED = 'sipena_biometric_enabled';
const STORAGE_KEY_USER = 'sipena_biometric_user';
const STORAGE_KEY_SCHOOL = 'sipena_biometric_school';
const STORAGE_KEY_TOKEN = 'sipena_biometric_token';

/**
 * Checks if a given role is allowed to use biometric login.
 * STRICT SECURITY RULE: Admin roles CANNOT use biometric login.
 */
export function isRoleAllowedForBiometric(role?: string): boolean {
  if (!role) return false;
  const normalizedRole = role.toLowerCase().trim();
  
  // Administrator and Superadmin are strictly prohibited from biometric login
  if (
    normalizedRole === 'admin' || 
    normalizedRole === 'administrator' || 
    normalizedRole === 'superadmin' ||
    normalizedRole.includes('admin')
  ) {
    return false;
  }

  // Allowed: Guru / Tenaga Pendidik, Siswa, Orang Tua / Wali
  return true;
}

/**
 * Checks device hardware support and enrolled biometrics (Fingerprint / FaceID).
 */
export async function checkBiometricSupport(): Promise<BiometricAvailability> {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) {
      return { available: false, enrolled: false, biometryType: 'none', label: 'Tidak didukung' };
    }

    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();

    let biometryType: 'fingerprint' | 'facial' | 'biometric' | 'none' = 'biometric';
    let label = 'Sidik Jari / Biometrik';

    if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      biometryType = 'fingerprint';
      label = 'Sidik Jari (Fingerprint)';
    } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      biometryType = 'facial';
      label = 'Pengenalan Wajah';
    }

    return {
      available: hasHardware,
      enrolled: isEnrolled,
      biometryType,
      label,
    };
  } catch (error) {
    console.warn('Gagal memeriksa dukungan biometrik:', error);
    return { available: false, enrolled: false, biometryType: 'none', label: 'Error' };
  }
}

/**
 * Retrieves saved biometric profile if enabled and role is permitted.
 */
export async function getBiometricProfile(): Promise<BiometricProfile | null> {
  try {
    const enabled = await SecureStore.getItemAsync(STORAGE_KEY_ENABLED);
    if (enabled !== 'true') return null;

    const userRaw = await SecureStore.getItemAsync(STORAGE_KEY_USER);
    const schoolRaw = await SecureStore.getItemAsync(STORAGE_KEY_SCHOOL);
    const token = await SecureStore.getItemAsync(STORAGE_KEY_TOKEN);

    if (!userRaw || !token || !schoolRaw) return null;

    const user = JSON.parse(userRaw);
    const school = JSON.parse(schoolRaw);

    // Double check: if user is admin, disable and clear immediately
    if (!isRoleAllowedForBiometric(user.role)) {
      await clearBiometricProfile();
      return null;
    }

    return { user, school, token };
  } catch (e) {
    console.warn('Gagal membaca profil biometrik:', e);
    return null;
  }
}

/**
 * Saves or updates biometric profile for non-admin user.
 */
export async function saveBiometricProfile(user: any, school: any, token: string): Promise<boolean> {
  try {
    // Admin cannot register biometric
    if (!isRoleAllowedForBiometric(user?.role)) {
      await clearBiometricProfile();
      return false;
    }

    await SecureStore.setItemAsync(STORAGE_KEY_ENABLED, 'true');
    await SecureStore.setItemAsync(STORAGE_KEY_USER, JSON.stringify(user));
    await SecureStore.setItemAsync(STORAGE_KEY_SCHOOL, JSON.stringify(school));
    await SecureStore.setItemAsync(STORAGE_KEY_TOKEN, token);
    return true;
  } catch (e) {
    console.warn('Gagal menyimpan profil biometrik:', e);
    return false;
  }
}

/**
 * Deactivates and clears biometric credentials.
 */
export async function clearBiometricProfile(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(STORAGE_KEY_ENABLED);
    await SecureStore.deleteItemAsync(STORAGE_KEY_USER);
    await SecureStore.deleteItemAsync(STORAGE_KEY_SCHOOL);
    await SecureStore.deleteItemAsync(STORAGE_KEY_TOKEN);
  } catch (e) {
    console.warn('Gagal menghapus profil biometrik:', e);
  }
}

/**
 * Triggers native Fingerprint / Biometric authentication dialog.
 */
export async function authenticateUser(promptTitle?: string): Promise<{ success: boolean; error?: string }> {
  try {
    const support = await checkBiometricSupport();
    if (!support.available) {
      return { success: false, error: 'Perangkat Anda tidak memiliki sensor biometrik/sidik jari.' };
    }
    if (!support.enrolled) {
      return { success: false, error: 'Belum ada sidik jari yang terdaftar di pengaturan HP Anda.' };
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: promptTitle || 'Autentikasi Sidik Jari SIPENAFS',
      cancelLabel: 'Batal',
      fallbackLabel: 'Gunakan Kata Sandi',
      disableDeviceFallback: false,
    });

    if (result.success) {
      return { success: true };
    }

    if (result.error === 'user_cancel' || result.error === 'app_cancel') {
      return { success: false, error: 'Autentikasi dibatalkan' };
    }

    return { success: false, error: 'Verifikasi sidik jari tidak sesuai.' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Terjadi kesalahan sensor biometrik.' };
  }
}
