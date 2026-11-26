import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import Colors from '../../constants/Colors';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';

type TabType = 'jadwal' | 'kalender' | 'mapel';

interface ScheduleItem {
  id: string;
  day: string;
  subjectName: string;
  teacherName: string;
  startTime: string;
  endTime: string;
  roomName: string;
  className: string;
}

interface CalendarEvent {
  id: string;
  title: string;
  dateRange: string;
  type: 'academic' | 'holiday' | 'exam' | 'meeting';
  description: string;
  status?: string;
}

interface SubjectItem {
  id: string;
  name: string;
  category: string;
  teacherName: string;
  hoursPerWeek: number;
  kkm: number;
}

const formatEventDateRange = (startDateStr: string, endDateStr?: string) => {
  if (!startDateStr) return '';
  try {
    const months = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    const sDate = new Date(startDateStr);
    if (isNaN(sDate.getTime())) return startDateStr;
    const sD = sDate.getDate();
    const sM = months[sDate.getMonth()];
    const sY = sDate.getFullYear();

    if (!endDateStr || startDateStr.slice(0, 10) === endDateStr.slice(0, 10)) {
      return `${sD < 10 ? '0' + sD : sD} ${sM} ${sY}`;
    }

    const eDate = new Date(endDateStr);
    if (isNaN(eDate.getTime())) return `${sD < 10 ? '0' + sD : sD} ${sM} ${sY}`;
    const eD = eDate.getDate();
    const eM = months[eDate.getMonth()];
    const eY = eDate.getFullYear();

    if (sY === eY && sM === eM) {
      return `${sD < 10 ? '0' + sD : sD} - ${eD < 10 ? '0' + eD : eD} ${sM} ${sY}`;
    } else if (sY === eY) {
      return `${sD < 10 ? '0' + sD : sD} ${sM.slice(0, 3)} - ${eD < 10 ? '0' + eD : eD} ${eM.slice(0, 3)} ${sY}`;
    } else {
      return `${sD < 10 ? '0' + sD : sD} ${sM.slice(0, 3)} ${sY} - ${eD < 10 ? '0' + eD : eD} ${eM.slice(0, 3)} ${eY}`;
    }
  } catch (_) {
    return startDateStr;
  }
};

