import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export default function PwaManager() {
  const { user } = useAuth();

  useEffect(() => {
    const updateManifest = async () => {
      let name = "المدرسة الذكية";
      let shortName = "المدرسة";
      const defaultIcon = "https://mecutwhreywjwstirpka.supabase.co/storage/v1/object/public/branding/logo.png";
      let icon = defaultIcon;
      let slug = "";
      let themeColor = "#1e293b";

      // 1. Determine school context
      if (user?.schoolId) {
        try {
          const { data, error } = await supabase
            .from('schools')
            .select('name, slug, logo_url, icon_url, theme_color')
            .eq('id', user.schoolId)
            .maybeSingle();
          
          if (error) {
            console.error('Error fetching PWA school data:', error);
          } else if (data) {
            const school = data as any;
            name = school.name;
            shortName = school.name.split(' ')[0];
            icon = school.icon_url || school.logo_url || "/icons/icon-192.png";
            slug = school.slug;
            themeColor = school.theme_color || "#1e293b";
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
              .select('name, slug, logo_url, icon_url, theme_color')
              .eq('slug', finalSlug)
              .maybeSingle();
            
            if (error) {
              console.error('Error fetching PWA school data by slug:', error);
            } else if (data) {
              const school = data as any;
              name = school.name;
              shortName = school.name.split(' ')[0];
              icon = school.icon_url || school.logo_url || "/icons/icon-192.png";
              slug = school.slug;
              themeColor = school.theme_color || "#1e293b";
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
    };

    updateManifest();

    // 2. Real-time update listener for school branding
    const channel = supabase
      .channel('pwa-branding-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'schools',
          filter: user?.schoolId ? `id=eq.${user.schoolId}` : undefined
        },
        () => {
          // Re-run the manifest update when school data changes
          updateManifest();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.schoolId, user?.id]);

  return null;
}
