import { supabase } from "@/integrations/supabase/client";
import {
  getPendingMutations,
  removeMutation,
  queueMutation,
} from "./offline-store";
import type { OfflineMutation } from "./offline-store";

const MAX_RETRIES = 5;

async function executeMutation(mutation: OfflineMutation): Promise<boolean> {
  try {
    const { table, operation, payload } = mutation;

    switch (operation) {
      case 'insert': {
        const { error } = await (supabase as any).from(table).insert(payload);
        if (error) throw error;
        return true;
      }
      case 'update': {
        const { id, ...updates } = payload;
        if (!id) throw new Error('Update mutation missing id in payload');
        const { error } = await (supabase as any)
          .from(table)
          .update(updates)
          .eq('id', id as string);
        if (error) throw error;
        return true;
      }
      case 'delete': {
        const deleteId = payload.id;
        if (!deleteId) throw new Error('Delete mutation missing id in payload');
        const { error } = await supabase
          .from(table)
          .delete()
          .eq('id', deleteId as string);
        if (error) throw error;
        return true;
      }
      default:
        console.error(`Unknown operation: ${operation}`);
        return false;
    }
  } catch (err) {
    console.error(`Failed to execute mutation ${mutation.id}:`, err);
    return false;
  }
}

export async function replayMutations(): Promise<{
  succeeded: number;
  failed: number;
}> {
  const mutations = await getPendingMutations();
  let succeeded = 0;
  let failed = 0;

  for (const mutation of mutations) {
    const ok = await executeMutation(mutation);

    if (ok) {
      await removeMutation(mutation.id);
      succeeded++;
    } else {
      const nextRetry = mutation.retryCount + 1;
      if (nextRetry >= MAX_RETRIES) {
        console.warn(
          `Mutation ${mutation.id} exceeded max retries (${MAX_RETRIES}), removing.`
        );
        await removeMutation(mutation.id);
      } else {
        await queueMutation({ ...mutation, retryCount: nextRetry });
      }
      failed++;
    }
  }

  return { succeeded, failed };
}

let onlineHandler: (() => void) | null = null;

export function startAutoSync(onSyncComplete?: (result: { succeeded: number; failed: number }) => void): void {
  if (onlineHandler) return; // already listening

  onlineHandler = async () => {
    const result = await replayMutations();
    onSyncComplete?.(result);
  };

  window.addEventListener('online', onlineHandler);
}

export function stopAutoSync(): void {
  if (onlineHandler) {
    window.removeEventListener('online', onlineHandler);
    onlineHandler = null;
  }
}
