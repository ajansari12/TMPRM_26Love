/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        tier: {
          5: {
            DEFAULT: '#dc2626', // red-600
            light: '#fee2e2', // red-100
          },
          4: {
            DEFAULT: '#f97316', // orange-500
            light: '#ffedd5', // orange-100
          },
          3: {
            DEFAULT: '#f59e0b', // amber-500
            light: '#fef3c7', // amber-100
          },
          2: {
            DEFAULT: '#10b981', // emerald-500
            light: '#d1fae5', // emerald-100
          },
          1: {
            DEFAULT: '#94a3b8', // slate-400
            light: '#f1f5f9', // slate-100
          },
        },
      },
    },
  },
  plugins: [],
};
