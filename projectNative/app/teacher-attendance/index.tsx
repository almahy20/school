import React, { useState } from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTeachersAttendance, useSaveTeacherAttendance } from '@/hooks/useAttendance';
import { useTeachers } from '@/hooks/useUsers';
import { useTheme } from '@/contexts/ThemeContext';
import { Text, Card, Badge, ScreenHeader, LoadingScreen, Button, Avatar } from '@/components/ui';
import { Colors } from '@/constants/Colors';
import { Layout } from '@/constants/Layout';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { AttendanceStatus } from '@/types/models';

export default function TeacherAttendanceScreen() {
  const { colors }  = useTheme();
  const insets      = useSafeAreaInsets();
  const [date]      = useState(new Date());

  const { data: teachers, isLoading: loadingTeachers } = useTeachers();
  const { data: attendance, isLoading: loadingAtt, refetch } = useTeachersAttendance(date);
  const saveAttendance = useSaveTeacherAttendance();

  const [localAttendance, setLocalAttendance] = useState<Record<string, AttendanceStatus>>({});

  // Sync local state when attendance is loaded
  React.useEffect(() => {
    if (attendance && teachers) {
      const map: Record<string, AttendanceStatus> = {};
      teachers.forEach(t => { map[t.id] = 'present'; }); // default
      attendance.forEach(r => { map[r.teacherId] = r.status; });
      setLocalAttendance(map);
    }
  }, [attendance, teachers]);

  const handleStatusChange = (teacherId: string, status: AttendanceStatus) => {
    setLocalAttendance(prev => ({ ...prev, [teacherId]: status }));
  };

  const handleSave = async () => {
    if (!teachers) return;
    const records = teachers.map(t => ({
      teacherId: t.id,
      teacherName: t.fullName,
      status: localAttendance[t.id] || 'present'
    }));
    await saveAttendance.mutateAsync({ date, records });
    alert('تم حفظ كشف حضور المعلمين بنجاح');
  };

  const renderTeacher = ({ item }: { item: any }) => {
    const status = localAttendance[item.id] || 'present';
    return (
      <Card style={styles.teacherCard}>
        <View style={styles.teacherRow}>
          <Avatar name={item.fullName} size="sm" />
          <Text variant="body" weight="bold" style={{ flex: 1, marginRight: 12 }}>{item.fullName}</Text>
          
          <View style={styles.statusBtns}>
            <TouchableOpacity 
              onPress={() => handleStatusChange(item.id, 'present')}
              style={[styles.statusBtn, status === 'present' && { backgroundColor: Colors.success.main }]}
            >
              <Text variant="caption" style={status === 'present' && { color: '#fff' }}>حاضر</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => handleStatusChange(item.id, 'absent')}
              style={[styles.statusBtn, status === 'absent' && { backgroundColor: Colors.error.main }]}
            >
              <Text variant="caption" style={status === 'absent' && { color: '#fff' }}>غائب</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Card>
    );
  };

  if (loadingTeachers || loadingAtt) return <LoadingScreen />;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScreenHeader 
        title="حضور المعلمين" 
        subtitle={format(date, 'EEEE, dd MMMM', { locale: ar })}
        showBack 
      />

      <FlatList
        data={teachers}
        keyExtractor={item => item.id}
        renderItem={renderTeacher}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 80 }]}
        refreshControl={<RefreshControl refreshing={loadingAtt} onRefresh={refetch} />}
      />

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16, backgroundColor: colors.surface }]}>
        <Button 
          title="حفظ الكشف" 
          onPress={handleSave} 
          loading={saveAttendance.isPending}
          fullWidth
          size="lg"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root:        { flex: 1 },
  list:        { padding: Layout.spacing[4], gap: Layout.spacing[3] },
  teacherCard: { padding: Layout.spacing[3] },
  teacherRow:  { flexDirection: 'row-reverse', alignItems: 'center' },
  statusBtns:  { flexDirection: 'row-reverse', gap: 6 },
  statusBtn:   { paddingHorizontal: 12, paddingVertical: 6, borderRadius: Layout.radius.md, backgroundColor: Colors.neutral[100] },
  footer:      { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)' },
});
