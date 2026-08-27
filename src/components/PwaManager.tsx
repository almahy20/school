import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cleanBrandingData } from '@/hooks/useCleanBranding';
import { useBranding } from '@/hooks/queries/useBranding';
import { logger } from '@/utils/logger';

const FALLBACK_PWA_ICON = "/icons/badge-72.png";

function toValidIconUrl(icon: string | null | undefined) {
  const value = (icon || "").trim();

  if (!value) return '';
  if (/^data:image\//i.test(value)) return value;
  if (/^data:/i.test(value) || /^blob:/i.test(value)) return '';
  if (/^https?:\/\//i.test(value)) return value;

  return window.location.origin + (value.startsWith('/') ? value : `/${value}`);
}

export default function PwaManager() {
  const { user } = useAuth();
  const branding = useBranding();
  const brandingDataRef = useRef(branding.data);
  const lastIconUrlRef = useRef<string>(''); // ✅ track last favicon URL to skip redundant network requests

  brandingDataRef.current = branding.data;

  const updateManifest = useCallback(async () => {
    let name = document.title || "المدرسة الذكية";
    let shortName = document.title || "المدرسة";
    const defaultIcon = toValidIconUrl((document.querySelector('link[rel~="icon"]') as HTMLLinkElement)?.href || FALLBACK_PWA_ICON);
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
      const liveBranding = brandingDataRef.current;

      if (liveBranding) {
        const cleaned = cleanBrandingData(liveBranding);
        name = cleaned.cleanName;
        shortName = cleaned.cleanName;
        icon = cleaned.logo || FALLBACK_PWA_ICON;
        slug = liveBranding.slug;
        themeColor = "#1e293b";
      } else {
        // ✅ Fallback: Check localStorage first for immediate PWA update
        const cached = localStorage.getItem(`branding_${schoolId}`);
        let loadedFromCache = false;
        if (cached) {
          try {
            const s = JSON.parse(cached);
            const cleaned = cleanBrandingData(s);
            name = cleaned.cleanName;
            shortName = cleaned.cleanName;
            icon = cleaned.logo || defaultIcon;
            slug = s.slug;
            loadedFromCache = true;
          } catch (e) {
            logger.error('Error parsing cached branding:', e);
          }
        }

        if (!loadedFromCache) {
          try {
            const { data, error } = await supabase
              .from('schools')
              .select('name, slug, logo_url')
              .eq('id', schoolId)
              .maybeSingle();

            if (error) {
              logger.error('Error fetching PWA school data:', error);
            } else if (data) {
              const school = data as any;
              const cleaned = cleanBrandingData(school);
              name = cleaned.cleanName;
              shortName = cleaned.cleanName;
              icon = cleaned.logo || FALLBACK_PWA_ICON;
              slug = school.slug;
              themeColor = "#1e293b";
            }
          } catch (err) {
            logger.error('Fatal error in PwaManager fetch:', err);
          }
        }
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
            logger.error('Error fetching PWA school data by slug:', error);
          } else if (data) {
            const school = data as any;
            const cleaned = cleanBrandingData(school);
            name = cleaned.cleanName;
            shortName = cleaned.cleanName;
            icon = cleaned.logo || FALLBACK_PWA_ICON;
            slug = school.slug;
            themeColor = "#1e293b";
          }
        } catch (err) {
          logger.error('Fatal error in PwaManager fetch by slug:', err);
        }
      }
    }

    // ✅ favicon (icon/shortcut icon) → width=32 لأن المتصفح بيعرضه بـ 16-32px
    // ✅ apple-touch-icon → width=120 — نفس الـ URL المستخدم في الـ UI لضمان cache موحد
    // ✅ الـ manifest icons بتستخدم لوجو المدرسة الديناميكي بدل أي static file
    const rawLogoUrl = brandingDataRef.current?.logo_url || '';
    const { getOptimizedImageUrl } = await import('@/lib/utils');
    const faviconUrl = rawLogoUrl
      ? getOptimizedImageUrl(rawLogoUrl, { width: 32, quality: 80 })
      : '';
    const appleTouchUrl = rawLogoUrl
      ? getOptimizedImageUrl(rawLogoUrl, { width: 120, quality: 75 })
      : '';
    const manifestIconUrl = rawLogoUrl
      ? getOptimizedImageUrl(rawLogoUrl, { width: 512, quality: 90 })
      : '';
    const cacheBustFavicon = toValidIconUrl(faviconUrl || icon || '');
    const cacheBustApple = toValidIconUrl(appleTouchUrl || icon || '');
    const cacheBustManifest = toValidIconUrl(manifestIconUrl || appleTouchUrl || icon || '');

    // @ts-expect-error - Deep type instantiation
    const manifest: Record<string, unknown> = {
      name: name,
      short_name: shortName,
      description: `نظام إدارة ${name} الذكي`,
      start_url: window.location.origin + (slug ? `/?school=${slug}` : "/"),
      display: "standalone",
      background_color: "#0a0f1e",
      theme_color: themeColor,
    };

    // فقط نضيف icons لو عندنا لوجو المدرسة — مش بنستخدم static files
    if (cacheBustManifest) {
      // نحدد نوع الصورة بشكل صحيح — Supabase بترجع JPEG/WebP مش PNG
      const iconMimeType = rawLogoUrl.toLowerCase().includes('.png') ? 'image/png' : 'image/jpeg';
      (manifest as any).icons = [
        {
          src: cacheBustManifest,
          sizes: "any",
          type: iconMimeType,
          purpose: "any maskable"
        },
        {
          src: cacheBustApple || cacheBustManifest,
          sizes: "any",
          type: iconMimeType,
          purpose: "any"
        }
      ];
    } else {
      // fallback to static badge icon
      (manifest as any).icons = [
        {
          src: "/icons/badge-72.png",
          sizes: "72x72",
          type: "image/png",
          purpose: "any maskable"
        }
      ];
    }

    const stringManifest = JSON.stringify(manifest);
    const blob = new Blob([stringManifest], { type: 'application/json' });
    const manifestURL = URL.createObjectURL(blob);

    // 3. Update DOM
    const link = document.querySelector('link[rel="manifest"]') as HTMLLinkElement;
    if (link) {
      // ✅ Optimization: Revoke old URL to prevent memory leaks
      if (link.href.startsWith('blob:')) {
        URL.revokeObjectURL(link.href);
      }
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

    // ✅ Skip favicon update if URL hasn't changed — avoids redundant network requests
    // favicon (16-32px display) uses width=32, apple-touch-icon (homescreen) uses width=120
    if (lastIconUrlRef.current !== cacheBustFavicon) {
      lastIconUrlRef.current = cacheBustFavicon;
      updateIcon('icon', cacheBustFavicon);
      updateIcon('shortcut icon', cacheBustFavicon);
      updateIcon('apple-touch-icon', cacheBustApple);
    }

    let metaTheme = document.querySelector("meta[name='theme-color']") as HTMLMetaElement;
    if (!metaTheme) {
      metaTheme = document.createElement('meta');
      metaTheme.name = 'theme-color';
      document.head.appendChild(metaTheme);
    }
    metaTheme.content = themeColor;
  }, [user?.schoolId, user?.email]);

  /*
    💡 ملاحظة حول الاستخدام المختلف للقناتين اللتين كانتا مشتركتا في جدول schools:
    - القناة في RealtimeNotificationsManager.tsx (سطر 150-171): هدفها تحديث React Query cache لـ ['school-branding'] عند UPDATE في الجدول،
      فتستخدم supabase.channel مباشرة مع invalidation للـ cache عشان يتحدث في الـ UI.
    - القناة القديمة هنا في PwaManager (التي تمت إزالتها): هدفها إعادة بناء Web Manifest + تحديث الفافيكون
      والـ theme-color مباشرة في الـ DOM عند تحديث بيانات المدرسة (اسم/لوجو).
    
    تم توحيدهما بالاعتماد على الـ useBranding hook نفسه: عندما يتحدث الـ branding عن طريق
    القناة في RealtimeNotificationsManager، الـ ref هنا يتحدث وبيحس بالتغير ويعيد بناء الـ Manifest تلقائياً،
    فبالتالي قللنا عدد قنوات WebSocket بمقدار 1 قناة لجدول schools.
  */
  useEffect(() => {
    updateManifest();
  }, [user?.schoolId, user?.email, updateManifest]);

  useEffect(() => {
    if (branding.data) {
      updateManifest();
    }
  }, [branding.data, updateManifest]);

  return null;
}
