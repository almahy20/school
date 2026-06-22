import React from 'react';
import { View, Image, StyleSheet, ViewStyle } from 'react-native';
import { Text } from './Text';
import { Colors } from '@/constants/Colors';
import { Layout } from '@/constants/Layout';

type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface Props {
  name?:   string;
  uri?:    string;
  size?:   Size;
  color?:  string;
  style?:  ViewStyle;
}

const sizeMap: Record<Size, number> = {
  xs: 28,
  sm: 36,
  md: 44,
  lg: 56,
  xl: 72,
};

const fontMap: Record<Size, number> = {
  xs: 11,
  sm: 14,
  md: 17,
  lg: 22,
  xl: 28,
};

// Generate consistent color from name
function getColorFromName(name: string): string {
  const colors = [
    Colors.primary[500],
    '#8b5cf6',
    '#ec4899',
    '#f59e0b',
    '#10b981',
    '#3b82f6',
    '#ef4444',
    '#06b6d4',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export function Avatar({ name = '', uri, size = 'md', color, style }: Props) {
  const dim = sizeMap[size];
  const fontSize = fontMap[size];
  const bgColor = color ?? getColorFromName(name);
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase();

  return (
    <View style={[
      styles.container,
      {
        width:        dim,
        height:       dim,
        borderRadius: dim / 2,
        backgroundColor: uri ? 'transparent' : bgColor,
      },
      style,
    ]}>
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: dim, height: dim, borderRadius: dim / 2 }}
          resizeMode="cover"
        />
      ) : (
        <Text style={{ color: '#fff', fontSize, fontWeight: '800' }}>
          {initials || '?'}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems:     'center',
    justifyContent: 'center',
    overflow:       'hidden',
  },
});
