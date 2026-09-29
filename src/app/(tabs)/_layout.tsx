import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import Colors from '../../constants/Colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconHome, IconAkademik, IconKeuangan, IconNotifikasi, IconProfil } from '../../components/ui/TabIcons';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textLight,
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: Colors.border,
          backgroundColor: Colors.white,
          height: Platform.OS === 'ios' ? 60 + insets.bottom : 65 + insets.bottom,
          paddingBottom: Platform.OS === 'ios' ? insets.bottom : insets.bottom + 10,
          paddingTop: 10,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
          marginTop: 2,
        }
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Beranda',
          tabBarIcon: ({ color, focused }) => <IconHome color={color as string} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="akademik"
        options={{
          title: 'Akademik',
          tabBarIcon: ({ color, focused }) => <IconAkademik color={color as string} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="keuangan"
        options={{
          title: 'Keuangan',
          tabBarIcon: ({ color, focused }) => <IconKeuangan color={color as string} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="notifikasi"
        options={{
          title: 'Notifikasi',
          tabBarIcon: ({ color, focused }) => <IconNotifikasi color={color as string} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profil"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, focused }) => <IconProfil color={color as string} focused={focused} />,
        }}
      />
    </Tabs>
  );
}
