import { useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

interface UseAppStateTimeoutResult {
  /** Whether the user needs to re-authenticate after being away too long. */
  requiresAuth: boolean;
  /** Clear the re-auth requirement (call after successful authentication). */
  clearAuth: () => void;
}

export function useAppStateTimeout(): UseAppStateTimeoutResult {
  const [requiresAuth, setRequiresAuth] = useState(false);
  const backgroundTimestamp = useRef<number | null>(null);

  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'background' || nextState === 'inactive') {
        // Record when the app went to the background
        backgroundTimestamp.current = Date.now();
      } else if (nextState === 'active') {
        // App came back to the foreground — check elapsed time
        if (backgroundTimestamp.current !== null) {
          const elapsed = Date.now() - backgroundTimestamp.current;
          if (elapsed >= TIMEOUT_MS) {
            setRequiresAuth(true);
          }
          backgroundTimestamp.current = null;
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, []);

  const clearAuth = () => {
    setRequiresAuth(false);
  };

  return { requiresAuth, clearAuth };
}
