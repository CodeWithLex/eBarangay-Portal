/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
        serif: ['"DM Serif Display"', 'serif'],
      },
      colors: {
        brand: {
          50:  '#f0faf5',
          100: '#d8f3e6',
          200: '#aee5cc',
          400: '#3db882',
          500: '#1d9e6a',
          600: '#167a52',
          700: '#105c3e',
          800: '#0a3d29',
          900: '#052014',
        },
        gold: {
          400: '#f0b429',
          500: '#d99e22',
        }
      },
      animation: {
        'fade-up': 'fadeUp 0.5s ease both',
        'fade-in': 'fadeIn 0.3s ease both',
        'slide-in': 'slideIn 0.35s ease both',
        'pulse-dot': 'pulseDot 2s ease-in-out infinite',
      },
      keyframes: {
        fadeUp: {
          from: { opacity: 0, transform: 'translateY(16px)' },
          to:   { opacity: 1, transform: 'translateY(0)' },
        },
        fadeIn: {
          from: { opacity: 0 },
          to:   { opacity: 1 },
        },
        slideIn: {
          from: { opacity: 0, transform: 'translateX(20px)' },
          to:   { opacity: 1, transform: 'translateX(0)' },
        },
        pulseDot: {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.4 },
        }
      }
    },
  },
  plugins: [],
}
