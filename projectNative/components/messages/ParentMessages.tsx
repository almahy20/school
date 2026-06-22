import React from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useMyMessages, useMarkMessageRead } from '@/hooks/useMessages';
import { useTheme } from '@/contexts/ThemeContext';
import { Text, Card, Avatar, Badge, EmptyState, LoadingScreen, ScreenHeader } from '@/components/ui';
import { Colors } from '@/constants/Colors';
import { Layout } from '@/constants/Layout';
import { Message } from '@/types/models';

export default function ParentMessages() {
  const { colors }  = useTheme();
  const insets      = useSafeAreaInsets();
  const { data: messages, isLoading } = useMyMessages();
  const markRead = useMarkMessageRead();

  const unreadCount = messages?.filter(m => !m.isRead).length ?? 0;

  const renderMessage = ({ item }: { item: Message }) => (
    <Card
      style={[styles.msgCard, !item.isRead && { borderRightWidth: 3, borderRightColor: Colors.primary[500] }]}
      onPress={() => { if (!item.isRead) markRead.mutate(item.id); }}
    >
      <View style={styles.msgRow}>
        <Avatar name={item.senderName ?? 'إدارة'} size="md" />
        <View style={{ flex: 1, marginRight: 12 }}>
          <View style={styles.msgHeader}>
            <Text variant="label" weight="bold">{item.senderName ?? 'إدارة المدرسة'}</Text>
            {!item.isRead && <Badge label="جديد" variant="primary" size="sm" />}
          </View>
          <Text variant="body" numberOfLines={2} style={{ marginTop: 4 }}>{item.content}</Text>
          <Text variant="caption" muted style={{ marginTop: 6 }}>
            {format(new Date(item.createdAt), 'dd MMM yyyy - hh:mm a', { locale: ar })}
          </Text>
        </View>
      </View>
    </Card>
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScreenHeader
        title="الرسائل"
        subtitle={unreadCount > 0 ? `${unreadCount} رسالة غير مقروءة` : undefined}
      />
      {isLoading ? (
        <LoadingScreen message="جاري تحميل الرسائل..." fullScreen={false} />
      ) : (
        <FlatList
          data={messages}
          keyExtractor={item => item.id}
          renderItem={renderMessage}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState
              icon="chatbubble-outline"
              title="لا توجد رسائل"
              description="ستظهر هنا الرسائل الواردة من إدارة المدرسة"
            />
          }
          ItemSeparatorComponent={() => <View style={{ height: Layout.spacing[2] }} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root:      { flex: 1 },
  list:      { padding: Layout.spacing[4] },
  msgCard:   { padding: Layout.spacing[3] },
  msgRow:    { flexDirection: 'row-reverse', alignItems: 'flex-start' },
  msgHeader: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
});
