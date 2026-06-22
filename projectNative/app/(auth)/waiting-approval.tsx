import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Text, Button, Card } from '@/components/ui';
import { Colors } from '@/constants/Colors';
import { Layout } from '@/constants/Layout';

export default function WaitingApprovalScreen() {
  const { logout, user } = useAuth();
  const { colors }       = useTheme();
  const insets           = useSafeAreaInsets();

  return (
    <View style={[
      styles.root,
      { backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: insets.bottom },
    ]}>
      <View style={styles.content}>
        <View style={[styles.iconWrap, { backgroundColor: Colors.warning.light }]}>
          <Ionicons name="time-outline" size={48} color={Colors.warning.dark} />
        </View>

        <Text variant="h3" weight="black" align="center" style={{ marginTop: 24 }}>
          في انتظار الموافقة
        </Text>

        <Text variant="body" muted align="center" style={{ marginTop: 12, maxWidth: 300 }}>
          تم إنشاء حسابك بنجاح. يرجى الانتظار حتى يقوم مدير المدرسة بتفعيل حسابك.
        </Text>

        <Card style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="person-outline" size={18} color={colors.icon} />
            <Text variant="body" style={{ marginRight: 8, flex: 1 }}>{user?.fullName}</Text>
          </View>
          <View style={[styles.infoRow, { marginTop: 8 }]}>
            <Ionicons name="call-outline" size={18} color={colors.icon} />
            <Text variant="body" style={{ marginRight: 8, flex: 1 }}>{user?.phone}</Text>
          </View>
        </Card>

        <Button
          title="تسجيل الخروج"
          onPress={logout}
          variant="outline"
          style={{ marginTop: 24 }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
  },
  content: {
    alignItems:        'center',
    paddingHorizontal: Layout.spacing[6],
  },
  iconWrap: {
    width:          100,
    height:         100,
    borderRadius:   50,
    alignItems:     'center',
    justifyContent: 'center',
  },
  infoCard: {
    width:     '100%',
    marginTop: 24,
    padding:   Layout.spacing[4],
  },
  infoRow: {
    flexDirection:  'row-reverse',
    alignItems:     'center',
  },
});
