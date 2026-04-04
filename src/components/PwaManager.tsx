import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export default function PwaManager() {
  const { user } = useAuth();

  useEffect(() => {
    const updateManifest = async () => {
      let name = "المدرسة";
      let shortName = "المدرسة";
      let icon = "/icons/icon-192.png";
      let slug = "";
      let themeColor = "#1e293b";

      // 1. Determine school context
      if (user?.schoolId) {
        const { data } = await supabase
          .from('schools')
          .select('name, slug, logo_url, icon_url, theme_color')
          .eq('id', user.schoolId)
          .single();
        
        const school = data as any;
        if (school) {
          name = school.name;
          shortName = school.name.split(' ')[0];
          icon = school.icon_url || school.logo_url || "/icons/icon-192.png";
          slug = school.slug;
          themeColor = school.theme_color || "#1e293b";
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
           const { data } = await supabase
            .from('schools')
            .select('name, slug, logo_url, icon_url, theme_color')
            .eq('slug', finalSlug)
            .single();
          
          const school = data as any;
          if (school) {
            name = school.name;
            shortName = school.name.split(' ')[0];
            icon = school.icon_url || school.logo_url || "/icons/icon-192.png";
            slug = school.slug;
            themeColor = school.theme_color || "#1e293b";
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
      
      const favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
      if (favicon) {
        favicon.href = cacheBustIcon;
      }

      let metaTheme = document.querySelector("meta[name='theme-color']") as HTMLMetaElement;
      if (!metaTheme) {
        metaTheme = document.createElement('meta');
        metaTheme.name = 'theme-color';
        document.head.appendChild(metaTheme);
      }
      metaTheme.content = themeColor;
    };

    updateManifest();
  }, [user?.schoolId, user?.id]);

  return null;
}
