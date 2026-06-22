import React from 'react';
import {
  View, ScrollView, StyleSheet, RefreshControl,
  TouchableOpacity, Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useAdminStats } from '@/hooks/useAdminStats';
import { useComplaints } from '@/hooks/useComplaints';
import { Text, Card, StatCard, Avatar, Badge, LoadingScreen } from '@/components/ui';
import { Colors } from '@/constants/Colors';
import { Layout } from '@/constants/Layout';

const { width } = Dimensions.get('window');

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const { colors }       = useTheme();
  const router           = useRouter();
  const insets           = useSafeAreaInsets();

  const { data: stats,      isLoading: statsLoading,      refetch: refetchStats }      = useAdminStats();
  const { data: complaints, isLoading: complaintsLoading, refetch: refetchComplaints } = useComplaints('pending');

  const isLoading = statsLoading || complaintsLoading;
  const onRefresh = () => { refetchStats(); refetchComplaints(); };

  // Quick actions
  const quickActions = [
    { icon: 'person-add-outline' as const, label: 'إضافة طالب',   color: Colors.primary[500],  bg: Colors.primary[50],  route: '/student/new' },
    { icon: 'school-outline'     as const, label: 'الفصول',        color: '#8b5cf6',             bg: '#ede9fe',           route: '/(tabs)/classes'  },
    { icon: 'calendar-outline'   as const, label: 'حضور المعلمين', color: Colors.success.main,   bg: Colors.success.light, route: '/teacher-attendance' },
    { icon: 'card-outline'       as const, label: 'المصروفات',     color: Colors.warning.main,   bg: Colors.warning.light, route: '/fees'             },
    { icon: 'megaphone-outline'  as const, label: 'الشكاوى',       color: Colors.error.main,     bg: Colors.error.light,  route: '/complaints' },
    { icon: 'bar-chart-outline'  as const, label: 'التقارير',      color: Colors.info.main,      bg: Colors.info.light,   route: '/reports' },
  ];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12, backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.headerInner}>
          {/* Right: greeting */}
          <View style={{ flex: 1 }}>
            <Text variant="caption" muted>مرحباً بك،</Text>
            <Text variant="h4" weight="black" numberOfLines={1}>{user?.fullName}</Text>
          </View>

          {/* Left: avatar + notifications */}
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[styles.headerBtn, { backgroundColor: colors.input }]}
              onPress={() => router.push('/more')}
            >
              <Ionicons name="notifications-outline" size={20} color={colors.icon} />
              {(stats?.pendingComplaints ?? 0) > 0 && (
                <View style={styles.notifDot} />
              )}
            </TouchableOpacity>
            <Avatar name={user?.fullName ?? ''} size="md" />
          </View>
        </View>

        {/* School name */}
        <View style={styles.schoolBadge}>
          <Ionicons name="school" size={14} color={Colors.primary[500]} />
          <Text variant="caption" style={{ color: Colors.primary[600], marginRight: 4, fontWeight: '700' }}>
            {user?.schoolName ?? 'مدرستي'}
          </Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={onRefresh} tintColor={Colors.primary[500]} />}
      >
        {/* Stats Grid */}
        <View style={styles.section}>
          <Text variant="h4" weight="bold" style={styles.sectionTitle}>الإحصائيات</Text>
          <View style={styles.statsGrid}>
            <StatCard
              title="الطلاب"
              value={stats?.totalStudents ?? 0}
              icon="people"
              iconColor={Colors.primary[500]}
              iconBg={Colors.primary[50]}
              style={styles.statCard}
              onPress={() => router.push('/students')}
            />
            <StatCard
              title="المعلمون"
              value={stats?.totalTeachers ?? 0}
              icon="person"
              iconColor="#8b5cf6"
              iconBg="#ede9fe"
              style={styles.statCard}
            />
            <StatCard
              title="الحضور اليوم"
              value={`${stats?.todayAttendanceRate ?? 0}%`}
              icon="calendar-check"
              iconColor={Colors.success.main}
              iconBg={Colors.success.light}
              style={styles.statCard}
            />
            <StatCard
              title="المحصّل"
              value={`${((stats?.totalFeesCollected ?? 0) / 1000).toFixed(1)}k`}
              icon="card"
              iconColor={Colors.warning.main}
              iconBg={Colors.warning.light}
              style={styles.statCard}
              subtitle="ريال"
            />
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text variant="h4" weight="bold" style={styles.sectionTitle}>الوصول السريع</Text>
          <View style={styles.actionsGrid}>
            {quickActions.map((action) => (
              <TouchableOpacity
                key={action.label}
                style={[styles.actionBtn, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
                onPress={() => router.push(action.route as any)}
                activeOpacity={0.8}
              >
                <View style={[styles.actionIcon, { backgroundColor: action.bg }]}>
                  <Ionicons name={action.icon} size={22} color={action.color} />
                </View>
                <Text variant="caption" weight="semibold" align="center" style={{ marginTop: 8 }}>
                  {action.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Pending Complaints */}
        {(complaints?.length ?? 0) > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text variant="h4" weight="bold">الشكاوى المعلقة</Text>
              <TouchableOpacity onPress={() => router.push('/complaints')}>
                <Text variant="caption" style={{ color: Colors.primary[500], fontWeight: '700' }}>
                  عرض الكل
                </Text>
              </TouchableOpacity>
            </View>

            {complaints?.slice(0, 3).map((c) => (
              <Card key={c.id} style={styles.complaintCard}>
                <View style={styles.complaintHeader}>
                  <Avatar name={c.parentName ?? 'م'} size="sm" />
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Text variant="label" weight="bold">{c.parentName ?? 'ولي أمر'}</Text>
                    <Text variant="caption" muted numberOfLines={2} style={{ marginTop: 2 }}>
                      {c.content}
                    </Text>
                  </View>
                  <Badge label="جديد" variant="warning" size="sm" />
                </View>
              </Card>
            ))}
          </View>
        )}

        {/* Financial Summary */}
        {stats && (
          <View style={styles.section}>
            <Text variant="h4" weight="bold" style={styles.sectionTitle}>الملخص المالي</Text>
            <Card>
              <View style={styles.feeRow}>
                <View style={styles.feeItem}>
                  <Text variant="h3" weight="black" style={{ color: Colors.success.main }}>
                    {stats.totalFeesCollected.toLocaleString('ar-EG')}
                  </Text>
                  <Text variant="caption" muted>المحصّل</Text>
                </View>
                <View style={[styles.feeDivider, { backgroundColor: colors.border }]} />
                <View style={styles.feeItem}>
                  <Text variant="h3" weight="black" style={{ color: Colors.error.main }}>
                    {(stats.totalFeesDue - stats.totalFeesCollected).toLocaleString('ar-EG')}
                  </Text>
                  <Text variant="caption" muted>المتبقي</Text>
                </View>
                <View style={[styles.feeDivider, { backgroundColor: colors.border }]} />
                <View style={styles.feeItem}>
                  <Text variant="h3" weight="black">
                    {stats.totalFeesDue.toLocaleString('ar-EG')}
                  </Text>
                  <Text variant="caption" muted>الإجمالي</Text>
                </View>
              </View>

              {/* Progress bar */}
              <View style={[styles.progressBg, { backgroundColor: colors.border }]}>
                <View style={[
                  styles.progressFill,
                  {
                    width: `${stats.totalFeesDue > 0 ? (stats.totalFeesCollected / stats.totalFeesDue) * 100 : 0}%`,
                    backgroundColor: Colors.success.main,
                  },
                ]} />
              </View>
              <Text variant="caption" muted align="center" style={{ marginTop: 6 }}>
                {stats.totalFeesDue > 0
                  ? `${Math.round((stats.totalFeesCollected / stats.totalFeesDue) * 100)}% تم تحصيله`
                  : 'لا توجد رسوم'}
              </Text>
            </Card>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:         { flex: 1 },
  header:       { paddingHorizontal: Layout.spacing[4], paddingBottom: 12, borderBottomWidth: 1 },
  headerInner:  { flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
  headerActions:{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
  headerBtn:    { width: 40, height: 40, borderRadius: Layout.radius.md, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  notifDot:     { position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.error.main },
  schoolBadge:  { flexDirection: 'row-reverse', alignItems: 'center', marginTop: 8, gap: 4 },
  scroll:       { padding: Layout.spacing[4], gap: Layout.spacing[5] },
  section:      { gap: Layout.spacing[3] },
  sectionTitle: { marginBottom: 4 },
  sectionHeader:{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  statsGrid:    { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: Layout.spacing[3] },
  statCard:     { width: (width - Layout.spacing[4] * 2 - Layout.spacing[3]) / 2 },
  actionsGrid:  { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: Layout.spacing[3] },
  actionBtn:    {
    width:          (width - Layout.spacing[4] * 2 - Layout.spacing[3] * 2) / 3,
    aspectRatio:    1,
    borderRadius:   Layout.radius.xl,
    alignItems:     'center',
    justifyContent: 'center',
    borderWidth:    1,
    ...Layout.shadows.sm,
  },
  actionIcon:   { width: 48, height: 48, borderRadius: Layout.radius.lg, alignItems: 'center', justifyContent: 'center' },
  complaintCard:{ padding: Layout.spacing[3] },
  complaintHeader: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 10 },
  feeRow:       { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-around', marginBottom: 16 },
  feeItem:      { alignItems: 'center', gap: 4 },
  feeDivider:   { width: 1, height: 40 },
  progressBg:   { height: 8, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
});
