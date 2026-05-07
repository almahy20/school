import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  realtime: {
    params: {
      eventsPerSecond: 40,
    }
    // ✅ ملاحظة: في local development، WebSocket قد يتأخر
    // في production، سيستخدم wss:// تلقائياً
  },
  global: {
    headers: {
      'x-client-info': 'school-app'
    }
  },
  // ✅ تحسين أداء الـ requests
  db: {
    schema: 'public'
  }
});