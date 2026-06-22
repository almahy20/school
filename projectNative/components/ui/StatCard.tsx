import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { Card } from './Card';
import { useTheme } from '@/contexts/ThemeContext';
import { Colors } from '@/constants/Colors';
import { Layout } from '@/constants/Layout';

interface Props {
  title:       string;
  value:       string | number;
  icon:        keyof typeof Ionicons.glyphMap;
  iconColor?:  string;
  iconBg?:     string;
  trend?:      { value: number; label: string };
  subtitle?:   string;
  style?:      ViewStyle;
  onPress?:    () => void;
}

export function StatCard({
  title,
  value,
  icon,
  iconColor = Colors.primary[500],
  iconBg    = Colors.primary[50],
  trend,
  subtitle,
  style,
  onPress,
}: Props) {
  const { colors } = useTheme();
  const isPositive = (trend?.value ?? 0) >= 0;

  return (
    <Card style={[styles.card, style]} onPress={onPress}>
      <View style={styles.header}>
        <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
          <Ionicons name={icon} size={22} color={iconColor} />
        </View>
        {trend && (
          <View style={[
            styles.trendBadge,
            { backgroundColor: isPositive ? Colors.success.light : Colors.error.light },
          ]}>
            <Ionicons
              name={isPositive ? 'trending-up' : 'trending-down'}
              size={12}
              color={isPositive ? Colors.success.dark : Colors.error.dark}
            />
            <Text style={{
              fontSize:   11,
              fontWeight: '700',
              color:      isPositive ? Colors.success.dark : Colors.error.dark,
              marginRight: 2,
            }}>
              {Math.abs(trend.value)}%
            </Text>
          </View>
        )}
      </View>

      <Text
        variant="h2"
        weight="black"
        style={{ marginTop: 12, color: colors.text }}
      >
        {typeof value === 'number' ? value.toLocaleString('ar-EG') : value}
      </Text>

      <Text variant="label" muted style={{ marginTop: 4 }}>
        {title}
      </Text>

      {subtitle && (
        <Text variant="caption" muted style={{ marginTop: 2 }}>
          {subtitle}
        </Text>
      )}

      {trend && (
        <Text variant="caption" muted style={{ marginTop: 6 }}>
          {trend.label}
        </Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 140,
  },
  header: {
    flexDirection:  'row-reverse',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  iconWrap: {
    width:          44,
    height:         44,
    borderRadius:   Layout.radius.lg,
    alignItems:     'center',
    justifyContent: 'center',
  },
  trendBadge: {
    flexDirection:  'row-reverse',
    alignItems:     'center',
    paddingHorizontal: 8,
    paddingVertical:   4,
    borderRadius:   Layout.radius.full,
    gap:            3,
  },
});
