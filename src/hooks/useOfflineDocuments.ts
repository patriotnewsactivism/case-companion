import { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

const DB_NAME = 'case-companion-offline';
const DB_VERSION = 1;
const STORE_NAME = 'documents';

export interface CachedDocument {
  id: string;
  case_id: string;
  name: string;
  file_url: string;
  file_type: string;
  content: string;
  encrypted: boolean;
  cached_at: string;
  sync_status: 'synced' | 'pending' | 'modified';
}

export type SyncStatus = 'synced' | 'syncing' | 'offline';

export interface UseOfflineDocumentsReturn {
  cacheDocument: (documentId: string) => Promise<void>;
  getCachedDocument: (documentId: string) => CachedDocument | null;
  isCached: (documentId: string) => boolean;
  syncStatus: SyncStatus;
  pendingChanges: number;
  syncChanges: () => Promise<void>;
}

async function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);

    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('case_id', 'case_id', { unique: false });
        store.createIndex('sync_status', 'sync_status', { unique: false });
      }
    };
  });
}

async function encryptContent(content: string, key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(key.padEnd(32, '0').slice(0, 32)),
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    keyMaterial,
    data
  );

  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);

  return btoa(String.fromCharCode(...combined));
}

async function decryptContent(encryptedContent: string, key: string): Promise<string> {
  const encoder = new TextEncoder();
  const combined = new Uint8Array(
    atob(encryptedContent).split('').map((c) => c.charCodeAt(0))
  );

  const iv = combined.slice(0, 12);
  const data = combined.slice(12);

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(key.padEnd(32, '0').slice(0, 32)),
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    keyMaterial,
    data
  );

  return new TextDecoder().decode(decrypted);
}

async function getCachedDoc(db: IDBDatabase, documentId: string): Promise<CachedDocument | null> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(documentId);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || null);
  });
}

async function getAllCachedDocs(db: IDBDatabase): Promise<CachedDocument[]> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
}

async function putCachedDoc(db: IDBDatabase, doc: CachedDocument): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(doc);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

async function deleteCachedDoc(db: IDBDatabase, documentId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(documentId);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export function useOfflineDocuments(): UseOfflineDocumentsReturn {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
  const [pendingChanges, setPendingChanges] = useState(0);
  const dbRef = useRef<IDBDatabase | null>(null);

  const { data: cachedDocs = [] } = useQuery({
    queryKey: ['offline-documents'],
    queryFn: async () => {
      if (!dbRef.current) {
        dbRef.current = await openDatabase();
      }
      return getAllCachedDocs(dbRef.current);
    },
    enabled: !!user,
  });

  useEffect(() => {
    const pending = cachedDocs.filter((d) => d.sync_status === 'pending' || d.sync_status === 'modified').length;
    setPendingChanges(pending);
  }, [cachedDocs]);

  useEffect(() => {
    const handleOnline = () => setSyncStatus(navigator.onLine ? 'synced' : 'offline');
    const handleOffline = () => setSyncStatus('offline');

    setSyncStatus(navigator.onLine ? 'synced' : 'offline');

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const cacheDocument = useCallback(async (documentId: string) => {
    if (!user) throw new Error('User must be authenticated');
    if (!dbRef.current) {
      dbRef.current = await openDatabase();
    }

    const { data: doc, error } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (error) throw error;
    if (!doc) throw new Error('Document not found');

    let content = '';
    if (doc.file_url) {
      try {
        const response = await fetch(doc.file_url);
        content = await response.text();
      } catch {
        content = '';
      }
    }

    const encryptionKey = user.id;
    const encryptedContent = await encryptContent(content, encryptionKey);

    const cachedDoc: CachedDocument = {
      id: doc.id,
      case_id: doc.case_id,
      name: doc.name,
      file_url: doc.file_url || '',
      file_type: doc.file_type || '',
      content: encryptedContent,
      encrypted: true,
      cached_at: new Date().toISOString(),
      sync_status: 'synced',
    };

    await putCachedDoc(dbRef.current, cachedDoc);
    queryClient.invalidateQueries({ queryKey: ['offline-documents'] });
  }, [user, queryClient]);

  const getCachedDocument = useCallback((documentId: string): CachedDocument | null => {
    return cachedDocs.find((d) => d.id === documentId) || null;
  }, [cachedDocs]);

  const isCached = useCallback((documentId: string): boolean => {
    return cachedDocs.some((d) => d.id === documentId);
  }, [cachedDocs]);

  const syncChanges = useCallback(async () => {
    if (!user || !navigator.onLine) return;
    if (!dbRef.current) {
      dbRef.current = await openDatabase();
    }

    setSyncStatus('syncing');

    try {
      const docs = await getAllCachedDocs(dbRef.current);
      const modified = docs.filter((d) => d.sync_status === 'modified');

      for (const doc of modified) {
        try {
          await supabase
            .from('documents')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', doc.id);

          await putCachedDoc(dbRef.current, { ...doc, sync_status: 'synced' });
        } catch (err) {
          console.error(`Failed to sync document ${doc.id}:`, err);
        }
      }

      setSyncStatus('synced');
      setPendingChanges(0);
      queryClient.invalidateQueries({ queryKey: ['offline-documents'] });
    } catch (err) {
      setSyncStatus('offline');
      throw err;
    }
  }, [user, queryClient]);

  useEffect(() => {
    openDatabase().then((db) => {
      dbRef.current = db;
    });

    return () => {
      if (dbRef.current) {
        dbRef.current.close();
      }
    };
  }, []);

  return {
    cacheDocument,
    getCachedDocument,
    isCached,
    syncStatus,
    pendingChanges,
    syncChanges,
  };
}

export { decryptContent };