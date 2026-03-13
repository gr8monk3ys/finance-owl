import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { colors, fontSize, fontWeight, spacing } from '../utils/theme';

/**
 * Banner displayed at the top of the tab navigator when the device is offline.
 * Amber/yellow background to be noticeable without blocking interaction.
 */
export default function OfflineBanner() {
  const { isConnected, isInternetReachable } = useNetworkStatus();

  // Show banner when we know the device is offline
  const isOffline = !isConnected || isInternetReachable === false;

  if (!isOffline) {
    return null;
  }

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>
        You're offline. Some features may be unavailable.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.accent[500],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  text: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.surface[900],
    textAlign: 'center',
  },
});
