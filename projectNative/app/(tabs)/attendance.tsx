import React, { useState, useMemo } from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity, Alert, RefreshControl, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStudents } from '@/hooks/useStudents';
import { useClasses } from '@/hooks/useClasses';
import { useAttendance, useSaveAttendance } from '@/hooks/useAttendance';
import { useTheme } from '@/contexts/ThemeContext';
import { Text, Card, Badge, ScreenHeader, LoadingScreen, Button, Avatar, SearchBar } from '@/components/ui';
import { Colors } from '@/constants/Colors';
import { Layout } from '@/constants/Layout';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { AttendanceStatus } from '@/types/models';

export default function StudentAttendanceScreen() {
  const { colors }  = useTheme();
  const insets      = useSafeAreaInsets();
  const [date]      = useState(new Date());
  const [classId, setClassId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const { data: classes } = useClasses();
  const { data: students, isLoading: loadingStudents } = useStudents(classId || undefined);
  const { data: attendance, isLoading: loadingAtt, refetch } = useAttendance(date, classId || '');
  const saveAttendance = useSaveAttendance();

  const [localAttendance, setLocalAttendance] = useState<Record<string, AttendanceStatus>>({});

  // Sync local state when attendance is loaded
  React.useEffect(() => {
    if (attendance && students) {
      const map: Record<string, AttendanceStatus> = {};
      students.forEach(s => { map[s.id] = 'present'; }); // default
      attendance.forEach(r => { map[r.studentId] = r.status; });
      setLocalAttendance(map);
    }
  }, [attendance, students, classId]);

  const filteredStudents = useMemo(() => {
    if (!students) return [];
    if (!search.trim()) return students;
    return students.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));
  }, [students, search]);

  const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
    setLocalAttendance(prev => ({ ...prev, [studentId]: status }));
  };

  const handleSave = async () => {
    if (!students || !classId) {
      Alert.alert('تنبيه', 'يرجى اختيار الفصل أولاً');
      return;
    }
    const records = students.map(s => ({
      studentId: s.id,
      studentName: s.name,
      status: localAttendance[s.id] || 'present'
    }));
    await saveAttendance.mutateAsync({ date, classId, records });
    Alert.alert('تم', 'تم حفظ كشف حضور الطلاب بنجاح');
  };

  const renderStudent = ({ item }: { item: any }) => {
    const status = localAttendance[item.id] || 'present';
    return (
      <Card style={styles.studentCard}>
        <View style={styles.studentRow}>
          <Avatar name={item.name} size="sm" />
          <Text variant="body" weight="bold" style={{ flex: 1, marginRight: 12 }}>{item.name}</Text>
          
          <View style={styles.statusBtns}>
            <TouchableOpacity 
              onPress={() => handleStatusChange(item.id, 'present')}
              style={[styles.statusBtn, status === 'present' && { backgroundColor: Colors.success.main }]}
            >
              <Ionicons name="checkmark" size={16} color={status === 'present' ? '#fff' : colors.icon} />
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => handleStatusChange(item.id, 'absent')}
              style={[styles.statusBtn, status === 'absent' && { backgroundColor: Colors.error.main }]}
            >
              <Ionicons name="close" size={16} color={status === 'absent' ? '#fff' : colors.icon} />
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => handleStatusChange(item.id, 'late')}
              style={[styles.statusBtn, status === 'late' && { backgroundColor: Colors.warning.main }]}
            >
              <Ionicons name="time-outline" size={16} color={status === 'late' ? '#fff' : colors.icon} />
            </TouchableOpacity>
          </View>
        </View>
      </Card>
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScreenHeader 
        title="حضور الطلاب" 
        subtitle={format(date, 'EEEE, dd MMMM', { locale: ar })}
      />

      <View style={styles.filters}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.classChips}>
          <TouchableOpacity 
            style={[styles.classChip, !classId && { backgroundColor: Colors.primary[500] }]}
            onPress={() => setClassId(null)}
          >
            <Text style={[styles.classChipText, !classId && { color: '#fff' }]}>الكل</Text>
          </TouchableOpacity>
          {classes?.map(c => (
            <TouchableOpacity 
              key={c.id}
              style={[styles.classChip, classId === c.id && { backgroundColor: Colors.primary[500] }]}
              onPress={() => setClassId(c.id)}
            >
              <Text style={[styles.classChipText, classId === c.id && { color: '#fff' }]}>{c.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <SearchBar value={search} onChangeText={setSearch} placeholder="بحث عن طالب..." />
      </View>

      {loadingStudents || loadingAtt ? (
        <LoadingScreen fullScreen={false} />
      ) : (
        <FlatList
          data={filteredStudents}
          keyExtractor={item => item.id}
          renderItem={renderStudent}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 80 }]}
          refreshControl={<RefreshControl refreshing={loadingAtt} onRefresh={refetch} />}
        />
      )}

      {classId && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16, backgroundColor: colors.surface }]}>
          <Button 
            title="حفظ الكشف" 
            onPress={handleSave} 
            loading={saveAttendance.isPending}
            fullWidth
            size="lg"
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root:        { flex: 1 },
  filters:     { padding: Layout.spacing[4], gap: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
  classChips:  { flexDirection: 'row-reverse', gap: 8, paddingBottom: 4 },
  classChip:   { paddingHorizontal: 16, paddingVertical: 8, borderRadius: Layout.radius.full, backgroundColor: '#f1f5f9' },
  classChipText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  list:        { padding: Layout.spacing[4], gap: Layout.spacing[3] },
  studentCard: { padding: Layout.spacing[3] },
  studentRow:  { flexDirection: 'row-reverse', alignItems: 'center' },
  statusBtns:  { flexDirection: 'row-reverse', gap: 8 },
  statusBtn:   { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9' },
  footer:      { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)' },
});
