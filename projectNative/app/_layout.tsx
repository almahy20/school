import React, { useEffect } from 'react';
import { View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';

import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { queryClient } from '@/lib/queryClient';
import { LoadingScreen } from '@/components/ui';

// ── Auth Guard ────────────────────────────────────────────────────────────────
function AuthGuard() {
  const { user, isReady } = useAuth();
  const { colors, isDark } = useTheme();
  const router   = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (!isReady) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!user) {
      // Not logged in → go to login
      if (!inAuthGroup) router.replace('/(auth)/login');
    } else {
      // Logged in
      if (user.approvalStatus === 'pending') {
        if (segments.join('/') !== '(auth)/waiting-approval') {
          router.replace('/(auth)/waiting-approval');
        }
        return;
      }

      if (user.schoolStatus === 'suspended') {
        // Show suspended screen (handled inside tabs)
        if (inAuthGroup) router.replace('/(tabs)');
        return;
      }

      if (inAuthGroup) {
        // Redirect to appropriate dashboard
        router.replace('/(tabs)');
      }
    }
  }, [user, isReady, segments]);

  if (!isReady) {
    return <LoadingScreen message="جاري التحميل..." />;
  }

  // Error boundary fallback
  if (isReady && !colors) {
    return <LoadingScreen message="حدث خطأ في تحميل الإعدادات" />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen name="student/[id]" options={{ presentation: 'modal', title: 'بيانات الطالب' }} />
        <Stack.Screen name="class/[id]" options={{ presentation: 'modal', title: 'بيانات الفصل' }} />
        <Stack.Screen name="teachers/index" options={{ title: 'إدارة المعلمين' }} />
        <Stack.Screen name="parents/index" options={{ title: 'أولياء الأمور' }} />
        <Stack.Screen name="fees/index" options={{ title: 'إدارة الرسوم' }} />
        <Stack.Screen name="settings/index" options={{ title: 'الإعدادات' }} />
        <Stack.Screen name="teacher-attendance/index" options={{ title: 'حضور المعلمين' }} />
      </Stack>
    </View>
  );
}

// ── Root Layout ───────────────────────────────────────────────────────────────
export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <AuthProvider>
              <AuthGuard />
            </AuthProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
