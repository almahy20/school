import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { Colors } from '@/constants/Colors';
import { Layout } from '@/constants/Layout';
import { Typography } from '@/constants/Typography';

interface Props {
  value:         string;
  onChangeText:  (text: string) => void;
  placeholder?:  string;
  style?:        ViewStyle;
  onClear?:      () => void;
}

export function SearchBar({ value, onChangeText, placeholder = 'بحث...', style, onClear }: Props) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View style={[
      styles.container,
      {
        backgroundColor: colors.input,
        borderColor:     focused ? Colors.primary[500] : colors.inputBorder,
        borderWidth:     focused ? 2 : 1.5,
        borderRadius:    Layout.radius.xl,
      },
      style,
    ]}>
      <Ionicons name="search-outline" size={18} color={colors.icon} style={styles.searchIcon} />

      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.placeholder}
        style={[
          styles.input,
          {
            color:    colors.text,
            fontSize: Typography.sizes.base,
            textAlign: 'right', // Explicitly right for Arabic
          },
        ]}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        writingDirection="rtl"
        returnKeyType="search"
      />

      {value.length > 0 && (
        <TouchableOpacity
          onPress={() => { onChangeText(''); onClear?.(); }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.clearBtn}
        >
          <Ionicons name="close-circle" size={18} color={colors.icon} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection:  'row-reverse',
    alignItems:     'center',
    height:         48,
    paddingHorizontal: 14,
    gap:            8,
  },
  searchIcon: {
    // left side in RTL
  },
  input: {
    flex:           1,
    paddingVertical: 0,
    fontWeight:     '500',
  },
  clearBtn: {
    padding: 2,
  },
});
