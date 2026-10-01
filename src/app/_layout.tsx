import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { requestAppPermissions, AppPermissionsStatus } from '../utils/permissions';
import { PermissionModal } from '../components/PermissionModal';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [permissions, setPermissions] = useState<AppPermissionsStatus>({
    location: false,
    camera: false,
    audio: false,
    media: false,
    allGranted: false,
  });
  const [showPermissionModal, setShowPermissionModal] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function initApp() {
      try {
        // Hide splash screen first so that permission dialogs and UI are clearly visible to user
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
      } catch (err) {
        console.log('[RootLayout] Permission init error:', err);
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
        <Stack.Screen name="login" />
        <Stack.Screen name="(tabs)" />
      </Stack>

      <PermissionModal
        visible={showPermissionModal}
        permissions={permissions}
        onRequestPermissions={handleRequestPermissions}
        onDismiss={() => setShowPermissionModal(false)}
      />
    </>
  );
}
