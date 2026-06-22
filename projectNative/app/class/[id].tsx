import React, { useEffect } from 'react';
import { View, ScrollView, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useClasses, useAddClass, useUpdateClass } from '@/hooks/useClasses';
import { useTeachers } from '@/hooks/useUsers';
import { useTheme } from '@/contexts/ThemeContext';
import { Text, Button, Input, ScreenHeader, Card, LoadingScreen } from '@/components/ui';
import { Colors } from '@/constants/Colors';
import { Layout } from '@/constants/Layout';

const classSchema = z.object({
  name:       z.string().min(2, 'اسم الفصل يجب أن يكون حرفين على الأقل'),
  gradeLevel: z.string().min(1, 'يرجى تحديد الصف الدراسي'),
  teacherId:  z.string().optional(),
});

type ClassForm = z.infer<typeof classSchema>;

export default function ClassFormScreen() {
  const { id }      = useLocalSearchParams<{ id: string }>();
  const isNew       = id === 'new';
  const router      = useRouter();
  const insets      = useSafeAreaInsets();
  const { colors }  = useTheme();

  const { data: classes,  isLoading: loadingClasses }  = useClasses();
  const { data: teachers, isLoading: loadingTeachers } = useTeachers();
  const addClass    = useAddClass();
  const updateClass = useUpdateClass();

  const cls = classes?.find(c => c.id === id);

  const { control, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<ClassForm>({
    resolver: zodResolver(classSchema),
    defaultValues: {
      name:       '',
      gradeLevel: '',
      teacherId:  '',
    },
  });

  useEffect(() => {
    if (cls && !isNew) {
      reset({
        name:       cls.name,
        gradeLevel: cls.gradeLevel ?? '',
        teacherId:  cls.teacherId ?? '',
      });
    }
  }, [cls, isNew, reset]);

  const onSubmit = async (data: ClassForm) => {
    try {
      const teacherName = teachers?.find(t => t.id === data.teacherId)?.fullName;
      if (isNew) {
        await addClass.mutateAsync({ ...data, teacherName });
        Alert.alert('تم', 'تم إنشاء الفصل بنجاح');
      } else {
        await updateClass.mutateAsync({ id: id!, ...data, teacherName });
        Alert.alert('تم', 'تم تحديث بيانات الفصل بنجاح');
      }
      router.back();
    } catch (err: any) {
      Alert.alert('خطأ', err.message || 'حدث خطأ أثناء حفظ البيانات');
    }
  };

  if (!isNew && loadingClasses) return <LoadingScreen />;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScreenHeader 
        title={isNew ? 'إضافة فصل جديد' : 'تعديل بيانات الفصل'} 
        showBack 
      />

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
      >
        <Card style={styles.card} elevated>
          <Text variant="h4" weight="bold" style={{ marginBottom: 20 }}>معلومات الفصل</Text>

          <Controller
            control={control}
            name="name"
            render={({ field: { onChange, value, onBlur } }) => (
              <Input
                label="اسم الفصل"
                placeholder="مثال: أول / أ، 3-ب..."
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.name?.message}
                icon="school-outline"
              />
            )}
          />

          <Controller
            control={control}
            name="gradeLevel"
            render={({ field: { onChange, value, onBlur } }) => (
              <Input
                label="الصف الدراسي"
                placeholder="مثال: الصف الأول، الثاني الابتدائي..."
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.gradeLevel?.message}
                icon="layers-outline"
              />
            )}
          />

          <Text variant="label" weight="bold" style={styles.label}>المعلم المسؤول (اختياري)</Text>
          <View style={styles.teacherGrid}>
            {teachers?.map((t) => (
              <Controller
                key={t.id}
                control={control}
                name="teacherId"
                render={({ field: { value, onChange } }) => (
                  <TouchableOpacity
                    style={[
                      styles.teacherItem,
                      { backgroundColor: colors.input, borderColor: colors.border },
                      value === t.id && { backgroundColor: Colors.primary[50], borderColor: Colors.primary[500] }
                    ]}
                    onPress={() => onChange(value === t.id ? '' : t.id)}
                  >
                    <Text 
                      variant="caption" 
                      weight={value === t.id ? 'bold' : 'medium'}
                      color={value === t.id ? Colors.primary[600] : colors.text}
                    >
                      {t.fullName}
                    </Text>
                  </TouchableOpacity>
                )}
              />
            ))}
          </View>

          <View style={styles.actions}>
            <Button
              title={isNew ? 'إنشاء الفصل' : 'حفظ التعديلات'}
              onPress={handleSubmit(onSubmit)}
              loading={isSubmitting}
              fullWidth
              size="lg"
            />
          </View>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:        { flex: 1 },
  scroll:      { padding: Layout.spacing[4] },
  card:        { padding: Layout.spacing[4] },
  label:       { marginBottom: 8, marginTop: 16 },
  teacherGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  teacherItem: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: Layout.radius.md, borderWidth: 1 },
  actions:     { marginTop: 32 },
});
