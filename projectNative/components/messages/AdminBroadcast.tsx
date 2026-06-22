import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Alert, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBroadcastMessage, useSentMessages, useSendMessage } from '@/hooks/useMessages';
import { useTeachers, useParents } from '@/hooks/useUsers';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { Text, Card, Button, ScreenHeader, Avatar, Badge, LoadingScreen } from '@/components/ui';
import { Colors } from '@/constants/Colors';
import { Layout } from '@/constants/Layout';
import { Input } from '@/components/ui/Input';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

const TARGET_OPTIONS = [
  { value: 'all',       label: 'الجميع',       icon: 'people'          as const },
  { value: 'teacher',   label: 'المعلمون',      icon: 'person'          as const },
  { value: 'parent',    label: 'أولياء الأمور', icon: 'people-circle'   as const },
];

export default function AdminBroadcast() {
  const { user }    = useAuth();
  const { colors }  = useTheme();
  const insets      = useSafeAreaInsets();
  
  const [mode,       setMode]       = useState<'broadcast' | 'direct'>('broadcast');
  const [message,    setMessage]    = useState('');
  const [targetRole, setTargetRole] = useState<string>('all');
  const [selectedRecipient, setSelectedRecipient] = useState<{ id: string, name: string } | null>(null);

  const broadcast   = useBroadcastMessage();
  const directSend  = useSendMessage();
  const { data: sent, isLoading: sentLoading } = useSentMessages();
  
  const { data: teachers } = useTeachers();
  const { data: parents }  = useParents();

  const isAdmin = user?.role === 'admin' || user?.isSuperAdmin;

  const handleSend = () => {
    if (!message.trim()) return;

    if (mode === 'broadcast') {
      const targetLabel = TARGET_OPTIONS.find(t => t.value === targetRole)?.label;
      Alert.alert(
        'بث رسالة جماعية',
        `سيتم إرسال الرسالة لـ ${targetLabel}. هل تريد المتابعة؟`,
        [
          { text: 'إلغاء', style: 'cancel' },
          {
            text: 'إرسال',
            onPress: async () => {
              await broadcast.mutateAsync({ 
                content: message, 
                targetRole: targetRole === 'all' ? undefined : targetRole 
              });
              setMessage('');
              Alert.alert('تم', 'تم بث الرسالة بنجاح');
            },
          },
        ]
      );
    } else {
      if (!selectedRecipient) {
        Alert.alert('تنبيه', 'يرجى اختيار مستلم للرسالة');
        return;
      }
      Alert.alert(
        'إرسال رسالة خاصة',
        `سيتم إرسال الرسالة إلى: ${selectedRecipient.name}`,
        [
          { text: 'إلغاء', style: 'cancel' },
          {
            text: 'إرسال',
            onPress: async () => {
              await directSend.mutateAsync({
                receiverId: selectedRecipient.id,
                receiverName: selectedRecipient.name,
                content: message,
              });
              setMessage('');
              setSelectedRecipient(null);
              Alert.alert('تم', 'تم إرسال الرسالة بنجاح');
            },
          },
        ]
      );
    }
  };

  const renderRecipient = (p: any) => (
    <TouchableOpacity
      key={p.id}
      style={[
        styles.recipientChip,
        selectedRecipient?.id === p.id && styles.recipientChipActive,
        { borderColor: colors.border }
      ]}
      onPress={() => setSelectedRecipient({ id: p.id, name: p.fullName })}
    >
      <Avatar name={p.fullName} size="xs" />
      <Text variant="caption" style={selectedRecipient?.id === p.id && { color: '#fff' }}>
        {p.fullName}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScreenHeader title="مركز التواصل" subtitle="إرسال رسائل خاصة أو عامة" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}>
        
        {/* Mode Switcher */}
        <View style={styles.modeContainer}>
          <TouchableOpacity 
            style={[styles.modeBtn, mode === 'broadcast' && styles.modeBtnActive]} 
            onPress={() => setMode('broadcast')}
          >
            <Text style={[styles.modeText, mode === 'broadcast' && { color: '#fff' }]}>بث جماعي</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.modeBtn, mode === 'direct' && styles.modeBtnActive]} 
            onPress={() => setMode('direct')}
          >
            <Text style={[styles.modeText, mode === 'direct' && { color: '#fff' }]}>رسالة خاصة</Text>
          </TouchableOpacity>
        </View>

        {/* Compose */}
        <Card style={styles.composeCard} elevated>
          <Text variant="h4" weight="bold" style={{ marginBottom: 16 }}>
            {mode === 'broadcast' ? 'بث رسالة جديدة' : 'رسالة خاصة جديدة'}
          </Text>

          {mode === 'broadcast' ? (
            <>
              <Text variant="label" muted style={{ marginBottom: 8 }}>المستهدفون</Text>
              <View style={styles.targetRow}>
                {TARGET_OPTIONS.map(opt => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.targetBtn, targetRole === opt.value && styles.targetBtnActive]}
                    onPress={() => setTargetRole(opt.value)}
                  >
                    <Ionicons
                      name={opt.icon}
                      size={16}
                      color={targetRole === opt.value ? '#fff' : colors.icon}
                    />
                    <Text style={[styles.targetText, targetRole === opt.value && { color: '#fff' }]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          ) : (
            <>
              <Text variant="label" muted style={{ marginBottom: 8 }}>اختر المستلم</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recipientsRow}>
                {isAdmin && teachers?.map(renderRecipient)}
                {parents?.map(renderRecipient)}
              </ScrollView>
              {selectedRecipient && (
                <View style={styles.selectedRecip}>
                  <Text variant="caption" weight="bold" color={Colors.primary[600]}>
                    المستلم: {selectedRecipient.name}
                  </Text>
                  <TouchableOpacity onPress={() => setSelectedRecipient(null)}>
                    <Ionicons name="close-circle" size={16} color={Colors.error.main} />
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}

          {/* Message */}
          <Input
            label="نص الرسالة"
            placeholder="اكتب رسالتك هنا..."
            value={message}
            onChangeText={setMessage}
            multiline
            numberOfLines={4}
            containerStyle={{ marginTop: 16 }}
            style={{ height: 100, textAlignVertical: 'top', paddingTop: 8 }}
          />

          <Button
            title="إرسال الرسالة"
            onPress={handleSend}
            loading={broadcast.isPending || directSend.isPending}
            disabled={!message.trim() || (mode === 'direct' && !selectedRecipient)}
            fullWidth
            size="lg"
            style={{ marginTop: 16 }}
            icon={<Ionicons name="send" size={18} color="#fff" />}
          />
        </Card>

        {/* Sent Messages */}
        <View style={{ marginTop: 8 }}>
          <Text variant="h4" weight="bold" style={{ marginBottom: 12 }}>الرسائل المرسلة</Text>
          {sentLoading ? (
            <LoadingScreen message="جاري التحميل..." fullScreen={false} />
          ) : sent?.length === 0 ? (
            <Text variant="body" muted align="center" style={{ marginTop: 12 }}>لا توجد رسائل مرسلة حالياً</Text>
          ) : (
            sent?.slice(0, 10).map(msg => (
              <Card key={msg.id} style={styles.sentCard}>
                <View style={styles.sentHeader}>
                  <Text variant="label" weight="bold">إلى: {msg.receiverName || 'مجموعة'}</Text>
                  <Text variant="caption" muted>
                    {format(new Date(msg.createdAt), 'hh:mm a', { locale: ar })}
                  </Text>
                </View>
                <Text variant="body" numberOfLines={2} style={{ marginTop: 4 }}>{msg.content}</Text>
                <Text variant="caption" muted style={{ marginTop: 6 }}>
                  {format(new Date(msg.createdAt), 'dd MMMM yyyy', { locale: ar })}
                </Text>
              </Card>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:         { flex: 1 },
  scroll:       { padding: Layout.spacing[4], gap: Layout.spacing[4] },
  composeCard:  { padding: Layout.spacing[5] },
  
  modeContainer: { flexDirection: 'row-reverse', backgroundColor: Colors.neutral[100], borderRadius: Layout.radius.lg, padding: 4 },
  modeBtn:       { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: Layout.radius.md },
  modeBtnActive: { backgroundColor: Colors.primary[500] },
  modeText:      { fontSize: 13, fontWeight: '700', color: Colors.neutral[600] },

  targetRow:    { flexDirection: 'row-reverse', gap: 8 },
  targetBtn:    { flex: 1, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: Layout.radius.lg, backgroundColor: Colors.neutral[100], gap: 6 },
  targetBtnActive: { backgroundColor: Colors.primary[500] },
  targetText:   { fontSize: 12, fontWeight: '700', color: Colors.neutral[600] },
  
  recipientsRow: { flexDirection: 'row-reverse', gap: 8 },
  recipientChip: { flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: Layout.radius.full, borderWidth: 1, gap: 6 },
  recipientChipActive: { backgroundColor: Colors.primary[500], borderColor: Colors.primary[500] },
  selectedRecip: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, padding: 8, backgroundColor: Colors.primary[50], borderRadius: Layout.radius.md },

  sentCard:     { padding: Layout.spacing[3], marginBottom: Layout.spacing[2] },
  sentHeader:   { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
});
