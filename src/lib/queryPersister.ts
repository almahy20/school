import { openDB } from 'idb';
import { PersistedClient, Persister } from '@tanstack/react-query-persist-client';

/**
 * Custom IndexedDB persister for React Query.
 * Replaces localStorage to overcome its 5MB limit.
 */
const DB_NAME = 'school-react-query-db';
const STORE_NAME = 'query-cache-store';
const KEY_NAME = 'app-query-cache';

const dbPromise = typeof window !== 'undefined' 
  ? openDB(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      },
    })
  : null;

export const idbPersister: Persister = {
  persistClient: async (client: PersistedClient) => {
    try {
      const db = await dbPromise;
      if (db) {
        await db.put(STORE_NAME, client, KEY_NAME);
      }
    } catch (error) {
      console.error('Failed to save query cache to IndexedDB:', error);
    }
  },
  restoreClient: async () => {
    try {
      const db = await dbPromise;
      if (db) {
        return await db.get(STORE_NAME, KEY_NAME);
      }
    } catch (error) {
      console.error('Failed to restore query cache from IndexedDB:', error);
      return undefined;
    }
  },
  removeClient: async () => {
    try {
      const db = await dbPromise;
      if (db) {
        await db.delete(STORE_NAME, KEY_NAME);
      }
    } catch (error) {
      console.error('Failed to remove query cache from IndexedDB:', error);
    }
  },
};
