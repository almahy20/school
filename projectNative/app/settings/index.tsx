import React from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Switch, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Text, Card, ScreenHeader, Avatar, Button } from '@/components/ui';
import { Colors } from '@/constants/Colors';
import { Layout } from '@/constants/Layout';

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const { colors, isDark, toggleTheme } = useTheme();
  const insets = useSafeAreaInsets();

  const isAdmin = user?.role === 'admin' || user?.isSuperAdmin;

  const sections = [
    {
      title: 'الحساب',
      items: [
        { id: 'profile', icon: 'person-outline', label: 'تعديل الملف الشخصي', type: 'link' },
        { id: 'password', icon: 'lock-closed-outline', label: 'تغيير كلمة المرور', type: 'link' },
      ]
    },
    {
      title: 'التطبيق',
      items: [
        { id: 'theme', icon: isDark ? 'moon-outline' : 'sunny-outline', label: 'الوضع الداكن', type: 'switch', value: isDark, onValueChange: toggleTheme },
        { id: 'notifications', icon: 'notifications-outline', label: 'الإشعارات', type: 'switch', value: true, onValueChange: () => {} },
        { id: 'language', icon: 'language-outline', label: 'اللغة', type: 'link', value: 'العربية' },
      ]
    },
    ...(isAdmin ? [{
      title: 'المدرسة',
      items: [
        { id: 'school-info', icon: 'school-outline', label: 'بيانات المدرسة', type: 'link' },
        { id: 'subscription', icon: 'card-outline', label: 'الاشتراك والباقات', type: 'link' },
      ]
    }] : []),
    {
      title: 'الدعم',
      items: [
        { id: 'help', icon: 'help-circle-outline', label: 'مركز المساعدة', type: 'link' },
        { id: 'about', icon: 'information-circle-outline', label: 'عن التطبيق', type: 'link' },
      ]
    }
  ];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScreenHeader title="الإعدادات" showBack />

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
      >
        {/* User Info Header */}
        <View style={styles.userHeader}>
          <Avatar name={user?.fullName || ''} size="xl" />
          <Text variant="h3" weight="bold" style={{ marginTop: 12 }}>{user?.fullName}</Text>
          <Text variant="body" muted>{user?.phone}</Text>
        </View>

        {sections.map((section, idx) => (
          <View key={idx} style={styles.section}>
            <Text variant="label" weight="bold" muted style={styles.sectionTitle}>
              {section.title}
            </Text>
            <Card noPadding style={styles.sectionCard}>
              {section.items.map((item, i) => (
                <View key={item.id}>
                  <TouchableOpacity 
                    style={styles.item}
                    onPress={() => item.type === 'link' && Alert.alert('قريباً', `ميزة ${item.label} ستكون متاحة في التحديث القادم`)}
                    disabled={item.type === 'switch'}
                  >
                    <View style={[styles.iconBox, { backgroundColor: colors.input }]}>
                      <Ionicons name={item.icon as any} size={20} color={colors.icon} />
                    </View>
                    <Text variant="body" weight="medium" style={{ flex: 1, marginRight: 12 }}>
                      {item.label}
                    </Text>
                    {item.type === 'switch' ? (
                      <Switch 
                        value={item.value as boolean} 
                        onValueChange={item.onValueChange}
                        trackColor={{ false: colors.border, true: Colors.primary[300] }}
                        thumbColor={item.value ? Colors.primary[500] : '#f4f3f4'}
                      />
                    ) : (
                      <View style={{ flexDirection: 'row-reverse', alignItems: 'center' }}>
                        {typeof item.value === 'string' && (
                          <Text variant="caption" muted style={{ marginLeft: 8 }}>{item.value}</Text>
                        )}
                        <Ionicons name="chevron-back" size={16} color={colors.icon} />
                      </View>
                    )}
                  </TouchableOpacity>
                  {i < section.items.length - 1 && (
                    <View style={[styles.separator, { backgroundColor: colors.border }]} />
                  )}
                </View>
              ))}
            </Card>
          </View>
        ))}

        <Button
          title="تسجيل الخروج"
          onPress={logout}
          variant="outline"
          fullWidth
          size="lg"
          style={{ marginTop: 24, borderColor: Colors.error.main }}
          color={Colors.error.main}
          icon={<Ionicons name="log-out-outline" size={20} color={Colors.error.main} />}
        />
        
        <Text variant="caption" muted align="center" style={{ marginTop: 16 }}>
          نظام إدارة المدارس - إصدار 1.0.0
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:         { flex: 1 },
  scroll:       { padding: Layout.spacing[4] },
  userHeader:   { alignItems: 'center', marginVertical: 24 },
  section:      { marginBottom: 20 },
  sectionTitle: { marginBottom: 8, marginRight: 4, textTransform: 'uppercase' },
  sectionCard:  { overflow: 'hidden' },
  item:         { flexDirection: 'row-reverse', alignItems: 'center', padding: Layout.spacing[4] },
  iconBox:      { width: 36, height: 36, borderRadius: Layout.radius.md, alignItems: 'center', justifyContent: 'center' },
  separator:    { height: 1, marginHorizontal: Layout.spacing[4] },
});