const getTodayDayName = () => {
  const dayIndex = new Date().getDay(); // 0: Min, 1: Sen, 2: Sel, 3: Rab, 4: Kam, 5: Jum, 6: Sab
  const map = ['Senin', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  return map[dayIndex] || 'Senin';
};

const mapDayNumber = (val: any) => {
  if (!val && val !== 0) return 'Senin';
  if (typeof val === 'string' && isNaN(Number(val))) {
    const v = val.trim().toLowerCase();
    if (v.startsWith('sen')) return 'Senin';
    if (v.startsWith('sel')) return 'Selasa';
    if (v.startsWith('rab')) return 'Rabu';
    if (v.startsWith('kam')) return 'Kamis';
    if (v.startsWith('jum')) return 'Jumat';
    if (v.startsWith('sab')) return 'Sabtu';
    if (v.startsWith('min')) return 'Minggu';
    return val;
  }
  const num = Number(val);
  const days = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
  return days[num] || 'Senin';
};

export default function AkademikScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<TabType>('jadwal');
  const [selectedDay, setSelectedDay] = useState<string>(getTodayDayName());
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);

  const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

  useEffect(() => {
    fetchAcademicData();
  }, []);

  const fetchAcademicData = async () => {
    try {
      const apiUrl = await SecureStore.getItemAsync('sipena_api_url');
      const token = await SecureStore.getItemAsync('sipena_token');
      const storedUser = await SecureStore.getItemAsync('sipena_user');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      if (apiUrl && token) {
        try {
          const [resSched, resSubj, resCal] = await Promise.allSettled([
            axios.get(`${apiUrl}/api/schedules`, { headers }),
            axios.get(`${apiUrl}/api/subjects`, { headers }),
            axios.get(`${apiUrl}/api/academic-calendars`, { headers }),
          ]);

          if (resSched.status === 'fulfilled' && resSched.value.data?.data) {
            const apiSched = resSched.value.data.data.map((s: any) => ({
              id: s.id?.toString() || Math.random().toString(),
              day: s.day_of_week ? mapDayNumber(s.day_of_week) : (s.day ? mapDayNumber(s.day) : 'Senin'),
              subjectName: s.subject?.name || 'Mata Pelajaran',
              teacherName: s.teacher?.name || 'Guru Pengampu',
              startTime: s.start_time ? s.start_time.slice(0, 5) : '07:15',
              endTime: s.end_time ? s.end_time.slice(0, 5) : '08:45',
              roomName: s.room || 'R-01',
              className: s.class?.name || '-',
              classId: s.class_id ? String(s.class_id) : undefined,
              teacherId: s.teacher_id ? String(s.teacher_id) : undefined,
            }));

            // Filter strict sesuai kelas siswa / jadwal guru dari master data
            let filteredSchedules = apiSched;
            if (storedUser) {
              const u = JSON.parse(storedUser);
              const r = (u.role || '').toLowerCase();
              let sClassId = u.class_id ? String(u.class_id) : null;
              let sClassName = u.class_name || null;

              if ((r.includes('siswa') || r.includes('student')) && !sClassId) {
                try {
                  const resMe = await axios.get(`${apiUrl}/api/students/me`, { headers });
                  const meData = resMe.data?.data || resMe.data;
                  const enr = meData?.enrollments?.[0];
                  if (enr?.class_id) {
                    sClassId = String(enr.class_id);
                    sClassName = enr.class?.name || null;
                  } else if (meData?.class_id) {
                    sClassId = String(meData.class_id);
                    sClassName = meData.class_name || meData.class?.name || null;
                  }
                } catch (_) {}
              }

              if (sClassId) {
                filteredSchedules = apiSched.filter((sc: any) => String(sc.classId) === String(sClassId));
              } else if (sClassName) {
                filteredSchedules = apiSched.filter((sc: any) => (sc.className || '').toLowerCase() === sClassName?.toLowerCase());
              } else if (u.teacher_id) {
                filteredSchedules = apiSched.filter((sc: any) => String(sc.teacherId) === String(u.teacher_id));
              }
            }

            setSchedules(filteredSchedules);
          } else {
            setSchedules([]);
          }

          if (resSubj.status === 'fulfilled' && resSubj.value.data?.data) {
            const apiSubj = resSubj.value.data.data.map((sb: any) => ({
              id: sb.id?.toString() || Math.random().toString(),
              name: sb.name || 'Mata Pelajaran',
              category: sb.group || 'Umum',
              teacherName: sb.teacher?.name || 'Guru Bidang Studi',
              hoursPerWeek: Number(sb.hours_per_week || sb.hours || 2),
              kkm: Number(sb.kkm || 75),
            }));
            setSubjects(apiSubj);
          } else {
            setSubjects([]);
          }

          if (resCal.status === 'fulfilled' && resCal.value.data) {
            const rawList = Array.isArray(resCal.value.data?.data)
              ? resCal.value.data.data
              : (Array.isArray(resCal.value.data) ? resCal.value.data : []);
            const apiEvents: CalendarEvent[] = rawList.map((c: any) => ({
              id: c.id ? String(c.id) : Math.random().toString(),
              title: c.title || 'Agenda Pendidikan',
              dateRange: formatEventDateRange(c.start_date, c.end_date),
              type: (c.event_type === 'exam' || c.event_type === 'holiday' || c.event_type === 'meeting') ? c.event_type : 'academic',
              description: c.description || '',
              status: c.status || 'upcoming',
            }));
            setEvents(apiEvents);
          }
        } catch (_) {}
      }

    } catch (e: any) {
      console.warn('Academic fetch error:', e.message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchAcademicData();
  };

  const daySchedules = schedules.filter(s => s.day === selectedDay);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <View style={styles.yearBadge}>
            <Ionicons name="school" size={12} color="#0B8A7D" />
            <Text style={styles.yearBadgeText}>T.A 2026/2027 • SEMESTER GANJIL</Text>
          </View>
          <Text style={styles.headerTitle}>Portal Akademik</Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh}>
          <Ionicons name="reload" size={18} color={Colors.text} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'jadwal' && styles.tabButtonActive]}
          onPress={() => setActiveTab('jadwal')}
        >
          <Ionicons name="time-outline" size={16} color={activeTab === 'jadwal' ? '#0B8A7D' : Colors.textLight} />
          <Text style={[styles.tabText, activeTab === 'jadwal' && styles.tabTextActive]}>Jadwal Pelajaran</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'kalender' && styles.tabButtonActive]}
          onPress={() => setActiveTab('kalender')}
        >
          <Ionicons name="calendar-outline" size={16} color={activeTab === 'kalender' ? '#0B8A7D' : Colors.textLight} />
          <Text style={[styles.tabText, activeTab === 'kalender' && styles.tabTextActive]}>Kalender</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'mapel' && styles.tabButtonActive]}
          onPress={() => setActiveTab('mapel')}
        >
          <Ionicons name="book-outline" size={16} color={activeTab === 'mapel' ? '#0B8A7D' : Colors.textLight} />
          <Text style={[styles.tabText, activeTab === 'mapel' && styles.tabTextActive]}>Mata Pelajaran</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#0B8A7D" />
          <Text style={styles.loadingText}>Memuat kalender akademik...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={['#0B8A7D']} />}
          showsVerticalScrollIndicator={false}
        >
          {/* TAB 1: JADWAL */}
          {activeTab === 'jadwal' && (
            <View>
              {/* Day Selector Pills */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayScroll}>
                {days.map(d => (
                  <TouchableOpacity
                    key={d}
                    style={[styles.dayPill, selectedDay === d && styles.dayPillActive]}
                    onPress={() => setSelectedDay(d)}
                  >
                    <Text style={[styles.dayPillText, selectedDay === d && styles.dayPillTextActive]}>{d}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.sectionHeaderTitle}>Jadwal Pelajaran Hari {selectedDay}</Text>

              {daySchedules.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Ionicons name="cafe-outline" size={40} color={Colors.textLight} />
                  <Text style={styles.emptyTitle}>Tidak Ada Kegiatan Belajar</Text>
                  <Text style={styles.emptySub}>Tidak ada jam pelajaran aktif di hari {selectedDay}.</Text>
                </View>
              ) : (
                daySchedules.map((item, index) => (
                  <View key={item.id} style={styles.scheduleCard}>
                    <View style={styles.timeColumn}>
                      <Text style={styles.startTime}>{item.startTime}</Text>
                      <View style={styles.timeLine} />
                      <Text style={styles.endTime}>{item.endTime}</Text>
                    </View>

                    <View style={styles.schedDetails}>
                      <View style={styles.schedTopRow}>
                        <View style={styles.roomBadge}>
                          <Ionicons name="location" size={10} color="#0B8A7D" />
                          <Text style={styles.roomText}>{item.roomName}</Text>
                        </View>
                        <Text style={styles.classText}>{item.className}</Text>
                      </View>
                      <Text style={styles.subjectTitle}>{item.subjectName}</Text>
                      <Text style={styles.teacherName}>Pengajar: {item.teacherName}</Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}

          {/* TAB 2: KALENDER */}
          {activeTab === 'kalender' && (
            <View>
              <Text style={styles.sectionHeaderTitle}>Kalender Pendidikan Sekolah</Text>
              <Text style={styles.sectionSubtitle}>Agenda kegiatan belajar, pekan ujian, serta libur akademik resmi.</Text>

              {events.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Ionicons name="calendar-outline" size={40} color={Colors.textLight} />
                  <Text style={styles.emptyTitle}>Belum Ada Agenda</Text>
                  <Text style={styles.emptySub}>Tidak ada agenda kalender akademik yang dijadwalkan.</Text>
                </View>
              ) : (
                events.map(ev => {
                  const isExam = ev.type === 'exam';
                  const isHoliday = ev.type === 'holiday';
                  const isMeeting = ev.type === 'meeting';
                  const badgeColor = isExam ? '#EF4444' : isHoliday ? '#F59E0B' : isMeeting ? '#8B5CF6' : '#0B8A7D';
                  const badgeBg = isExam ? '#FEF2F2' : isHoliday ? '#FFFBEB' : isMeeting ? '#F5F3FF' : '#E6F4F1';
                  const badgeLabel = isExam ? 'PEKAN UJIAN' : isHoliday ? 'LIBUR RESMI' : isMeeting ? 'RAPAT / DINAS' : 'AGENDA AKADEMIK';

                  return (
                    <View key={ev.id} style={styles.eventCard}>
                      <View style={styles.eventHeader}>
                        <View style={[styles.eventBadge, { backgroundColor: badgeBg }]}>
                          <Text style={[styles.eventBadgeText, { color: badgeColor }]}>
                            {badgeLabel}
                          </Text>
                        </View>
                        <Text style={styles.eventRange}>{ev.dateRange}</Text>
                      </View>

                      <Text style={styles.eventTitle}>{ev.title}</Text>
                      {ev.description ? <Text style={styles.eventDesc}>{ev.description}</Text> : null}
                    </View>
                  );
                })
              )}
            </View>
          )}

          {/* TAB 3: MATA PELAJARAN */}
          {activeTab === 'mapel' && (
            <View>
              <Text style={styles.sectionHeaderTitle}>Struktur Kurikulum & Mata Pelajaran</Text>
              <Text style={styles.sectionSubtitle}>Daftar alokasi beban jam mengajar dan Kriteria Ketercapaian Tujuan Pembelajaran (KKM).</Text>

              {subjects.map(subj => (
                <View key={subj.id} style={styles.subjectCard}>
                  <View style={styles.subjHeader}>
                    <Text style={styles.subjName}>{subj.name}</Text>
                    <View style={styles.kkmBadge}>
                      <Text style={styles.kkmText}>KKM: {subj.kkm}</Text>
                    </View>
                  </View>
                  <Text style={styles.subjCategory}>{subj.category}</Text>
                  <Text style={styles.subjTeacher}>Pengampu: {subj.teacherName}</Text>
                  <View style={styles.subjFooter}>
                    <Ionicons name="time" size={14} color={Colors.textLight} />
                    <Text style={styles.hoursText}>{subj.hoursPerWeek} Jam Pelajaran (JP) / Minggu</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
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
  yearBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E6F4F1',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 2,
  },
  yearBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0B8A7D',
    letterSpacing: 0.5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
  },
  refreshBtn: {
    padding: 6,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  tabButtonActive: {
    backgroundColor: '#E6F4F1',
    borderWidth: 1,
    borderColor: '#99D5CE',
  },
  tabText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textLight,
  },
  tabTextActive: {
    color: '#0B8A7D',
  },
  loadingBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: Colors.textLight,
  },
  scrollContent: {
    padding: 16,
  },
  dayScroll: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  dayPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  dayPillActive: {
    backgroundColor: '#0B8A7D',
    borderColor: '#0B8A7D',
  },
  dayPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textLight,
  },
  dayPillTextActive: {
    color: '#FFFFFF',
  },
  sectionHeaderTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: Colors.textLight,
    marginBottom: 14,
    lineHeight: 18,
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 36,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 10,
  },
  emptySub: {
    fontSize: 12,
    color: Colors.textLight,
    marginTop: 4,
  },
  scheduleCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 14,
  },
  timeColumn: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 50,
  },
  startTime: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0B8A7D',
  },
  timeLine: {
    width: 2,
    height: 18,
    backgroundColor: '#E6F4F1',
    marginVertical: 2,
  },
  endTime: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textLight,
  },
  schedDetails: {
    flex: 1,
  },
  schedTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  roomBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#E6F4F1',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  roomText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0B8A7D',
  },
  classText: {
    fontSize: 11,
    color: Colors.textLight,
  },
  subjectTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  teacherName: {
    fontSize: 11,
    color: Colors.textLight,
    marginTop: 2,
  },
  eventCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  eventBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  eventBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  eventRange: {
    fontSize: 11,
    color: Colors.textLight,
    fontWeight: '600',
  },
  eventTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  eventDesc: {
    fontSize: 12,
    color: '#4B5563',
    marginTop: 4,
    lineHeight: 18,
  },
  subjectCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  subjHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subjName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    flex: 1,
  },
  kkmBadge: {
    backgroundColor: '#E6F4F1',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  kkmText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0B8A7D',
  },
  subjCategory: {
    fontSize: 11,
    color: '#0B8A7D',
    fontWeight: '600',
    marginTop: 2,
  },
  subjTeacher: {
    fontSize: 12,
    color: Colors.textLight,
    marginTop: 2,
  },
  subjFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  hoursText: {
    fontSize: 11,
    color: Colors.textLight,
  },
});
