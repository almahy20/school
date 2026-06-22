import React from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { COLLECTIONS } from '@/lib/firebase/collections';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Text, Card, Avatar, Badge, EmptyState, LoadingScreen, ScreenHeader } from '@/components/ui';
import { Colors } from '@/constants/Colors';
import { Layout } from '@/constants/Layout';

export default function ChildrenScreen() {
  const { user }   = useAuth();
  const { colors } = useTheme();
  const router     = useRouter();
  const insets     = useSafeAreaInsets();

  const { data: children, isLoading } = useQuery({
    queryKey: ['parent-children', user?.id],
    enabled:  !!user?.id,
    queryFn:  async () => {
      const spSnap = await getDocs(query(
        collection(db, COLLECTIONS.STUDENT_PARENTS),
        where('parentId', '==', user!.id),
      ));
      const studentIds = spSnap.docs.map(d => d.data().studentId as string);
      if (studentIds.length === 0) return [];

      const studentsSnap = await getDocs(query(
        collection(db, COLLECTIONS.STUDENTS),
        where('schoolId', '==', user!.schoolId),
      ));
      return studentsSnap.docs
        .filter(d => studentIds.includes(d.id))
        .map(d => ({ id: d.id, ...d.data() as any }));
    },
  });

  const renderChild = ({ item }: { item: any }) => (
    <Card style={styles.childCard} onPress={() => router.push(`/child/${item.id}` as any)}>
      <View style={styles.childHeader}>
        <Avatar name={item.name} size="lg" />
        <View style={{ flex: 1, marginRight: 14 }}>
          <Text variant="h4" weight="bold">{item.name}</Text>
          {item.className && (
            <Badge label={item.className} variant="info" size="sm" style={{ marginTop: 4 }} />
          )}
        </View>
        <Ionicons name="chevron-back" size={18} color={colors.icon} />
      </View>

      {/* Quick links */}
      <View style={styles.quickLinks}>
        {[
          { icon: 'ribbon-outline'   as const, label: 'الدرجات',  route: `/child/${item.id}/grades`,     color: Colors.primary[500], bg: Colors.primary[50]  },
          { icon: 'calendar-outline' as const, label: 'الحضور',   route: `/child/${item.id}/attendance`, color: Colors.success.main, bg: Colors.success.light },
          { icon: 'card-outline'     as const, label: 'المالية',  route: `/child/${item.id}/financial`,  color: Colors.warning.main, bg: Colors.warning.light },
          { icon: 'book-outline'     as const, label: 'المنهج',   route: `/child/${item.id}/curriculum`, color: '#8b5cf6',           bg: '#ede9fe'            },
        ].map(link => (
          <View
            key={link.label}
            style={[styles.quickLink, { backgroundColor: link.bg }]}
          >
            <Ionicons name={link.icon} size={16} color={link.color} />
            <Text style={{ fontSize: 10, fontWeight: '700', color: link.color, marginTop: 3 }}>
              {link.label}
            </Text>
          </View>
        ))}
      </View>
    </Card>
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScreenHeader title="أبنائي" subtitle={`${children?.length ?? 0} طالب`} />

      {isLoading ? (
        <LoadingScreen message="جاري التحميل..." fullScreen={false} />
      ) : (
        <FlatList
          data={children}
          keyExtractor={item => item.id}
          renderItem={renderChild}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState
              icon="people-outline"
              title="لا يوجد أبناء مرتبطون"
              description="تواصل مع إدارة المدرسة لربط أبنائك بحسابك"
            />
          }
          ItemSeparatorComponent={() => <View style={{ height: Layout.spacing[3] }} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root:       { flex: 1 },
  list:       { padding: Layout.spacing[4] },
  childCard:  { padding: Layout.spacing[4] },
  childHeader:{ flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 16 },
  quickLinks: { flexDirection: 'row-reverse', gap: Layout.spacing[2] },
  quickLink:  { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: Layout.radius.lg },
});
