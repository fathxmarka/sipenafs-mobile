import Constants from 'expo-constants';

export interface AppUpdateInfo {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseName: string;
  releaseNotes: string;
  downloadUrl: string;
}

/**
 * Membandingkan 2 string versi (misal: "1.0.1" vs "1.0.0")
 * Return true jika remoteVersion lebih besar dari currentVersion
 */
export function isNewerVersion(remoteVersion: string, currentVersion: string): boolean {
  if (!remoteVersion || !currentVersion) return false;

  // Bersihkan karakter non-numerik di awal (misal 'v1.0.1' -> '1.0.1')
  const cleanRemote = remoteVersion.replace(/^v/i, '').trim();
  const cleanCurrent = currentVersion.replace(/^v/i, '').trim();

  const rParts = cleanRemote.split('.').map((p) => parseInt(p, 10) || 0);
  const cParts = cleanCurrent.split('.').map((p) => parseInt(p, 10) || 0);

  const maxLength = Math.max(rParts.length, cParts.length);
  for (let i = 0; i < maxLength; i++) {
    const r = rParts[i] || 0;
    const c = cParts[i] || 0;
    if (r > c) return true;
    if (r < c) return false;
  }

  return false;
}

/**
 * Mengecek ketersediaan rilis APK terbaru dari GitHub Releases
 */
export async function checkForAppUpdate(): Promise<AppUpdateInfo | null> {
  try {
    const currentVersion = Constants.expoConfig?.version || '1.0.0';
    const GITHUB_REPO = 'fathxmarka/sipenafs-mobile';
    const apiUrl = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000); // 6 detik timeout

    const res = await fetch(apiUrl, {
      signal: controller.signal,
      headers: {
        Accept: 'application/vnd.github.v3+json',
      },
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      // Jika repo belum ada rilis atau status 404, lewati tanpa error
      return null;
    }

    const data = await res.json();
    if (!data || !data.tag_name) {
      return null;
    }

    const latestVersion = data.tag_name;
    const hasUpdate = isNewerVersion(latestVersion, currentVersion);

    if (!hasUpdate) {
      return {
        hasUpdate: false,
        currentVersion,
        latestVersion,
        releaseName: data.name || latestVersion,
        releaseNotes: data.body || '',
        downloadUrl: '',
      };
    }

    // Cari file APK di daftar assets rilis GitHub
    let apkDownloadUrl = '';
    if (Array.isArray(data.assets) && data.assets.length > 0) {
      const apkAsset = data.assets.find((asset: any) =>
        asset.name && asset.name.toLowerCase().endsWith('.apk')
      );
      if (apkAsset && apkAsset.browser_download_url) {
        apkDownloadUrl = apkAsset.browser_download_url;
      } else if (data.assets[0].browser_download_url) {
        apkDownloadUrl = data.assets[0].browser_download_url;
      }
    }

    // Fallback jika belum upload asset, buka halaman rilis
    if (!apkDownloadUrl) {
      apkDownloadUrl = data.html_url || `https://github.com/${GITHUB_REPO}/releases/latest`;
    }

    return {
      hasUpdate: true,
      currentVersion,
      latestVersion,
      releaseName: data.name || `Pembaruan Versi ${latestVersion}`,
      releaseNotes: data.body || 'Peningkatan stabilitas dan fitur terbaru aplikasi SIPENAFS.',
      downloadUrl: apkDownloadUrl,
    };
  } catch (error) {
    // Silent fail agar aplikasi tetap bisa berjalan normal saat offline
    console.log('[UpdateService] Check update error (offline or timeout):', error);
    return null;
  }
}
