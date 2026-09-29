import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Colors from '../../constants/Colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Button } from '../../components/ui/Button';

export default function ProfilScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const handleLogout = () => {
    router.replace('/login');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom }]}>
      {/* Avatar */}
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>BS</Text>
      </View>
      <Text style={styles.name}>Budi Santoso</Text>
      <Text style={styles.info}>Kelas IX-A - SMP Negeri 1</Text>
      <Text style={styles.info}>NIS: 202310001</Text>

      <View style={styles.spacer} />

      <Button
        title="Keluar / Logout"
        onPress={handleLogout}
        variant="outline"
        style={styles.logoutBtn}
        textStyle={{ color: Colors.danger }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    padding: 20,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
    marginTop: 20,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  name: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 5,
  },
  info: {
    fontSize: 14,
    color: Colors.textLight,
    marginBottom: 2,
  },
  spacer: {
    flex: 1,
  },
  logoutBtn: {
    width: '100%',
    borderColor: Colors.danger,
    marginBottom: 20,
  },
});
