import { Platform, PermissionsAndroid } from 'react-native';
import * as Location from 'expo-location';
import { Camera } from 'expo-camera';
import * as MediaLibrary from 'expo-media-library/legacy';
import * as Contacts from 'expo-contacts/legacy';

export interface AppPermissionsStatus {
  location: boolean;
  camera: boolean;
  audio: boolean;
  media: boolean;
  contacts: boolean;
  allGranted: boolean;
}

/**
 * Request essential device permissions on app startup:
 * - GPS / Location (for attendance & radius validation)
 * - Camera (for face verification & QR scanning)
 * - Audio / Microphone (for learning media & audio recording)
 * - Media / Photos & Storage (for document & media attachments)
 * - Contacts (for connecting teachers, students, and parent directories)
 */
export async function requestAppPermissions(): Promise<AppPermissionsStatus> {
  const result: AppPermissionsStatus = {
    location: false,
    camera: false,
    audio: false,
    media: false,
    contacts: false,
    allGranted: false,
  };

  try {
    // 1. GPS / Location permission via expo-location
    try {
      const locStatus = await Location.requestForegroundPermissionsAsync();
      result.location = locStatus.status === 'granted';
    } catch (locErr) {
      console.log('[expo-location] request error:', locErr);
    }

    // 2. Camera permission via expo-camera
    try {
      const camStatus = await Camera.requestCameraPermissionsAsync();
      result.camera = camStatus.status === 'granted';
    } catch (camErr) {
      console.log('[expo-camera] request error:', camErr);
    }

    // 3. Audio / Microphone permission via expo-camera
    try {
      const micStatus = await Camera.requestMicrophonePermissionsAsync();
      result.audio = micStatus.status === 'granted';
    } catch (micErr) {
      console.log('[expo-camera/audio] request error:', micErr);
    }

    // 4. Media Library / Photos & Storage permission via expo-media-library
    try {
      if (MediaLibrary?.requestPermissionsAsync) {
        const mediaStatus = await MediaLibrary.requestPermissionsAsync();
        result.media =
          mediaStatus.status === 'granted' ||
          (mediaStatus as any).accessPrivileges === 'all' ||
          (mediaStatus as any).accessPrivileges === 'limited';
      }
    } catch (mediaErr) {
      console.log('[expo-media-library] request error:', mediaErr);
    }

    // 5. Contacts permission via expo-contacts
    try {
      if (Contacts?.requestPermissionsAsync) {
        const contactsStatus = await Contacts.requestPermissionsAsync();
        result.contacts = contactsStatus.status === 'granted';
      }
    } catch (contactsErr) {
      console.log('[expo-contacts] request error:', contactsErr);
    }

    // 6. Additional verification via PermissionsAndroid on Android
    if (Platform.OS === 'android') {
      try {
        if (!result.location) {
          result.location =
            (await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION)) ||
            (await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION));
        }
        if (!result.camera) {
          result.camera = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA);
        }
        if (!result.audio) {
          result.audio = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
        }
        if (!result.contacts) {
          result.contacts = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_CONTACTS);
        }
        if (!result.media) {
          const hasImages =
            PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES &&
            (await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES));
          const hasStorage =
            PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE &&
            (await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE));
          result.media = Boolean(hasImages || hasStorage);
        }
      } catch (err) {
        console.log('[PermissionsAndroid] check error:', err);
      }
    }

    result.allGranted =
      result.location &&
      result.camera &&
      result.audio &&
      result.media &&
      result.contacts;

    console.log('[Permissions] App permissions status:', result);
  } catch (error) {
    console.log('[Permissions] Error requesting app permissions:', error);
  }

  return result;
}

/**
 * Check current permissions status without prompting
 */
export async function checkAppPermissions(): Promise<AppPermissionsStatus> {
  const result: AppPermissionsStatus = {
    location: false,
    camera: false,
    audio: false,
    media: false,
    contacts: false,
    allGranted: false,
  };

  try {
    const locStatus = await Location.getForegroundPermissionsAsync();
    result.location = locStatus.status === 'granted';

    const camStatus = await Camera.getCameraPermissionsAsync();
    result.camera = camStatus.status === 'granted';

    const micStatus = await Camera.getMicrophonePermissionsAsync();
    result.audio = micStatus.status === 'granted';

    try {
      if (MediaLibrary?.getPermissionsAsync) {
        const mediaStatus = await MediaLibrary.getPermissionsAsync();
        result.media =
          mediaStatus.status === 'granted' ||
          (mediaStatus as any).accessPrivileges === 'all' ||
          (mediaStatus as any).accessPrivileges === 'limited';
      }
    } catch (e) {
      console.log('[expo-media-library] check error:', e);
    }

    try {
      if (Contacts?.getPermissionsAsync) {
        const contactsStatus = await Contacts.getPermissionsAsync();
        result.contacts = contactsStatus.status === 'granted';
      }
    } catch (e) {
      console.log('[expo-contacts] check error:', e);
    }

    result.allGranted =
      result.location &&
      result.camera &&
      result.audio &&
      result.media &&
      result.contacts;
  } catch (e) {
    console.log('[Permissions] Check error:', e);
  }

  return result;
}
