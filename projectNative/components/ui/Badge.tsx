import React from 'react';
import { View, ViewStyle, StyleSheet } from 'react-native';
import { Text } from './Text';
import { Colors } from '@/constants/Colors';
import { Layout } from '@/constants/Layout';

type Variant = 'primary' | 'success' | 'warning' | 'error' | 'info' | 'neutral';
type Size    = 'sm' | 'md';

interface Props {
  label:    string;
  variant?: Variant;
  size?:    Size;
  style?:   ViewStyle;
  dot?:     boolean;
}

const variantMap: Record<Variant, { bg: string; text: string }> = {
  primary: { bg: Colors.primary[100],    text: Colors.primary[700] },
  success: { bg: Colors.success.light,   text: Colors.success.dark  },
  warning: { bg: Colors.warning.light,   text: Colors.warning.dark  },
  error:   { bg: Colors.error.light,     text: Colors.error.dark    },
  info:    { bg: Colors.info.light,      text: Colors.info.dark     },
  neutral: { bg: Colors.neutral[100],    text: Colors.neutral[600]  },
};

export function Badge({ label, variant = 'neutral', size = 'md', style, dot = false }: Props) {
  const { bg, text } = variantMap[variant];
  const isSmall = size === 'sm';

  return (
    <View style={[
      styles.badge,
      {
        backgroundColor: bg,
        paddingHorizontal: isSmall ? 8 : 10,
        paddingVertical:   isSmall ? 2 : 4,
        borderRadius:      Layout.radius.full,
        flexDirection:     'row',
        alignItems:        'center',
        gap:               4,
      },
      style,
    ]}>
      {dot && (
        <View style={{
          width:           6,
          height:          6,
          borderRadius:    3,
          backgroundColor: text,
        }} />
      )}
      <Text
        variant="caption"
        style={{
          color:      text,
          fontWeight: '700',
          fontSize:   isSmall ? 10 : 12,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
  },
});
