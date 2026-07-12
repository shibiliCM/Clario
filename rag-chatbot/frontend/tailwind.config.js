/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        mono: ['"JetBrains Mono"', 'monospace'],
        sans: ['"DM Sans"', 'sans-serif'],
        display: ['"Space Grotesk"', '"DM Sans"', 'sans-serif'],
      },
      colors: {
        gem: {
          50:  '#f0fdf9',
          100: '#ccfbef',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          900: '#064e3b',
        },
      },
    },
  },
  plugins: [],
};
