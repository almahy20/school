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
