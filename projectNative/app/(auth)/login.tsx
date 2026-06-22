import React, { useState, useRef } from 'react';
import {
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  Dimensions,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Text, Button, Input, Card } from '@/components/ui';
import { Colors } from '@/constants/Colors';
import { Layout } from '@/constants/Layout';
import { createAdminAccount } from '@/lib/auth/authService';

const { width } = Dimensions.get('window');

// ── Validation Schema ─────────────────────────────────────────────────────────
const loginSchema = z.object({
  phone:    z.string().min(9, 'رقم الهاتف غير صحيح').max(15),
  password: z.string().min(6, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'),
});

type LoginForm = z.infer<typeof loginSchema>;

// ── Component ─────────────────────────────────────────────────────────────────
export default function LoginScreen() {
  const { login }   = useAuth();
  const { colors, isDark } = useTheme();
  const router      = useRouter();
  const insets      = useSafeAreaInsets();
  const passwordRef = useRef<TextInput>(null);

  const [serverError, setServerError] = useState<string | null>(null);
  const [initLoading, setInitLoading] = useState(false);

  const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { phone: '', password: '' },
  });

  const onSubmit = async (data: LoginForm) => {
    setServerError(null);
    const error = await login(data.phone, data.password);
    if (error) {
      setServerError(error);
    }
  };

  const onInitialize = async () => {
    if (initLoading) return;
    setInitLoading(true);
    setServerError(null);
    
    try {
      const { error } = await createAdminAccount({
        phone: '0500000000',
        password: 'password123',
        fullName: 'المدير العام',
        schoolName: 'المدرسة الأولى النموذجية',
        schoolSlug: 'main-school'
      });
      
      if (error) {
        setServerError(error);
      } else {
        alert('تمت تهيئة النظام بنجاح! يمكنك الدخول بـ 0500000000 و password123');
      }
    } catch (err: any) {
      setServerError(err.message || 'فشلت عملية التهيئة');
    } finally {
      setInitLoading(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Decorative gradient top */}
      <View style={styles.topDecor}>
        <View style={[styles.circle1, { backgroundColor: Colors.primary[500] + '20' }]} />
        <View style={[styles.circle2, { backgroundColor: Colors.primary[400] + '15' }]} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo & Brand */}
          <View style={styles.brand}>
            <View style={[styles.logoWrap, { backgroundColor: Colors.primary[500] }]}>
              <Ionicons name="school" size={36} color="#fff" />
            </View>
            <Text variant="h2" weight="black" align="center" style={{ marginTop: 16 }}>
              إدارة المدرسة
            </Text>
            <Text variant="body" muted align="center" style={{ marginTop: 6 }}>
              منصة إدارة تعليمية متكاملة
            </Text>
          </View>

          {/* Login Card */}
          <Card style={styles.card} elevated>
            <Text variant="h4" weight="bold" align="right" style={{ marginBottom: 4 }}>
              تسجيل الدخول
            </Text>
            <Text variant="body" muted align="right" style={{ marginBottom: 24 }}>
              أدخل رقم هاتفك وكلمة المرور
            </Text>

            {/* Phone */}
            <Controller
              control={control}
              name="phone"
              render={({ field: { onChange, value, onBlur } }) => (
                <Input
                  label="رقم الهاتف"
                  placeholder="05xxxxxxxx"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.phone?.message}
                  keyboardType="phone-pad"
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                  leftIcon={<Ionicons name="call-outline" size={18} color={colors.icon} />}
                  required
                />
              )}
            />

            <View style={{ height: 16 }} />

            {/* Password */}
            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, value, onBlur } }) => (
                <Input
                  ref={passwordRef}
                  label="كلمة المرور"
                  placeholder="••••••••"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.password?.message}
                  isPassword
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit(onSubmit)}
                  leftIcon={<Ionicons name="lock-closed-outline" size={18} color={colors.icon} />}
                  required
                />
              )}
            />

            {/* Server Error */}
            {serverError && (
              <View style={[styles.errorBox, { backgroundColor: Colors.error.light }]}>
                <Ionicons name="alert-circle" size={16} color={Colors.error.dark} />
                <Text variant="caption" style={{ color: Colors.error.dark, flex: 1, marginRight: 6 }}>
                  {serverError}
                </Text>
              </View>
            )}

            <View style={{ height: 24 }} />

            {/* Submit */}
            <Button
              title="تسجيل الدخول"
              onPress={handleSubmit(onSubmit)}
              loading={isSubmitting}
              fullWidth
              size="lg"
              iconRight={<Ionicons name="arrow-back" size={18} color="#fff" />}
            />

            <Button
              title="تهيئة النظام (مدير جديد)"
              onPress={onInitialize}
              loading={initLoading}
              variant="outline"
              fullWidth
              size="md"
              style={{ marginTop: 12 }}
            />
          </Card>

          {/* Footer */}
          <Text variant="caption" muted align="center" style={{ marginTop: 24 }}>
            نظام إدارة المدارس © {new Date().getFullYear()}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  topDecor: {
    position:   'absolute',
    top:        -60,
    right:      -60,
    width:      300,
    height:     300,
    zIndex:     0,
  },
  circle1: {
    position:     'absolute',
    width:        250,
    height:       250,
    borderRadius: 125,
    top:          0,
    right:        0,
  },
  circle2: {
    position:     'absolute',
    width:        180,
    height:       180,
    borderRadius: 90,
    top:          60,
    right:        80,
  },
  scroll: {
    flexGrow:          1,
    paddingHorizontal: Layout.spacing[5],
    justifyContent:    'center',
  },
  brand: {
    alignItems:   'center',
    marginBottom: 32,
  },
  logoWrap: {
    width:          80,
    height:         80,
    borderRadius:   24,
    alignItems:     'center',
    justifyContent: 'center',
    ...Layout.shadows.colored(Colors.primary[500]),
  },
  card: {
    padding: Layout.spacing[6],
  },
  errorBox: {
    flexDirection:  'row-reverse',
    alignItems:     'center',
    padding:        12,
    borderRadius:   Layout.radius.md,
    marginTop:      16,
    gap:            8,
  },
});
