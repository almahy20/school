import { useEffect, useRef } from 'react';
import { useBranding } from './useBranding';

/**
 * Hook to dynamically update the favicon with school logo
 * Only updates when branding changes, not on every render
 */
export function useSchoolFavicon() {
  const { data: branding } = useBranding();
  const previousLogoUrl = useRef<string | undefined>(undefined);

  useEffect(() => {
    // Only update if logo URL actually changed
    if (branding?.logo_url && branding.logo_url !== previousLogoUrl.current) {
      previousLogoUrl.current = branding.logo_url;
      
      // Find or create favicon link
      let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
      
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }

      link.href = branding.logo_url;
      link.type = 'image/png';

      // Also update apple-touch-icon
      let appleLink = document.querySelector("link[rel~='apple-touch-icon']") as HTMLLinkElement;
      if (!appleLink) {
        appleLink = document.createElement('link');
        appleLink.rel = 'apple-touch-icon';
        document.head.appendChild(appleLink);
      }
      appleLink.href = branding.logo_url;

      // Update manifest theme color if needed
      const metaThemeColor = document.querySelector("meta[name='theme-color']") as HTMLMetaElement;
      if (metaThemeColor) {
        metaThemeColor.content = '#1e293b';
      }
    }

    // NO cleanup function - don't revert favicon on unmount
    // This prevents unnecessary favicon.ico requests on every route change
  }, [branding]); // Only runs when branding changes
}
