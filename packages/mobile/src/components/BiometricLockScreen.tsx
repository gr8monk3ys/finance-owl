import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors, fontSize, fontWeight, spacing, borderRadius } from '../utils/theme';

interface BiometricLockScreenProps {
  onAuthenticate: () => void;
  isAuthenticating?: boolean;
}

function LockIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function OwlIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={9} cy={10} r={1.5} fill={color} />
      <Circle cx={15} cy={10} r={1.5} fill={color} />
      <Path
        d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"
        fill={color}
      />
      <Path d="M12 14c-1.1 0-2 .45-2 1s.9 1 2 1 2-.45 2-1-.9-1-2-1z" fill={color} />
    </Svg>
  );
}

export default function BiometricLockScreen({
  onAuthenticate,
  isAuthenticating = false,
}: BiometricLockScreenProps) {
  return (
    <View style={styles.overlay}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <OwlIcon size={48} color={colors.primary[400]} />
        </View>

        <Text style={styles.appName}>Finance Owl</Text>

        <View style={styles.lockContainer}>
          <LockIcon size={40} color={colors.surface[400]} />
        </View>

        <Text style={styles.subtitle}>Authenticate to continue</Text>

        <TouchableOpacity
          style={styles.unlockButton}
          onPress={onAuthenticate}
          activeOpacity={0.7}
          disabled={isAuthenticating}
        >
          {isAuthenticating ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Text style={styles.unlockText}>Tap to unlock</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.surface[900],
    zIndex: 1000,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: spacing['3xl'],
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary[950],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  appName: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: colors.white,
    marginBottom: spacing['4xl'],
  },
  lockContainer: {
    marginBottom: spacing.lg,
  },
  subtitle: {
    fontSize: fontSize.base,
    color: colors.surface[400],
    marginBottom: spacing['3xl'],
  },
  unlockButton: {
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing['3xl'],
    borderRadius: borderRadius.lg,
    minWidth: 160,
    alignItems: 'center',
  },
  unlockText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.white,
  },
});
