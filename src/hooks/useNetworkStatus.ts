import { useState, useEffect, useCallback } from "react";
import { getPendingCount } from "@/lib/offline/offline-store";

export interface NetworkStatus {
  isOnline: boolean;
  pendingCount: number;
}

export function useNetworkStatus(): NetworkStatus {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);

  const refreshPendingCount = useCallback(async () => {
    try {
      const count = await getPendingCount();
      setPendingCount(count);
    } catch {
      // IndexedDB may be unavailable; treat as zero pending
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Poll pending count every 2 seconds so the UI stays current
  useEffect(() => {
    refreshPendingCount();
    const interval = setInterval(refreshPendingCount, 2000);
    return () => clearInterval(interval);
  }, [refreshPendingCount]);

  return { isOnline, pendingCount };
}
