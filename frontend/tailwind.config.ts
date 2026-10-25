import type { Config } from 'tailwindcss'
import plugin from 'tailwindcss/plugin'

const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['variant', ['&:is(.dark *)', '&:is([data-theme="dark"] *)']],
  theme: {
    extend: {
      colors: {
        bg: token('bg'),
        surface: { DEFAULT: token('surface'), 2: token('surface-2') },
        border: token('border'),
        fg: token('fg'),
        muted: token('muted'),
        brand: {
          DEFAULT: token('brand'),
          soft: token('brand-soft'),
          fg: token('brand-fg'),
          // text and icons in the brand colour: deep mint on light, mint itself on graphite
          ink: token('brand-ink'),
        },
        success: token('success'),
        warning: token('warning'),
        danger: token('danger'),
        info: token('info'),
        accent: 'var(--accent)',
      },
      borderColor: {
        DEFAULT: token('border'),
      },
      fontFamily: {
        sans: ['IBM Plex Sans Arabic', 'Segoe UI', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Readex Pro', 'IBM Plex Sans Arabic', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'Cascadia Mono', 'Consolas', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        '2xs': ['12px', '16px'],
        '13': ['13px', '20px'],
      },
      borderRadius: {
        sm: '6px',
        DEFAULT: '6px',
        md: '8px',
        lg: '10px',
        xl: '14px',
        '2xl': '20px',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        DEFAULT: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        xl: 'var(--shadow-lg)',
        '2xl': 'var(--shadow-lg)',
        '3d-sm': 'var(--shadow-sm)',
        '3d': 'var(--shadow-md)',
        '3d-lg': 'var(--shadow-lg)',
        'glow-accent': 'var(--shadow-md)',
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.2, 0, 0, 1)',
      },
      transitionDuration: {
        spring: '200ms',
      },
      animation: {
        'float-up': 'page-in 0.25s ease-out both',
        'neon-pulse': 'none',
        shimmer: 'shimmer 1.6s linear infinite',
        'glow-pulse': 'none',
        'shake-x': 'none',
        'scan-line': 'scan-line 1.2s ease-in-out infinite',
        'float-drift': 'none',
        'float-bob': 'none',
        orbit: 'none',
        'spin-slow': 'none',
        'counter-spin': 'none',
        morph: 'none',
        'particle-rise': 'none',
        'entrance-slide': 'page-in 0.3s ease-out both',
        breathe: 'none',
        'live-ping': 'live-ping 2s cubic-bezier(0, 0, 0.2, 1) infinite',
      },
    },
  },
  plugins: [
    plugin(({ addUtilities, matchUtilities }) => {
      addUtilities({
        '.transform-style-3d': { 'transform-style': 'preserve-3d' },
        '.transform-style-flat': { 'transform-style': 'flat' },
        '.backdrop-blur-glass': {
          'backdrop-filter': 'blur(12px)',
          '-webkit-backdrop-filter': 'blur(12px)',
        },
        '.glow-accent': { 'box-shadow': 'var(--shadow-md)' },
      })
      matchUtilities(
        { perspective: (value: string) => ({ perspective: value }) },
        {
          values: {
            none: 'none',
            '600': '600px',
            '1000': '1000px',
            '1200': '1200px',
            '2000': '2000px',
          },
        },
      )
    }),
  ],
} satisfies Config
