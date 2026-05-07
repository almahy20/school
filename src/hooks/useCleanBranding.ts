import { useMemo } from 'react';
import { getOptimizedImageUrl } from '@/lib/utils';

export interface BrandingData {
  name: string;
  cleanName: string;
  logo: string;
  themeColor: string;
}

/**
 * Pure function to clean and optimize branding data.
 * Can be used outside of React components/hooks.
 */
export function cleanBrandingData(rawBranding: { name?: string; logo_url?: string } | null | undefined): BrandingData {
  const rawName = rawBranding?.name || 'الجيل الجديد';
  const rawLogo = rawBranding?.logo_url || '';

  // Clean name: remove "مدرسة" or "مدرسه" from the start
  const cleanName = rawName
    .replace(/^مدرسة\s*/i, '')
    .replace(/^مدرسه\s*/i, '')
    .trim();

  // Optimize logo URL for faster loading
  const optimizedLogo = getOptimizedImageUrl(rawLogo, { width: 160, quality: 80 });

  return {
    name: rawName,
    cleanName: cleanName || rawName,
    logo: optimizedLogo,
    themeColor: '#1A3C8F'
  };
}

/**
 * Hook to process raw school branding data into a clean, optimized format.
 * Centralizes the logic for name cleaning and image optimization.
 */
export function useCleanBranding(rawBranding: { name?: string; logo_url?: string } | null | undefined): BrandingData {
  return useMemo(() => cleanBrandingData(rawBranding), [rawBranding]);
}
