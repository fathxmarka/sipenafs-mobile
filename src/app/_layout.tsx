import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { requestAppPermissions, AppPermissionsStatus } from '../utils/permissions';
import { PermissionModal } from '../components/PermissionModal';
import { checkForAppUpdate, AppUpdateInfo } from '../services/updateService';
import { UpdateModal } from '../components/UpdateModal';
import {
  configureNotificationHandler,
  setupNotificationChannel,
  requestNotificationPermission,
  sendUpdateNotification,
  addNotificationResponseListener,
} from '../services/notificationService';

// Konfigurasi agar notifikasi muncul saat app di foreground
configureNotificationHandler();

export default function RootLayout() {
  const [permissions, setPermissions] = useState<AppPermissionsStatus>({
    location: false,
    camera: false,
    audio: false,
    media: false,
    allGranted: false,
  });
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<AppUpdateInfo | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const hasCheckedOnLaunch = useRef(false);

  /**
   * Cek update dan kirim notifikasi + tampilkan modal jika ada
   */
  const performUpdateCheck = async (showModal: boolean = true) => {
    try {
      const update = await checkForAppUpdate();
      if (update?.hasUpdate) {
        setUpdateInfo(update);

        // Kirim local push notification (hanya sekali per versi)
        await sendUpdateNotification(
          update.latestVersion,
          update.releaseName
        );

        // Tampilkan modal otomatis saat buka app
        if (showModal) {
          setShowUpdateModal(true);
        }
      }
    } catch (err) {
      console.log('[RootLayout] Update check error:', err);
    }
  };

  useEffect(() => {
    let isMounted = true;

    async function initApp() {
      try {
        // Sembunyikan splash screen
        await SplashScreen.hideAsync().catch(() => {});

        // Setup notification channel (wajib untuk Android 8+)
        await setupNotificationChannel();

        // Request izin notifikasi
        await requestNotificationPermission();

        // Request izin essential (GPS, Camera, Audio, Media)
        const status = await requestAppPermissions();
        if (isMounted) {
          setPermissions(status);
          if (!status.allGranted) {
            setShowPermissionModal(true);
          }
        }

        // Cek update saat pertama buka app → kirim notif + tampilkan modal
        if (isMounted && !hasCheckedOnLaunch.current) {
          hasCheckedOnLaunch.current = true;
          await performUpdateCheck(true);
        }
      } catch (err) {
        console.log('[RootLayout] Init error:', err);
      }
    }

    initApp();

    return () => {
      isMounted = false;
    };
  }, []);

  /**
   * Re-check update ketika app kembali dari background ke foreground
   * Sehingga user yang buka app dari notifikasi langsung dapat modal update
   */
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App kembali ke foreground → cek update lagi
        performUpdateCheck(true);
      }
      appStateRef.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  /**
   * Listener: ketika user klik notifikasi update → langsung buka modal
   */
  useEffect(() => {
    const subscription = addNotificationResponseListener((response) => {
      const data = response.notification.request.content.data;
      if (data?.type === 'app_update') {
        // User klik notifikasi update → langsung tampilkan modal
        performUpdateCheck(true);
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const handleRequestPermissions = async () => {
    const updated = await requestAppPermissions();
    setPermissions(updated);
    if (updated.allGranted) {
      setShowPermissionModal(false);
    }
  };

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="(tabs)" />
      </Stack>

      <PermissionModal
        visible={showPermissionModal}
        permissions={permissions}
        onRequestPermissions={handleRequestPermissions}
        onDismiss={() => setShowPermissionModal(false)}
      />

      <UpdateModal
        visible={showUpdateModal}
        updateInfo={updateInfo}
        onDismiss={() => setShowUpdateModal(false)}
      />
    </>
  );
}


