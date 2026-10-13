/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#17211b',
        forest: '#244b36',
        sage: '#8da898',
        sand: '#f3efe7',
        cream: '#f8f7f3',
        copper: '#b46f45',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Cormorant Garamond', 'Georgia', 'serif'],
      },
      boxShadow: {
        soft: '0 18px 50px rgba(23, 33, 27, 0.08)',
      },
    },
  },
  plugins: [],
};
