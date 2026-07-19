import type { Config } from 'tailwindcss'
import plugin from 'tailwindcss/plugin'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
      },
      fontFamily: {
        sans: ['Segoe UI', 'Tahoma', 'system-ui', '-apple-system', 'Helvetica Neue', 'Arial', 'sans-serif'],
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
