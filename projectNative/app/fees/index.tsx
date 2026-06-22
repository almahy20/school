import React, { useState } from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFees, useUpdateFeeStatus } from '@/hooks/useFees';
import { useTheme } from '@/contexts/ThemeContext';
import { Text, Card, Badge, SearchBar, EmptyState, LoadingScreen, ScreenHeader, Button } from '@/components/ui';
import { Colors } from '@/constants/Colors';
import { Layout } from '@/constants/Layout';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

export default function FeesScreen() {
  const { colors }  = useTheme();
  const insets      = useSafeAreaInsets();
  const [search, setSearch] = useState('');

  const { data: fees, isLoading, refetch } = useFees();
  const updateStatus = useUpdateFeeStatus();

  const filtered = fees?.filter(f => 
    f.studentName.toLowerCase().includes(search.toLowerCase())
  );

  const handlePay = (fee: any) => {
    Alert.alert(
      'تسديد الرسوم',
      `هل تم استلام المبلغ المستحق من الطالب "${fee.studentName}"؟`,
      [
        { text: 'إلغاء', style: 'cancel' },
        { 
          text: 'نعم، تم الاستلام', 
          onPress: () => updateStatus.mutate({ id: fee.id, status: 'paid', amountPaid: fee.totalAmount })
        }
      ]
    );
  };

  const renderFee = ({ item }: { item: any }) => (
    <Card style={styles.feeCard}>
      <View style={styles.feeHeader}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text variant="label" weight="bold">{item.studentName}</Text>
          <Text variant="caption" muted style={{ marginTop: 2 }}>{item.title}</Text>
        </View>
        <Badge 
          label={item.status === 'paid' ? 'مدفوع' : item.status === 'partial' ? 'مدفوع جزئياً' : 'غير مدفوع'} 
          variant={item.status === 'paid' ? 'success' : item.status === 'partial' ? 'info' : 'error'} 
          size="sm" 
        />
      </View>

      <View style={[styles.feeDetails, { borderTopColor: colors.border }]}>
        <View style={styles.detailItem}>
          <Text variant="caption" muted>المبلغ الكلي</Text>
          <Text variant="body" weight="bold">{item.totalAmount} ر.س</Text>
        </View>
        <View style={styles.detailItem}>
          <Text variant="caption" muted>المتبقي</Text>
          <Text variant="body" weight="bold" color={Colors.error.main}>{item.totalAmount - (item.amountPaid || 0)} ر.س</Text>
        </View>
      </View>

      {item.status !== 'paid' && (
        <Button 
          title="تسجيل دفعة" 
          onPress={() => handlePay(item)} 
          size="sm" 
          variant="outline"
          style={{ marginTop: 12 }}
          icon={<Ionicons name="card-outline" size={16} color={Colors.primary[500]} />}
        />
      )}
    </Card>
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScreenHeader 
        title="إدارة الرسوم الدراسية" 
        showBack
      />

      <View style={styles.searchBarWrap}>
        <SearchBar 
          value={search} 
          onChangeText={setSearch} 
          placeholder="بحث عن طالب..." 
        />
      </View>

      {isLoading ? (
        <LoadingScreen message="جاري التحميل..." fullScreen={false} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={renderFee}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={Colors.primary[500]} />
          }
          ListEmptyComponent={
            <EmptyState
              icon="card-outline"
              title="لا توجد سجلات مالية"
              description="لم يتم العثور على أي رسوم مسجلة حالياً"
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
  feeCard:       { padding: Layout.spacing[4] },
  feeHeader:     { flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 12 },
  feeDetails:    { flexDirection: 'row-reverse', justifyContent: 'space-between', paddingTop: 12, borderTopWidth: 1 },
  detailItem:    { alignItems: 'center' },
});
