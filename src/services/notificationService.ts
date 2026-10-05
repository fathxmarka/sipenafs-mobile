import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const NOTIFICATION_CHANNEL_ID = 'sipenafs-updates';
const LAST_NOTIFIED_VERSION_KEY = 'sipenafs_last_notified_version';

/**
 * Konfigurasi handler notifikasi agar muncul saat app foreground
 */
export function configureNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

/**
 * Setup notification channel untuk Android (wajib untuk Android 8+)
 */
export async function setupNotificationChannel(): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL_ID, {
      name: 'Pembaruan Aplikasi',
      description: 'Notifikasi pembaruan versi aplikasi SIPENAFS',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#0D9488',
      sound: 'default',
    });
  }
}

/**
 * Request izin notifikasi dari user
 */
export async function requestNotificationPermission(): Promise<boolean> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      });
      finalStatus = status;
    }

    return finalStatus === 'granted';
  } catch (error) {
    console.log('[NotificationService] Permission request error:', error);
    return false;
  }
}

/**
 * Cek apakah sudah pernah mengirim notifikasi untuk versi tertentu
 * Mencegah spam notifikasi berulang untuk versi yang sama
 */
export async function hasNotifiedForVersion(version: string): Promise<boolean> {
  try {
    const lastNotified = await AsyncStorage.getItem(LAST_NOTIFIED_VERSION_KEY);
    return lastNotified === version;
  } catch {
    return false;
  }
}

/**
 * Simpan versi yang sudah dinotifikasi
 */
export async function markVersionNotified(version: string): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_NOTIFIED_VERSION_KEY, version);
  } catch (error) {
    console.log('[NotificationService] Failed to save notified version:', error);
  }
}

/**
 * Kirim local push notification untuk pembaruan aplikasi
 */
export async function sendUpdateNotification(
  latestVersion: string,
  releaseName: string
): Promise<void> {
  try {
    // Cek apakah sudah pernah notif untuk versi ini
    const alreadyNotified = await hasNotifiedForVersion(latestVersion);
    if (alreadyNotified) {
      console.log('[NotificationService] Already notified for version', latestVersion);
      return;
    }

    // Request permission jika belum
    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) {
      console.log('[NotificationService] Notification permission not granted');
      return;
    }

    // Kirim notifikasi lokal
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🔄 Pembaruan SIPENAFS Tersedia!',
        body: `Versi ${latestVersion.replace(/^v/i, '')} telah dirilis. ${releaseName || 'Buka aplikasi untuk memperbarui.'}`,
        data: {
          type: 'app_update',
          version: latestVersion,
        },
        sound: 'default',
        ...(Platform.OS === 'android' ? { channelId: NOTIFICATION_CHANNEL_ID } : {}),
      },
      trigger: null, // Kirim langsung (immediate)
    });

    // Tandai versi ini sudah dinotifikasi
    await markVersionNotified(latestVersion);
    console.log('[NotificationService] Update notification sent for version', latestVersion);
  } catch (error) {
    console.log('[NotificationService] Failed to send notification:', error);
  }
}

/**
 * Listener untuk menangani klik notifikasi
 * Return subscription yang harus di-cleanup
 */
export function addNotificationResponseListener(
  callback: (response: Notifications.NotificationResponse) => void
): Notifications.EventSubscription {
  return Notifications.addNotificationResponseReceivedListener(callback);
}
