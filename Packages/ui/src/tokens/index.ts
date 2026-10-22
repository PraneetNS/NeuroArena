/**
 * NeuroArena Design Tokens: A Scholarly Explorer's Instrument
 * Single source of truth in code, defining colors, typography, spacing,
 * elevation, radii, motion, and z-index layers.
 */

export const typography = {
  fonts: {
    display: "'Fraunces', Georgia, serif",
    ui: "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    mono: "'IBM Plex Mono', 'SFMono-Regular', Menlo, Monaco, Consolas, monospace"
  },
  scale: {
    xs: { size: '0.75rem', lineHeight: '1.33', weight: '400' }, // 12px
    sm: { size: '0.8125rem', lineHeight: '1.38', weight: '400' }, // 13px
    base: { size: '0.9375rem', lineHeight: '1.5', weight: '400' }, // 15px
    md: { size: '1.0625rem', lineHeight: '1.47', weight: '500' }, // 17px
    lg: { size: '1.25rem', lineHeight: '1.4', weight: '600' }, // 20px
    xl: { size: '1.5rem', lineHeight: '1.33', weight: '600' }, // 24px
    '2xl': { size: '1.875rem', lineHeight: '1.27', weight: '600' }, // 30px
    '3xl': { size: '2.375rem', lineHeight: '1.21', weight: '700' }, // 38px
    '4xl': { size: '3rem', lineHeight: '1.17', weight: '700' } // 48px
  }
};

export const paletteDark = {
  // Foundational surfaces
  ink: '#0E1116',
  surface: '#151A21',
  raised: '#1D242D',
  overlay: 'rgba(14, 17, 22, 0.82)',
  line: '#2A333F',
  lineStrong: '#3A4657',

  // Typography
  text: '#E8E4DA',
  textSecondary: '#C5C1B6',
  muted: '#9AA3AE',
  faint: '#656E7B',

  // Accent & Semantics
  accent: '#E8A33D', // Lantern amber
  accentHover: '#F5B453',
  accentMuted: 'rgba(232, 163, 61, 0.15)',
  accentCool: '#4FB3A9', // Signal teal
  accentCoolHover: '#62C5BB',
  accentCoolMuted: 'rgba(79, 179, 169, 0.15)',

  success: '#6BBF7A',
  successMuted: 'rgba(107, 191, 122, 0.15)',
  warning: '#E0B04A',
  warningMuted: 'rgba(224, 176, 74, 0.15)',
  danger: '#D9564A',
  dangerMuted: 'rgba(217, 86, 74, 0.15)',

  // Data Quality token set
  quality: {
    clean: '#6BBF7A',
    noisy: '#E0B04A',
    duplicate: '#8E9AAF',
    contaminated: '#D9564A',
    unknown: '#6B7785'
  }
};

export const paletteLight = {
  // Foundational surfaces (warm archival parchment)
  ink: '#F6F4EE',
  surface: '#ECE8DD',
  raised: '#FFFFFF',
  overlay: 'rgba(246, 244, 238, 0.85)',
  line: '#D5CEC0',
  lineStrong: '#BDB4A4',

  // Typography
  text: '#1A1F26',
  textSecondary: '#363E4A',
  muted: '#5F6876',
  faint: '#8E97A4',

  // Accent & Semantics
  accent: '#B36814',
  accentHover: '#96550C',
  accentMuted: 'rgba(179, 104, 20, 0.12)',
  accentCool: '#207F75',
  accentCoolHover: '#16675E',
  accentCoolMuted: 'rgba(32, 127, 117, 0.12)',

  success: '#2E7D3F',
  successMuted: 'rgba(46, 125, 63, 0.12)',
  warning: '#9C6F12',
  warningMuted: 'rgba(156, 111, 18, 0.12)',
  danger: '#B83428',
  dangerMuted: 'rgba(184, 52, 40, 0.12)',

  // Data Quality token set
  quality: {
    clean: '#2E7D3F',
    noisy: '#9C6F12',
    duplicate: '#586577',
    contaminated: '#B83428',
    unknown: '#788494'
  }
};

export const spacing = {
  0: '0px',
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  8: '32px',
  10: '40px',
  12: '48px',
  16: '64px'
};

export const radii = {
  none: '0px',
  sm: '2px',
  base: '4px',
  md: '6px',
  lg: '8px',
  full: '9999px'
};

export const elevation = {
  none: 'none',
  1: '0 1px 2px rgba(0, 0, 0, 0.25), 0 0 0 1px var(--na-line)',
  2: '0 3px 8px rgba(0, 0, 0, 0.35), 0 0 0 1px var(--na-line)',
  3: '0 8px 24px rgba(0, 0, 0, 0.45), 0 0 0 1px var(--na-line)'
};

export const zIndex = {
  base: 0,
  surface: 10,
  dropdown: 100,
  sticky: 200,
  modal: 500,
  popover: 600,
  toast: 700,
  tooltip: 800
};

export const motion = {
  duration: {
    instant: '0ms',
    fast: '100ms',
    base: '180ms',
    slow: '300ms'
  },
  easing: {
    standard: 'cubic-bezier(0.2, 0.0, 0, 1.0)',
    emphasized: 'cubic-bezier(0.05, 0.7, 0.1, 1.0)',
    exit: 'cubic-bezier(0.3, 0.0, 0.8, 0.15)'
  }
};
