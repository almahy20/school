import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { Button } from './Button';
import { useTheme } from '@/contexts/ThemeContext';
import { Colors } from '@/constants/Colors';

interface Props {
  icon?:        keyof typeof Ionicons.glyphMap;
  title:        string;
  description?: string;
  actionLabel?: string;
  onAction?:    () => void;
  style?:       ViewStyle;
}

export function EmptyState({ icon = 'folder-open-outline', title, description, actionLabel, onAction, style }: Props) {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, style]}>
      <View style={[styles.iconWrap, { backgroundColor: Colors.primary[50] }]}>
        <Ionicons name={icon} size={40} color={Colors.primary[400]} />
      </View>
      <Text variant="h4" align="center" style={{ marginTop: 16 }}>{title}</Text>
      {description && (
        <Text variant="body" muted align="center" style={{ marginTop: 8, maxWidth: 280 }}>
          {description}
        </Text>
      )}
      {actionLabel && onAction && (
        <Button
          title={actionLabel}
          onPress={onAction}
          variant="primary"
          size="md"
          style={{ marginTop: 20 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems:     'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  iconWrap: {
    width:          80,
    height:         80,
    borderRadius:   40,
    alignItems:     'center',
    justifyContent: 'center',
  },
});
