import React, { useEffect } from 'react';
import { View, ScrollView, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStudents, useAddStudent, useUpdateStudent } from '@/hooks/useStudents';
import { useClasses } from '@/hooks/useClasses';
import { useTheme } from '@/contexts/ThemeContext';
import { Text, Button, Input, ScreenHeader, Card, LoadingScreen } from '@/components/ui';
import { Colors } from '@/constants/Colors';
import { Layout } from '@/constants/Layout';

const studentSchema = z.object({
  name:        z.string().min(3, 'الاسم يجب أن يكون 3 أحرف على الأقل'),
  parentPhone: z.string().min(9, 'رقم الهاتف غير صحيح').max(15),
  classId:     z.string().min(1, 'يرجى اختيار الفصل'),
  gender:      z.enum(['male', 'female']).default('male'),
  address:     z.string().optional(),
  birthDate:   z.string().optional(),
});

type StudentForm = z.infer<typeof studentSchema>;

export default function StudentFormScreen() {
  const { id }      = useLocalSearchParams<{ id: string }>();
  const isNew       = id === 'new';
  const router      = useRouter();
  const insets      = useSafeAreaInsets();
  const { colors }  = useTheme();

  const { data: students, isLoading: loadingStudents } = useStudents();
  const { data: classes,  isLoading: loadingClasses }  = useClasses();
  const addStudent    = useAddStudent();
  const updateStudent = useUpdateStudent();

  const student = students?.find(s => s.id === id);

  const { control, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm<StudentForm>({
    resolver: zodResolver(studentSchema),
    defaultValues: {
      name:        '',
      parentPhone: '',
      classId:     '',
      gender:      'male',
      address:     '',
      birthDate:   '',
    },
  });

  useEffect(() => {
    if (student && !isNew) {
      reset({
        name:        student.name,
        parentPhone: student.parentPhone ?? '',
        classId:     student.classId ?? '',
        gender:      (student.gender as any) || 'male',
        address:     student.address ?? '',
        birthDate:   student.birthDate ?? '',
      });
    }
  }, [student, isNew, reset]);

  const onSubmit = async (data: StudentForm) => {
    try {
      const className = classes?.find(c => c.id === data.classId)?.name;
      if (isNew) {
        await addStudent.mutateAsync({ ...data, className });
        Alert.alert('تم', 'تم إضافة الطالب بنجاح');
      } else {
        await updateStudent.mutateAsync({ 
          id: id!, 
          ...data, 
          className,
          oldClassId: student?.classId 
        });
        Alert.alert('تم', 'تم تحديث بيانات الطالب بنجاح');
      }
      router.back();
    } catch (err: any) {
      Alert.alert('خطأ', err.message || 'حدث خطأ أثناء حفظ البيانات');
    }
  };

  if (!isNew && loadingStudents) return <LoadingScreen />;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScreenHeader 
        title={isNew ? 'إضافة طالب جديد' : 'تعديل بيانات طالب'} 
        showBack 
      />

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
      >
        <Card style={styles.card} elevated>
          <Text variant="h4" weight="bold" style={{ marginBottom: 20 }}>المعلومات الأساسية</Text>

          <Controller
            control={control}
            name="name"
            render={({ field: { onChange, value, onBlur } }) => (
              <Input
                label="اسم الطالب كاملاً"
                placeholder="أدخل الاسم الثلاثي..."
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.name?.message}
                icon="person-outline"
              />
            )}
          />

          <Controller
            control={control}
            name="parentPhone"
            render={({ field: { onChange, value, onBlur } }) => (
              <Input
                label="رقم هاتف ولي الأمر"
                placeholder="مثال: 0500000000"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.parentPhone?.message}
                keyboardType="phone-pad"
                icon="call-outline"
              />
            )}
          />

          <Text variant="label" weight="bold" style={styles.label}>الفصل الدراسي</Text>
          <View style={styles.classGrid}>
            {classes?.map((cls) => (
              <Controller
                key={cls.id}
                control={control}
                name="classId"
                render={({ field: { value, onChange } }) => (
                  <TouchableOpacity
                    style={[
                      styles.classItem,
                      { backgroundColor: colors.input, borderColor: colors.border },
                      value === cls.id && { backgroundColor: Colors.primary[50], borderColor: Colors.primary[500] }
                    ]}
                    onPress={() => onChange(cls.id)}
                  >
                    <Text 
                      variant="caption" 
                      weight={value === cls.id ? 'bold' : 'medium'}
                      color={value === cls.id ? Colors.primary[600] : colors.text}
                    >
                      {cls.name}
                    </Text>
                  </TouchableOpacity>
                )}
              />
            ))}
          </View>
          {errors.classId && (
            <Text variant="caption" color={Colors.error.main} style={{ marginTop: 4 }}>
              {errors.classId.message}
            </Text>
          )}

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text variant="label" weight="bold" style={styles.label}>الجنس</Text>
              <View style={styles.genderRow}>
                <Controller
                  control={control}
                  name="gender"
                  render={({ field: { value, onChange } }) => (
                    <>
                      <TouchableOpacity
                        style={[styles.genderBtn, value === 'male' && styles.genderBtnActive]}
                        onPress={() => onChange('male')}
                      >
                        <Text style={[styles.genderText, value === 'male' && { color: '#fff' }]}>ذكر</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.genderBtn, value === 'female' && styles.genderBtnActive]}
                        onPress={() => onChange('female')}
                      >
                        <Text style={[styles.genderText, value === 'female' && { color: '#fff' }]}>أنثى</Text>
                      </TouchableOpacity>
                    </>
                  )}
                />
              </View>
            </View>
          </View>

          <Controller
            control={control}
            name="address"
            render={({ field: { onChange, value, onBlur } }) => (
              <Input
                label="العنوان (اختياري)"
                placeholder="الحي، الشارع..."
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                icon="location-outline"
                containerStyle={{ marginTop: 12 }}
              />
            )}
          />

          <Button
            title={isNew ? 'إضافة الطالب' : 'حفظ التعديلات'}
            onPress={handleSubmit(onSubmit)}
            loading={isSubmitting}
            fullWidth
            size="lg"
            style={{ marginTop: 24 }}
            icon={<Ionicons name="checkmark-circle" size={20} color="#fff" />}
          />
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:         { flex: 1 },
  scroll:       { padding: Layout.spacing[4] },
  card:         { padding: Layout.spacing[5] },
  label:        { marginBottom: 8, marginTop: 16, textAlign: 'right' },
  row:          { flexDirection: 'row-reverse', gap: 12 },
  classGrid:    { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  classItem:    { paddingHorizontal: 16, paddingVertical: 10, borderRadius: Layout.radius.md, borderWidth: 1, minWidth: 80, alignItems: 'center' },
  genderRow:    { flexDirection: 'row-reverse', backgroundColor: Colors.neutral[100], borderRadius: Layout.radius.md, padding: 4, gap: 4 },
  genderBtn:    { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: Layout.radius.sm },
  genderBtnActive: { backgroundColor: Colors.primary[500] },
  genderText:   { fontSize: 13, fontWeight: '700', color: Colors.neutral[600] },
});
