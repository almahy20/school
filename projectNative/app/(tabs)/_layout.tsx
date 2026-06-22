import React from 'react';
import { View, Platform, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Colors } from '@/constants/Colors';
import { Layout } from '@/constants/Layout';
import { Text } from '@/components/ui';

// ── Tab Config per Role ───────────────────────────────────────────────────────
type TabItem = {
  name:  string;
  title: string;
  icon:  keyof typeof Ionicons.glyphMap;
  iconFocused: keyof typeof Ionicons.glyphMap;
};

const adminTabs: TabItem[] = [
  { name: 'index',       title: 'الرئيسية',  icon: 'home-outline',          iconFocused: 'home'           },
  { name: 'students',    title: 'الطلاب',    icon: 'people-outline',         iconFocused: 'people'         },
  { name: 'classes',     title: 'الفصول',    icon: 'school-outline',         iconFocused: 'school'         },
  { name: 'reports',     title: 'التقارير',  icon: 'bar-chart-outline',      iconFocused: 'bar-chart'      },
  { name: 'more',        title: 'المزيد',    icon: 'grid-outline',           iconFocused: 'grid'           },
];

const teacherTabs: TabItem[] = [
  { name: 'index',       title: 'الرئيسية',  icon: 'home-outline',          iconFocused: 'home'           },
  { name: 'classes',     title: 'فصولي',     icon: 'school-outline',         iconFocused: 'school'         },
  { name: 'attendance',  title: 'الحضور',    icon: 'calendar-outline',       iconFocused: 'calendar'       },
  { name: 'more',        title: 'المزيد',    icon: 'grid-outline',           iconFocused: 'grid'           },
];

const parentTabs: TabItem[] = [
  { name: 'index',       title: 'الرئيسية',  icon: 'home-outline',          iconFocused: 'home'           },
  { name: 'children',    title: 'أبنائي',    icon: 'people-outline',         iconFocused: 'people'         },
  { name: 'messages',    title: 'الرسائل',   icon: 'chatbubble-outline',     iconFocused: 'chatbubble'     },
  { name: 'complaints',  title: 'الشكاوى',   icon: 'megaphone-outline',      iconFocused: 'megaphone'      },
  { name: 'more',        title: 'المزيد',    icon: 'grid-outline',           iconFocused: 'grid'           },
];

// ── Custom Tab Bar Icon ───────────────────────────────────────────────────────
function TabIcon({
  name,
  focused,
  label,
  badge,
}: {
  name: keyof typeof Ionicons.glyphMap;
  focused: boolean;
  label: string;
  badge?: number;
}) {
  const { colors } = useTheme();
  const color = focused ? Colors.primary[500] : colors.icon;

  return (
    <View style={tabStyles.iconWrap}>
      <View style={[tabStyles.iconInner, focused && tabStyles.iconActive]}>
        <Ionicons name={name} size={22} color={color} />
        {badge && badge > 0 ? (
          <View style={tabStyles.badge}>
            <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800' }}>
              {badge > 99 ? '99+' : badge}
            </Text>
          </View>
        ) : null}
      </View>
      <Text style={[tabStyles.label, { color }]}>{label}</Text>
    </View>
  );
}

const tabStyles = StyleSheet.create({
  iconWrap: {
    alignItems:     'center',
    justifyContent: 'center',
    paddingTop:     6,
    gap:            3,
  },
  iconInner: {
    width:          44,
    height:         32,
    borderRadius:   16,
    alignItems:     'center',
    justifyContent: 'center',
    position:       'relative',
  },
  iconActive: {
    backgroundColor: Colors.primary[50],
  },
  label: {
    fontSize:   10,
    fontWeight: '600',
  },
  badge: {
    position:        'absolute',
    top:             -2,
    left:            -2,
    minWidth:        16,
    height:          16,
    borderRadius:    8,
    backgroundColor: Colors.error.main,
    alignItems:      'center',
    justifyContent:  'center',
    paddingHorizontal: 3,
  },
});

// ── Tabs Layout ───────────────────────────────────────────────────────────────
export default function TabsLayout() {
  const { user }   = useAuth();
  const { colors } = useTheme();
  const insets     = useSafeAreaInsets();

  const tabs = user?.isSuperAdmin
    ? adminTabs
    : user?.role === 'admin'
    ? adminTabs
    : user?.role === 'teacher'
    ? teacherTabs
    : parentTabs;

  // All possible tab names — hidden ones just won't appear in the bar
  const allTabNames = ['index', 'students', 'classes', 'attendance', 'children', 'messages', 'complaints', 'reports', 'more'];

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor:  colors.tabBar,
          borderTopColor:   colors.tabBarBorder,
          borderTopWidth:   1,
          height:           Layout.heights.tabBar + insets.bottom,
          paddingBottom:    insets.bottom,
          ...Platform.select({
            web: {
              boxShadow: 'none',
              borderTopWidth: 1,
            },
            default: {
              elevation: 0,
              shadowOpacity: 0,
            },
          }),
        },
        tabBarShowLabel: false,
        tabBarActiveTintColor: Colors.primary[500],
        tabBarInactiveTintColor: colors.icon,
      }}
    >
      {allTabNames.map((tabName) => {
        const tabConfig = tabs.find((t) => t.name === tabName);
        const isVisible = !!tabConfig;

        return (
          <Tabs.Screen
            key={tabName}
            name={tabName}
            options={{
              href:    isVisible ? undefined : null,
              tabBarIcon: ({ focused }) =>
                tabConfig ? (
                  <TabIcon
                    name={focused ? tabConfig.iconFocused : tabConfig.icon}
                    focused={focused}
                    label={tabConfig.title}
                  />
                ) : null,
            }}
          />
        );
      })}
    </Tabs>
  );
}
