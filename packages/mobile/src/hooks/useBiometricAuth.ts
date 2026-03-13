import { useCallback, useEffect, useState } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';

interface UseBiometricAuthResult {
  /** Whether the device supports biometrics and has them enrolled. */
  isBiometricAvailable: boolean;
  /** Prompt the user to authenticate via biometrics / passcode. */
  authenticate: () => Promise<boolean>;
  /** Whether the app is currently locked behind biometric auth. */
  isLocked: boolean;
  /** Manually unlock (e.g. when biometrics aren't available). */
  unlock: () => void;
}

export function useBiometricAuth(): UseBiometricAuthResult {
  const [isBiometricAvailable, setIsBiometricAvailable] = useState(false);
  const [isLocked, setIsLocked] = useState(true);

  useEffect(() => {
    (async () => {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      const available = hasHardware && isEnrolled;
      setIsBiometricAvailable(available);

      // If biometrics aren't available, don't lock the user out
      if (!available) {
        setIsLocked(false);
      }
    })();
  }, []);

  const authenticate = useCallback(async (): Promise<boolean> => {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock Finance Owl',
      fallbackLabel: 'Use passcode',
    });

    if (result.success) {
      setIsLocked(false);
      return true;
    }

    return false;
  }, []);

  const unlock = useCallback(() => {
    setIsLocked(false);
  }, []);

  return { isBiometricAvailable, authenticate, isLocked, unlock };
}
