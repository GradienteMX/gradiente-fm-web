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
        base: '#000000',
        surface: '#080808',
        elevated: '#111111',
        hover: '#181818',
        border: '#242424',
        'border-subtle': '#161616',
        primary: '#F0F0F0',
        secondary: '#888888',
        muted: '#444444',
        // NGE system colors
        'sys-red': '#E63329',
        'sys-orange': '#F97316',
        'sys-amber': '#F59E0B',
        'sys-green': '#4ADE80',
        // Vibe colors (cold → hot)
        'vibe-ice': '#7DD3FC',
        'vibe-cold': '#38BDF8',
        'vibe-cool': '#818CF8',
        'vibe-neutral': '#A78BFA',
        'vibe-warm': '#E879F9',
        'vibe-hot': '#FB923C',
        'vibe-fire': '#F87171',
        'vibe-volcano': '#B91C1C',
      },
      backgroundImage: {
        'vibe-gradient':
          'linear-gradient(to right, #7DD3FC 0%, #38BDF8 12%, #818CF8 28%, #A78BFA 42%, #E879F9 55%, #FB923C 70%, #F87171 83%, #B91C1C 100%)',
        'hazard-stripes':
          'repeating-linear-gradient(-45deg, #F97316 0px, #F97316 4px, #000 4px, #000 12px)',
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
