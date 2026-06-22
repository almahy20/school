import React from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { COLLECTIONS } from '@/lib/firebase/collections';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Text, Card, Avatar, Badge } from '@/components/ui';
import { Colors } from '@/constants/Colors';
import { Layout } from '@/constants/Layout';

export default function ParentDashboard() {
  const { user }   = useAuth();
  const { colors } = useTheme();
  const router     = useRouter();
  const insets     = useSafeAreaInsets();

  // Fetch parent's children
  const { data: children, isLoading } = useQuery({
    queryKey: ['parent-children', user?.id],
    enabled:  !!user?.id,
    queryFn:  async () => {
      // Get student IDs linked to this parent
      const spSnap = await getDocs(query(
        collection(db, COLLECTIONS.STUDENT_PARENTS),
        where('parentId', '==', user!.id),
      ));
      const studentIds = spSnap.docs.map(d => d.data().studentId as string);
      if (studentIds.length === 0) return [];

      // Fetch students
      const studentsSnap = await getDocs(query(
        collection(db, COLLECTIONS.STUDENTS),
        where('schoolId', '==', user!.schoolId),
        where('id', 'in', studentIds.slice(0, 10)) // Firestore 'in' limit is 10
      ));

      return studentsSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));
    },
  });

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12, backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.headerInner}>
          <View style={{ flex: 1 }}>
            <Text variant="caption" muted>مرحباً،</Text>
            <Text variant="h4" weight="black" numberOfLines={1}>{user?.fullName}</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[styles.headerBtn, { backgroundColor: colors.input }]}
              onPress={() => router.push('/messages')}
            >
              <Ionicons name="chatbubble-outline" size={20} color={colors.icon} />
            </TouchableOpacity>
            <Avatar name={user?.fullName ?? ''} size="md" />
          </View>
        </View>
        <Badge label="ولي أمر" variant="success" size="sm" style={{ marginTop: 8 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
      >
        {/* Children */}
        <View style={styles.section}>
          <Text variant="h4" weight="bold" style={styles.sectionTitle}>أبنائي</Text>

          {children?.length === 0 && (
            <Card style={styles.emptyCard}>
              <Ionicons name="people-outline" size={40} color={colors.icon} />
              <Text variant="body" muted align="center" style={{ marginTop: 12 }}>
                لم يتم ربط أي طالب بحسابك بعد
              </Text>
              <Text variant="caption" muted align="center" style={{ marginTop: 4 }}>
                تواصل مع إدارة المدرسة لربط أبنائك
              </Text>
            </Card>
          )}

          {children?.map((child: any) => (
            <Card
              key={child.id}
              style={styles.childCard}
              onPress={() => router.push(`/child/${child.id}` as any)}
            >
              <View style={styles.childRow}>
                <Avatar name={child.name} size="lg" />
                <View style={{ flex: 1, marginRight: 14 }}>
                  <Text variant="h4" weight="bold">{child.name}</Text>
                  {child.className && (
                    <Text variant="caption" muted style={{ marginTop: 2 }}>{child.className}</Text>
                  )}
                  <View style={styles.childActions}>
                    <TouchableOpacity
                      style={[styles.childActionBtn, { backgroundColor: Colors.primary[50] }]}
                      onPress={() => router.push(`/child/${child.id}/grades` as any)}
                    >
                      <Ionicons name="ribbon-outline" size={14} color={Colors.primary[500]} />
                      <Text style={{ fontSize: 11, color: Colors.primary[600], fontWeight: '700', marginRight: 3 }}>الدرجات</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.childActionBtn, { backgroundColor: Colors.success.light }]}
                      onPress={() => router.push(`/child/${child.id}/attendance` as any)}
                    >
                      <Ionicons name="calendar-outline" size={14} color={Colors.success.dark} />
                      <Text style={{ fontSize: 11, color: Colors.success.dark, fontWeight: '700', marginRight: 3 }}>الحضور</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <Ionicons name="chevron-back" size={18} color={colors.icon} />
              </View>
            </Card>
          ))}
        </View>

        {/* Quick Links */}
        <View style={styles.section}>
          <Text variant="h4" weight="bold" style={styles.sectionTitle}>روابط سريعة</Text>
          <View style={styles.linksGrid}>
            {[
              { icon: 'chatbubble-outline' as const, label: 'الرسائل',  color: Colors.info.main,    bg: Colors.info.light,    route: '/messages'   },
              { icon: 'megaphone-outline'  as const, label: 'الشكاوى',  color: Colors.error.main,   bg: Colors.error.light,   route: '/complaints' },
              { icon: 'settings-outline'   as const, label: 'الإعدادات', color: colors.icon,         bg: colors.input,         route: '/settings'       },
            ].map((link) => (
              <TouchableOpacity
                key={link.label}
                style={[styles.linkBtn, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
                onPress={() => router.push(link.route as any)}
                activeOpacity={0.8}
              >
                <View style={[styles.linkIcon, { backgroundColor: link.bg }]}>
                  <Ionicons name={link.icon} size={22} color={link.color} />
                </View>
                <Text variant="caption" weight="semibold" align="center" style={{ marginTop: 8 }}>
                  {link.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:         { flex: 1 },
  header:       { paddingHorizontal: Layout.spacing[4], paddingBottom: 12, borderBottomWidth: 1 },
  headerInner:  { flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
  headerActions:{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
  headerBtn:    { width: 40, height: 40, borderRadius: Layout.radius.md, alignItems: 'center', justifyContent: 'center' },
  scroll:       { padding: Layout.spacing[4], gap: Layout.spacing[5] },
  section:      { gap: Layout.spacing[3] },
  sectionTitle: { marginBottom: 4 },
  emptyCard:    { alignItems: 'center', paddingVertical: Layout.spacing[8] },
  childCard:    { padding: Layout.spacing[4] },
  childRow:     { flexDirection: 'row-reverse', alignItems: 'center' },
  childActions: { flexDirection: 'row-reverse', gap: 8, marginTop: 10 },
  childActionBtn:{ flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: Layout.radius.full, gap: 3 },
  linksGrid:    { flexDirection: 'row-reverse', gap: Layout.spacing[3] },
  linkBtn:      { flex: 1, alignItems: 'center', paddingVertical: Layout.spacing[4], borderRadius: Layout.radius.xl, borderWidth: 1, ...Layout.shadows.sm },
  linkIcon:     { width: 48, height: 48, borderRadius: Layout.radius.lg, alignItems: 'center', justifyContent: 'center' },
});
