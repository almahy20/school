import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { realtimeEngine } from '@/lib/RealtimeEngine';

export default function PwaManager() {
  const { user } = useAuth();

  const updateManifest = useCallback(async () => {
    let name = "المدرسة الذكية";
    let shortName = "المدرسة";
    const defaultIcon = "/icons/icon-192.png";
    let icon = defaultIcon;
    let slug = "";
    let themeColor = "#1e293b";
    let schoolId = user?.schoolId;

    // For new users waiting approval, try to get school_id from user metadata
    if (!schoolId && user?.email) {
      const { data: { user: supabaseUser } } = await supabase.auth.getUser();
      if (supabaseUser?.user_metadata?.school_id) {
        schoolId = supabaseUser.user_metadata.school_id;
      }
    }

    // 1. Determine school context
    if (schoolId) {
      try {
        const { data, error } = await supabase
          .from('schools')
          .select('name, slug, logo_url')
          .eq('id', schoolId)
          .maybeSingle();
        
        if (error) {
          console.error('Error fetching PWA school data:', error);
        } else if (data) {
          const school = data as any;
          name = school.name;
          shortName = school.name.split(' ')[0];
          icon = school.logo_url || "/icons/icon-192.png";
          slug = school.slug;
          themeColor = "#1e293b";
        }
      } catch (err) {
        console.error('Fatal error in PwaManager fetch:', err);
      }
    } else {
      // Check URL for registration slugs or query params
      const pathParts = window.location.pathname.split('/');
      const isReg = pathParts.includes('register');
      const urlSlug = pathParts[pathParts.length - 1];
      const params = new URLSearchParams(window.location.search);
      const querySlug = params.get('school');
      
      const finalSlug = querySlug || (isReg ? urlSlug : null);
      
      if (finalSlug) {
         try {
           const { data, error } = await supabase
            .from('schools')
            .select('name, slug, logo_url')
            .eq('slug', finalSlug)
            .maybeSingle();
          
          if (error) {
            console.error('Error fetching PWA school data by slug:', error);
          } else if (data) {
            const school = data as any;
            name = school.name;
            shortName = school.name.split(' ')[0];
            icon = school.logo_url || "/icons/icon-192.png";
            slug = school.slug;
            themeColor = "#1e293b";
          }
        } catch (err) {
          console.error('Fatal error in PwaManager fetch by slug:', err);
        }
      }
    }

    // Add cache busting to icon to force refresh when changed in dashboard
    const timestamp = Date.now();
    const cacheBustIcon = icon.includes('?') ? `${icon}&v=${timestamp}` : `${icon}?v=${timestamp}`;

    // @ts-ignore - Deep type instantiation
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

    // 3. Update DOM
    const link = document.querySelector('link[rel="manifest"]') as HTMLLinkElement;
    if (link) {
      link.href = manifestURL;
    }

    // 4. Update Title & Favicon & Theme Color
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
  }, [user?.schoolId]);

  useEffect(() => {
    updateManifest();

    // 2. Real-time update listener for school branding using the robust engine
    const unsubscribe = realtimeEngine.subscribe(
      'schools',
      () => {
        // Re-run the manifest update when school data changes
        updateManifest();
      },
      {
        event: 'UPDATE',
        filter: user?.schoolId ? `id=eq.${user.schoolId}` : undefined
      }
    );

    return () => {
      unsubscribe();
    };
  }, [user?.schoolId, user?.email, updateManifest]);

  return null;
}
