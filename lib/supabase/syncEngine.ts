import { db } from '../db/dexie';
import { getSupabaseClient } from './client';
import { SyncQueueRecord } from '@/types';

export type SyncState = 'idle' | 'syncing' | 'synced' | 'offline' | 'unconfigured' | 'error';

let syncListeners: ((state: SyncState, lastSynced?: string, error?: string) => void)[] = [];
let currentState: SyncState = 'idle';
let lastSyncTimestamp: string | null = null;
let syncIntervalTimer: any = null;

export function subscribeToSyncState(callback: (state: SyncState, lastSynced?: string, error?: string) => void) {
  syncListeners.push(callback);
  callback(currentState, lastSyncTimestamp || undefined);
  return () => {
    syncListeners = syncListeners.filter((cb) => cb !== callback);
  };
}

function notifySyncState(state: SyncState, error?: string) {
  currentState = state;
  syncListeners.forEach((cb) => cb(state, lastSyncTimestamp || undefined, error));
}

// Convert camelCase record to Supabase snake_case format
function toSnakeCase(obj: any): any {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  const newObj: any = {};
  for (const key of Object.keys(obj)) {
    const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
    newObj[snakeKey] = obj[key];
  }
  return newObj;
}

// Convert Supabase snake_case to camelCase
function toCamelCase(obj: any): any {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  const newObj: any = {};
  for (const key of Object.keys(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, g) => g.toUpperCase());
    newObj[camelKey] = obj[key];
  }
  return newObj;
}

export async function performSync(): Promise<{ success: boolean; message?: string }> {
  if (typeof window === 'undefined') return { success: false };

  if (!navigator.onLine) {
    notifySyncState('offline');
    return { success: false, message: 'Device is offline' };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    notifySyncState('unconfigured');
    return { success: true, message: 'Local-only mode (No Supabase configured)' };
  }

  notifySyncState('syncing');

  try {
    // 1. Process local Outbox (syncQueue)
    const pendingItems = await db.syncQueue.toArray();

    for (const item of pendingItems) {
      const { id: queueId, table, recordId, operation, payload } = item;

      try {
        if (operation === 'DELETE') {
          const { error } = await supabase.from(table).delete().eq('id', recordId);
          if (error && error.code !== 'PGRST116') {
            console.warn(`Sync delete error on ${table}:`, error);
          }
        } else {
          const remotePayload = toSnakeCase(payload);
          const { error } = await supabase.from(table).upsert(remotePayload);
          if (error) {
            console.warn(`Sync upsert error on ${table}:`, error);
          }
        }

        if (queueId) {
          await db.syncQueue.delete(queueId);
        }
      } catch (err) {
        console.error(`Error processing queue item ${queueId}:`, err);
      }
    }

    // 2. Pull remote changes from Supabase
    const tables: Array<{ name: string; dexieTable: any }> = [
      { name: 'folders', dexieTable: db.folders },
      { name: 'notebooks', dexieTable: db.notebooks },
      { name: 'pages', dexieTable: db.pages },
      { name: 'textbooks', dexieTable: db.textbooks },
      { name: 'lists', dexieTable: db.lists },
      { name: 'assignments', dexieTable: db.assignments },
      { name: 'homeworks', dexieTable: db.homeworks },
    ];

    for (const { name, dexieTable } of tables) {
      try {
        const { data, error } = await supabase.from(name).select('*').limit(200);
        if (!error && data) {
          for (const remoteRow of data) {
            const localRecord = toCamelCase(remoteRow);
            const existing = await dexieTable.get(localRecord.id);
            if (!existing) {
              await dexieTable.add(localRecord);
            } else {
              const remoteTime = new Date(localRecord.updatedAt || 0).getTime();
              const localTime = new Date(existing.updatedAt || 0).getTime();
              if (remoteTime > localTime) {
                await dexieTable.put(localRecord);
              }
            }
          }
        }
      } catch (err) {
        console.warn(`Failed pulling remote data for table ${name}:`, err);
      }
    }

    lastSyncTimestamp = new Date().toISOString();
    notifySyncState('synced');
    return { success: true };
  } catch (error: any) {
    console.error('Sync failed:', error);
    notifySyncState('error', error?.message || 'Sync failed');
    return { success: false, message: error?.message };
  }
}

export function initSyncEngine() {
  if (typeof window === 'undefined') return;

  // Listen to network status changes
  window.addEventListener('online', () => {
    console.log('Network online, triggering sync...');
    performSync();
  });

  window.addEventListener('offline', () => {
    notifySyncState('offline');
  });

  // Initial sync attempt
  setTimeout(() => {
    performSync();
  }, 2000);

  // Periodic background sync every 60 seconds
  if (!syncIntervalTimer) {
    syncIntervalTimer = setInterval(() => {
      if (navigator.onLine) {
        performSync();
      }
    }, 60000);
  }
}
