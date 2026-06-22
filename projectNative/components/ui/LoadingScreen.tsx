import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Text } from './Text';
import { useTheme } from '@/contexts/ThemeContext';
import { Colors } from '@/constants/Colors';

interface Props {
  message?: string;
  fullScreen?: boolean;
}

export function LoadingScreen({ message, fullScreen = true }: Props) {
  const { colors } = useTheme();

  return (
    <View style={[
      styles.container,
      fullScreen && styles.fullScreen,
      { backgroundColor: colors.background },
    ]}>
      <View style={styles.inner}>
        <ActivityIndicator size="large" color={Colors.primary[500]} />
        {message && (
          <Text variant="body" muted style={{ marginTop: 12 }}>
            {message}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems:     'center',
    justifyContent: 'center',
    padding:        24,
  },
  fullScreen: {
    flex: 1,
  },
  inner: {
    alignItems: 'center',
  },
});
