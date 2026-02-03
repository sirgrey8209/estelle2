/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Nord Color Palette
        // Polar Night - backgrounds
        background: {
          DEFAULT: '#2E3440', // nord0
        },
        surface: {
          DEFAULT: '#3B4252', // nord1
          hover: '#434C5E', // nord2
          active: '#4C566A', // nord3
        },

        // Snow Storm - text
        'text-primary': '#ECEFF4', // nord6
        'text-secondary': '#E5E9F0', // nord5
        'text-muted': '#D8DEE9', // nord4

        // Frost - accent
        primary: {
          DEFAULT: '#88C0D0', // nord8
          light: '#8FBCBB', // nord7
          dark: '#5E81AC', // nord10
          muted: '#81A1C1', // nord9
        },

        // Aurora - semantic
        red: {
          400: '#BF616A', // nord11
        },
        orange: {
          400: '#D08770', // nord12
          500: '#D08770',
        },
        yellow: {
          400: '#EBCB8B', // nord13
        },
        green: {
          400: '#A3BE8C', // nord14
        },
        purple: {
          400: '#B48EAD', // nord15
        },
        cyan: {
          400: '#88C0D0', // nord8
        },

        // Grayscale aliases
        gray: {
          300: '#D8DEE9', // nord4
          400: '#D8DEE9',
          500: '#4C566A', // nord3
          600: '#434C5E', // nord2
          700: '#3B4252', // nord1
        },
      },
    },
  },
  plugins: [],
};
