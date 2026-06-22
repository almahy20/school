import React, { useState } from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTeachers } from '@/hooks/useUsers';
import { useTheme } from '@/contexts/ThemeContext';
import { Text, Card, Avatar, Badge, SearchBar, EmptyState, LoadingScreen, ScreenHeader, Button } from '@/components/ui';
import { Colors } from '@/constants/Colors';
import { Layout } from '@/constants/Layout';

export default function TeachersScreen() {
  const { colors }  = useTheme();
  const insets      = useSafeAreaInsets();
  const [search, setSearch] = useState('');

  const { data: teachers, isLoading, refetch } = useTeachers();

  const filtered = teachers?.filter(t => 
    t.fullName.toLowerCase().includes(search.toLowerCase()) ||
    t.phone?.includes(search)
  );

  const handleAddTeacher = () => {
    Alert.alert(
      'إضافة معلم',
      'سيتم توفير ميزة إضافة المعلمين وتعيين صلاحياتهم في التحديث القادم. حالياً يمكن للمعلمين التسجيل بأنفسهم وطلب الموافقة.',
      [{ text: 'حسناً' }]
    );
  };

  const renderTeacher = ({ item }: { item: any }) => (
    <Card style={styles.teacherCard}>
      <View style={styles.teacherRow}>
        <Avatar name={item.fullName} size="md" />
        <View style={{ flex: 1, marginRight: 12 }}>
          <Text variant="label" weight="bold">{item.fullName}</Text>
          <Text variant="caption" muted style={{ marginTop: 2 }}>{item.phone}</Text>
        </View>
        <Badge label="نشط" variant="success" size="sm" />
        <TouchableOpacity style={styles.actionBtn}>
          <Ionicons name="ellipsis-vertical" size={18} color={colors.icon} />
        </TouchableOpacity>
      </View>
    </Card>
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScreenHeader 
        title="إدارة المعلمين" 
        showBack
        rightAction={
          <TouchableOpacity 
            style={[styles.addBtn, { backgroundColor: Colors.primary[500] }]}
            onPress={handleAddTeacher}
          >
            <Ionicons name="person-add" size={20} color="#fff" />
          </TouchableOpacity>
        }
      />

      <View style={styles.searchBarWrap}>
        <SearchBar 
          value={search} 
          onChangeText={setSearch} 
          placeholder="بحث عن معلم..." 
        />
      </View>

      {isLoading ? (
        <LoadingScreen message="جاري التحميل..." fullScreen={false} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={renderTeacher}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={Colors.primary[500]} />
          }
          ListEmptyComponent={
            <EmptyState
              icon="person-outline"
              title="لا يوجد معلمون"
              description="لم يتم العثور على أي معلم في المدرسة حالياً"
            />
          }
          ItemSeparatorComponent={() => <View style={{ height: Layout.spacing[3] }} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root:          { flex: 1 },
  searchBarWrap: { padding: Layout.spacing[4], paddingBottom: 0 },
  list:          { padding: Layout.spacing[4] },
  teacherCard:   { padding: Layout.spacing[3] },
  teacherRow:    { flexDirection: 'row-reverse', alignItems: 'center' },
  addBtn:        { width: 40, height: 40, borderRadius: Layout.radius.md, alignItems: 'center', justifyContent: 'center' },
  actionBtn:     { padding: 8, marginLeft: -8 },
});
