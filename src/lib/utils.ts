import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Safely applies .in() or .eq() filter to a Supabase query
 * Supabase .in() fails with single-element arrays, so we use .eq() for single values
 * 
 * @param query - The Supabase query builder
 * @param column - The column to filter on
 * @param values - Array of values to filter by
 * @returns The modified query builder
 */
export function safeInFilter(
  query: any,
  column: string,
  values: any[]
): any {
  if (!values || values.length === 0) {
    return query;
  }
  
  if (values.length === 1) {
    return query.eq(column, values[0]);
  }
  
  return query.in(column, values);
}

/**
 * Optimizes Supabase image URLs for faster loading and better compression.
 * Note: Requires Supabase Image Transformation to be enabled (standard on some plans).
 * 
 * @param url - The original public URL
 * @param options - Transformation options (width, height, quality)
 * @returns The optimized URL
 */
export function getOptimizedImageUrl(url: string | null | undefined, options: { width?: number; height?: number; quality?: number } = {}) {
  if (!url) return '';
  if (!url.includes('supabase.co/storage/v1/object/public/')) return url;

  const { width = 100, height, quality = 70 } = options;
  
  // Transform the URL from /object/public/ to /render/image/public/
  let optimizedUrl = url.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/');
  
  // Append transformation parameters
  const params = new URLSearchParams();
  params.append('width', width.toString());
  if (height) params.append('height', height.toString());
  params.append('quality', quality.toString());
  params.append('resize', 'contain');
  
  // Keep original query params (like cache buster v=...) but append new ones
  const separator = optimizedUrl.includes('?') ? '&' : '?';
  return `${optimizedUrl}${separator}${params.toString()}`;
}

/**
 * يقوم بضغط الصورة في المتصفح قبل رفعها لتقليل استهلاك البيانات وتسريع الرفع
 */
export async function compressImage(file: File, maxWidth = 1024, quality = 0.8): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Canvas to Blob conversion failed'));
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
}
