import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../../constants/Colors';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';

type FilterType = 'all' | 'presensi' | 'nilai' | 'spp' | 'pengumuman';

interface NotificationItem {
  id: string;
  type: 'presensi' | 'nilai' | 'spp' | 'pengumuman';
  title: string;
  body: string;
  time: string;
  isRead: boolean;
}

export default function NotifikasiScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    setIsLoading(true);
    try {
      const apiUrl = await SecureStore.getItemAsync('sipena_api_url');
      const token = await SecureStore.getItemAsync('sipena_token');
      if (apiUrl && token) {
        const headers = { Authorization: `Bearer ${token}` };
        try {
          const res = await axios.get(`${apiUrl}/api/announcements`, { headers });
          if (res.data && res.data.success && Array.isArray(res.data.data)) {
            const items = res.data.data.map((item: any, idx: number) => ({
              id: item.id?.toString() || idx.toString(),
              type: 'pengumuman' as const,
              title: item.title || 'Pengumuman Sekolah',
              body: item.content || item.description || '',
              time: item.created_at || 'Hari ini',
              isRead: false,
            }));
            setNotifications(items);
          } else {
            setNotifications([]);
          }
        } catch (_) {
          setNotifications([]);
        }
      }
    } catch (e: any) {
      console.warn('Failed to load notifications:', e.message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchNotifications();
  };

  const handleMarkAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const handlePressItem = (id: string) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, isRead: true } : n))
    );
  };

  const filteredList = notifications.filter(n => {
    if (activeFilter === 'all') return true;
    return n.type === activeFilter;
  });

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const getTypeStyle = (type: string) => {
    switch (type) {
      case 'presensi':
        return { icon: 'time' as const, color: '#10B981', bg: '#ECFDF5' };
      case 'nilai':
        return { icon: 'ribbon' as const, color: '#3B82F6', bg: '#EFF6FF' };
      case 'spp':
      case 'keuangan':
        return { icon: 'card' as const, color: '#EF4444', bg: '#FEF2F2' };
      default:
        return { icon: 'megaphone' as const, color: '#F59E0B', bg: '#FFFBEB' };
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerSubtitle}>Pusat Notifikasi & Info</Text>
          <View style={styles.titleRow}>
            <Text style={styles.headerTitle}>Notifikasi</Text>
            {unreadCount > 0 && (
              <View style={styles.unreadCountBadge}>
                <Text style={styles.unreadCountText}>{unreadCount} Baru</Text>
              </View>
            )}
          </View>
        </View>
        <TouchableOpacity style={styles.markReadBtn} onPress={handleMarkAllRead}>
          <Ionicons name="checkmark-done" size={16} color="#0B8A7D" />
          <Text style={styles.markReadBtnText}>Tandai Dibaca</Text>
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterBarWrapper}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          contentContainerStyle={styles.filterBarContent}
        >
          {[
            { id: 'all', label: 'Semua' },
            { id: 'presensi', label: 'Presensi' },
            { id: 'nilai', label: 'Nilai & Tugas' },
            { id: 'spp', label: 'SPP / Keuangan' },
            { id: 'pengumuman', label: 'Pengumuman' },
          ].map(tab => (
            <TouchableOpacity
              key={tab.id}
              style={[styles.filterPill, activeFilter === tab.id && styles.filterPillActive]}
              onPress={() => setActiveFilter(tab.id as FilterType)}
              activeOpacity={0.7}
            >
              <Text style={[styles.filterPillText, activeFilter === tab.id && styles.filterPillTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* List */}
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={['#0B8A7D']} />}
        showsVerticalScrollIndicator={false}
      >
        {filteredList.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="notifications-off-outline" size={48} color={Colors.textLight} />
            <Text style={styles.emptyTitle}>Tidak Ada Notifikasi</Text>
            <Text style={styles.emptySub}>Semua pemberitahuan telah Anda baca.</Text>
          </View>
        ) : (
          filteredList.map(item => {
            const styleInfo = getTypeStyle(item.type);
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.notifCard, !item.isRead && styles.notifCardUnread]}
                onPress={() => handlePressItem(item.id)}
                activeOpacity={0.7}
              >
                <View style={[styles.notifIconWrapper, { backgroundColor: styleInfo.bg }]}>
                  <Ionicons name={styleInfo.icon} size={20} color={styleInfo.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.notifTopRow}>
                    <Text style={styles.notifTitle}>{item.title}</Text>
                    {!item.isRead && <View style={styles.unreadDot} />}
                  </View>
                  <Text style={styles.notifBody}>{item.body}</Text>
                  <Text style={styles.notifTime}>{item.time}</Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#0B8A7D',
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
  },
  unreadCountBadge: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  unreadCountText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  markReadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E6F4F1',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  markReadBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0B8A7D',
  },
  filterBarWrapper: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  filterBarContent: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
    flexDirection: 'row',
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterPillActive: {
    backgroundColor: '#0B8A7D',
    borderColor: '#0B8A7D',
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 12,
  },
  emptySub: {
    fontSize: 12,
    color: Colors.textLight,
    marginTop: 4,
  },
  notifCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 12,
  },
  notifCardUnread: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  notifIconWrapper: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notifTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  notifTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0B8A7D',
    marginLeft: 6,
  },
  notifBody: {
    fontSize: 12,
    color: '#4B5563',
    marginTop: 4,
    lineHeight: 18,
  },
  notifTime: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 6,
  },
});
