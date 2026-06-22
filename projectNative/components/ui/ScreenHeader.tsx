import React from 'react';
import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from './Text';
import { useTheme } from '@/contexts/ThemeContext';
import { Colors } from '@/constants/Colors';
import { Layout } from '@/constants/Layout';

interface Props {
  title:        string;
  subtitle?:    string;
  showBack?:    boolean;
  onBack?:      () => void;
  rightAction?: React.ReactNode;
  transparent?: boolean;
}

export function ScreenHeader({
  title,
  subtitle,
  showBack    = false,
  onBack,
  rightAction,
  transparent = false,
}: Props) {
  const { colors } = useTheme();
  const router     = useRouter();
  const insets     = useSafeAreaInsets();

  const handleBack = () => {
    if (onBack) onBack();
    else router.back();
  };

  return (
    <View style={[
      styles.container,
      {
        paddingTop:      insets.top + 8,
        backgroundColor: transparent ? 'transparent' : colors.surface,
        borderBottomColor: transparent ? 'transparent' : colors.border,
        borderBottomWidth: transparent ? 0 : 1,
      },
    ]}>
      <View style={styles.inner}>
        {/* Right side: back button or spacer */}
        <View style={styles.side}>
          {showBack && (
            <TouchableOpacity
              onPress={handleBack}
              style={[styles.backBtn, { backgroundColor: colors.input }]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="chevron-forward" size={20} color={colors.text} />
            </TouchableOpacity>
          )}
        </View>

        {/* Center: title */}
        <View style={styles.titleWrap}>
          <Text variant="h4" weight="black" align="center" numberOfLines={1}>
            {title}
          </Text>
          {subtitle && (
            <Text variant="caption" muted align="center" numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>

        {/* Left side: action or spacer */}
        <View style={styles.side}>
          {rightAction ?? <View style={styles.backBtn} />}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 12,
    paddingHorizontal: Layout.spacing[4],
  },
  inner: {
    flexDirection:  'row-reverse',
    alignItems:     'center',
    justifyContent: 'space-between',
    minHeight:      Layout.heights.header,
  },
  side: {
    width:          44,
    alignItems:     'center',
    justifyContent: 'center',
  },
  backBtn: {
    width:          36,
    height:         36,
    borderRadius:   Layout.radius.md,
    alignItems:     'center',
    justifyContent: 'center',
  },
  titleWrap: {
    flex:    1,
    alignItems: 'center',
  },
});
