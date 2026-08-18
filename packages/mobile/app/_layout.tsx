import React, { useCallback, useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '../src/stores/auth';
import { useRouter, useSegments } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { colors } from '../src/utils/theme';
import ErrorBoundary from '../src/components/ErrorBoundary';
import BiometricLockScreen from '../src/components/BiometricLockScreen';
import { useBiometricAuth } from '../src/hooks/useBiometricAuth';
import { useAppStateTimeout } from '../src/hooks/useAppStateTimeout';
import { configureSentry, Sentry } from '../src/lib/sentry';

// Initialize Sentry as early as possible
configureSentry();

/**
 * Root layout. Handles:
 * 1. Initializing auth state on mount
 * 2. Redirecting to auth screens when not authenticated
 * 3. Redirecting to tabs when authenticated
 * 4. Showing biometric lock after 5+ minutes in background
 */
function RootLayout() {
  const { isAuthenticated, isLoading, initialize } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();
  const { isBiometricAvailable, authenticate, isLocked, unlock } = useBiometricAuth();
  const { requiresAuth, clearAuth } = useAppStateTimeout();

  useEffect(() => {
    initialize();
  }, []);

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!isAuthenticated && !inAuthGroup) {
      // Redirect to login if not authenticated and not already in auth group
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuthGroup) {
      // Redirect to main tabs if authenticated but still on auth screen
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, isLoading, segments]);

  const handleBiometricAuth = useCallback(async () => {
    const success = await authenticate();
    if (success) {
      clearAuth();
    }
  }, [authenticate, clearAuth]);

  // Determine whether the biometric lock should be shown:
  // - User must be authenticated (not on auth screens)
  // - Either it's the initial lock or the app returned from background after timeout
  // - The device supports biometrics and user has enrolled
  const inAuthGroup = segments[0] === '(auth)';
  const showBiometricLock =
    isAuthenticated &&
    !inAuthGroup &&
    isBiometricAvailable &&
    (isLocked || requiresAuth);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
        <StatusBar style="light" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.surface[900] },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
      </Stack>
      {showBiometricLock && (
        <BiometricLockScreen
          onAuthenticate={handleBiometricAuth}
        />
      )}
    </>
  );
}

export default Sentry.wrap(function App() {
  return (
    <ErrorBoundary>
      <RootLayout />
    </ErrorBoundary>
  );
});

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface[900],
  },
});
