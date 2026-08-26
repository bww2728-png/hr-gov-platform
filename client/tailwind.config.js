/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Tajawal', 'Inter', 'system-ui', 'sans-serif'],
        en: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        primary: {
          50:  '#eef4ff',
          100: '#dce8ff',
          200: '#bcd3ff',
          300: '#8eb4ff',
          400: '#5a8eff',
          500: '#3a6bf0',
          600: '#2950d4',
          700: '#223fa8',
          800: '#1f3587',
          900: '#1d2f6e',
          950: '#141d44',
        },
        accent: {
          50: '#fef9ed',
          400: '#f0b73f',
          500: '#d99a26',
          600: '#b87f1a',
        },
        success: { 500: '#16a34a', 600: '#15803d' },
        warn:    { 500: '#f59e0b', 600: '#d97706' },
        danger:  { 500: '#dc2626', 600: '#b91c1c' },
        ink:     { 900: '#0f172a', 700: '#334155', 500: '#64748b', 300: '#cbd5e1', 100: '#f1f5f9', 50: '#f8fafc' },
      },
      boxShadow: {
        'card': '0 1px 3px rgba(15,23,42,0.06), 0 1px 2px rgba(15,23,42,0.04)',
        'pop':  '0 10px 25px rgba(15,23,42,0.10), 0 4px 6px rgba(15,23,42,0.05)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.25s ease-out',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
        slideUp: {
          '0%': { opacity: 0, transform: 'translateY(8px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};