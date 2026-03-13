import { useEffect, useState, useRef } from 'react';

interface NetworkStatus {
  isConnected: boolean;
  isInternetReachable: boolean | null;
}

const PING_URL = 'https://clients3.google.com/generate_204';
const POLL_INTERVAL_MS = 15_000;

/**
 * Lightweight connectivity hook.
 *
 * Uses a periodic HEAD request to detect whether the device can reach the
 * internet. This avoids a hard dependency on @react-native-community/netinfo
 * which is not currently installed.
 *
 * NOTE: For production, consider installing @react-native-community/netinfo
 * for more reliable, event-driven network status detection.
 */
export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>({
    isConnected: true,
    isInternetReachable: null,
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function checkConnectivity() {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        await fetch(PING_URL, {
          method: 'HEAD',
          cache: 'no-store',
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (isMounted) {
          setStatus({ isConnected: true, isInternetReachable: true });
        }
      } catch {
        if (isMounted) {
          setStatus({ isConnected: false, isInternetReachable: false });
        }
      }
    }

    // Check immediately, then poll
    void checkConnectivity();
    intervalRef.current = setInterval(checkConnectivity, POLL_INTERVAL_MS);

    return () => {
      isMounted = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return status;
}
