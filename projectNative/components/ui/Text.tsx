import React from 'react';
import { Text as RNText, TextProps, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { Typography } from '@/constants/Typography';

type Variant = 'h1' | 'h2' | 'h3' | 'h4' | 'body' | 'bodyLg' | 'caption' | 'label' | 'overline';
type Weight  = 'regular' | 'medium' | 'semibold' | 'bold' | 'black';
type Align   = 'left' | 'center' | 'right' | 'auto';

interface Props extends TextProps {
  variant?:  Variant;
  weight?:   Weight;
  color?:    string;
  align?:    Align;
  muted?:    boolean;
  secondary?: boolean;
  children:  React.ReactNode;
}

const variantStyles: Record<Variant, { fontSize: number; fontWeight: string; lineHeight?: number }> = {
  h1:       { fontSize: Typography.sizes['4xl'], fontWeight: Typography.weights.black,   lineHeight: 40 },
  h2:       { fontSize: Typography.sizes['3xl'], fontWeight: Typography.weights.black,   lineHeight: 34 },
  h3:       { fontSize: Typography.sizes['2xl'], fontWeight: Typography.weights.bold,    lineHeight: 30 },
  h4:       { fontSize: Typography.sizes.xl,     fontWeight: Typography.weights.bold,    lineHeight: 26 },
  bodyLg:   { fontSize: Typography.sizes.md,     fontWeight: Typography.weights.regular, lineHeight: 24 },
  body:     { fontSize: Typography.sizes.base,   fontWeight: Typography.weights.regular, lineHeight: 22 },
  label:    { fontSize: Typography.sizes.sm,     fontWeight: Typography.weights.semibold, lineHeight: 20 },
  caption:  { fontSize: Typography.sizes.xs,     fontWeight: Typography.weights.regular, lineHeight: 16 },
  overline: { fontSize: Typography.sizes.xs,     fontWeight: Typography.weights.bold,    lineHeight: 16 },
};

export function Text({
  variant   = 'body',
  weight,
  color,
  align     = 'auto',
  muted     = false,
  secondary = false,
  style,
  children,
  ...props
}: Props) {
  const { colors } = useTheme();

  const textColor = color
    ? color
    : muted
    ? colors.textMuted
    : secondary
    ? colors.textSecondary
    : colors.text;

  const vStyle = variantStyles[variant];
  const fw = weight ? Typography.weights[weight] : vStyle.fontWeight;

  // Default alignment logic: if it's 'auto', we use 'right' for Arabic (RTL) context
  const textAlign = align === 'auto' ? 'right' : align;

  return (
    <RNText
      style={[
        {
          fontSize:   vStyle.fontSize,
          fontWeight: fw as any,
          lineHeight: vStyle.lineHeight,
          color:      textColor,
          textAlign,
          writingDirection: 'rtl',
        },
        style,
      ]}
      {...props}
    >
      {children}
    </RNText>
  );
}
