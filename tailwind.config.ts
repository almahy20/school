import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    // Enhanced breakpoints for better responsive design
    screens: {
      'xs': '480px',    // Large phones
      'sm': '640px',    // Tablets portrait
      'md': '768px',    // Tablets landscape
      'lg': '1024px',   // Laptops
      'xl': '1280px',   // Desktops
      '2xl': '1536px',  // Large screens
    },
    extend: {
      fontFamily: {
        cairo: ["Cairo", "sans-serif"],
      },
      spacing: {
        'card-padding': '1.5rem',
        'section-gap': '2rem',
        'page-padding': '1rem',        // Mobile
        'page-padding-md': '1.5rem',   // Tablet
        'page-padding-lg': '2rem',     // Desktop
        'card-gap': '1rem',
      },
      borderRadius: {
        'card': '1rem',
        'modal': '1.5rem',
        'button': '0.75rem',
      },
      // Comprehensive Typography Scale (Mobile-First)
      fontSize: {
        'xs': ['0.625rem', { lineHeight: '0.75rem' }],      // 10px - Labels, badges
        'sm': ['0.75rem', { lineHeight: '1rem' }],           // 12px - Small text, captions
        'base': ['0.875rem', { lineHeight: '1.25rem' }],     // 14px - Body text (default)
        'md': ['1rem', { lineHeight: '1.5rem' }],            // 16px - Large body, form labels
        'lg': ['1.125rem', { lineHeight: '1.75rem' }],       // 18px - Subtitles
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],        // 20px - Card titles
        '2xl': ['1.5rem', { lineHeight: '2rem' }],           // 24px - Section titles
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],      // 30px - Page titles
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],        // 36px - Hero titles
        // Legacy support
        'page-title': ['1.875rem', { lineHeight: '1.2', fontWeight: '700' }],
        'card-title': ['1.25rem', { lineHeight: '1.3', fontWeight: '700' }],
        'body': ['1rem', { lineHeight: '1.6', fontWeight: '400' }],
        'small': ['0.875rem', { lineHeight: '1.5', fontWeight: '400' }],
      },
      // Enhanced Spacing Scale
      spacing: {
        'card-padding': '1.5rem',
        'section-gap': '2rem',
        'page-padding': '1rem',        // Mobile
        'page-padding-md': '1.5rem',   // Tablet
        'page-padding-lg': '2rem',     // Desktop
        'card-gap': '1rem',
      },
      colors: {
        border: "#e2e8f0",
        input: "#e2e8f0",
        ring: "#0f172a",
        background: "#f8fafc",
        foreground: "#0f172a",
        primary: {
          DEFAULT: "#0f172a",
          foreground: "#ffffff",
        },
        secondary: {
          DEFAULT: "#10b981",
          foreground: "#ffffff",
        },
        destructive: {
          DEFAULT: "#ef4444",
          foreground: "#ffffff",
        },
        muted: {
          DEFAULT: "#f1f5f9",
          foreground: "#64748b",
        },
        accent: {
          DEFAULT: "#f59e0b",
          foreground: "#ffffff",
        },
        card: {
          DEFAULT: "#ffffff",
          foreground: "#0f172a",
        },
        success: {
          DEFAULT: "#10b981",
          foreground: "#ffffff",
        },
        warning: {
          DEFAULT: "#f59e0b",
          foreground: "#ffffff",
        },
      },
      borderRadius: {
        "3xl": "1.5rem",
        "2xl": "1rem",
        xl: "0.75rem",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        premium: "0 20px 25px -5px rgb(0 0 0 / 0.05), 0 8px 10px -6px rgb(0 0 0 / 0.05)",
        soft: "0 4px 6px -1px rgb(0 0 0 / 0.02), 0 2px 4px -2px rgb(0 0 0 / 0.02)",
        'glow-indigo': "0 0 20px rgb(99 102 241 / 0.3)",
        'glow-emerald': "0 0 20px rgb(16 185 129 / 0.3)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.95)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.4s ease-out",
        "scale-in": "scale-in 0.3s ease-out",
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config;
