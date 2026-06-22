import React, { useState, useMemo, useCallback } from 'react';
import {
  View, FlatList, StyleSheet, TouchableOpacity,
  RefreshControl, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStudents, useDeleteStudent } from '@/hooks/useStudents';
import { useClasses } from '@/hooks/useClasses';
import { useTheme } from '@/contexts/ThemeContext';
import {
  Text, Card, Avatar, Badge, SearchBar,
  EmptyState, LoadingScreen, ScreenHeader,
} from '@/components/ui';
import { Colors } from '@/constants/Colors';
import { Layout } from '@/constants/Layout';
import { Student } from '@/types/models';

export default function StudentsScreen() {
  const { colors }  = useTheme();
  const router      = useRouter();
  const insets      = useSafeAreaInsets();

  const [search,      setSearch]      = useState('');
  const [classFilter, setClassFilter] = useState<string | null>(null);

  const { data: students, isLoading, refetch } = useStudents(classFilter);
  const { data: classes }                       = useClasses();
  const deleteStudent                           = useDeleteStudent();

  // Filter by search
  const filtered = useMemo(() => {
    if (!students) return [];
    if (!search.trim()) return students;
    const q = search.toLowerCase();
    return students.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.parentPhone?.includes(q)
    );
  }, [students, search]);

  const handleDelete = useCallback((student: Student) => {
    Alert.alert(
      'حذف الطالب',
      `هل أنت متأكد من حذف "${student.name}"؟ لا يمكن التراجع عن هذا الإجراء.`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'حذف',
          style: 'destructive',
          onPress: () => deleteStudent.mutate({ id: student.id, classId: student.classId }),
        },
      ]
    );
  }, [deleteStudent]);

  const renderStudent = useCallback(({ item }: { item: Student }) => (
    <Card
      style={styles.studentCard}
      onPress={() => router.push(`/student/${item.id}` as any)}
    >
      <View style={styles.studentRow}>
        <Avatar name={item.name} size="md" />
        <View style={{ flex: 1, marginRight: 12 }}>
          <Text variant="label" weight="bold">{item.name}</Text>
          {item.className && (
            <Text variant="caption" muted style={{ marginTop: 2 }}>{item.className}</Text>
          )}
          {item.parentPhone && (
            <View style={styles.phoneRow}>
              <Ionicons name="call-outline" size={12} color={colors.icon} />
              <Text variant="caption" muted style={{ marginRight: 3 }}>{item.parentPhone}</Text>
            </View>
          )}
        </View>
        <TouchableOpacity
          onPress={() => handleDelete(item)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={[styles.deleteBtn, { backgroundColor: Colors.error.light }]}
        >
          <Ionicons name="trash-outline" size={16} color={Colors.error.main} />
        </TouchableOpacity>
        <Ionicons name="chevron-back" size={16} color={colors.icon} style={{ marginRight: 4 }} />
      </View>
    </Card>
  ), [colors, router, handleDelete]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScreenHeader
        title="إدارة الطلاب"
        subtitle={`${filtered.length} طالب`}
        rightAction={
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: Colors.primary[500] }]}
            onPress={() => router.push('/student/new' as any)}
          >
            <Ionicons name="add" size={22} color="#fff" />
          </TouchableOpacity>
        }
      />

      {/* Search & Filter */}
      <View style={[styles.filterBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="بحث بالاسم أو رقم الهاتف..."
          style={{ flex: 1 }}
        />
        {/* Class filter chips */}
        {(classes?.length ?? 0) > 0 && (
          <View style={styles.chips}>
            <TouchableOpacity
              style={[styles.chip, !classFilter && styles.chipActive]}
              onPress={() => setClassFilter(null)}
            >
              <Text style={[styles.chipText, !classFilter && styles.chipTextActive]}>الكل</Text>
            </TouchableOpacity>
            {classes?.slice(0, 4).map((cls) => (
              <TouchableOpacity
                key={cls.id}
                style={[styles.chip, classFilter === cls.id && styles.chipActive]}
                onPress={() => setClassFilter(classFilter === cls.id ? null : cls.id)}
              >
                <Text style={[styles.chipText, classFilter === cls.id && styles.chipTextActive]}>
                  {cls.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {isLoading ? (
        <LoadingScreen message="جاري تحميل الطلاب..." fullScreen={false} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderStudent}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: insets.bottom + 24 },
            filtered.length === 0 && styles.listEmpty,
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={Colors.primary[500]} />
          }
          ListEmptyComponent={
            <EmptyState
              icon="people-outline"
              title={search ? 'لا توجد نتائج' : 'لا يوجد طلاب'}
              description={search ? 'جرب كلمة بحث مختلفة' : 'ابدأ بإضافة طلاب للمدرسة'}
              actionLabel={!search ? 'إضافة طالب' : undefined}
              onAction={!search ? () => router.push('/student/new' as any) : undefined}
            />
          }
          ItemSeparatorComponent={() => <View style={{ height: Layout.spacing[2] }} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root:          { flex: 1 },
  addBtn:        { width: 36, height: 36, borderRadius: Layout.radius.md, alignItems: 'center', justifyContent: 'center' },
  filterBar:     { paddingHorizontal: Layout.spacing[4], paddingVertical: Layout.spacing[3], borderBottomWidth: 1, gap: Layout.spacing[2] },
  chips:         { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6 },
  chip:          { paddingHorizontal: 12, paddingVertical: 5, borderRadius: Layout.radius.full, backgroundColor: Colors.neutral[100] },
  chipActive:    { backgroundColor: Colors.primary[500] },
  chipText:      { fontSize: 12, fontWeight: '600', color: Colors.neutral[600] },
  chipTextActive:{ color: '#fff' },
  list:          { padding: Layout.spacing[4], gap: Layout.spacing[2] },
  listEmpty:     { flex: 1, justifyContent: 'center' },
  studentCard:   { padding: Layout.spacing[3] },
  studentRow:    { flexDirection: 'row-reverse', alignItems: 'center' },
  phoneRow:      { flexDirection: 'row-reverse', alignItems: 'center', marginTop: 4, gap: 3 },
  deleteBtn:     { width: 32, height: 32, borderRadius: Layout.radius.md, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
});
