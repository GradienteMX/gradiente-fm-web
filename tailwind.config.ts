import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './context/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        syne: ['var(--font-syne)', 'sans-serif'],
        grotesk: ['var(--font-space-grotesk)', 'sans-serif'],
        mono: ['var(--font-space-mono)', 'monospace'],
      },
      colors: {
        // Deep-charcoal base (not pure black): nighttime readability per the
        // RA brutalism teardown. Grey ramp re-derived to keep the original
        // elevation deltas above the new base.
        base: '#0D0D0D',
        surface: '#141414',
        elevated: '#1B1B1B',
        hover: '#222222',
        border: '#2E2E2E',
        'border-subtle': '#202020',
        primary: '#F0F0F0',
        secondary: '#888888',
        muted: '#4A4A4A',
        // System colors
        'sys-red': '#E63329',
        'sys-orange': '#F97316',
        'sys-amber': '#F59E0B',
        'sys-green': '#4ADE80',
        // Vibe slots 0-10 — thermo-diverging instrument ramp. Single source of
        // truth is VIBE_SLOT_COLORS in lib/utils.ts; change in lockstep.
        'vibe-0': '#087487',
        'vibe-1': '#217B98',
        'vibe-2': '#48819E',
        'vibe-3': '#6586A0',
        'vibe-4': '#7A8A9D',
        'vibe-5': '#948E85',
        'vibe-6': '#C38174',
        'vibe-7': '#E17756',
        'vibe-8': '#FC6C0F',
        'vibe-9': '#FC9414',
        'vibe-10': '#FEB225',
      },
      backgroundImage: {
        // NOTE: no 'vibe-gradient' entry here — the canonical .bg-vibe-gradient
        // class lives in globals.css (single definition; the old duplicate
        // shadowed this utility).
        'hazard-stripes':
          'repeating-linear-gradient(-45deg, #F97316 0px, #F97316 4px, #0D0D0D 4px, #0D0D0D 12px)',
      },
      borderRadius: {
        DEFAULT: '0px',
        sm: '0px',
        md: '2px',
        lg: '2px',
        xl: '2px',
        '2xl': '2px',
        full: '9999px',
      },
      animation: {
        blink: 'blink 1.2s step-end infinite',
        'slide-in': 'slideIn 0.2s ease-out',
        'fade-in': 'fadeIn 0.3s ease-out',
        scanline: 'scanline 4s linear infinite',
      },
      keyframes: {
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        slideIn: {
          '0%': { opacity: '0', transform: 'translateX(-12px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        scanline: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
      },
    },
  },
  plugins: [],
}

export default config
