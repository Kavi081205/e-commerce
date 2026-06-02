/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gold: {
          DEFAULT: '#facc15',
          secondary: '#eab308',
          dark: '#ca8a04',
          light: '#fef08a',
          muted: '#854d0e',
        },
        silver: {
          DEFAULT: '#94a3b8',
        },
        brand: {
          bg: '#030712',
          surface: '#0a0a0a',
          card: '#0f172a',
          navy: '#111827',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        gold: '0 0 20px rgba(250, 204, 21, 0.3)',
        'gold-lg': '0 0 30px rgba(234, 179, 8, 0.5)',
      },
      backgroundImage: {
        'gold-gradient': 'linear-gradient(135deg, #facc15 0%, #eab308 100%)',
        'gold-shine': 'linear-gradient(to right, #eab308 20%, #fef08a 40%, #fef08a 60%, #eab308 80%)',
      },
    },
  },
  plugins: [],
}