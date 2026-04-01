import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export default function PwaManager() {
  const { user } = useAuth();

  useEffect(() => {
    const updateManifest = async () => {
      let name = "إدارة عربية";
      let shortName = "إدارة";
      let icon = "/placeholder.svg";
      let slug = "";

      // 1. Determine school context
      if (user?.schoolId) {
        const { data } = await supabase
          .from('schools')
          .select('name, slug, logo_url')
          .eq('id', user.schoolId)
          .single();
        
        const school = data as any;
        if (school) {
          name = school.name;
          shortName = school.name.split(' ')[0];
          icon = school.logo_url || "/placeholder.svg";
          slug = school.slug;
        }
      } else {
        // Check URL for registration slugs
        const pathParts = window.location.pathname.split('/');
        const isReg = pathParts.includes('register');
        const urlSlug = pathParts[pathParts.length - 1];
        
        if (isReg && urlSlug) {
           const { data } = await supabase
            .from('schools')
            .select('name, slug, logo_url')
            .eq('slug', urlSlug)
            .single();
          
          const school = data as any;
          if (school) {
            name = school.name;
            shortName = school.name.split(' ')[0];
            icon = school.logo_url || "/placeholder.svg";
            slug = school.slug;
          }
        }
      }

      // @ts-ignore - Deep type instantiation
      const manifest = {
        name: name,
        short_name: shortName,
        description: "نظام إدارة المدارس الذكي — منصة إدارة عربية",
        start_url: window.location.origin + (slug ? `/?school=${slug}` : "/"),
        display: "standalone",
        background_color: "#0a0f1e",
        theme_color: "#1e293b",
        icons: [
          {
            src: icon.startsWith('http') ? icon : window.location.origin + (icon.startsWith('/') ? icon : '/' + icon),
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable"
          },
          {
            src: icon.startsWith('http') ? icon : window.location.origin + (icon.startsWith('/') ? icon : '/' + icon),
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

      // 4. Update Title & Favicon
      document.title = name;
      const favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
      if (favicon) {
        favicon.href = icon;
      }
    };

    updateManifest();
  }, [user?.schoolId]);

  return null;
}
