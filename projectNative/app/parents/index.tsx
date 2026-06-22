import React, { useState } from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useParents } from '@/hooks/useUsers';
import { useTheme } from '@/contexts/ThemeContext';
import { Text, Card, Avatar, SearchBar, EmptyState, LoadingScreen, ScreenHeader } from '@/components/ui';
import { Colors } from '@/constants/Colors';
import { Layout } from '@/constants/Layout';

export default function ParentsScreen() {
  const { colors }  = useTheme();
  const insets      = useSafeAreaInsets();
  const [search, setSearch] = useState('');

  const { data: parents, isLoading, refetch } = useParents();

  const filtered = parents?.filter(p => 
    p.fullName.toLowerCase().includes(search.toLowerCase()) ||
    p.phone?.includes(search)
  );

  const renderParent = ({ item }: { item: any }) => (
    <Card style={styles.parentCard}>
      <View style={styles.parentRow}>
        <Avatar name={item.fullName} size="md" />
        <View style={{ flex: 1, marginRight: 12 }}>
          <Text variant="label" weight="bold">{item.fullName}</Text>
          <Text variant="caption" muted style={{ marginTop: 2 }}>{item.phone}</Text>
        </View>
        <TouchableOpacity style={styles.actionBtn}>
          <Ionicons name="chatbubble-ellipses-outline" size={18} color={Colors.primary[500]} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn}>
          <Ionicons name="chevron-back" size={16} color={colors.icon} />
        </TouchableOpacity>
      </View>
    </Card>
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScreenHeader 
        title="أولياء الأمور" 
        showBack
      />

      <View style={styles.searchBarWrap}>
        <SearchBar 
          value={search} 
          onChangeText={setSearch} 
          placeholder="بحث عن ولي أمر..." 
        />
      </View>

      {isLoading ? (
        <LoadingScreen message="جاري التحميل..." fullScreen={false} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={renderParent}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={Colors.primary[500]} />
          }
          ListEmptyComponent={
            <EmptyState
              icon="people-outline"
              title="لا يوجد أولياء أمور"
              description="لم يتم العثور على أي ولي أمر مسجل حالياً"
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
  parentCard:    { padding: Layout.spacing[3] },
  parentRow:     { flexDirection: 'row-reverse', alignItems: 'center' },
  actionBtn:     { padding: 8 },
});
