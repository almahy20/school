/**
 * Shared Mutation Helpers
 * 
 * Reduces code duplication across mutation hooks by providing
 * common patterns for success handling and query invalidation.
 */

import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

/**
 * Create a standard success handler for mutations
 * 
 * @param queryKeys - Array of query keys to invalidate
 * @param successMessage - Toast message to show on success
 * @param showToast - Whether to show toast (default: true)
 */
export function createMutationSuccessHandler(
  queryKeys: string[][],
  successMessage: string,
  showToast: boolean = true
) {
  return {
    onSuccess: () => {
      // Invalidate all related queries
      queryKeys.forEach(key => {
        // This will be called with queryClient in the actual hook
      });
      
      if (showToast) {
        toast.success(successMessage);
      }
    }
  };
}

/**
 * Invalidate multiple query keys
 * 
 * @param queryClient - The query client instance
 * @param queryKeys - Array of query keys to invalidate
 */
export function invalidateQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  queryKeys: string[][]
) {
  queryKeys.forEach(key => {
    queryClient.invalidateQueries({ queryKey: key });
  });
}

/**
 * Show success toast with standard formatting
 * 
 * @param message - Success message to display
 */
export function showSuccessToast(message: string) {
  toast.success(message);
}

/**
 * Example usage:
 * 
 * ```typescript
 * import { invalidateQueries, showSuccessToast } from '@/lib/mutationHelpers';
 * 
 * export function useCreateStudent() {
 *   const queryClient = useQueryClient();
 *   
 *   return useMutation({
 *     mutationFn: async (data) => {
 *       const { data: result, error } = await supabase
 *         .from('students')
 *         .insert(data)
 *         .select()
 *         .single();
 *       if (error) throw error;
 *       return result;
 *     },
 *     onSuccess: () => {
 *       invalidateQueries(queryClient, [['students']]);
 *       showSuccessToast('تم إضافة الطالب بنجاح');
 *     }
 *   });
 * }
 * ```
 */
