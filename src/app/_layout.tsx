import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { requestAppPermissions, AppPermissionsStatus } from '../utils/permissions';
import { PermissionModal } from '../components/PermissionModal';
import { checkForAppUpdate, AppUpdateInfo } from '../services/updateService';
import { UpdateModal } from '../components/UpdateModal';

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

  useEffect(() => {
    let isMounted = true;

    async function initApp() {
      try {
        // Automatically hide splash screen when app initializes
        await SplashScreen.hideAsync().catch(() => {});

        // Automatically request essential permissions (GPS, Camera, Audio, Media) when app opens
        const status = await requestAppPermissions();
        if (isMounted) {
          setPermissions(status);
          // If any essential permission is not granted, display permission modal
          if (!status.allGranted) {
            setShowPermissionModal(true);
          }
        }

        // Check for app update in background
        const update = await checkForAppUpdate();
        if (isMounted && update?.hasUpdate) {
          setUpdateInfo(update);
          setShowUpdateModal(true);
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


