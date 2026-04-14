import { supabase } from '@/integrations/supabase/client';
import { queryClient } from './queryClient';

/**
 * World-Class Persistent Realtime Engine
 * 
 * محرك Realtime متين وموثوق يحافظ على الاتصالات بشكل دائم
 * ويعيد الاتصال تلقائيًا عند أي انقطاع مع exponential backoff
 * ومراقبة صحية مستمرة للقنوات
 */
class RealtimeEngine {
  private activeSubscriptions = new Map<string, {
    channel: any,
    table: string,
    callback?: (payload: any) => void,
    options: any,
    retryCount: number,
    lastError: Date | null,
    isHealthy: boolean,
    isReconnecting: boolean
  }>();
  
  private maxRetries = 10;
  private baseDelay = 1000; // 1 second
  private maxDelay = 30000; // 30 seconds
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;
  private isResyncing = false;
  private lastResyncTime = 0;
  private resyncCooldown = 5000; // 5 seconds cooldown between resyncs

  constructor() {
    // Listen for auth changes
    if (typeof window !== 'undefined') {
      supabase.auth.onAuthStateChange((event, session) => {
        console.log(`[RealtimeEngine] Auth event: ${event}`);
        
        // Only reconnect on SIGNED_IN - TOKEN_REFRESHED doesn't require reconnection
        // as the existing WebSocket connection remains valid
        if (event === 'SIGNED_IN') {
          console.log('[RealtimeEngine] User signed in, reconnecting all channels...');
          this.reconnectAll();
        }
        if (event === 'SIGNED_OUT') {
          console.log('[RealtimeEngine] User signed out, cleaning up all channels...');
          this.unsubscribeAll();
        }
      });

      // Start health monitoring
      this.startHealthMonitoring();
      
      // Note: Visibility and Network handlers are now coordinated by HealthMonitor
      // to prevent redundant connection attempts and Auth lock contention.
    }
  }

  public subscribe(table: string, callback?: (payload: any) => void, options: { event?: string, filter?: string } = {}) {
    const channelName = `realtime-engine:${table}:${options.event || '*'}:${options.filter || 'all'}`;
    
    // Cleanup existing subscription if exists
    if (this.activeSubscriptions.has(channelName)) {
      console.log(`[RealtimeEngine] Replacing existing subscription: ${channelName}`);
      this.unsubscribe(channelName);
    }

    console.log(`[RealtimeEngine] Creating subscription: ${channelName}`);
    
    const channel = this.createChannel(channelName, table, callback, options);
    
    this.activeSubscriptions.set(channelName, {
      channel,
      table,
      callback,
      options,
      retryCount: 0,
      lastError: null,
      isHealthy: true,
      isReconnecting: false
    });

    // Return unsubscribe function
    return () => {
      this.unsubscribe(channelName);
    };
  }

