import React, { useState } from 'react';
import { View, FlatList, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMyComplaints, useComplaints, useSubmitComplaint, useRespondToComplaint } from '@/hooks/useComplaints';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { Text, Card, Badge, Button, EmptyState, LoadingScreen, ScreenHeader, Avatar } from '@/components/ui';
import { Input } from '@/components/ui/Input';
import { Colors } from '@/constants/Colors';
import { Layout } from '@/constants/Layout';
import { Complaint } from '@/types/models';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

const schema = z.object({
  content: z.string().min(10, 'يجب أن تكون الشكوى 10 أحرف على الأقل'),
});

const statusMap = {
  pending:     { label: 'قيد الانتظار', variant: 'warning' as const },
  in_progress: { label: 'قيد المعالجة', variant: 'info'    as const },
  resolved:    { label: 'تم الحل',      variant: 'success' as const },
};

export default function ComplaintsScreen() {
  const { user }    = useAuth();
  const { colors }  = useTheme();
  const insets      = useSafeAreaInsets();
  
  const [showForm,  setShowForm]  = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText,  setReplyText]  = useState('');

  const isAdmin = user?.role === 'admin' || user?.isSuperAdmin;

  const { data: myComplaints, isLoading: loadingMy } = useMyComplaints();
  const { data: allComplaints, isLoading: loadingAll } = useComplaints();
  const submit  = useSubmitComplaint();
  const respond = useRespondToComplaint();

  const complaints = isAdmin ? allComplaints : myComplaints;
  const isLoading  = isAdmin ? loadingAll : loadingMy;

  const { control, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { content: '' },
  });

  const onSubmit = async (data: { content: string }) => {
    await submit.mutateAsync({ content: data.content });
    reset();
    setShowForm(false);
    Alert.alert('تم', 'تم إرسال شكواك بنجاح، سيتم الرد عليها قريباً');
  };

  const handleRespond = async (id: string) => {
    if (!replyText.trim()) return;
    await respond.mutateAsync({ id, response: replyText, status: 'resolved' });
    setReplyText('');
    setReplyingTo(null);
    Alert.alert('تم', 'تم إرسال الرد بنجاح');
  };

  const renderComplaint = ({ item }: { item: Complaint }) => {
    const status = statusMap[item.status];
    const isReplying = replyingTo === item.id;

    return (
      <Card style={styles.complaintCard}>
        <View style={styles.complaintHeader}>
          {isAdmin && (
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', flex: 1 }}>
              <Avatar name={item.parentName || 'ولي أمر'} size="xs" />
              <Text variant="label" weight="bold" style={{ marginRight: 8 }}>{item.parentName}</Text>
            </View>
          )}
          {!isAdmin && <Text variant="label" weight="bold" style={{ flex: 1 }}>شكوى</Text>}
          <Badge label={status.label} variant={status.variant} size="sm" />
        </View>

        <Text variant="body" style={{ marginTop: 8 }}>{item.content}</Text>

        {item.adminResponse && (
          <View style={[styles.responseBox, { backgroundColor: colors.input }]}>
            <Text variant="caption" weight="bold" color={Colors.primary[600]} style={{ marginBottom: 4 }}>
              رد الإدارة:
            </Text>
            <Text variant="caption" style={{ color: colors.text }}>{item.adminResponse}</Text>
          </View>
        )}

        {isAdmin && !item.adminResponse && (
          <View style={{ marginTop: 12 }}>
            {isReplying ? (
              <View style={styles.replyBox}>
                <Input
                  placeholder="اكتب ردك هنا..."
                  value={replyText}
                  onChangeText={setReplyText}
                  multiline
                  style={{ height: 60 }}
                />
                <View style={styles.replyActions}>
                  <Button title="إلغاء" onPress={() => setReplyingTo(null)} variant="secondary" size="xs" />
                  <Button 
                    title="إرسال الرد" 
                    onPress={() => handleRespond(item.id)} 
                    loading={respond.isPending} 
                    size="xs" 
                  />
                </View>
              </View>
            ) : (
              <Button 
                title="الرد على الشكوى" 
                onPress={() => setReplyingTo(item.id)} 
                variant="outline" 
                size="xs" 
                style={{ alignSelf: 'flex-start' }}
              />
            )}
          </View>
        )}

        <View style={styles.complaintFooter}>
          <Text variant="caption" muted>
            {format(new Date(item.createdAt), 'dd MMM yyyy - hh:mm a', { locale: ar })}
          </Text>
        </View>
      </Card>
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScreenHeader
        title={isAdmin ? 'إدارة الشكاوى' : 'الشكاوى والمقترحات'}
        rightAction={!isAdmin && (
          <Button
            title="جديد"
            onPress={() => setShowForm(!showForm)}
            variant={showForm ? 'secondary' : 'primary'}
            size="sm"
          />
        )}
      />

      {/* New Complaint Form (Parent Only) */}
      {!isAdmin && showForm && (
        <Card style={styles.formCard} elevated>
          <Text variant="h4" weight="bold" style={{ marginBottom: 16 }}>شكوى / مقترح جديد</Text>
          <Controller
            control={control}
            name="content"
            render={({ field: { onChange, value, onBlur } }) => (
              <Input
                label="محتوى الشكوى"
                placeholder="اكتب شكواك أو مقترحك هنا..."
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.content?.message}
                multiline
                numberOfLines={4}
                style={{ height: 100, textAlignVertical: 'top', paddingTop: 8 }}
              />
            )}
          />
          <View style={styles.formActions}>
            <Button title="إلغاء" onPress={() => { setShowForm(false); reset(); }} variant="secondary" size="sm" style={{ flex: 1 }} />
            <Button title="إرسال" onPress={handleSubmit(onSubmit)} loading={isSubmitting} size="sm" style={{ flex: 1 }} />
          </View>
        </Card>
      )}

      {isLoading ? (
        <LoadingScreen message="جاري التحميل..." fullScreen={false} />
      ) : (
        <FlatList
          data={complaints}
          keyExtractor={item => item.id}
          renderItem={renderComplaint}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState
              icon="megaphone-outline"
              title="لا توجد شكاوى"
              description="يمكنك تقديم شكوى أو مقترح للإدارة"
              actionLabel="تقديم شكوى"
              onAction={() => setShowForm(true)}
            />
          }
          ItemSeparatorComponent={() => <View style={{ height: Layout.spacing[3] }} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root:             { flex: 1 },
  formCard:         { margin: Layout.spacing[4], padding: Layout.spacing[4] },
  formActions:      { flexDirection: 'row-reverse', gap: Layout.spacing[3], marginTop: Layout.spacing[4] },
  list:             { padding: Layout.spacing[4] },
  complaintCard:    { padding: Layout.spacing[4] },
  complaintHeader:  { flexDirection: 'row-reverse', alignItems: 'center' },
  responseBox:      { padding: Layout.spacing[3], borderRadius: Layout.radius.md, marginTop: 12 },
  replyBox:         { gap: Layout.spacing[2], marginTop: Layout.spacing[3] },
  replyActions:     { flexDirection: 'row-reverse', gap: Layout.spacing[2] },
  complaintFooter:  { marginTop: Layout.spacing[3], borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)', paddingTop: Layout.spacing[2] },
});
