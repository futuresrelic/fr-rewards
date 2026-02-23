/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          900: '#050810',
          800: '#0a0e1a',
          700: '#0f1526',
          600: '#151c32',
          500: '#1d2540',
        },
        brand: {
          purple: '#7c3aed',
          violet: '#8b5cf6',
          cyan: '#06b6d4',
          blue: '#3b82f6',
          pink: '#ec4899',
        },
      },
      backgroundImage: {
        'gradient-brand': 'linear-gradient(135deg, #7c3aed 0%, #06b6d4 100%)',
        'gradient-card': 'linear-gradient(180deg, rgba(124,58,237,0.15) 0%, rgba(6,182,212,0.05) 100%)',
      },
      animation: {
        'shimmer': 'shimmer 1.5s infinite',
        'float': 'float 3s ease-in-out infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
      },
    },
  },
  plugins: [],
};