  private createChannel(channelName: string, table: string, callback?: (payload: any) => void, options: { event?: string, filter?: string } = {}) {
    console.log(`[RealtimeEngine] Creating channel: ${channelName} for table: ${table}`);
    
    // CRITICAL: Always check if Supabase already has a channel with this name
    // and remove it before creating a new one to avoid "cannot add postgres_changes after subscribe()"
    // Using safer check for existing channels in various versions of Supabase SDK
    const supabaseAny = supabase as any;
    const channels = supabaseAny.channels || (supabaseAny.realtime && supabaseAny.realtime.channels) || [];
    const existingChannel = Array.isArray(channels) ? channels.find((c: any) => c.topic === `realtime:${channelName}`) : null;
    
    if (existingChannel) {
      console.log(`[RealtimeEngine] Removing globally existing channel: ${channelName}`);
      supabase.removeChannel(existingChannel);
    }
    
    const channel: any = supabase.channel(channelName, {
      config: {
        presence: {
          key: channelName
        },
        broadcast: {
          ack: true
        },
        private: false
      }
    });
    
    // CRITICAL: Add .on() BEFORE .subscribe() to avoid "cannot add postgres_changes after subscribe()" error
    channel
      .on(
        'postgres_changes' as any,
        {
          event: options.event || '*',
          schema: 'public',
          table: table,
          filter: options.filter,
        },
        (payload: any) => {
          // Skip if channel is being removed
          if (channel._isBeingRemoved) {
            console.log(`[RealtimeEngine] Skipping event for channel being removed: ${channelName}`);
            return;
          }
          
          console.log(`[RealtimeEngine] Received event for ${table}:`, payload.eventType);
          
          // Update health status
          const sub = this.activeSubscriptions.get(channelName);
          if (sub) {
            sub.isHealthy = true;
            sub.lastError = null;
            sub.retryCount = 0;
          }
          
          // Silent Cache Auto-Sync
          this.syncToCache(table, payload);
          
          // Trigger individual UI callbacks
          if (callback) {
            callback(payload);
          }
        }
      )
      .subscribe((status: string, error?: any) => {
        // Skip if channel is being removed
        if (channel._isBeingRemoved) {
          console.log(`[RealtimeEngine] Skipping status update for channel being removed: ${channelName}`);
          return;
        }
        
        console.log(`[RealtimeEngine] Channel ${channelName} status: ${status}`, error);
        
        const sub = this.activeSubscriptions.get(channelName);
        if (!sub) {
          console.warn(`[RealtimeEngine] Subscription not found for: ${channelName}`);
          return;
        }

        switch (status) {
          case 'SUBSCRIBED':
            sub.isHealthy = true;
            sub.retryCount = 0;
            sub.lastError = null;
            sub.isReconnecting = false;
            console.log(`✅ [RealtimeEngine] Channel healthy: ${channelName}`);
            break;
            
          case 'CHANNEL_ERROR':
            sub.isHealthy = false;
            sub.lastError = new Date();
            console.error(`❌ [RealtimeEngine] Channel error: ${channelName}`, error);
            
            // IMMEDIATE force reconnect - reset everything
            if (!sub.isReconnecting) {
              sub.isReconnecting = true;
              
              // Remove the broken channel completely
              if (sub.channel) {
                console.log(`[RealtimeEngine] Force removing broken channel: ${channelName}`);
                supabase.removeChannel(sub.channel);
              }
              
              // Wait and create fresh channel - with safety check
              setTimeout(() => {
                // Verify subscription still exists
                const currentSub = this.activeSubscriptions.get(channelName);
                if (!currentSub) {
                  console.log(`[RealtimeEngine] Subscription removed, skipping reconnect: ${channelName}`);
                  return;
                }
                
                currentSub.isReconnecting = false;
                this.createFreshChannel(channelName, currentSub);
              }, 500);
            }
            break;
            
          case 'TIMED_OUT':
            sub.isHealthy = false;
            sub.lastError = new Date();
            console.warn(`⏱️ [RealtimeEngine] Channel timeout: ${channelName} - RECONNECTING`);
            // Quick reconnect for timeout
            if (!sub.isReconnecting) {
              setTimeout(() => {
                this.reconnectChannel(channelName);
              }, 500);
            }
            break;
            
          case 'CLOSED':
            sub.isHealthy = false;
            sub.lastError = new Date();
            console.warn(`🔌 [RealtimeEngine] Channel closed: ${channelName} - FORCE RECONNECT`);
            
            // IMMEDIATE force reconnect
            if (!sub.isReconnecting) {
              sub.isReconnecting = true;
              sub.retryCount = 0; // Reset counter
              
              // Remove old channel
              if (sub.channel) {
                console.log(`[RealtimeEngine] Removing closed channel: ${channelName}`);
                supabase.removeChannel(sub.channel);
              }
              
              // Create fresh channel after short delay - with safety check
              setTimeout(() => {
                // Verify subscription still exists
                const currentSub = this.activeSubscriptions.get(channelName);
                if (!currentSub) {
                  console.log(`[RealtimeEngine] Subscription removed, skipping reconnect: ${channelName}`);
                  return;
                }
                
                currentSub.isReconnecting = false;
                this.createFreshChannel(channelName, currentSub);
              }, 300);
            }
            break;
            
          case 'UNSUBSCRIBED':
            console.log(`👋 [RealtimeEngine] Channel unsubscribed: ${channelName}`);
            sub.isHealthy = false;
            sub.isReconnecting = false;
            // Don't auto-reconnect if explicitly unsubscribed
            break;
            
          case 'CLOSING':
            console.log(`🔴 [RealtimeEngine] Channel closing: ${channelName}`);
            sub.isHealthy = false;
            break;
            
          case 'ERRORED':
            console.error(`💥 [RealtimeEngine] Channel errored: ${channelName}`, error);
            sub.isHealthy = false;
            sub.lastError = new Date();
            if (!sub.isReconnecting) {
              setTimeout(() => {
                this.reconnectChannel(channelName);
              }, 200);
            }
            break;
        }
      });
    
    return channel;
  }

