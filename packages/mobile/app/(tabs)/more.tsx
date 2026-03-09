import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Alert,
  type AlertButton,
  Linking,
} from 'react-native';
import Constants from 'expo-constants';
import Svg, { Path, Rect, Circle, Line } from 'react-native-svg';
import { useAuthStore } from '../../src/stores/auth';
import { colors, fontSize, fontWeight, borderRadius, spacing } from '../../src/utils/theme';

interface SettingsItem {
  title: string;
  subtitle: string;
  icon: 'shield' | 'bell' | 'creditcard' | 'link' | 'help' | 'info' | 'download';
  accentColor: string;
  onPress?: () => void;
}

function SettingsIcon({
  icon,
  color,
}: {
  icon: SettingsItem['icon'];
  color: string;
}) {
  const size = 20;
  switch (icon) {
    case 'shield':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );
    case 'bell':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );
    case 'creditcard':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Rect
            x={1}
            y={4}
            width={22}
            height={16}
            rx={2}
            stroke={color}
            strokeWidth={2}
          />
          <Line
            x1={1}
            y1={10}
            x2={23}
            y2={10}
            stroke={color}
            strokeWidth={2}
          />
        </Svg>
      );
    case 'link':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );
    case 'help':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Circle
            cx={12}
            cy={12}
            r={10}
            stroke={color}
            strokeWidth={2}
          />
          <Path
            d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3M12 17h.01"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );
    case 'info':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Circle
            cx={12}
            cy={12}
            r={10}
            stroke={color}
            strokeWidth={2}
          />
          <Line
            x1={12}
            y1={16}
            x2={12}
            y2={12}
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
          />
          <Line
            x1={12}
            y1={8}
            x2={12.01}
            y2={8}
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
          />
        </Svg>
      );
    case 'download':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );
    default:
      return null;
  }
}

