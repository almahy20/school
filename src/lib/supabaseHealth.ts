import { supabase } from '@/integrations/supabase/client';
import { queryClient } from './queryClient';
import { logger } from '@/utils/logger';

/**
 * Supabase Health Manager (Simple & Robust)
 * 
 * يضمن بقاء اتصال Supabase و Realtime نشطاً ومستقراً حتى بعد فترات طويلة في الخلفية.
 * يحل مشكلة "التلف (Corrupted Client)" و "فشل التزامن" بتبسيط جذري.
 */

class SupabaseHealthManager {
  private lastCheck = Date.now();
  private isResurrecting = false;
  private COOLDOWN = 10000; // 10 ثواني كحد أدنى بين الفحوصات لتجنب الإرهاق

  constructor() {
    if (typeof window !== 'undefined') {
      this.setupListeners();
    }
  }

  private setupListeners() {
    // 1. مراقبة ظهور التبويب (Tab Visibility)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.checkAndHeal();
      }
    });

    // 2. مراقبة العودة للإنترنت (Online Status)
    window.addEventListener('online', () => {
      this.checkAndHeal(true); // Force heal on online
    });
  }

  /**
   * فحص صحة العميل وإعادة إحيائه إذا لزم الأمر
   */
  async checkAndHeal(force = false) {
    const now = Date.now();
    if (!force && (now - this.lastCheck < this.COOLDOWN)) return;
    if (this.isResurrecting) return;

    this.isResurrecting = true;
    this.lastCheck = now;

    logger.log('👁️ [SupabaseHealth] Tab visible - verifying connection health...');

    try {
      // فحص بسيط للـ API بدون RLS — جدول schools كان يُعيد 403 لمستخدمي parent/teacher
      // مما كان يُطلق performSoftReset() في كل مرة تُصبح التبويب مرئية
      const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
      const supabaseKey = (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY || '';
      
      const res = await fetch(`${supabaseUrl}/rest/v1/`, {
        method: 'HEAD',
        headers: { 'apikey': supabaseKey },
        signal: AbortSignal.timeout(5000),
      });

      if (!res.ok && res.status !== 404) {
        logger.warn('⚠️ [SupabaseHealth] API unreachable - performing soft reset');
        await this.performSoftReset();
      } else {
        logger.log('✅ [SupabaseHealth] Client is healthy. Refreshing stale data...');
        this.refreshStaleQueries();
      }
    } catch (e) {
      logger.error('❌ [SupabaseHealth] Critical health check error:', e);
      await this.performSoftReset();
    } finally {
      this.isResurrecting = false;
    }
  }

  /**
   * إعادة تعيين الاتصال بهدوء بدون إزعاج المستخدم
   */
  private async performSoftReset() {
    logger.log('🔧 [SupabaseHealth] Performing soft reset of Realtime & Queries...');

    try {
      // 1. إعادة تنشيط الجلسة (لضمان صحة الـ Token)
      const { data: { session } } = await supabase.auth.getSession();
      
      // 2. إجبار Realtime على إعادة الاتصال بشكل كامل (Reset Socket)
      // هذا يحل مشكلة "Reconnected 0 channels" بجعل العميل يبدأ من جديد
      supabase.realtime.disconnect();
      
      if (session) {
        supabase.realtime.setAuth(session.access_token);
      }
      
      supabase.realtime.connect();

      // 3. تحديث الكاش (TanStack Query) لضمان أن البيانات المعروضة حديثة
      this.refreshStaleQueries();

      logger.log('✅ [SupabaseHealth] Soft reset completed successfully.');
    } catch (e) {
      logger.error('❌ [SupabaseHealth] Soft reset failed:', e);
    }
  }

  private refreshStaleQueries() {
    // refetchQueries تحتفظ بالكاش وتحدثه في الخلفية
    // invalidateQueries كانت تُلغي الكاش أولاً = refetch مؤلم لكل البيانات
    queryClient.refetchQueries({ 
      type: 'active',
      stale: true 
    });
  }
}

export const supabaseHealth = new SupabaseHealthManager();