  private handleChannelError(channelName: string, error: any) {
    const sub = this.activeSubscriptions.get(channelName);
    if (!sub) return;

    // Don't retry if we've exceeded max retries
    if (sub.retryCount >= this.maxRetries) {
      console.error(`[RealtimeEngine] Max retries reached for ${channelName}, will retry once more in 30s`);
      // Reset and try one more time after 30s
      sub.retryCount = 0;
      setTimeout(() => {
        console.log(`🔄 [RealtimeEngine] Final retry attempt for: ${channelName}`);
        this.reconnectChannel(channelName);
      }, 30000);
      return;
    }

    // IMMEDIATE reconnection for first few attempts, then backoff
    let delay = 0;
    if (sub.retryCount >= 3) {
      // After 3 failed attempts, use exponential backoff
      delay = this.calculateBackoff(sub.retryCount - 3);
    }
    
    sub.retryCount++;

    console.log(`[RealtimeEngine] Scheduling reconnect for ${channelName} in ${delay}ms (attempt ${sub.retryCount}/${this.maxRetries})`);

    // Schedule reconnection (immediate or delayed)
    setTimeout(() => {
      const currentSub = this.activeSubscriptions.get(channelName);
      if (currentSub && !currentSub.isHealthy) {
        console.log(`🔄 [RealtimeEngine] Reconnecting: ${channelName}`);
        this.reconnectChannel(channelName);
      }
    }, delay);
  }

  private calculateBackoff(retryCount: number): number {
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s (max)
    const exponentialDelay = Math.min(
      this.baseDelay * Math.pow(2, retryCount),
      this.maxDelay
    );
    
    // Add jitter (random ±25%)
    const jitter = exponentialDelay * 0.25 * (Math.random() - 0.5);
    
    return exponentialDelay + jitter;
  }

  private reconnectChannel(channelName: string) {
    const sub = this.activeSubscriptions.get(channelName);
    if (!sub) {
      console.warn(`[RealtimeEngine] Cannot reconnect, subscription not found: ${channelName}`);
      return;
    }

    // Prevent multiple simultaneous reconnection attempts
    if (sub.isReconnecting) {
      console.log(`⏳ [RealtimeEngine] Already reconnecting: ${channelName}, skipping`);
      return;
    }

    console.log(`🔄 [RealtimeEngine] Reconnecting channel: ${channelName}`);
    sub.isReconnecting = true;

    try {
      // Mark old channel as being removed
      if (sub.channel) {
        console.log(`[RealtimeEngine] Marking old channel for removal: ${channelName}`);
        sub.channel._isBeingRemoved = true; // Flag to prevent re-subscribe attempts
        
        // Remove old channel
        supabase.removeChannel(sub.channel);
        
        // Wait longer for complete removal (500ms instead of 300ms)
        setTimeout(() => {
          this.createFreshChannel(channelName, sub);
        }, 500);
      } else {
        this.createFreshChannel(channelName, sub);
      }
    } catch (error) {
      console.error(`❌ [RealtimeEngine] Failed to reconnect ${channelName}:`, error);
      sub.isReconnecting = false;
      sub.isHealthy = false;
      sub.lastError = new Date();
      
      // Retry with backoff
      this.handleChannelError(channelName, error);
    }
  }

  private createFreshChannel(channelName: string, sub: any) {
    try {
      console.log(`[RealtimeEngine] Creating fresh channel: ${channelName}`);
      
      // Create new channel with same configuration
      const newChannel = this.createChannel(
        channelName,
        sub.table,
        sub.callback,
        sub.options
      );

      // Update subscription
      sub.channel = newChannel;
      sub.isHealthy = false; // Will be set to true when subscribed
      sub.isReconnecting = false;
      
      console.log(`✅ [RealtimeEngine] Fresh channel created: ${channelName}`);
    } catch (error) {
      console.error(`❌ [RealtimeEngine] Failed to create fresh channel ${channelName}:`, error);
      sub.isReconnecting = false;
      sub.isHealthy = false;
      sub.lastError = new Date();
      
      this.handleChannelError(channelName, error);
    }
  }

