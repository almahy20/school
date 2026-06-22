import React from 'react';
import { View, ViewStyle, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { Layout } from '@/constants/Layout';

interface Props {
  children:    React.ReactNode;
  style?:      ViewStyle;
  onPress?:    () => void;
  elevated?:   boolean;
  noPadding?:  boolean;
  radius?:     number;
}

export function Card({ children, style, onPress, elevated = false, noPadding = false, radius }: Props) {
  const { colors } = useTheme();

  const cardStyle: ViewStyle = {
    backgroundColor: elevated ? colors.surfaceElevated : colors.card,
    borderRadius:    radius ?? Layout.radius.xl,
    borderWidth:     1,
    borderColor:     colors.cardBorder,
    padding:         noPadding ? 0 : Layout.spacing[4],
    overflow:        'hidden',
    ...Layout.shadows.md,
  };

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.85}
        style={[cardStyle, style]}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return (
    <View style={[cardStyle, style]}>
      {children}
    </View>
  );
}
