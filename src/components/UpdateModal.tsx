import React, { useState, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { AppUpdateInfo } from '../services/updateService';

interface UpdateModalProps {
  visible: boolean;
  updateInfo: AppUpdateInfo | null;
  onDismiss: () => void;
}

export const UpdateModal: React.FC<UpdateModalProps> = ({
  visible,
  updateInfo,
  onDismiss,
}) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0); // 0.0 to 1.0
  const [downloadedBytesStr, setDownloadedBytesStr] = useState('0 MB');
  const [totalBytesStr, setTotalBytesStr] = useState('0 MB');
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [downloadedFileUri, setDownloadedFileUri] = useState<string | null>(null);

  const downloadTaskRef = useRef<FileSystem.DownloadResumable | null>(null);

  if (!updateInfo || !updateInfo.hasUpdate) {
    return null;
  }

  const handleStartDownload = async () => {
    if (!updateInfo.downloadUrl) return;

    setIsDownloading(true);
    setDownloadProgress(0);
    setDownloadSuccess(false);

    try {
      const fileUri = `${FileSystem.documentDirectory}sipenafs-update.apk`;

      // Hapus file lama jika ada agar bersih
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(fileUri, { idempotent: true });
      }

      const callback = (data: FileSystem.DownloadProgressData) => {
        const written = data.totalBytesWritten;
        const total = data.totalBytesExpectedToWrite;
        if (total > 0) {
          const progress = Math.min(Math.max(written / total, 0), 1);
          setDownloadProgress(progress);
          setDownloadedBytesStr((written / (1024 * 1024)).toFixed(1) + ' MB');
          setTotalBytesStr((total / (1024 * 1024)).toFixed(1) + ' MB');
        }
      };

      const downloadResumable = FileSystem.createDownloadResumable(
        updateInfo.downloadUrl,
        fileUri,
        {},
        callback
      );
      downloadTaskRef.current = downloadResumable;

      const result = await downloadResumable.downloadAsync();
      if (result && result.uri) {
        setDownloadedFileUri(result.uri);
        setDownloadSuccess(true);
        setDownloadProgress(1);

        // Langsung panggil installer Android di layar
        await triggerInstallation(result.uri);
      }
    } catch (error: any) {
      console.log('[UpdateModal] In-app download error:', error);
      Alert.alert(
        'Gagal Mengunduh',
        'Terjadi kendala saat mengunduh berkas pembaruan. Anda dapat mencoba lagi atau membuka unduhan manual.',
        [
          {
            text: 'Batal',
            style: 'cancel',
            onPress: () => {
              setIsDownloading(false);
              setDownloadProgress(0);
            },
          },
          {
            text: 'Unduh Manual',
            onPress: () => {
              setIsDownloading(false);
              Linking.openURL(updateInfo.downloadUrl);
            },
          },
        ]
      );
      setIsDownloading(false);
    }
  };

  const triggerInstallation = async (apkUri: string) => {
    try {
      const contentUri = await FileSystem.getContentUriAsync(apkUri);

      // FLAG_GRANT_READ_URI_PERMISSION (1) | FLAG_ACTIVITY_NEW_TASK (268435456) = 268435457
      // FLAG_ACTIVITY_NEW_TASK diperlukan agar Package Installer bisa berjalan di task terpisah
      const intentFlags = 268435457;

      try {
        // Coba dulu dengan action INSTALL_PACKAGE (lebih reliable untuk install APK)
        await IntentLauncher.startActivityAsync('android.intent.action.INSTALL_PACKAGE', {
          data: contentUri,
          flags: intentFlags,
          type: 'application/vnd.android.package-archive',
        });
      } catch (_installErr) {
        // Fallback ke VIEW action jika INSTALL_PACKAGE tidak tersedia
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: contentUri,
          flags: intentFlags,
          type: 'application/vnd.android.package-archive',
        });
      }
    } catch (err: any) {
      console.log('[UpdateModal] Intent launch error:', err);
      Alert.alert(
        'Izin Pemasangan',
        'Sistem Android memerlukan izin untuk memasang pembaruan. Pastikan izin "Install unknown apps" aktif untuk SIPENAFS.',
        [
          { text: 'Tutup', style: 'cancel' },
          {
            text: 'Unduh via Browser',
            onPress: () => Linking.openURL(updateInfo.downloadUrl),
          },
        ]
      );
    }
  };

  const handleCancelDownload = async () => {
    try {
      if (downloadTaskRef.current) {
        await downloadTaskRef.current.pauseAsync();
        downloadTaskRef.current = null;
      }
    } catch (_) {}
    setIsDownloading(false);
    setDownloadProgress(0);
  };

  const handleDismissModal = () => {
    if (isDownloading && !downloadSuccess) {
      Alert.alert(
        'Batalkan Unduhan?',
        'Proses pengunduhan pembaruan sedang berjalan. Yakin ingin membatalkannya?',
        [
          { text: 'Lanjutkan Unduh', style: 'cancel' },
          {
            text: 'Batalkan',
            style: 'destructive',
            onPress: () => {
              handleCancelDownload();
              onDismiss();
            },
          },
        ]
      );
      return;
    }
    onDismiss();
  };

  const percentage = Math.round(downloadProgress * 100);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleDismissModal}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Header Icon */}
          <View style={[styles.iconCircle, downloadSuccess && styles.iconCircleSuccess]}>
            {downloadSuccess ? (
              <Ionicons name="checkmark-circle" size={34} color="#059669" />
            ) : isDownloading ? (
              <ActivityIndicator size="small" color="#0D9488" />
            ) : (
              <Ionicons name="cloud-download" size={32} color="#0D9488" />
            )}
          </View>

          <Text style={styles.title}>
            {downloadSuccess
              ? 'Unduhan Siap Dipasang!'
              : isDownloading
              ? 'Mengunduh Pembaruan...'
              : 'Pembaruan Tersedia!'}
          </Text>

          <Text style={styles.subtitle}>
            {downloadSuccess
              ? 'Berkas telah selesai diunduh. Ketuk tombol pasang untuk memperbarui aplikasi.'
              : isDownloading
              ? 'Harap tunggu, proses unduh sedang berjalan tanpa keluar dari aplikasi.'
              : 'Versi terbaru aplikasi SIPENAFS telah dirilis.'}
          </Text>

          {/* Version Comparison Badge */}
          {!isDownloading && !downloadSuccess && (
            <View style={styles.versionContainer}>
              <View style={styles.versionBadgeOld}>
                <Text style={styles.versionBadgeOldText}>v{updateInfo.currentVersion}</Text>
              </View>
              <Ionicons name="arrow-forward" size={16} color="#94A3B8" style={{ marginHorizontal: 8 }} />
              <View style={styles.versionBadgeNew}>
                <Text style={styles.versionBadgeNewText}>v{updateInfo.latestVersion.replace(/^v/i, '')}</Text>
              </View>
            </View>
          )}

          {/* DOWNLOADING STATE: PROGRESS BAR */}
          {isDownloading && (
            <View style={styles.progressContainer}>
              <View style={styles.progressLabelRow}>
                <Text style={styles.progressPercentText}>{percentage}%</Text>
                <Text style={styles.progressBytesText}>
                  {downloadedBytesStr} / {totalBytesStr !== '0 MB' ? totalBytesStr : '50 MB'}
                </Text>
              </View>

              {/* Progress Bar Track & Fill */}
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${percentage}%` },
                    downloadSuccess && styles.progressFillSuccess,
                  ]}
                />
              </View>

              <Text style={styles.progressHint}>
                {downloadSuccess
                  ? 'Menyiapkan pemasangan otomatis...'
                  : 'Jangan tutup aplikasi selama proses pengunduhan.'}
              </Text>
            </View>
          )}

          {/* RELEASE NOTES (Only visible when not downloading) */}
          {!isDownloading && !downloadSuccess && (
            <View style={styles.notesBox}>
              <View style={styles.notesHeader}>
                <Ionicons name="document-text-outline" size={15} color="#0D9488" style={{ marginRight: 6 }} />
                <Text style={styles.notesTitle}>Catatan Pembaruan:</Text>
              </View>
              <ScrollView
                style={styles.notesScroll}
                showsVerticalScrollIndicator={true}
              >
                <Text style={styles.releaseNameText}>{updateInfo.releaseName}</Text>
                <Text style={styles.notesContent}>
                  {updateInfo.releaseNotes.trim() || 'Peningkatan performa, perbaikan bugs, dan kestabilan sistem aplikasi.'}
                </Text>
              </ScrollView>
            </View>
          )}

          {/* ACTIONS */}
          <View style={styles.actions}>
            {downloadSuccess ? (
              <>
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={() => downloadedFileUri && triggerInstallation(downloadedFileUri)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="checkmark-done-circle-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.primaryBtnText}>Pasang Sekarang</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.dismissBtn}
                  onPress={onDismiss}
                  activeOpacity={0.7}
                >
                  <Text style={styles.dismissBtnText}>Tutup</Text>
                </TouchableOpacity>
              </>
            ) : isDownloading ? (
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={handleCancelDownload}
                activeOpacity={0.7}
              >
                <Ionicons name="close-circle-outline" size={18} color="#EF4444" style={{ marginRight: 6 }} />
                <Text style={styles.cancelBtnText}>Batalkan Unduhan</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={handleStartDownload}
                  activeOpacity={0.8}
                >
                  <Ionicons name="download-outline" size={19} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.primaryBtnText}>Perbarui Sekarang</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.dismissBtn}
                  onPress={onDismiss}
                  activeOpacity={0.7}
                >
                  <Text style={styles.dismissBtnText}>Nanti Saja</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingVertical: 24,
    paddingHorizontal: 22,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 12,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#CCFBF1',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconCircleSuccess: {
    backgroundColor: '#D1FAE5',
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 12.5,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 8,
    lineHeight: 18,
  },
  versionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  versionBadgeOld: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  versionBadgeOldText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  versionBadgeNew: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  versionBadgeNewText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
  },
  notesBox: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 18,
  },
  notesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  notesTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  notesScroll: {
    maxHeight: 120,
  },
  releaseNameText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0D9488',
    marginBottom: 4,
  },
  notesContent: {
    fontSize: 11.5,
    color: '#475569',
    lineHeight: 17,
  },
  progressContainer: {
    width: '100%',
    backgroundColor: '#F0FDFA',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#CCFBF1',
    padding: 16,
    marginBottom: 20,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 10,
  },
  progressPercentText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0D9488',
  },
  progressBytesText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  progressTrack: {
    width: '100%',
    height: 10,
    backgroundColor: '#E2E8F0',
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#0D9488',
    borderRadius: 5,
  },
  progressFillSuccess: {
    backgroundColor: '#10B981',
  },
  progressHint: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  actions: {
    width: '100%',
    gap: 8,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0D9488',
    paddingVertical: 13,
    borderRadius: 12,
    shadowColor: '#0D9488',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingVertical: 11,
    borderRadius: 12,
  },
  cancelBtnText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '700',
  },
  dismissBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  dismissBtnText: {
    color: '#94A3B8',
    fontSize: 12.5,
    fontWeight: '600',
  },
});
