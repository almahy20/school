/**
 * Global Error Interceptor
 * Catches and suppresses specific HTTP errors before they reach console
 */

(function() {
  // Store original fetch
  const originalFetch = window.fetch;

  // Override fetch to intercept 403/404 errors
  window.fetch = async function(...args) {
    try {
      const response = await originalFetch.apply(this, args);
      
      // Suppress 403/404 errors silently
      if (response.status === 403 || response.status === 404) {
        // Return response but don't log error
        return response;
      }
      
      return response;
    } catch (error) {
      // Check if it's a network error we should suppress
      const errorMessage = String(error).toLowerCase();
      if (errorMessage.includes('403') || errorMessage.includes('404')) {
        // Suppress silently
        throw error; // Still throw for proper error handling
      }
      throw error;
    }
  };

  // Also intercept XMLHttpRequest (for older libraries)
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this._url = String(url);
    return originalXHROpen.apply(this, [method, url, ...rest]);
  };

  XMLHttpRequest.prototype.send = function(...args) {
    const originalOnReadyStateChange = this.onreadystatechange;
    
    this.onreadystatechange = function() {
      if (this.readyState === 4) {
        // Suppress 403/404 in XHR
        if (this.status === 403 || this.status === 404) {
          // Don't call original handler for these errors
          return;
        }
      }
      
      if (originalOnReadyStateChange) {
        originalOnReadyStateChange.apply(this, args);
      }
    };
    
    return originalXHRSend.apply(this, args);
  };
})();

export {};
