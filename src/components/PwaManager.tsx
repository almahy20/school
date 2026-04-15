import { useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useBranding } from '@/hooks/queries';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

export default function PwaManager() {
  const { user } = useAuth();
  const location = useLocation();
  const { data: brandingData } = useBranding();

  // Helper to get slug from URL if user is not logged in
  const urlSlug = useMemo(() => {
    if (user?.schoolId) return null;
    
    const pathParts = location.pathname.split('/');
    const isReg = pathParts.includes('register');
    const slugInPath = pathParts[pathParts.length - 1];
    const params = new URLSearchParams(location.search);
    const querySlug = params.get('school');
    
    return querySlug || (isReg ? slugInPath : null);
  }, [user?.schoolId, location.pathname, location.search]);

  // Fetch school by slug if no user schoolId
  const { data: slugBrandingData } = useQuery({
    queryKey: ['school-by-slug-pwa', urlSlug],
    queryFn: async () => {
      if (!urlSlug) return null;
      const { data: school, error } = await supabase
        .from('schools')
        .select('id, name, logo_url, slug')
        .eq('slug', urlSlug)
        .maybeSingle();
      
      if (error) return null;
      return school;
    },
    enabled: !!urlSlug && !user?.schoolId
  });

  const activeBranding = brandingData || slugBrandingData;

  const updateManifest = useCallback(() => {
    let name = "المدرسة الذكية";
    let shortName = "المدرسة";
    const defaultIcon = "/icons/icon-192.png";
    let icon = defaultIcon;
    let slug = "";
    const themeColor = "#1e293b";

    if (activeBranding) {
      name = activeBranding.name;
      // Use full name as short name if it's reasonably short (up to 12 chars), otherwise use first 2 words or first word
      const words = activeBranding.name.split(' ');
      if (activeBranding.name.length <= 15) {
        shortName = activeBranding.name;
      } else if (words.length > 1) {
        shortName = `${words[0]} ${words[1]}`.slice(0, 12);
      } else {
        shortName = words[0].slice(0, 12);
      }
      icon = activeBranding.logo_url || defaultIcon;
      slug = activeBranding.slug;
    }

    // Add cache busting to icon to force refresh when changed in dashboard
    const timestamp = Date.now();
    const cacheBustIcon = icon.includes('?') ? `${icon}&v=${timestamp}` : `${icon}?v=${timestamp}`;

    // @ts-expect-error - Deep type instantiation
    const manifest = {
      name: name,
      short_name: shortName,
      description: `نظام إدارة ${name} الذكي`,
      start_url: window.location.origin + (slug ? `/?school=${slug}` : "/"),
      display: "standalone",
      background_color: "#0a0f1e",
      theme_color: themeColor,
      icons: [
        {
          src: cacheBustIcon.startsWith('http') ? cacheBustIcon : window.location.origin + (cacheBustIcon.startsWith('/') ? cacheBustIcon : '/' + cacheBustIcon),
          sizes: "192x192",
          type: "image/png",
          purpose: "any maskable"
        },
        {
          src: cacheBustIcon.startsWith('http') ? cacheBustIcon : window.location.origin + (cacheBustIcon.startsWith('/') ? cacheBustIcon : '/' + cacheBustIcon),
          sizes: "512x512",
          type: "image/png"
        }
      ]
    };

    const stringManifest = JSON.stringify(manifest);
    const blob = new Blob([stringManifest], { type: 'application/json' });
    const manifestURL = URL.createObjectURL(blob);

    // Update DOM
    const link = document.querySelector('link[rel="manifest"]') as HTMLLinkElement;
    if (link) {
      link.href = manifestURL;
    }

    // Update Title & Favicon & Theme Color
    document.title = name;
    
    const updateIcon = (rel: string, href: string) => {
      let link = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement;
      if (!link) {
        link = document.createElement('link');
        link.rel = rel;
        document.head.appendChild(link);
      }
      link.href = href;
    };

    const finalIcon = cacheBustIcon.startsWith('http') 
      ? cacheBustIcon 
      : window.location.origin + (cacheBustIcon.startsWith('/') ? cacheBustIcon : '/' + cacheBustIcon);

    updateIcon('icon', finalIcon);
    updateIcon('apple-touch-icon', finalIcon);
    updateIcon('shortcut icon', finalIcon);

    let metaTheme = document.querySelector("meta[name='theme-color']") as HTMLMetaElement;
    if (!metaTheme) {
      metaTheme = document.createElement('meta');
      metaTheme.name = 'theme-color';
      document.head.appendChild(metaTheme);
    }
    metaTheme.content = themeColor;
  }, [activeBranding]);

  useEffect(() => {
    updateManifest();
  }, [updateManifest]);

  return null;
}