export default function MoreScreen() {
  const { user, logout } = useAuthStore();
  const webUrl = process.env.EXPO_PUBLIC_WEB_URL?.replace(/\/$/, '') ?? null;
  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  async function openUrl(url: string, title: string) {
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert(title, 'Unable to open that link on this device.');
        return;
      }

      await Linking.openURL(url);
    } catch {
      Alert.alert(title, 'Unable to open that link right now.');
    }
  }

  function openWebOnlySetting(title: string, path?: string) {
    const buttons: AlertButton[] = [];

    if (webUrl && path) {
      buttons.push({
        text: 'Open Web App',
        onPress: () => {
          void openUrl(`${webUrl}${path}`, title);
        },
      });
    }

    buttons.push({ text: 'Not Now', style: 'cancel' as const });

    Alert.alert(
      title,
      webUrl && path
        ? 'This feature is available in the web app for now.'
        : 'This feature is available on the web app for now. Set EXPO_PUBLIC_WEB_URL to open it from mobile.',
      buttons,
    );
  }

  function handleHelpAndSupport() {
    const buttons: AlertButton[] = [
      {
        text: 'Email Support',
        onPress: () => {
          void openUrl(
            'mailto:support@financeowl.com?subject=FinanceOwl%20Support',
            'Help & Support',
          );
        },
      },
    ];

    if (webUrl) {
      buttons.push({
        text: 'Help Center',
        onPress: () => {
          void openUrl(`${webUrl}/help`, 'Help & Support');
        },
      });
    }

    buttons.push({ text: 'Cancel', style: 'cancel' as const });

    Alert.alert(
      'Help & Support',
      'Need help with billing, security, or a bug report?',
      buttons,
    );
  }

  function handleAbout() {
    const buttons: AlertButton[] = [];

    if (webUrl) {
      buttons.push({
        text: 'Privacy',
        onPress: () => {
          void openUrl(`${webUrl}/privacy`, 'About');
        },
      });
      buttons.push({
        text: 'Terms',
        onPress: () => {
          void openUrl(`${webUrl}/terms`, 'About');
        },
      });
    }

    buttons.push({ text: 'OK', style: 'cancel' as const });

    Alert.alert(
      'About FinanceOwl',
      `Version ${appVersion}${webUrl ? `\n${webUrl}` : ''}`,
      buttons,
    );
  }

  function handleLogout() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: () => logout(),
      },
    ]);
  }

  const settingsItems: SettingsItem[] = [
    {
      title: 'Security',
      subtitle: 'Password, 2FA, and sessions',
      icon: 'shield',
      accentColor: colors.primary[400],
      onPress: () => openWebOnlySetting('Security', '/settings/security'),
    },
    {
      title: 'Notifications',
      subtitle: 'Email alerts and push notification settings',
      icon: 'bell',
      accentColor: '#fbbf24',
      onPress: () =>
        openWebOnlySetting('Notifications', '/settings/notifications'),
    },
    {
      title: 'Billing',
      subtitle: 'Subscription plan and payment details',
      icon: 'creditcard',
      accentColor: colors.primary[500],
      onPress: () => openWebOnlySetting('Billing', '/settings/billing'),
    },
    {
      title: 'Connected Accounts',
      subtitle: 'Manage linked bank accounts',
      icon: 'link',
      accentColor: '#06b6d4',
      onPress: () => openWebOnlySetting('Connected Accounts', '/accounts'),
    },
    {
      title: 'Data Export',
      subtitle: 'Download your financial data',
      icon: 'download',
      accentColor: '#8b5cf6',
      onPress: () => openWebOnlySetting('Data Export', '/settings/privacy'),
    },
    {
      title: 'Help & Support',
      subtitle: 'FAQs, contact us, report a bug',
      icon: 'help',
      accentColor: '#f97316',
      onPress: handleHelpAndSupport,
    },
    {
      title: 'About',
      subtitle: 'Version, terms, and privacy policy',
      icon: 'info',
      accentColor: colors.surface[400],
      onPress: handleAbout,
    },
  ];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
    >
      {/* User card */}
      <View style={styles.userCard}>
        <View style={styles.userAvatar}>
          <Text style={styles.userAvatarText}>
            {user?.name?.charAt(0).toUpperCase() ?? '?'}
          </Text>
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{user?.name ?? 'User'}</Text>
          <Text style={styles.userEmail}>{user?.email ?? ''}</Text>
        </View>
      </View>

      {/* Settings list */}
      <View style={styles.settingsList}>
        {settingsItems.map((item) => (
          <Pressable
            key={item.title}
            style={({ pressed }) => [
              styles.settingsItem,
              pressed && styles.settingsItemPressed,
            ]}
            onPress={item.onPress}
          >
            <View
              style={[
                styles.settingsIcon,
                { backgroundColor: item.accentColor + '18' },
              ]}
            >
              <SettingsIcon icon={item.icon} color={item.accentColor} />
            </View>
            <View style={styles.settingsTextContainer}>
              <Text style={styles.settingsTitle}>{item.title}</Text>
              <Text style={styles.settingsSubtitle}>{item.subtitle}</Text>
            </View>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
              <Path
                d="M9 18l6-6-6-6"
                stroke={colors.surface[500]}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </Pressable>
        ))}
      </View>

      {/* Sign out */}
      <Pressable
        style={({ pressed }) => [
          styles.signOutButton,
          pressed && styles.signOutButtonPressed,
        ]}
        onPress={handleLogout}
      >
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
          <Path
            d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"
            stroke={colors.danger[400]}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
        <Text style={styles.signOutText}>Sign Out</Text>
      </Pressable>

      {/* App version */}
      <Text style={styles.versionText}>FinanceOwl v{appVersion}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surface[900],
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing['5xl'],
    gap: spacing.lg,
  },

  // User card
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    backgroundColor: colors.surface[800],
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.surface[700] + '80',
    padding: spacing.xl,
  },
  userAvatar: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary[600] + '30',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.primary[500] + '30',
  },
  userAvatarText: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.primary[400],
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.white,
  },
  userEmail: {
    fontSize: fontSize.sm,
    color: colors.surface[400],
    marginTop: 2,
  },

  // Settings list
  settingsList: {
    backgroundColor: colors.surface[800],
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.surface[700] + '80',
    overflow: 'hidden',
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface[700] + '40',
  },
  settingsItemPressed: {
    backgroundColor: colors.surface[750],
  },
  settingsIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsTextContainer: {
    flex: 1,
    minWidth: 0,
  },
  settingsTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.white,
  },
  settingsSubtitle: {
    fontSize: fontSize.xs,
    color: colors.surface[400],
    marginTop: 2,
  },

  // Sign out
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.danger[500] + '30',
    backgroundColor: colors.danger[500] + '08',
  },
  signOutButtonPressed: {
    backgroundColor: colors.danger[500] + '18',
  },
  signOutText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.danger[400],
  },

  // Version
  versionText: {
    fontSize: fontSize.xs,
    color: colors.surface[600],
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
