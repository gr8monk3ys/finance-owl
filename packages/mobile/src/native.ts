/**
 * Native platform utilities for the Expo React Native app.
 * Replaces the previous Capacitor-based implementation.
 */
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

export const isNative = Platform.OS === 'ios' || Platform.OS === 'android';
export const platform = Platform.OS;

/**
 * Trigger haptic feedback on supported devices.
 */
export async function hapticFeedback(
  style: 'light' | 'medium' | 'heavy' = 'light',
): Promise<void> {
  if (!isNative) return;

  const impactStyle = {
    light: Haptics.ImpactFeedbackStyle.Light,
    medium: Haptics.ImpactFeedbackStyle.Medium,
    heavy: Haptics.ImpactFeedbackStyle.Heavy,
  }[style];

  await Haptics.impactAsync(impactStyle);
}
