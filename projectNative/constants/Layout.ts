import { Platform } from 'react-native';

/**
 * ثوابت التخطيط والمسافات
 */

export const Layout = {
  // Spacing Scale
  spacing: {
    0:   0,
    1:   4,
    2:   8,
    3:   12,
    4:   16,
    5:   20,
    6:   24,
    7:   28,
    8:   32,
    10:  40,
    12:  48,
    16:  64,
  },

  // Border Radius
  radius: {
    sm:   6,
    md:   10,
    lg:   14,
    xl:   18,
    '2xl': 24,
    '3xl': 32,
    full: 9999,
  },

  // Shadows
  shadows: {
    sm: Platform.select({
      web: { boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 2,
      },
    }),
    md: Platform.select({
      web: { boxShadow: '0 4px 12px rgba(0,0,0,0.08)' },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 4,
      },
    }),
    lg: Platform.select({
      web: { boxShadow: '0 8px 24px rgba(0,0,0,0.12)' },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 24,
        elevation: 8,
      },
    }),
    colored: (color: string) => Platform.select({
      web: { boxShadow: `0 4px 12px ${color}4D` }, // 4D is 30% opacity
      default: {
        shadowColor: color,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 6,
      },
    }),
  },

  // Component Heights
  heights: {
    input:     52,
    button:    52,
    buttonSm:  40,
    buttonLg:  60,
    tabBar:    64,
    header:    60,
    card:      'auto',
  },

  // Max Widths (for web)
  maxWidths: {
    sm:  480,
    md:  768,
    lg:  1024,
    xl:  1280,
  },
};
