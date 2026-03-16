import { useEffect, useState } from "react";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { replayMutations } from "@/lib/offline/sync-manager";
import { WifiOff, RefreshCw, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type SyncState = "idle" | "offline" | "syncing" | "done";

export function OfflineStatusBar() {
  const { isOnline, pendingCount } = useNetworkStatus();
  const [syncState, setSyncState] = useState<SyncState>("idle");
  const [visible, setVisible] = useState(false);

  // Drive state transitions based on network and pending count
  useEffect(() => {
    if (!isOnline) {
      setSyncState("offline");
      setVisible(true);
      return;
    }

    // Just came back online with pending mutations - start syncing
    if (isOnline && pendingCount > 0 && syncState === "offline") {
      setSyncState("syncing");
      setVisible(true);
      replayMutations().then(() => {
        setSyncState("done");
      });
      return;
    }

    // Show pending count even while online (e.g. mutations queued due to transient error)
    if (isOnline && pendingCount > 0 && syncState === "idle") {
      setVisible(true);
      return;
    }

    // After sync completes, briefly show success then hide
    if (syncState === "done") {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        setSyncState("idle");
      }, 2500);
      return () => clearTimeout(timer);
    }

    // Nothing to show
    if (isOnline && pendingCount === 0 && syncState !== "done") {
      setVisible(false);
      setSyncState("idle");
    }
  }, [isOnline, pendingCount, syncState]);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium transition-colors duration-300",
        syncState === "offline" &&
          "bg-amber-500/90 text-amber-950",
        syncState === "syncing" &&
          "bg-sky-500/90 text-white",
        syncState === "done" &&
          "bg-emerald-500/90 text-white",
        // Fallback for pending-while-online (idle with count > 0)
        syncState === "idle" &&
          pendingCount > 0 &&
          "bg-amber-500/90 text-amber-950"
      )}
    >
      {syncState === "offline" && (
        <>
          <WifiOff className="h-4 w-4 flex-shrink-0" />
          <span>
            You're offline &mdash; changes are saved locally
            {pendingCount > 0 && ` (${pendingCount} pending)`}
          </span>
        </>
      )}

      {syncState === "syncing" && (
        <>
          <RefreshCw className="h-4 w-4 flex-shrink-0 animate-spin" />
          <span>Syncing {pendingCount} change{pendingCount !== 1 ? "s" : ""}...</span>
        </>
      )}

      {syncState === "done" && (
        <>
          <CheckCircle className="h-4 w-4 flex-shrink-0" />
          <span>All changes synced</span>
        </>
      )}

      {syncState === "idle" && pendingCount > 0 && (
        <>
          <RefreshCw className="h-4 w-4 flex-shrink-0" />
          <span>{pendingCount} change{pendingCount !== 1 ? "s" : ""} pending</span>
        </>
      )}
    </div>
  );
}
