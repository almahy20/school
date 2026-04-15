/**
 * Offline-First Helper
 * 
 * Helper functions to easily add offline support to any mutation
 */

import { enqueueMutation } from '@/lib/offlineQueue';
import { toast } from 'sonner';

/**
 * Create an offline-aware mutation function
 * 
 * @param type - 'create' | 'update' | 'delete'
 * @param table - Database table name
 * @param data - Data to mutation
 * @param messages - Custom success messages
 * 
 * @returns Result with offline flag
 */
export async function offlineMutation(
  type: 'create' | 'update' | 'delete',
  table: string,
  data: any,
  messages?: {
    offline?: string;
    success?: string;
  }
) {
  // Check if offline
  if (!window.navigator.onLine) {
    const mutationId = await enqueueMutation(type, table, data);
    
    toast.success(
      messages?.offline || 'تم الحفظ - سيتم المزامنة عند عودة الاتصال',
      { duration: 3000 }
    );
    
    return { id: mutationId, offline: true };
  }

  // Online - return false to indicate direct execution
  return { offline: false };
}

/**
 * Handle mutation success with toast
 */
export function handleMutationSuccess(
  result: { offline?: boolean } | undefined,
  successMessage: string
) {
  if (!result?.offline) {
    toast.success(successMessage, { duration: 3000 });
  }
}

/**
 * Example usage in a mutation hook:
 * 
 * ```typescript
 * import { offlineMutation, handleMutationSuccess } from '@/lib/offlineMutationHelper';
 * 
 * export function useCreateSomething() {
 *   return useMutation({
 *     mutationFn: async (data) => {
 *       // Check offline first
 *       const offlineResult = await offlineMutation('create', 'table_name', data, {
 *         offline: 'تم الحفظ',
 *         success: 'تم الإنشاء بنجاح'
 *       });
 *       
 *       if (offlineResult.offline) {
 *         return offlineResult;
 *       }
 *       
 *       // Online - execute actual mutation
 *       const { data: result, error } = await supabase
 *         .from('table_name')
 *         .insert(data)
 *         .select()
 *         .single();
 *       
 *       if (error) throw error;
 *       return result;
 *     },
 *     onSuccess: (result) => {
 *       handleMutationSuccess(result, 'تم الإنشاء بنجاح');
 *     }
 *   });
 * }
 * ```
 */
