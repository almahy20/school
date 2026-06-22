import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStudents } from '@/hooks/useStudents';
import { useStudentAttendance } from '@/hooks/useAttendance';
import { useStudentFees } from '@/hooks/useFees';
import { useTheme } from '@/contexts/ThemeContext';
import { Text, Card, Avatar, Badge, ScreenHeader, LoadingScreen } from '@/components/ui';
import { Colors } from '@/constants/Colors';
import { Layout } from '@/constants/Layout';

export default function ReportsScreen() {
  const { colors }  = useTheme();
  const insets      = useSafeAreaInsets();
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  const { data: students, isLoading: studentsLoading } = useStudents();
  const selectedStudent = students?.find(s => s.id === selectedStudentId);

  const { data: attendance } = useStudentAttendance(selectedStudentId ?? '');
  const { data: fees }       = useStudentFees(selectedStudentId ?? '');

  const presentCount = attendance?.filter(a => a.status === 'present').length ?? 0;
  const absentCount  = attendance?.filter(a => a.status === 'absent').length  ?? 0;
  const lateCount    = attendance?.filter(a => a.status === 'late').length    ?? 0;
  const totalDays    = attendance?.length ?? 0;
  const attendanceRate = totalDays > 0 ? Math.round((presentCount / totalDays) * 100) : 0;

  const totalDue       = fees?.reduce((s, f) => s + f.amountDue,  0) ?? 0;
  const totalPaid      = fees?.reduce((s, f) => s + f.amountPaid, 0) ?? 0;
  const totalRemaining = totalDue - totalPaid;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScreenHeader title="مركز التقارير" subtitle="تقارير الطلاب الأكاديمية" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}>
        {/* Student Selector */}
        <View>
          <Text variant="h4" weight="bold" style={{ marginBottom: 12 }}>اختر الطالب</Text>
          {studentsLoading ? (
            <LoadingScreen message="جاري التحميل..." fullScreen={false} />
          ) : (
            <View style={styles.studentGrid}>
              {students?.map(student => (
                <TouchableOpacity
                  key={student.id}
                  style={[
                    styles.studentChip,
                    { backgroundColor: colors.card, borderColor: colors.cardBorder },
                    selectedStudentId === student.id && styles.studentChipActive,
                  ]}
                  onPress={() => setSelectedStudentId(student.id === selectedStudentId ? null : student.id)}
                >
                  <Avatar name={student.name} size="sm" />
                  <Text
                    variant="caption"
                    weight="semibold"
                    align="center"
                    style={[{ marginTop: 6 }, selectedStudentId === student.id && { color: Colors.primary[600] }]}
                    numberOfLines={2}
                  >
                    {student.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Report */}
        {selectedStudent && (
          <View style={styles.reportSection}>
            {/* Student Info */}
            <Card style={styles.studentInfoCard} elevated>
              <View style={styles.studentInfoRow}>
                <Avatar name={selectedStudent.name} size="xl" />
                <View style={{ flex: 1, marginRight: 16 }}>
                  <Text variant="h3" weight="black">{selectedStudent.name}</Text>
                  {selectedStudent.className && (
                    <Badge label={selectedStudent.className} variant="info" size="sm" style={{ marginTop: 6 }} />
                  )}
                </View>
              </View>
            </Card>

            {/* Performance Summary */}
            <Card>
              <View style={styles.reportHeader}>
                <Ionicons name="analytics" size={20} color={Colors.primary[500]} />
                <Text variant="h4" weight="bold" style={{ marginRight: 8 }}>ملخص الأداء</Text>
              </View>
              
              <View style={styles.summaryBox}>
                <View style={styles.summaryItem}>
                  <Text variant="label" weight="bold">الحالة الدراسية:</Text>
                  <Badge 
                    label={attendanceRate > 85 ? 'ممتاز' : attendanceRate > 70 ? 'جيد جداً' : 'يحتاج متابعة'} 
                    variant={attendanceRate > 85 ? 'success' : attendanceRate > 70 ? 'info' : 'warning'} 
                  />
                </View>
                
                <View style={styles.summaryItem}>
                  <Text variant="label" weight="bold">الالتزام المالي:</Text>
                  <Text variant="body" color={totalRemaining === 0 ? Colors.success.main : Colors.error.main}>
                    {totalRemaining === 0 ? 'مكتمل' : `متبقي ${totalRemaining.toLocaleString('ar-EG')} ر.س`}
                  </Text>
                </View>

                <View style={[styles.summaryItem, { borderBottomWidth: 0 }]}>
                  <Text variant="label" weight="bold">توصية الإدارة:</Text>
                  <Text variant="caption" muted>
                    {attendanceRate > 85 
                      ? 'يُنصح بالاستمرار على هذا النهج المتميز في الحضور.' 
                      : 'يُرجى الاهتمام بالحضور اليومي لضمان التحصيل العلمي.'}
                  </Text>
                </View>
              </View>
            </Card>

            {/* Attendance Report */}
            <Card>
              <View style={styles.reportHeader}>
                <Ionicons name="calendar" size={20} color={Colors.primary[500]} />
                <Text variant="h4" weight="bold" style={{ marginRight: 8 }}>تقرير الحضور</Text>
              </View>
              <View style={styles.attendanceStats}>
                {[
                  { label: 'حاضر',  count: presentCount, color: Colors.success.main, bg: Colors.success.light },
                  { label: 'غائب',  count: absentCount,  color: Colors.error.main,   bg: Colors.error.light   },
                  { label: 'متأخر', count: lateCount,    color: Colors.warning.main, bg: Colors.warning.light },
                ].map(s => (
                  <View key={s.label} style={[styles.attendanceStat, { backgroundColor: s.bg }]}>
                    <Text style={{ fontSize: 22, fontWeight: '900', color: s.color }}>{s.count}</Text>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: s.color }}>{s.label}</Text>
                  </View>
                ))}
              </View>
              <View style={[styles.progressBg, { backgroundColor: colors.border, marginTop: 12 }]}>
                <View style={[styles.progressFill, { width: `${attendanceRate}%`, backgroundColor: Colors.success.main }]} />
              </View>
              <Text variant="caption" muted align="center" style={{ marginTop: 6 }}>
                نسبة الحضور: {attendanceRate}%
              </Text>
            </Card>

            {/* Financial Report */}
            <Card>
              <View style={styles.reportHeader}>
                <Ionicons name="card" size={20} color={Colors.warning.main} />
                <Text variant="h4" weight="bold" style={{ marginRight: 8 }}>التقرير المالي</Text>
              </View>
              <View style={styles.feeStats}>
                <View style={styles.feeStat}>
                  <Text variant="h3" weight="black" style={{ color: Colors.success.main }}>
                    {totalPaid.toLocaleString('ar-EG')}
                  </Text>
                  <Text variant="caption" muted>المدفوع</Text>
                </View>
                <View style={[styles.feeDivider, { backgroundColor: colors.border }]} />
                <View style={styles.feeStat}>
                  <Text variant="h3" weight="black" style={{ color: Colors.error.main }}>
                    {totalRemaining.toLocaleString('ar-EG')}
                  </Text>
                  <Text variant="caption" muted>المتبقي</Text>
                </View>
                <View style={[styles.feeDivider, { backgroundColor: colors.border }]} />
                <View style={styles.feeStat}>
                  <Text variant="h3" weight="black">{totalDue.toLocaleString('ar-EG')}</Text>
                  <Text variant="caption" muted>الإجمالي</Text>
                </View>
              </View>
            </Card>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:            { flex: 1 },
  scroll:          { padding: Layout.spacing[4], gap: Layout.spacing[4] },
  studentGrid:     { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: Layout.spacing[2] },
  studentChip:     { width: 80, alignItems: 'center', padding: Layout.spacing[2], borderRadius: Layout.radius.lg, borderWidth: 1 },
  studentChipActive:{ borderColor: Colors.primary[500], backgroundColor: Colors.primary[50] },
  reportSection:   { gap: Layout.spacing[3] },
  studentInfoCard: { padding: Layout.spacing[4] },
  studentInfoRow:  { flexDirection: 'row-reverse', alignItems: 'center' },
  reportHeader:    { flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 16 },
  summaryBox: {
    backgroundColor: Colors.neutral?.[50] ?? '#F9FAFB',
    borderRadius: Layout.radius.md,
    padding: Layout.spacing[3],
  },
  summaryItem: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral?.[200] ?? '#E5E7EB',
  },
  attendanceStats: { flexDirection: 'row-reverse', gap: Layout.spacing[3] },
  attendanceStat:  { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: Layout.radius.lg, gap: 2 },
  progressBg:      { height: 8, borderRadius: 4, overflow: 'hidden' },
  progressFill:    { height: '100%', borderRadius: 4 },
  feeStats:        { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-around' },
  feeStat:         { alignItems: 'center', gap: 4 },
  feeDivider:      { width: 1, height: 40 },
});
