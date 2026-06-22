import React, { useState, forwardRef } from 'react';
import {
  View,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { Text } from './Text';
import { useTheme } from '@/contexts/ThemeContext';
import { Colors } from '@/constants/Colors';
import { Layout } from '@/constants/Layout';
import { Typography } from '@/constants/Typography';
import { Ionicons } from '@expo/vector-icons';

interface Props extends TextInputProps {
  label?:       string;
  error?:       string;
  hint?:        string;
  leftIcon?:    React.ReactNode;
  rightIcon?:   React.ReactNode;
  isPassword?:  boolean;
  containerStyle?: ViewStyle;
  required?:    boolean;
}

export const Input = forwardRef<TextInput, Props>(({
  label,
  error,
  hint,
  leftIcon,
  rightIcon,
  isPassword = false,
  containerStyle,
  required,
  style,
  ...props
}, ref) => {
  const { colors, isDark } = useTheme();
  const [focused,     setFocused]     = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const borderColor = error
    ? Colors.error.main
    : focused
    ? Colors.primary[500]
    : colors.inputBorder;

  const bgColor = colors.input;

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {label && (
        <View style={styles.labelRow}>
          <Text variant="label" style={{ color: colors.textSecondary }}>
            {label}
          </Text>
          {required && (
            <Text variant="caption" color={Colors.error.main}> *</Text>
          )}
        </View>
      )}

      <View style={[
        styles.inputContainer,
        {
          backgroundColor: bgColor,
          borderColor,
          borderWidth: focused ? 2 : 1.5,
          borderRadius: Layout.radius.lg,
        },
      ]}>
        {/* Right icon (RTL: appears on right = start) */}
        {leftIcon && (
          <View style={styles.iconLeft}>{leftIcon}</View>
        )}

        <TextInput
          ref={ref}
          style={[
            styles.input,
            {
              color:     colors.text,
              fontSize:  Typography.sizes.base,
              textAlign: 'right',
              flex: 1,
            },
            style,
          ]}
          placeholderTextColor={colors.placeholder}
          secureTextEntry={isPassword && !showPassword}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          writingDirection="rtl"
          {...props}
        />

        {/* Password toggle */}
        {isPassword && (
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            style={styles.iconRight}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={colors.icon}
            />
          </TouchableOpacity>
        )}

        {/* Custom right icon */}
        {rightIcon && !isPassword && (
          <View style={styles.iconRight}>{rightIcon}</View>
        )}
      </View>

      {/* Error or hint */}
      {error ? (
        <View style={styles.feedbackRow}>
          <Ionicons name="alert-circle-outline" size={13} color={Colors.error.main} />
          <Text variant="caption" color={Colors.error.main} style={{ marginRight: 4, textAlign: 'right' }}>
            {error}
          </Text>
        </View>
      ) : hint ? (
        <Text variant="caption" muted style={{ marginTop: 4, textAlign: 'right' }}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
});

Input.displayName = 'Input';

const styles = StyleSheet.create({
  wrapper: {
    gap: 6,
  },
  labelRow: {
    flexDirection:  'row-reverse',
    alignItems:     'center',
    marginBottom:   2,
  },
  inputContainer: {
    flexDirection:  'row-reverse',
    alignItems:     'center',
    height:         52,
    paddingHorizontal: 14,
    overflow:       'hidden',
  },
  input: {
    paddingVertical: 0,
    fontWeight:     '500',
  },
  iconLeft: {
    marginLeft: 8,
  },
  iconRight: {
    marginRight: 8,
  },
  feedbackRow: {
    flexDirection:  'row-reverse',
    alignItems:     'center',
    gap:            4,
    marginTop:      4,
  },
});
