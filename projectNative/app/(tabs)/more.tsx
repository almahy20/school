import React from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Text, Card, Avatar, Badge } from '@/components/ui';
import { Colors } from '@/constants/Colors';
import { Layout } from '@/constants/Layout';

type MenuItem = {
  icon:    keyof typeof Ionicons.glyphMap;
  label:   string;
  desc?:   string;
  color:   string;
  bg:      string;
  route?:  string;
  action?: () => void;
  badge?:  string;
};

export default function MoreScreen() {
  const { user, logout } = useAuth();
  const { colors, isDark, toggleTheme } = useTheme();
  const router  = useRouter();
  const insets  = useSafeAreaInsets();

  const handleLogout = () => {
    Alert.alert('تسجيل الخروج', 'هل تريد تسجيل الخروج؟', [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'خروج', style: 'destructive', onPress: logout },
    ]);
  };

  const roleLabel = user?.isSuperAdmin ? 'المشرف العام'
    : user?.role === 'admin'   ? 'مدير النظام'
    : user?.role === 'teacher' ? 'معلم'
    : 'ولي أمر';

  const roleVariant = user?.isSuperAdmin ? 'warning'
    : user?.role === 'admin'   ? 'primary'
    : user?.role === 'teacher' ? 'info'
    : 'success';

  // Build menu based on role
  const adminMenus: MenuItem[][] = [
    [
      { icon: 'people-outline',      label: 'إدارة الطلاب',    color: Colors.primary[500], bg: Colors.primary[50],  route: '/students'  },
      { icon: 'person-outline',      label: 'إدارة المعلمين',  color: '#8b5cf6',           bg: '#ede9fe',           route: '/teachers'         },
      { icon: 'people-circle-outline',label: 'أولياء الأمور',  color: Colors.success.main, bg: Colors.success.light, route: '/parents'         },
      { icon: 'school-outline',      label: 'الفصول',          color: Colors.info.main,    bg: Colors.info.light,   route: '/classes'   },
    ],
    [
      { icon: 'calendar-outline',    label: 'حضور المعلمين',   color: Colors.warning.main, bg: Colors.warning.light, route: '/teacher-attendance' },
      { icon: 'card-outline',        label: 'المصروفات',       color: Colors.error.main,   bg: Colors.error.light,  route: '/fees'             },
      { icon: 'megaphone-outline',   label: 'الشكاوى',         color: '#f59e0b',           bg: '#fef3c7',           route: '/complaints' },
      { icon: 'send-outline',        label: 'بث الرسائل',      color: Colors.info.main,    bg: Colors.info.light,   route: '/messages'    },
    ],
    [
      { icon: 'bar-chart-outline',   label: 'التقارير',        color: Colors.primary[500], bg: Colors.primary[50],  route: '/reports'   },
      { icon: 'settings-outline',    label: 'الإعدادات',       color: colors.icon,         bg: colors.input,        route: '/settings'         },
    ],
  ];

  const teacherMenus: MenuItem[][] = [
    [
      { icon: 'school-outline',      label: 'فصولي',           color: Colors.primary[500], bg: Colors.primary[50],  route: '/classes'   },
      { icon: 'calendar-outline',    label: 'تسجيل الحضور',    color: Colors.success.main, bg: Colors.success.light, route: '/attendance' },
    ],
    [
      { icon: 'settings-outline',    label: 'الإعدادات',       color: colors.icon,         bg: colors.input,        route: '/settings'         },
    ],
  ];

  const parentMenus: MenuItem[][] = [
    [
      { icon: 'chatbubble-outline',  label: 'الرسائل',         color: Colors.info.main,    bg: Colors.info.light,   route: '/messages'  },
      { icon: 'megaphone-outline',   label: 'الشكاوى',         color: Colors.error.main,   bg: Colors.error.light,  route: '/complaints' },
    ],
    [
      { icon: 'settings-outline',    label: 'الإعدادات',       color: colors.icon,         bg: colors.input,        route: '/settings'         },
    ],
  ];

  const menus = user?.role === 'admin' || user?.isSuperAdmin
    ? adminMenus
    : user?.role === 'teacher'
    ? teacherMenus
    : parentMenus;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12, backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Text variant="h3" weight="black">المزيد</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
      >
        {/* Profile Card */}
        <Card style={styles.profileCard} elevated>
          <View style={styles.profileRow}>
            <Avatar name={user?.fullName ?? ''} size="lg" />
            <View style={{ flex: 1, marginRight: 14 }}>
              <Text variant="h4" weight="bold">{user?.fullName}</Text>
              <Text variant="caption" muted style={{ marginTop: 2 }}>{user?.phone}</Text>
              <Badge label={roleLabel} variant={roleVariant as any} size="sm" style={{ marginTop: 6 }} />
            </View>
            <TouchableOpacity
              style={[styles.editBtn, { backgroundColor: colors.input }]}
              onPress={() => router.push('/settings' as any)}
            >
              <Ionicons name="pencil-outline" size={16} color={colors.icon} />
            </TouchableOpacity>
          </View>
          {user?.schoolName && (
            <View style={[styles.schoolRow, { borderTopColor: colors.border }]}>
              <Ionicons name="school-outline" size={14} color={Colors.primary[500]} />
              <Text variant="caption" style={{ color: Colors.primary[600], marginRight: 4, fontWeight: '600' }}>
                {user.schoolName}
              </Text>
            </View>
          )}
        </Card>

        {/* Menu Sections */}
        {menus.map((section, si) => (
          <Card key={si} noPadding style={styles.menuCard}>
            {section.map((item, ii) => (
              <TouchableOpacity
                key={item.label}
                style={[
                  styles.menuItem,
                  ii < section.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                ]}
                onPress={() => item.route ? router.push(item.route as any) : item.action?.()}
                activeOpacity={0.7}
              >
                <View style={[styles.menuIcon, { backgroundColor: item.bg }]}>
                  <Ionicons name={item.icon} size={18} color={item.color} />
                </View>
                <Text variant="body" weight="medium" style={{ flex: 1, marginRight: 12 }}>
                  {item.label}
                </Text>
                {item.badge && (
                  <Badge label={item.badge} variant="error" size="sm" style={{ marginLeft: 8 }} />
                )}
                <Ionicons name="chevron-back" size={16} color={colors.icon} />
              </TouchableOpacity>
            ))}
          </Card>
        ))}

        {/* Theme Toggle */}
        <Card noPadding style={styles.menuCard}>
          <TouchableOpacity style={styles.menuItem} onPress={toggleTheme} activeOpacity={0.7}>
            <View style={[styles.menuIcon, { backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }]}>
              <Ionicons name={isDark ? 'moon' : 'sunny'} size={18} color={isDark ? '#818cf8' : '#f59e0b'} />
            </View>
            <Text variant="body" weight="medium" style={{ flex: 1, marginRight: 12 }}>
              {isDark ? 'الوضع الداكن' : 'الوضع الفاتح'}
            </Text>
            <View style={[styles.toggle, { backgroundColor: isDark ? Colors.primary[500] : colors.border }]}>
              <View style={[styles.toggleThumb, isDark && styles.toggleThumbActive]} />
            </View>
          </TouchableOpacity>
        </Card>

        {/* Logout */}
        <TouchableOpacity
          style={[styles.logoutBtn, { backgroundColor: Colors.error.light }]}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <Ionicons name="log-out-outline" size={20} color={Colors.error.main} />
          <Text style={{ color: Colors.error.main, fontWeight: '700', fontSize: 15, marginRight: 8 }}>
            تسجيل الخروج
          </Text>
        </TouchableOpacity>

        <Text variant="caption" muted align="center" style={{ marginTop: 8 }}>
          الإصدار 1.0.0
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:         { flex: 1 },
  header:       { paddingHorizontal: Layout.spacing[4], paddingBottom: 12, borderBottomWidth: 1 },
  scroll:       { padding: Layout.spacing[4], gap: Layout.spacing[4] },
  profileCard:  { padding: Layout.spacing[4] },
  profileRow:   { flexDirection: 'row-reverse', alignItems: 'center' },
  editBtn:      { width: 36, height: 36, borderRadius: Layout.radius.md, alignItems: 'center', justifyContent: 'center' },
  schoolRow:    { flexDirection: 'row-reverse', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTopWidth: 1, gap: 4 },
  menuCard:     { overflow: 'hidden' },
  menuItem:     { flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: Layout.spacing[4], paddingVertical: Layout.spacing[4] },
  menuIcon:     { width: 36, height: 36, borderRadius: Layout.radius.md, alignItems: 'center', justifyContent: 'center' },
  toggle:       { width: 44, height: 24, borderRadius: 12, padding: 2, justifyContent: 'center' },
  toggleThumb:  { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', alignSelf: 'flex-end' },
  toggleThumbActive: { alignSelf: 'flex-start' },
  logoutBtn:    { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', height: 52, borderRadius: Layout.radius.xl, gap: 8 },
});