  private async reconnectAll() {
    console.log('🔄 [RealtimeEngine] Reconnecting all channels...');
    const channelNames = Array.from(this.activeSubscriptions.keys());
    
    for (const channelName of channelNames) {
      try {
        await this.reconnectChannel(channelName);
        // Small delay between reconnections to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        console.error(`[RealtimeEngine] Failed to reconnect ${channelName}:`, error);
      }
    }
    
    console.log(`✅ [RealtimeEngine] Reconnected ${channelNames.length} channels`);
  }

  private unsubscribe(channelName: string) {
    const sub = this.activeSubscriptions.get(channelName);
    if (sub) {
      console.log(`[RealtimeEngine] Unsubscribing: ${channelName}`);
      try {
        supabase.removeChannel(sub.channel);
      } catch (error) {
        console.warn(`[RealtimeEngine] Error removing channel:`, error);
      }
      this.activeSubscriptions.delete(channelName);
    }
  }

  private async unsubscribeAll() {
    console.log('[RealtimeEngine] Unsubscribing from all channels...');
    const channelNames = Array.from(this.activeSubscriptions.keys());
    
    for (const channelName of channelNames) {
      this.unsubscribe(channelName);
    }
    
    console.log(`✅ [RealtimeEngine] Unsubscribed from ${channelNames.length} channels`);
  }

