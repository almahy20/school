import React from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useClasses } from '@/hooks/useClasses';
import { Text, Card, Avatar, Badge } from '@/components/ui';
import { Colors } from '@/constants/Colors';
import { Layout } from '@/constants/Layout';

const { width } = Dimensions.get('window');

export default function TeacherDashboard() {
  const { user }   = useAuth();
  const { colors } = useTheme();
  const router     = useRouter();
  const insets     = useSafeAreaInsets();
  const { data: classes, isLoading } = useClasses();

  const totalStudents = classes?.reduce((sum, c) => sum + (c.studentCount ?? 0), 0) ?? 0;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12, backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.headerInner}>
          <View style={{ flex: 1 }}>
            <Text variant="caption" muted>مرحباً،</Text>
            <Text variant="h4" weight="black" numberOfLines={1}>{user?.fullName}</Text>
          </View>
          <Avatar name={user?.fullName ?? ''} size="md" />
        </View>
        <Badge label="معلم" variant="info" size="sm" style={{ marginTop: 8 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
      >
        {/* Summary Cards */}
        <View style={styles.summaryRow}>
          <Card style={styles.summaryCard}>
            <Ionicons name="school" size={28} color={Colors.primary[500]} />
            <Text variant="h2" weight="black" style={{ marginTop: 8 }}>{classes?.length ?? 0}</Text>
            <Text variant="caption" muted>فصولي</Text>
          </Card>
          <Card style={styles.summaryCard}>
            <Ionicons name="people" size={28} color="#8b5cf6" />
            <Text variant="h2" weight="black" style={{ marginTop: 8 }}>{totalStudents}</Text>
            <Text variant="caption" muted>طلابي</Text>
          </Card>
        </View>

        {/* My Classes */}
        <View style={styles.section}>
          <Text variant="h4" weight="bold" style={styles.sectionTitle}>فصولي الدراسية</Text>
          {classes?.map((cls) => (
            <Card
              key={cls.id}
              style={styles.classCard}
              onPress={() => router.push(`/class/${cls.id}` as any)}
            >
              <View style={styles.classRow}>
                <View style={[styles.classIcon, { backgroundColor: Colors.primary[50] }]}>
                  <Ionicons name="school-outline" size={22} color={Colors.primary[500]} />
                </View>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text variant="label" weight="bold">{cls.name}</Text>
                  {cls.gradeLevel && (
                    <Text variant="caption" muted style={{ marginTop: 2 }}>{cls.gradeLevel}</Text>
                  )}
                </View>
                <View style={styles.classRight}>
                  <Text variant="h4" weight="black" style={{ color: Colors.primary[500] }}>
                    {cls.studentCount ?? 0}
                  </Text>
                  <Text variant="caption" muted>طالب</Text>
                </View>
                <Ionicons name="chevron-back" size={16} color={colors.icon} style={{ marginRight: 4 }} />
              </View>
            </Card>
          ))}
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text variant="h4" weight="bold" style={styles.sectionTitle}>إجراءات سريعة</Text>
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: Colors.primary[500] }]}
              onPress={() => router.push('/attendance')}
            >
              <Ionicons name="calendar-outline" size={22} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700', marginTop: 6 }}>تسجيل الحضور</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#8b5cf6' }]}
              onPress={() => router.push('/classes')}
            >
              <Ionicons name="create-outline" size={22} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700', marginTop: 6 }}>إدخال الدرجات</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:        { flex: 1 },
  header:      { paddingHorizontal: Layout.spacing[4], paddingBottom: 12, borderBottomWidth: 1 },
  headerInner: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
  scroll:      { padding: Layout.spacing[4], gap: Layout.spacing[5] },
  summaryRow:  { flexDirection: 'row-reverse', gap: Layout.spacing[3] },
  summaryCard: { flex: 1, alignItems: 'center', paddingVertical: Layout.spacing[5] },
  section:     { gap: Layout.spacing[3] },
  sectionTitle:{ marginBottom: 4 },
  classCard:   { padding: Layout.spacing[3] },
  classRow:    { flexDirection: 'row-reverse', alignItems: 'center' },
  classIcon:   { width: 44, height: 44, borderRadius: Layout.radius.lg, alignItems: 'center', justifyContent: 'center' },
  classRight:  { alignItems: 'center', marginLeft: 8 },
  actionsRow:  { flexDirection: 'row-reverse', gap: Layout.spacing[3] },
  actionBtn:   {
    flex:           1,
    height:         90,
    borderRadius:   Layout.radius.xl,
    alignItems:     'center',
    justifyContent: 'center',
    gap:            4,
    ...Layout.shadows.md,
  },
});
