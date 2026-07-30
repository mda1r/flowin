import type { Config } from 'tailwindcss'
import plugin from 'tailwindcss/plugin'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#f0fdf9',
          100: '#ccfbef',
          200: '#99f6e0',
          300: '#5eead4',
          400: '#62E6C7',
          500: '#2dd4bf',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
          950: '#042f2e',
        },
        graphite: '#23262D',
        'soft-white': '#F7F7F5',
        mint: '#62E6C7',
      },
      fontFamily: {
        sans: ['Urbanist', 'Segoe UI', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['Cascadia Mono', 'Consolas', 'ui-monospace', 'monospace'],
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      transitionDuration: {
        spring: '250ms',
      },
      boxShadow: {
        '3d-sm':
          '0 1px 0 rgba(255,255,255,0.06) inset, 0 0 0 1px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.22)',
        '3d':
          '0 1px 0 rgba(255,255,255,0.06) inset, 0 0 0 1px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.28), 0 16px 48px rgba(0,0,0,0.18)',
        '3d-lg':
          '0 1px 0 rgba(255,255,255,0.08) inset, 0 0 0 1px rgba(0,0,0,0.14), 0 8px 24px rgba(0,0,0,0.32), 0 32px 80px rgba(0,0,0,0.26)',
        'glow-accent': '0 0 24px var(--glow), 0 8px 32px rgba(0,0,0,0.25)',
      },
      animation: {
        'float-up': 'float-up 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both',
        'neon-pulse': 'neon-pulse 1.6s ease-in-out infinite',
        shimmer: 'shimmer 1.8s linear infinite',
        'glow-pulse': 'glow-pulse 2.4s ease-in-out infinite',
        'shake-x': 'shake-x 0.7s ease-in-out infinite',
        'scan-line': 'scan-line 1.2s ease-in-out infinite',
        'float-drift': 'float-drift 14s ease-in-out infinite',
        'float-bob': 'float-bob 13s ease-in-out infinite',
        orbit: 'orbit 10s linear infinite',
        'spin-slow': 'spin-slow 16s linear infinite',
        'counter-spin': 'counter-spin 22s linear infinite',
        morph: 'morph 18s ease-in-out infinite',
        'particle-rise': 'particle-rise 12s linear infinite',
        'entrance-slide': 'entrance-slide 0.55s cubic-bezier(0.22, 1.2, 0.36, 1) both',
        breathe: 'breathe 3.8s ease-in-out infinite',
        'live-ping': 'live-ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite',
      },
    },
  },
  plugins: [
    plugin(({ addUtilities, matchUtilities }) => {
      addUtilities({
        '.transform-style-3d': { 'transform-style': 'preserve-3d' },
        '.transform-style-flat': { 'transform-style': 'flat' },
        '.backdrop-blur-glass': {
          'backdrop-filter': 'blur(20px) saturate(180%)',
          '-webkit-backdrop-filter': 'blur(20px) saturate(180%)',
        },
        '.glow-accent': { 'box-shadow': '0 0 24px var(--glow)' },
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
