import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { AppPermissionsStatus } from '../utils/permissions';

interface PermissionModalProps {
  visible: boolean;
  permissions: AppPermissionsStatus;
  onRequestPermissions: () => void;
  onDismiss: () => void;
}

export const PermissionModal: React.FC<PermissionModalProps> = ({
  visible,
  permissions,
  onRequestPermissions,
  onDismiss,
}) => {
  const hasDenied =
    !permissions.location ||
    !permissions.camera ||
    !permissions.audio ||
    !permissions.media;

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
            <Ionicons name="shield-checkmark" size={30} color="#0D9488" />
          </View>

          <Text style={styles.title}>Izin Akses Aplikasi</Text>
          <Text style={styles.subtitle}>
            Untuk kelancaran operasional presensi, verifikasi wajah, KBM, dan sinkronisasi data, SIPENAFS memerlukan izin berikut:
          </Text>

          {/* Permission Items with ScrollView to prevent overflow on smaller screens */}
          <ScrollView
            style={styles.scrollList}
            contentContainerStyle={styles.itemsList}
            showsVerticalScrollIndicator={false}
          >
            {/* 1. GPS / Location */}
            <View style={styles.itemRow}>
              <View
                style={[
                  styles.itemIconBox,
                  { backgroundColor: permissions.location ? '#ECFDF5' : '#FEF3C7' },
                ]}
              >
                <Ionicons
                  name="location"
                  size={19}
                  color={permissions.location ? '#059669' : '#D97706'}
                />
              </View>
              <View style={styles.itemContent}>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemTitle}>GPS & Lokasi</Text>
                  <View
                    style={[
                      styles.badge,
                      { backgroundColor: permissions.location ? '#D1FAE5' : '#FEE2E2' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.badgeText,
                        { color: permissions.location ? '#065F46' : '#991B1B' },
                      ]}
                    >
                      {permissions.location ? 'Aktif' : 'Belum Aktif'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.itemDesc}>
                  Validasi titik koordinat radius presensi masuk/pulang dan jurnal KBM.
                </Text>
              </View>
            </View>

            {/* 2. Camera */}
            <View style={styles.itemRow}>
              <View
                style={[
                  styles.itemIconBox,
                  { backgroundColor: permissions.camera ? '#ECFDF5' : '#FEF3C7' },
                ]}
              >
                <Ionicons
                  name="camera"
                  size={19}
                  color={permissions.camera ? '#059669' : '#D97706'}
                />
              </View>
              <View style={styles.itemContent}>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemTitle}>Kamera</Text>
                  <View
                    style={[
                      styles.badge,
                      { backgroundColor: permissions.camera ? '#D1FAE5' : '#FEE2E2' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.badgeText,
                        { color: permissions.camera ? '#065F46' : '#991B1B' },
                      ]}
                    >
                      {permissions.camera ? 'Aktif' : 'Belum Aktif'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.itemDesc}>
                  Verifikasi presensi wajah (face verification) dan scan barcode QR.
                </Text>
              </View>
            </View>

            {/* 3. Audio / Microphone */}
            <View style={styles.itemRow}>
              <View
                style={[
                  styles.itemIconBox,
                  { backgroundColor: permissions.audio ? '#ECFDF5' : '#FEF3C7' },
                ]}
              >
                <Ionicons
                  name="mic"
                  size={19}
                  color={permissions.audio ? '#059669' : '#D97706'}
                />
              </View>
              <View style={styles.itemContent}>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemTitle}>Audio & Mikrofon</Text>
                  <View
                    style={[
                      styles.badge,
                      { backgroundColor: permissions.audio ? '#D1FAE5' : '#FEE2E2' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.badgeText,
                        { color: permissions.audio ? '#065F46' : '#991B1B' },
                      ]}
                    >
                      {permissions.audio ? 'Aktif' : 'Belum Aktif'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.itemDesc}>
                  Rekaman suara materi KBM dan komunikasi audio modul pembelajaran.
                </Text>
              </View>
            </View>

            {/* 4. Media / Photos & Storage */}
            <View style={styles.itemRow}>
              <View
                style={[
                  styles.itemIconBox,
                  { backgroundColor: permissions.media ? '#ECFDF5' : '#FEF3C7' },
                ]}
              >
                <Ionicons
                  name="images"
                  size={19}
                  color={permissions.media ? '#059669' : '#D97706'}
                />
              </View>
              <View style={styles.itemContent}>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemTitle}>Media & Penyimpanan</Text>
                  <View
                    style={[
                      styles.badge,
                      { backgroundColor: permissions.media ? '#D1FAE5' : '#FEE2E2' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.badgeText,
                        { color: permissions.media ? '#065F46' : '#991B1B' },
                      ]}
                    >
                      {permissions.media ? 'Aktif' : 'Belum Aktif'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.itemDesc}>
                  Akses foto galeri & penyimpanan dokumen materi tugas atau jurnal mengajar.
                </Text>
              </View>
            </View>

          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.actions}>
            {hasDenied ? (
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={onRequestPermissions}
                activeOpacity={0.8}
              >
                <Ionicons name="shield" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.primaryBtnText}>Izinkan Semua Akses</Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => {
                if (Platform.OS === 'android') {
                  Linking.openSettings();
                } else {
                  Linking.openURL('app-settings:');
                }
              }}
              activeOpacity={0.7}
            >
              <Feather name="settings" size={15} color="#475569" style={{ marginRight: 6 }} />
              <Text style={styles.secondaryBtnText}>Buka Pengaturan HP</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dismissBtn}
              onPress={onDismiss}
              activeOpacity={0.7}
            >
              <Text style={styles.dismissBtnText}>Lanjutkan ke Aplikasi</Text>
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
    backgroundColor: 'rgba(15, 23, 42, 0.68)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    paddingVertical: 20,
    paddingHorizontal: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 10,
  },
  iconCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#CCFBF1',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 11.5,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 14,
    paddingHorizontal: 6,
  },
  scrollList: {
    width: '100%',
    maxHeight: 390,
    marginBottom: 16,
  },
  itemsList: {
    gap: 10,
    paddingVertical: 2,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  itemIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  itemContent: {
    flex: 1,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  itemTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#1E293B',
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  itemDesc: {
    fontSize: 10.5,
    color: '#64748B',
    lineHeight: 14,
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
    paddingVertical: 12,
    borderRadius: 12,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    paddingVertical: 9,
    borderRadius: 10,
  },
  secondaryBtnText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '600',
  },
  dismissBtn: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  dismissBtnText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
});
