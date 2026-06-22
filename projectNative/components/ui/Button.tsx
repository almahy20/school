import React from 'react';
import {
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
  View,
} from 'react-native';
import { Text } from './Text';
import { useTheme } from '@/contexts/ThemeContext';
import { Colors } from '@/constants/Colors';
import { Layout } from '@/constants/Layout';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
type Size    = 'sm' | 'md' | 'lg';

interface Props {
  title:       string;
  onPress:     () => void;
  variant?:    Variant;
  size?:       Size;
  loading?:    boolean;
  disabled?:   boolean;
  icon?:       React.ReactNode;
  iconRight?:  React.ReactNode;
  fullWidth?:  boolean;
  style?:      ViewStyle;
  textStyle?:  TextStyle;
}

const sizeConfig: Record<Size, { height: number; px: number; fontSize: number; radius: number }> = {
  sm: { height: 40, px: 16, fontSize: 13, radius: Layout.radius.md },
  md: { height: 52, px: 20, fontSize: 15, radius: Layout.radius.lg },
  lg: { height: 60, px: 24, fontSize: 17, radius: Layout.radius.xl },
};

export function Button({
  title,
  onPress,
  variant   = 'primary',
  size      = 'md',
  loading   = false,
  disabled  = false,
  icon,
  iconRight,
  fullWidth = false,
  style,
  textStyle,
}: Props) {
  const { isDark } = useTheme();
  const cfg = sizeConfig[size];
  const isDisabled = disabled || loading;

  const getStyles = (): { container: ViewStyle; text: TextStyle } => {
    const base: ViewStyle = {
      height:         cfg.height,
      paddingHorizontal: cfg.px,
      borderRadius:   cfg.radius,
      flexDirection:  'row',
      alignItems:     'center',
      justifyContent: 'center',
      gap:            8,
      opacity:        isDisabled ? 0.6 : 1,
      alignSelf:      fullWidth ? 'stretch' : 'auto',
    };

    switch (variant) {
      case 'primary':
        return {
          container: { ...base, backgroundColor: Colors.primary[500], ...Layout.shadows.colored(Colors.primary[500]) },
          text:      { color: '#fff', fontSize: cfg.fontSize, fontWeight: '700' },
        };
      case 'secondary':
        return {
          container: { ...base, backgroundColor: isDark ? Colors.neutral[700] : Colors.neutral[100] },
          text:      { color: isDark ? Colors.neutral[100] : Colors.neutral[800], fontSize: cfg.fontSize, fontWeight: '600' },
        };
      case 'outline':
        return {
          container: { ...base, backgroundColor: 'transparent', borderWidth: 1.5, borderColor: Colors.primary[500] },
          text:      { color: Colors.primary[500], fontSize: cfg.fontSize, fontWeight: '600' },
        };
      case 'ghost':
        return {
          container: { ...base, backgroundColor: 'transparent' },
          text:      { color: Colors.primary[500], fontSize: cfg.fontSize, fontWeight: '600' },
        };
      case 'danger':
        return {
          container: { ...base, backgroundColor: Colors.error.main, ...Layout.shadows.colored(Colors.error.main) },
          text:      { color: '#fff', fontSize: cfg.fontSize, fontWeight: '700' },
        };
      case 'success':
        return {
          container: { ...base, backgroundColor: Colors.success.main, ...Layout.shadows.colored(Colors.success.main) },
          text:      { color: '#fff', fontSize: cfg.fontSize, fontWeight: '700' },
        };
    }
  };

  const { container, text } = getStyles();

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
      style={[container, style]}
    >
      {loading ? (
        <ActivityIndicator color={text.color as string} size="small" />
      ) : (
        <>
          {icon && <View>{icon}</View>}
          <Text style={[text, textStyle]}>{title}</Text>
          {iconRight && <View>{iconRight}</View>}
        </>
      )}
    </TouchableOpacity>
  );
}
