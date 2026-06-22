import React, { useState, useMemo } from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useClasses, useDeleteClass } from '@/hooks/useClasses';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { Text, Card, Badge, SearchBar, EmptyState, LoadingScreen, ScreenHeader } from '@/components/ui';
import { Colors } from '@/constants/Colors';
import { Layout } from '@/constants/Layout';
import { Class } from '@/types/models';

export default function ClassesScreen() {
  const { colors } = useTheme();
  const { user }   = useAuth();
  const router     = useRouter();
  const insets     = useSafeAreaInsets();
  const [search, setSearch] = useState('');

  const { data: classes, isLoading, refetch } = useClasses();
  const deleteClass = useDeleteClass();

  const filtered = useMemo(() => {
    if (!classes) return [];
    if (!search.trim()) return classes;
    return classes.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
  }, [classes, search]);

  const handleDelete = (cls: Class) => {
    Alert.alert('حذف الفصل', `هل تريد حذف فصل "${cls.name}"؟`, [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'حذف', style: 'destructive', onPress: () => deleteClass.mutate(cls.id) },
    ]);
  };

  const isAdmin = user?.role === 'admin' || user?.isSuperAdmin;

  const renderClass = ({ item }: { item: Class }) => {
    const capacity = item.studentCount ?? 0;
    const maxCapacity = 40;
    const fillPct = Math.min((capacity / maxCapacity) * 100, 100);

    return (
      <Card
        style={styles.classCard}
        onPress={() => router.push(`/class/${item.id}` as any)}
      >
        <View style={styles.classHeader}>
          <View style={[styles.classIcon, { backgroundColor: Colors.primary[50] }]}>
            <Ionicons name="school-outline" size={24} color={Colors.primary[500]} />
          </View>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text variant="h4" weight="bold">{item.name}</Text>
            {item.gradeLevel && (
              <Badge label={item.gradeLevel} variant="info" size="sm" style={{ marginTop: 4 }} />
            )}
          </View>
          {isAdmin && (
            <TouchableOpacity
              onPress={() => handleDelete(item)}
              style={[styles.deleteBtn, { backgroundColor: Colors.error.light }]}
            >
              <Ionicons name="trash-outline" size={15} color={Colors.error.main} />
            </TouchableOpacity>
          )}
          <Ionicons name="chevron-back" size={16} color={colors.icon} style={{ marginRight: 4 }} />
        </View>

        {/* Teacher */}
        {item.teacherName && (
          <View style={styles.teacherRow}>
            <Ionicons name="person-outline" size={14} color={colors.icon} />
            <Text variant="caption" muted style={{ marginRight: 4 }}>{item.teacherName}</Text>
          </View>
        )}

        {/* Student count + progress */}
        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text variant="caption" muted>الطلاب</Text>
            <Text variant="caption" weight="bold" style={{ color: Colors.primary[500] }}>
              {capacity} / {maxCapacity}
            </Text>
          </View>
          <View style={[styles.progressBg, { backgroundColor: colors.border }]}>
            <View style={[styles.progressFill, { width: `${fillPct}%`, backgroundColor: Colors.primary[500] }]} />
          </View>
        </View>
      </Card>
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScreenHeader
        title={user?.role === 'teacher' ? 'فصولي' : 'الفصول الدراسية'}
        subtitle={`${filtered.length} فصل`}
        rightAction={
          isAdmin ? (
            <TouchableOpacity
              style={[styles.addBtn, { backgroundColor: Colors.primary[500] }]}
              onPress={() => router.push('/class/new' as any)}
            >
              <Ionicons name="add" size={22} color="#fff" />
            </TouchableOpacity>
          ) : undefined
        }
      />

      <View style={[styles.searchWrap, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <SearchBar value={search} onChangeText={setSearch} placeholder="بحث في الفصول..." />
      </View>

      {isLoading ? (
        <LoadingScreen message="جاري تحميل الفصول..." fullScreen={false} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderClass}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState
              icon="school-outline"
              title="لا توجد فصول"
              description={isAdmin ? 'ابدأ بإنشاء فصل دراسي' : 'لم يتم تعيينك في أي فصل بعد'}
              actionLabel={isAdmin ? 'إنشاء فصل' : undefined}
              onAction={isAdmin ? () => router.push('/class/new' as any) : undefined}
            />
          }
          ItemSeparatorComponent={() => <View style={{ height: Layout.spacing[3] }} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root:            { flex: 1 },
  addBtn:          { width: 36, height: 36, borderRadius: Layout.radius.md, alignItems: 'center', justifyContent: 'center' },
  searchWrap:      { paddingHorizontal: Layout.spacing[4], paddingVertical: Layout.spacing[3], borderBottomWidth: 1 },
  list:            { padding: Layout.spacing[4] },
  classCard:       { padding: Layout.spacing[4] },
  classHeader:     { flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 12 },
  classIcon:       { width: 48, height: 48, borderRadius: Layout.radius.lg, alignItems: 'center', justifyContent: 'center' },
  deleteBtn:       { width: 32, height: 32, borderRadius: Layout.radius.md, alignItems: 'center', justifyContent: 'center', marginLeft: 4 },
  teacherRow:      { flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 12, gap: 4 },
  progressSection: { gap: 6 },
  progressHeader:  { flexDirection: 'row-reverse', justifyContent: 'space-between' },
  progressBg:      { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill:    { height: '100%', borderRadius: 3 },
});
