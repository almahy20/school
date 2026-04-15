// Console Cleaner - Development Helper
// This helps suppress non-critical console warnings in development

const originalError = console.error;
const originalWarn = console.warn;

// Patterns to suppress (non-critical errors/warnings)
const SUPPRESS_PATTERNS = [
  // Supabase/PostgREST warnings
  'response status 403',
  'response status 404',
  'Failed to load resource',
  
  // React Query warnings (handled by error boundaries)
  'Global Mutation Error',
  'Global Query Error',
  
  // Development warnings
  'warn - The class',
  'ambiguous and matches multiple',
  
  // PWA warnings
  'ServiceWorker registration',
  
  // TanStack Query refetch warnings
  'refetchOnWindowFocus',
];

// Override console.error
console.error = (...args) => {
  const message = args.join(' ');
  const shouldSuppress = SUPPRESS_PATTERNS.some(pattern => 
    (message || '').toLowerCase().includes((pattern || '').toLowerCase())
  );
  
  if (!shouldSuppress) {
    originalError.apply(console, args);
  }
};

// Override console.warn
console.warn = (...args) => {
  const message = args.join(' ');
  const shouldSuppress = SUPPRESS_PATTERNS.some(pattern => 
    (message || '').toLowerCase().includes((pattern || '').toLowerCase())
  );
  
  if (!shouldSuppress) {
    originalWarn.apply(console, args);
  }
};

// Log that cleaner is active
console.log('🧹 Console cleaner active - suppressing non-critical warnings');

export {};
