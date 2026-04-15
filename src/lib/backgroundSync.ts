import { supabase } from '@/integrations/supabase/client';
import { queryClient } from './queryClient';
import { logger } from '@/utils/logger';
import { 
  getPendingMutations, 
  removeMutation, 
  incrementRetryCount,
  getPendingCount,
  watchQueue 
} from './offlineQueue';

/**
 * Background Sync Manager
 * 
 * manages background synchronization of offline mutations
 * ensuring data consistency by syncing pending changes
 */

class BackgroundSyncManager {
  private isSyncing = false;
  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private onlineHandler: (() => void) | null = null;
  private unsubscribeQueue: (() => void) | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.setupOnlineListener();
      this.startPeriodicSync();
    }
  }

  /**
   * Setup listener for online/offline events
   */
  private setupOnlineListener() {
    this.onlineHandler = () => {
      logger.log('🌐 [BackgroundSync] Device came online - starting sync...');
      this.syncPendingMutations();
    };

    window.addEventListener('online', this.onlineHandler);
  }

  /**
   * Start periodic sync check every 30 seconds
   */
  private startPeriodicSync() {
    this.syncInterval = setInterval(() => {
      if (window.navigator.onLine && !this.isSyncing) {
        logger.log('⏰ [BackgroundSync] Periodic sync check...');
        this.syncPendingMutations();
      }
    }, 120000); // Every 2 minutes (optimized from 30s)

    logger.log('✅ [BackgroundSync] Periodic sync started (2min interval)');
  }

  /**
   * Sync all pending mutations
   */
  async syncPendingMutations(): Promise<{ success: number; failed: number }> {
    if (this.isSyncing) {
      logger.log('⏳ [BackgroundSync] Sync already in progress, skipping...');
      return { success: 0, failed: 0 };
    }

    if (!window.navigator.onLine) {
      logger.log('📵 [BackgroundSync] Device offline - skipping sync');
      return { success: 0, failed: 0 };
    }

    this.isSyncing = true;
    logger.log('🚀 [BackgroundSync] Starting mutation sync...');

    try {
      const result = await this.processMutationQueue();
      logger.log(`✅ [BackgroundSync] Sync complete: ${result.success} succeeded, ${result.failed} failed`);
      
      // If there were successful syncs, invalidate related queries
      if (result.success > 0) {
        this.invalidateSyncedQueries();
      }

      return result;
    } catch (error) {
      logger.error('❌ [BackgroundSync] Sync failed:', error);
      return { success: 0, failed: 0 };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Process the mutation queue
   */
  private async processMutationQueue(): Promise<{ success: number; failed: number }> {
    const pending = await getPendingMutations();
    
    if (pending.length === 0) {
      return { success: 0, failed: 0 };
    }

    logger.log(`📦 [BackgroundSync] Processing ${pending.length} mutations...`);

    let success = 0;
    let failed = 0;

    for (const mutation of pending) {
      try {
        // Check retry limit
        if (mutation.retryCount >= mutation.maxRetries) {
          logger.error(`❌ [BackgroundSync] Max retries exceeded: ${mutation.id}`);
          await removeMutation(mutation.id);
          failed++;
          continue;
        }

        // Execute mutation based on type
        await this.executeMutation(mutation);
        
        // Remove from queue on success
        await removeMutation(mutation.id);
        success++;

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        logger.error(`❌ [BackgroundSync] Failed mutation ${mutation.id}:`, error);
        
        // Increment retry count
        await incrementRetryCount(mutation.id);
        failed++;

        // Stop on auth errors
        if (error instanceof Error && error.message.includes('auth')) {
          logger.error('🔒 [BackgroundSync] Auth error - stopping sync');
          break;
        }
      }
    }

    return { success, failed };
  }

  /**
   * Execute a single mutation
   */
  private async executeMutation(mutation: any): Promise<void> {
    const { type, table, data } = mutation;

    console.log(`📝 [BackgroundSync] Executing: ${type} on ${table}`);

    let error;

    switch (type) {
      case 'create': {
        const { error: createError } = await supabase
          .from(table)
          .insert(data);
        error = createError;
        break;
      }

      case 'update': {
        const { error: updateError } = await supabase
          .from(table)
          .update(data)
          .eq('id', data.id);
        error = updateError;
        break;
      }

      case 'delete': {
        const { error: deleteError } = await supabase
          .from(table)
          .delete()
          .eq('id', data.id);
        error = deleteError;
        break;
      }

      default:
        throw new Error(`Unknown mutation type: ${type}`);
    }

    if (error) {
      throw error;
    }

    logger.log(`✅ [BackgroundSync] Mutation executed: ${type} on ${table}`);
  }

  /**
   * Invalidate queries for synced tables
   */
  private invalidateSyncedQueries() {
    logger.log('🔄 [BackgroundSync] Invalidating queries for synced data...');
    
    // Invalidate all active queries to refresh UI
    queryClient.invalidateQueries({ 
      type: 'active',
      stale: true 
    });
  }

  /**
   * Watch queue and notify UI
   */
  startWatching(callback: (count: number) => void) {
    this.unsubscribeQueue = watchQueue(callback);
  }

  /**
   * Stop watching queue (safe cleanup)
   */
  stopWatching() {
    if (this.unsubscribeQueue) {
      try {
        this.unsubscribeQueue();
        this.unsubscribeQueue = null;
      } catch (error) {
        console.warn('[BackgroundSync] Error stopping watch:', error);
      }
    }
  }

  /**
   * Manual sync trigger
   */
  async triggerSync() {
    return await this.syncPendingMutations();
  }

  /**
   * Get pending count
   */
  async getPendingCount() {
    return await getPendingCount();
  }

  /**
   * Cleanup on app shutdown
   */
  destroy() {
    logger.log('🛑 [BackgroundSync] Destroying sync manager...');
    
    if (this.onlineHandler) {
      window.removeEventListener('online', this.onlineHandler);
    }
    
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    
    // Use safe cleanup
    this.stopWatching();
  }
}

export const backgroundSync = new BackgroundSyncManager();
