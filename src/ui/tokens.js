/**
 * @file tokens.js
 * @description Master single source of truth for NeuroArena Design Tokens.
 * Defines void colors, mathematical alert indicators, and 6 biome palettes.
 */

export const DESIGN_TOKENS = Object.freeze({
  colors: {
    void: {
      deep: '#05080E',
      surface: '#0B111B',
      elevated: '#111A29',
      border: 'rgba(0, 245, 155, 0.25)',
      borderDim: 'rgba(255, 255, 255, 0.08)'
    },
    alerts: {
      critical: '#FF2A55', // Loss explosion / hazard / error
      converged: '#00F59B', // Global minimum / success / verified
      warning: '#FFB800'    // Covariate shift / high learning rate / caution
    },
    biomes: {
      steppes: {
        name: 'Linear Steppes',
        primary: '#F59E0B',
        secondary: '#D97706',
        accent: '#FDE68A',
        glow: 'rgba(245, 158, 11, 0.45)'
      },
      marshlands: {
        name: 'Binary Marshlands',
        primary: '#10B981',
        secondary: '#06B6D4',
        accent: '#6EE7B7',
        glow: 'rgba(16, 185, 129, 0.45)'
      },
      tundra: {
        name: 'Variance Tundra',
        primary: '#38BDF8',
        secondary: '#6366F1',
        accent: '#BAE6FD',
        glow: 'rgba(56, 189, 248, 0.45)'
      },
      canopy: {
        name: 'Branching Canopy',
        primary: '#84CC16',
        secondary: '#EAB308',
        accent: '#BEF264',
        glow: 'rgba(132, 204, 22, 0.45)'
      },
      citadel: {
        name: 'Deep Synapse Citadel',
        primary: '#A855F7',
        secondary: '#EC4899',
        accent: '#E9D5FF',
        glow: 'rgba(168, 85, 247, 0.45)'
      },
      expanse: {
        name: 'Semantic Expanse',
        primary: '#14B8A6',
        secondary: '#F43F5E',
        accent: '#99F6E4',
        glow: 'rgba(20, 184, 166, 0.45)'
      }
    }
  },
  typography: {
    fontDisplay: '"Orbitron", "Space Grotesk", sans-serif',
    fontMono: '"JetBrains Mono", "Fira Code", monospace',
    fontSize: {
      xs: '11px',
      sm: '13px',
      base: '15px',
      lg: '18px',
      xl: '24px',
      title: '36px',
      hero: '54px'
    }
  },
  geometry: {
    chamferAngle: '45deg',
    chamferSizeSmall: '8px',
    chamferSizeMedium: '14px',
    chamferSizeLarge: '22px',
    clipPathMedium: 'polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px)',
    clipPathCard: 'polygon(18px 0, 100% 0, 100% calc(100% - 18px), calc(100% - 18px) 100%, 0 100%, 0 18px)'
  },
  motion: {
    durationFast: '120ms',
    durationNormal: '240ms',
    durationSlow: '400ms',
    easingSharp: 'cubic-bezier(0.16, 1.0, 0.3, 1.0)'
  }
});
