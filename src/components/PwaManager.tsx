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
      // ✅ Optimization: Check localStorage first for immediate PWA update
      const cached = localStorage.getItem(`branding_${schoolId}`);
      if (cached) {
        try {
          const s = JSON.parse(cached);
          let cleanName = s.name.replace(/^مدرسة\s*/i, '').replace(/^مدرسه\s*/i, '').trim();
          name = cleanName || s.name;
          shortName = cleanName || s.name;
          icon = s.logo_url || defaultIcon;
          slug = s.slug;
        } catch (e) {}
      }

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
          let cleanName = school.name.replace(/^مدرسة\s*/i, '').replace(/^مدرسه\s*/i, '').trim();
          name = cleanName || school.name;
          shortName = cleanName || school.name;
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
            let cleanName = school.name.replace(/^مدرسة\s*/i, '').replace(/^مدرسه\s*/i, '').trim();
            name = cleanName || school.name;
            shortName = cleanName || school.name;
            icon = school.logo_url || "/icons/icon-192.png";
            slug = school.slug;
            themeColor = "#1e293b";
          }
        } catch (err) {
          console.error('Fatal error in PwaManager fetch by slug:', err);
        }
      }
    }

    // ✅ Optimization: Remove Date.now() cache buster. 
    // It was causing the logo to be re-downloaded on every page navigation.
    // The logo_url in the database already has a version timestamp if updated.
    const cacheBustIcon = icon; 

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
          // ✅ Optimization: Use optimized smaller versions for manifest icons if possible
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

    // 4. Update Favicon & Theme Color (Title is handled by useBranding)
    // document.title = name; // ✅ REMOVED: Do not set title here to avoid flicker
    
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
