/**
 * نظام الخطوط والأحجام
 */

export const Typography = {
  // Font Families
  fonts: {
    regular: 'System',
    medium:  'System',
    bold:    'System',
    black:   'System',
  },

  // Font Sizes
  sizes: {
    xs:   11,
    sm:   13,
    base: 15,
    md:   16,
    lg:   18,
    xl:   20,
    '2xl': 24,
    '3xl': 28,
    '4xl': 32,
    '5xl': 40,
  },

  // Font Weights
  weights: {
    regular:  '400' as const,
    medium:   '500' as const,
    semibold: '600' as const,
    bold:     '700' as const,
    black:    '900' as const,
  },

  // Line Heights
  lineHeights: {
    tight:  1.2,
    normal: 1.5,
    relaxed: 1.75,
  },

  // Letter Spacing
  tracking: {
    tight:  -0.5,
    normal: 0,
    wide:   0.5,
    wider:  1,
    widest: 2,
  },
} as const;
