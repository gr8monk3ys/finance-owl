import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Alert,
  type AlertButton,
  Linking,
  Modal,
  Switch,
  TextInput,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import Constants from 'expo-constants';
import Svg, { Path, Rect, Circle, Line } from 'react-native-svg';
import { useAuthStore } from '../../src/stores/auth';
import client from '../../src/api/client';
import { colors, fontSize, fontWeight, borderRadius, spacing } from '../../src/utils/theme';

interface SettingsItem {
  title: string;
  subtitle: string;
  icon: 'shield' | 'bell' | 'creditcard' | 'link' | 'help' | 'info' | 'download';
  accentColor: string;
  onPress?: () => void;
}

function SettingsIcon({ icon, color }: { icon: SettingsItem['icon']; color: string }) {
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
          <Rect x={1} y={4} width={22} height={16} rx={2} stroke={color} strokeWidth={2} />
          <Line x1={1} y1={10} x2={23} y2={10} stroke={color} strokeWidth={2} />
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
          <Circle cx={12} cy={12} r={10} stroke={color} strokeWidth={2} />
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
          <Circle cx={12} cy={12} r={10} stroke={color} strokeWidth={2} />
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

// ── Security Screen ──────────────────────────────────────────────────────────

interface SecurityScreenProps {
  visible: boolean;
  onClose: () => void;
}

function SecurityScreen({ visible, onClose }: SecurityScreenProps) {
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);
  const [connectedDevices, setConnectedDevices] = useState(1);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const fetchSecurityStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const { data } = await client.get<{ twoFactorEnabled: boolean; activeSessions: number }>(
        '/auth/security-status',
      );
      setTwoFAEnabled(data.twoFactorEnabled);
      setConnectedDevices(data.activeSessions);
    } catch {
      // Use defaults if the endpoint isn't available
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  React.useEffect(() => {
    if (visible) {
      void fetchSecurityStatus();
    }
  }, [visible, fetchSecurityStatus]);

  async function handleChangePassword() {
    if (!currentPassword || !newPassword) {
      Alert.alert('Validation', 'Please fill in all password fields.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Validation', 'New passwords do not match.');
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert('Validation', 'New password must be at least 8 characters.');
      return;
    }

    setSavingPassword(true);
    try {
      await client.post('/auth/change-password', {
        currentPassword,
        newPassword,
      });
      Alert.alert('Success', 'Your password has been updated.');
      setShowPasswordForm(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      Alert.alert('Error', 'Failed to change password. Please verify your current password.');
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={settingsStyles.container}>
        <View style={settingsStyles.header}>
          <TouchableOpacity onPress={onClose}>
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
              <Path
                d="M15 18l-6-6 6-6"
                stroke={colors.surface[400]}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </TouchableOpacity>
          <Text style={settingsStyles.headerTitle}>Security</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={settingsStyles.body} contentContainerStyle={settingsStyles.bodyContent}>
          {loadingStatus ? (
            <ActivityIndicator size="large" color={colors.primary[500]} style={{ marginTop: 40 }} />
          ) : (
            <>
              {/* 2FA Status */}
              <View style={settingsStyles.card}>
                <View style={settingsStyles.cardRow}>
                  <View style={settingsStyles.cardRowLeft}>
                    <View
                      style={[
                        settingsStyles.statusDot,
                        {
                          backgroundColor: twoFAEnabled ? colors.primary[500] : colors.surface[500],
                        },
                      ]}
                    />
                    <View>
                      <Text style={settingsStyles.cardRowTitle}>Two-Factor Authentication</Text>
                      <Text style={settingsStyles.cardRowSubtitle}>
                        {twoFAEnabled ? 'Enabled' : 'Disabled'}
                      </Text>
                    </View>
                  </View>
                  <View
                    style={[
                      settingsStyles.badge,
                      {
                        backgroundColor: twoFAEnabled
                          ? colors.primary[600] + '30'
                          : colors.surface[700],
                      },
                    ]}
                  >
                    <Text
                      style={[
                        settingsStyles.badgeText,
                        { color: twoFAEnabled ? colors.primary[400] : colors.surface[400] },
                      ]}
                    >
                      {twoFAEnabled ? 'Active' : 'Off'}
                    </Text>
                  </View>
                </View>
                {!twoFAEnabled && (
                  <Text style={settingsStyles.cardHint}>
                    Enable 2FA in the web app for enhanced account security.
                  </Text>
                )}
              </View>

              {/* Connected Devices */}
              <View style={settingsStyles.card}>
                <View style={settingsStyles.cardRow}>
                  <View style={settingsStyles.cardRowLeft}>
                    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                      <Rect
                        x={2}
                        y={3}
                        width={20}
                        height={14}
                        rx={2}
                        stroke={colors.surface[400]}
                        strokeWidth={2}
                      />
                      <Line
                        x1={8}
                        y1={21}
                        x2={16}
                        y2={21}
                        stroke={colors.surface[400]}
                        strokeWidth={2}
                        strokeLinecap="round"
                      />
                      <Line
                        x1={12}
                        y1={17}
                        x2={12}
                        y2={21}
                        stroke={colors.surface[400]}
                        strokeWidth={2}
                        strokeLinecap="round"
                      />
                    </Svg>
                    <View>
                      <Text style={settingsStyles.cardRowTitle}>Connected Devices</Text>
                      <Text style={settingsStyles.cardRowSubtitle}>
                        {connectedDevices} active session{connectedDevices !== 1 ? 's' : ''}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Change Password */}
              <View style={settingsStyles.card}>
                <Pressable
                  style={settingsStyles.cardRow}
                  onPress={() => setShowPasswordForm(!showPasswordForm)}
                >
                  <View style={settingsStyles.cardRowLeft}>
                    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                      <Path
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                        stroke={colors.surface[400]}
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </Svg>
                    <Text style={settingsStyles.cardRowTitle}>Change Password</Text>
                  </View>
                  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                    <Path
                      d={showPasswordForm ? 'M18 15l-6-6-6 6' : 'M6 9l6 6 6-6'}
                      stroke={colors.surface[400]}
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Svg>
                </Pressable>

                {showPasswordForm && (
                  <View style={settingsStyles.passwordForm}>
                    <TextInput
                      style={settingsStyles.input}
                      value={currentPassword}
                      onChangeText={setCurrentPassword}
                      placeholder="Current password"
                      placeholderTextColor={colors.surface[500]}
                      secureTextEntry
                    />
                    <TextInput
                      style={settingsStyles.input}
                      value={newPassword}
                      onChangeText={setNewPassword}
                      placeholder="New password"
                      placeholderTextColor={colors.surface[500]}
                      secureTextEntry
                    />
                    <TextInput
                      style={settingsStyles.input}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      placeholder="Confirm new password"
                      placeholderTextColor={colors.surface[500]}
                      secureTextEntry
                    />
                    <Pressable
                      style={({ pressed }) => [
                        settingsStyles.saveButton,
                        pressed && settingsStyles.saveButtonPressed,
                      ]}
                      onPress={handleChangePassword}
                      disabled={savingPassword}
                    >
                      {savingPassword ? (
                        <ActivityIndicator size="small" color={colors.white} />
                      ) : (
                        <Text style={settingsStyles.saveButtonText}>Update Password</Text>
                      )}
                    </Pressable>
                  </View>
                )}
              </View>
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ── Notifications Screen ─────────────────────────────────────────────────────

interface NotificationsScreenProps {
  visible: boolean;
  onClose: () => void;
}

function NotificationsScreen({ visible, onClose }: NotificationsScreenProps) {
  const [budgetAlerts, setBudgetAlerts] = useState(true);
  const [billReminders, setBillReminders] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(false);
  const [loadingPrefs, setLoadingPrefs] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchPreferences = useCallback(async () => {
    setLoadingPrefs(true);
    try {
      const { data } = await client.get<{
        budgetAlerts: boolean;
        billReminders: boolean;
        weeklyDigest: boolean;
      }>('/notifications/preferences');
      setBudgetAlerts(data.budgetAlerts);
      setBillReminders(data.billReminders);
      setWeeklyDigest(data.weeklyDigest);
    } catch {
      // Use defaults if endpoint isn't available
    } finally {
      setLoadingPrefs(false);
    }
  }, []);

  React.useEffect(() => {
    if (visible) {
      void fetchPreferences();
    }
  }, [visible, fetchPreferences]);

  async function savePreference(key: string, value: boolean) {
    setSaving(true);
    try {
      await client.patch('/notifications/preferences', { [key]: value });
    } catch {
      // Revert on error
      Alert.alert('Error', 'Failed to update notification preference.');
      if (key === 'budgetAlerts') setBudgetAlerts(!value);
      if (key === 'billReminders') setBillReminders(!value);
      if (key === 'weeklyDigest') setWeeklyDigest(!value);
    } finally {
      setSaving(false);
    }
  }

  function handleToggle(key: 'budgetAlerts' | 'billReminders' | 'weeklyDigest', value: boolean) {
    switch (key) {
      case 'budgetAlerts':
        setBudgetAlerts(value);
        break;
      case 'billReminders':
        setBillReminders(value);
        break;
      case 'weeklyDigest':
        setWeeklyDigest(value);
        break;
    }
    void savePreference(key, value);
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={settingsStyles.container}>
        <View style={settingsStyles.header}>
          <TouchableOpacity onPress={onClose}>
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
              <Path
                d="M15 18l-6-6 6-6"
                stroke={colors.surface[400]}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </TouchableOpacity>
          <Text style={settingsStyles.headerTitle}>Notifications</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={settingsStyles.body} contentContainerStyle={settingsStyles.bodyContent}>
          {loadingPrefs ? (
            <ActivityIndicator size="large" color={colors.primary[500]} style={{ marginTop: 40 }} />
          ) : (
            <>
              <Text style={settingsStyles.sectionLabel}>Push Notifications</Text>

              <View style={settingsStyles.card}>
                {/* Budget Alerts */}
                <View style={settingsStyles.toggleRow}>
                  <View style={settingsStyles.toggleInfo}>
                    <Text style={settingsStyles.toggleTitle}>Budget Alerts</Text>
                    <Text style={settingsStyles.toggleSubtitle}>
                      Get notified when spending nears or exceeds budget limits
                    </Text>
                  </View>
                  <Switch
                    value={budgetAlerts}
                    onValueChange={(val) => handleToggle('budgetAlerts', val)}
                    trackColor={{ false: colors.surface[700], true: colors.primary[600] }}
                    thumbColor={budgetAlerts ? colors.primary[400] : colors.surface[400]}
                    disabled={saving}
                  />
                </View>

                <View style={settingsStyles.toggleDivider} />

                {/* Bill Reminders */}
                <View style={settingsStyles.toggleRow}>
                  <View style={settingsStyles.toggleInfo}>
                    <Text style={settingsStyles.toggleTitle}>Bill Reminders</Text>
                    <Text style={settingsStyles.toggleSubtitle}>
                      Reminders before upcoming bill due dates
                    </Text>
                  </View>
                  <Switch
                    value={billReminders}
                    onValueChange={(val) => handleToggle('billReminders', val)}
                    trackColor={{ false: colors.surface[700], true: colors.primary[600] }}
                    thumbColor={billReminders ? colors.primary[400] : colors.surface[400]}
                    disabled={saving}
                  />
                </View>

                <View style={settingsStyles.toggleDivider} />

                {/* Weekly Digest */}
                <View style={settingsStyles.toggleRow}>
                  <View style={settingsStyles.toggleInfo}>
                    <Text style={settingsStyles.toggleTitle}>Weekly Digest</Text>
                    <Text style={settingsStyles.toggleSubtitle}>
                      Weekly summary of spending, savings, and budget progress
                    </Text>
                  </View>
                  <Switch
                    value={weeklyDigest}
                    onValueChange={(val) => handleToggle('weeklyDigest', val)}
                    trackColor={{ false: colors.surface[700], true: colors.primary[600] }}
                    thumbColor={weeklyDigest ? colors.primary[400] : colors.surface[400]}
                    disabled={saving}
                  />
                </View>
              </View>
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ── Settings screen styles (shared by Security + Notifications) ──────────────

const settingsStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface[900],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface[700] + '80',
    backgroundColor: colors.surface[800],
  },
  headerTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.white,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing['5xl'],
  },
  sectionLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.surface[400],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: colors.surface[800],
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.surface[700] + '80',
    padding: spacing.xl,
    gap: spacing.md,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  cardRowTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.white,
  },
  cardRowSubtitle: {
    fontSize: fontSize.xs,
    color: colors.surface[400],
    marginTop: 2,
  },
  cardHint: {
    fontSize: fontSize.xs,
    color: colors.surface[500],
    lineHeight: 16,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  badgeText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
  },
  passwordForm: {
    gap: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.surface[700] + '40',
  },
  input: {
    backgroundColor: colors.surface[750],
    borderWidth: 1,
    borderColor: colors.surface[600] + '50',
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: fontSize.sm,
    color: colors.white,
  },
  saveButton: {
    backgroundColor: colors.primary[600],
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  saveButtonPressed: {
    backgroundColor: colors.primary[500],
  },
  saveButtonText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.white,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.lg,
  },
  toggleInfo: {
    flex: 1,
  },
  toggleTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.white,
  },
  toggleSubtitle: {
    fontSize: fontSize.xs,
    color: colors.surface[400],
    marginTop: 2,
    lineHeight: 16,
  },
  toggleDivider: {
    height: 1,
    backgroundColor: colors.surface[700] + '40',
  },
});

// ── More Screen ──────────────────────────────────────────────────────────────

export default function MoreScreen() {
  const { user, logout } = useAuthStore();
  const webUrl = process.env.EXPO_PUBLIC_WEB_URL?.replace(/\/$/, '') ?? null;
  const supportEmail = process.env.EXPO_PUBLIC_SUPPORT_EMAIL?.trim() || 'support@financeowl.com';
  const appVersion = Constants.expoConfig?.version ?? '1.0.0';
  const [showSecurity, setShowSecurity] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

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
          void openUrl(`mailto:${supportEmail}?subject=Finance%20Owl%20Support`, 'Help & Support');
        },
      },
    ];

    if (webUrl) {
      buttons.push({
        text: 'Help Center',
        onPress: () => {
          void openUrl(`${webUrl}/support`, 'Help & Support');
        },
      });
    }

    buttons.push({ text: 'Cancel', style: 'cancel' as const });

    Alert.alert('Help & Support', 'Need help with billing, security, or a bug report?', buttons);
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
      'About Finance Owl',
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
      onPress: () => setShowSecurity(true),
    },
    {
      title: 'Notifications',
      subtitle: 'Email alerts and push notification settings',
      icon: 'bell',
      accentColor: '#fbbf24',
      onPress: () => setShowNotifications(true),
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
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* User card */}
      <View style={styles.userCard}>
        <View style={styles.userAvatar}>
          <Text style={styles.userAvatarText}>{user?.name?.charAt(0).toUpperCase() ?? '?'}</Text>
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
            style={({ pressed }) => [styles.settingsItem, pressed && styles.settingsItemPressed]}
            onPress={item.onPress}
          >
            <View style={[styles.settingsIcon, { backgroundColor: item.accentColor + '18' }]}>
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
        style={({ pressed }) => [styles.signOutButton, pressed && styles.signOutButtonPressed]}
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
      <Text style={styles.versionText}>Finance Owl v{appVersion}</Text>
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