  /**
   * Comprehensive resync after tab becomes visible again
   */
  public async resyncAll() {
    // Prevent too frequent resyncs (cooldown period)
    const now = Date.now();
    if (now - this.lastResyncTime < this.resyncCooldown) {
      console.log('[RealtimeEngine] Resync cooldown active, skipping...');
      return;
    }

    if (this.isResyncing) {
      console.log('[RealtimeEngine] Resync already in progress, skipping...');
      return;
    }

    this.isResyncing = true;
    this.lastResyncTime = now;
    console.log('🔄 [RealtimeEngine] Starting comprehensive resync...');
    
    // First, check if Supabase realtime connection is alive
    const connectionState = await this.checkRealtimeConnection();
    
    if (!connectionState) {
      console.warn('[RealtimeEngine] Realtime connection is dead, force refresh needed');
      // Force a complete reconnection of the Supabase realtime client
      await this.forceRealtimeReconnect();
      // Wait for connection to establish
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    const subs = Array.from(this.activeSubscriptions.entries());
    let resyncedCount = 0;
    let failedCount = 0;
    
    for (const [channelName, sub] of subs) {
      try {
        const channelState = sub.channel.state;
        console.log(`[RealtimeEngine] Channel ${channelName} state: ${channelState}`);
        
        // Force reconnect for unhealthy or closed channels
        if (!sub.isHealthy || 
            channelState === 'closed' || 
            channelState === 'errored' || 
            channelState === 'unsubscribed' ||
            channelState === 'closing') {
          
          console.log(`🔧 [RealtimeEngine] Recreating unhealthy channel: ${channelName} (was ${channelState})`);
          
          try {
            // Check if already being reconnected
            if (sub.isReconnecting) {
              console.log(`⏳ [RealtimeEngine] Channel ${channelName} already being reconnected, skipping`);
              continue;
            }
            
            // Mark as reconnecting
            sub.isReconnecting = true;
            
            if (sub.channel) {
              console.log(`[RealtimeEngine] Removing channel: ${channelName}`);
              sub.channel._isBeingRemoved = true; // Mark for safety
              await supabase.removeChannel(sub.channel);
              // Wait for removal
              await new Promise(resolve => setTimeout(resolve, 300));
            }
            
            // Use createFreshChannel instead of createChannel to avoid duplicate issues
            this.createFreshChannel(channelName, sub);
            resyncedCount++;
            
            // Wait a bit for the channel to establish
            await new Promise(resolve => setTimeout(resolve, 500));
          } catch (error) {
            console.error(`[RealtimeEngine] Failed to recreate ${channelName}:`, error);
            sub.isReconnecting = false;
            failedCount++;
          }
        } else if (channelState === 'joined' || channelState === 'subscribed') {
          console.log(`✅ [RealtimeEngine] Channel healthy: ${channelName}`);
          resyncedCount++;
        } else {
          // For transitional states, wait and check again
          console.log(`⏳ [RealtimeEngine] Channel in transition: ${channelName} (${channelState})`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          const currentState = sub.channel.state;
          if (currentState !== 'joined' && currentState !== 'subscribed') {
            console.log(`🔧 [RealtimeEngine] Still unhealthy, reconnecting: ${channelName}`);
            this.reconnectChannel(channelName);
          }
        }
      } catch (error) {
        console.error(`[RealtimeEngine] Error processing ${channelName}:`, error);
        failedCount++;
      }
    }
    
    this.isResyncing = false;
    console.log(`✅ [RealtimeEngine] Resync complete: ${resyncedCount} ok, ${failedCount} failed`);
    
    // If any failed, schedule another resync
    if (failedCount > 0) {
      setTimeout(() => {
        console.log('[RealtimeEngine] Scheduling follow-up resync...');
        this.resyncAll();
      }, 5000);
    }
  }

  /**
   * Check if Supabase realtime connection is alive
   */
  private async checkRealtimeConnection(): Promise<boolean> {
    try {
      // Try to get the channel state from any active subscription
      const firstSub = this.activeSubscriptions.values().next().value;
      if (!firstSub) {
        console.log('[RealtimeEngine] No active subscriptions to check');
        return true;
      }
      
      const state = firstSub.channel.state;
      console.log(`[RealtimeEngine] Connection state check: ${state}`);
      
      return state === 'joined' || state === 'subscribed';
    } catch (error) {
      console.error('[RealtimeEngine] Failed to check connection:', error);
      return false;
    }
  }

  /**
   * Force a complete reconnection of Supabase realtime
   */
  private async forceRealtimeReconnect() {
    console.log('🔧 [RealtimeEngine] Forcing complete realtime reconnection...');
    
    try {
      // Remove all channels first
      const channelNames = Array.from(this.activeSubscriptions.keys());
      
      for (const channelName of channelNames) {
        const sub = this.activeSubscriptions.get(channelName);
        if (sub && sub.channel) {
          console.log(`[RealtimeEngine] Removing channel: ${channelName}`);
          await supabase.removeChannel(sub.channel);
          sub.isHealthy = false;
        }
      }
      
      // Wait for all channels to be removed
      await new Promise(resolve => setTimeout(resolve, 500));
      
      console.log('[RealtimeEngine] All channels removed, will recreate on next resync');
    } catch (error) {
      console.error('[RealtimeEngine] Error during force reconnect:', error);
    }
  }

  /**
   * Start periodic health monitoring
   */
  private startHealthMonitoring() {
    // Check health every 60 seconds (reduced from 30s to avoid unnecessary checks)
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, 60000);
    
    console.log('[RealtimeEngine] Health monitoring started (60s interval)');
  }

  private async performHealthCheck() {
    const subs = Array.from(this.activeSubscriptions.entries());
    
    for (const [channelName, sub] of subs) {
      const state = sub.channel.state;
      
      // If channel has been unhealthy for more than 2 minutes, force reconnect
      if (!sub.isHealthy && sub.lastError) {
        const timeSinceError = Date.now() - sub.lastError.getTime();
        if (timeSinceError > 120000) { // 2 minutes
          console.log(`[RealtimeEngine] Force reconnecting stale channel: ${channelName}`);
          sub.retryCount = 0; // Reset retry count for fresh start
          this.reconnectChannel(channelName);
        }
      }
      
      // Only reconnect channels in definitively bad states
      // Don't reconnect on 'closed' as it might be intentional (tab in background)
      if (state === 'errored' || state === 'unsubscribed') {
        console.warn(`[RealtimeEngine] Unhealthy channel detected: ${channelName} (${state})`);
        this.reconnectChannel(channelName);
      }
    }
  }



  /**
   * Get subscription status for debugging
   */
  public getSubscriptionStatus() {
    const status: any = {};
    
    for (const [channelName, sub] of this.activeSubscriptions.entries()) {
      status[channelName] = {
        table: sub.table,
        isHealthy: sub.isHealthy,
        state: sub.channel.state,
        retryCount: sub.retryCount,
        lastError: sub.lastError
      };
    }
    
    return status;
  }

  /**
   * Cleanup on app shutdown
   */
  public destroy() {
    console.log('[RealtimeEngine] Destroying engine, cleaning up all channels...');
    
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    
    this.unsubscribeAll();
  }

  // المحرك السحري: يقوم بالتحديث الذكي للكاش محلياً لكي تختفي الـ Loading 완전히
  private syncToCache(table: string, payload: any) {
    const { eventType, new: newRec, old: oldRec } = payload;
    
    try {
      // تحسين المزامنة: بدلاً من تحديث كافة الاستعلامات يدوياً (والذي قد يكون مكلفاً مع التجزئة)،
      // نقوم بتحديث الاستعلامات النشطة فقط أو إبطالها لضمان الدقة.
      
      if (table === 'students') {
        // نقوم بإبطال كافة استعلامات الطلاب لضمان تحديث العد (count) والترتيب عبر كافة الصفحات
        queryClient.invalidateQueries({ 
          queryKey: ['students'],
          exact: false,
          refetchType: 'none' // تحديث الصفحات الظاهرة حالياً فقط في الخلفية
        });

        // تحديث استعلام الطالب المنفرد إذا كان مفتوحاً
        if (eventType === 'UPDATE' || eventType === 'INSERT') {
           queryClient.setQueriesData({ queryKey: ['student', newRec.id] }, newRec);
        }
      }

      if (table === 'profiles') {
        // إذا تغير الملف الشخصي، قد يكون معلماً
        queryClient.invalidateQueries({ 
          queryKey: ['teachers'],
          exact: false,
          refetchType: 'none'
        });
        if (eventType === 'UPDATE' || eventType === 'INSERT') {
           queryClient.setQueriesData({ queryKey: ['teacher', newRec.id] }, newRec);
        }
      }

      if (table === 'user_roles') {
        // إذا تغيرت الأدوار (قبول/رفض معلم)، نحدث قائمة المعلمين
        queryClient.invalidateQueries({ 
          queryKey: ['teachers'],
          exact: false,
          refetchType: 'none'
        });
      }

      if (table === 'classes') {
        queryClient.invalidateQueries({ 
          queryKey: ['classes'],
          exact: false,
          refetchType: 'none'
        });
        if (eventType === 'UPDATE' || eventType === 'INSERT') {
           queryClient.setQueriesData({ queryKey: ['class', newRec.id] }, newRec);
        }
      }

      if (table === 'complaints') {
        queryClient.invalidateQueries({ 
          queryKey: ['complaints'],
          exact: false,
          refetchType: 'none'
        });
        queryClient.invalidateQueries({ 
          queryKey: ['parent-complaints'],
          exact: false,
          refetchType: 'none'
        });
      }

      if (table === 'grades' || table === 'exam_templates') {
        queryClient.invalidateQueries({ 
          queryKey: ['exam-templates'],
          exact: false,
          refetchType: 'none'
        });
        queryClient.invalidateQueries({ 
          queryKey: ['student-grades'],
          exact: false,
          refetchType: 'none'
        });
      }

      if (table === 'attendance') {
        queryClient.invalidateQueries({ 
          queryKey: ['attendance'],
          exact: false,
          refetchType: 'none'
        });
      }

      if (table === 'curriculums' || table === 'curriculum_subjects') {
        queryClient.invalidateQueries({ 
          queryKey: ['curriculums'],
          exact: false,
          refetchType: 'none'
        });
        queryClient.invalidateQueries({ 
          queryKey: ['curriculum-subjects'],
          exact: false,
          refetchType: 'none'
        });
      }
      
      if (table === 'notifications' || table === 'messages') {
          queryClient.invalidateQueries({ queryKey: [table], exact: false });
          if (table === 'notifications') {
            queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
          }
      }

    } catch (e) {
      console.warn('[RealtimeEngine] Failed to auto-sync cache', e);
    }
  }
}

export const realtimeEngine = new RealtimeEngine();
