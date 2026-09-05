/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#1A1A1A',
          50: '#F7F7F8',
          100: '#EDEDEF',
          300: '#B8B8BE',
          500: '#6B6B75',
          700: '#3A3A42',
          900: '#1A1A1A',
        },
        paper: {
          DEFAULT: '#FFFFFF',
          dim: '#F4F4F6',
        },
        amber: {
          DEFAULT: '#F2622E',
          soft: '#FDE7DE',
        },
        correct: '#1E9E5A',
        incorrect: '#E13B3B',
        stray: '#8354D6',
      },
      fontFamily: {
        display: ['"Inter"', 'system-ui', 'sans-serif'],
        body: ['"Inter"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      borderRadius: {
        sheet: '14px',
      },
    },
  },
  plugins: [],
};
