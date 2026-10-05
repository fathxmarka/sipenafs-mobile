import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
  if (!updateInfo || !updateInfo.hasUpdate) {
    return null;
  }

  const handleUpdate = async () => {
    if (!updateInfo.downloadUrl) return;
    try {
      await Linking.openURL(updateInfo.downloadUrl);
    } catch (err) {
      console.log('[UpdateModal] Error opening download url:', err);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Header Icon */}
          <View style={styles.iconCircle}>
            <Ionicons name="cloud-download" size={32} color="#0D9488" />
          </View>

          <Text style={styles.title}>Pembaruan Tersedia!</Text>
          <Text style={styles.subtitle}>
            Versi terbaru aplikasi SIPENAFS telah dirilis.
          </Text>

          {/* Version Comparison Badge */}
          <View style={styles.versionContainer}>
            <View style={styles.versionBadgeOld}>
              <Text style={styles.versionBadgeOldText}>v{updateInfo.currentVersion}</Text>
            </View>
            <Ionicons name="arrow-forward" size={16} color="#94A3B8" style={{ marginHorizontal: 8 }} />
            <View style={styles.versionBadgeNew}>
              <Text style={styles.versionBadgeNewText}>v{updateInfo.latestVersion.replace(/^v/i, '')}</Text>
            </View>
          </View>

          {/* Release Notes */}
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

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={handleUpdate}
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
    paddingVertical: 22,
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
  title: {
    fontSize: 19,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 14,
    paddingHorizontal: 10,
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
