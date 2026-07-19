/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Manrope', 'system-ui', 'sans-serif'],
      },
      fontWeight: {
        /* Hard-cap: max allowed weight is 600 (semibold) */
        thin:       '100',
        extralight: '200',
        light:      '300',
        normal:     '400',
        medium:     '500',
        semibold:   '600',
        /* bold/extrabold/black are remapped to 600 so Tailwind
           classes like font-bold still compile but render as 600 */
        bold:       '600',
        extrabold:  '600',
        black:      '600',
      },
      fontSize: {
        /* Premium product-card scale */
        'product-sm':  ['0.8125rem', { lineHeight: '1.45', letterSpacing: '-0.01em' }], /* 13px */
        'product':     ['0.9375rem', { lineHeight: '1.45', letterSpacing: '-0.01em' }], /* 15px */
        'product-lg':  ['1.0625rem', { lineHeight: '1.45', letterSpacing: '-0.01em' }], /* 17px */
        /* Section heading scale */
        'heading-sm':  ['1.125rem',  { lineHeight: '1.3',  letterSpacing: '-0.02em' }], /* 18px */
        'heading':     ['1.375rem',  { lineHeight: '1.3',  letterSpacing: '-0.02em' }], /* 22px */
        'heading-lg':  ['1.625rem',  { lineHeight: '1.25', letterSpacing: '-0.03em' }], /* 26px */
        /* Price scale */
        'price-sm':    ['1.125rem',  { lineHeight: '1',    letterSpacing: '-0.02em' }], /* 18px */
        'price':       ['1.375rem',  { lineHeight: '1',    letterSpacing: '-0.02em' }], /* 22px */
        'price-lg':    ['1.625rem',  { lineHeight: '1',    letterSpacing: '-0.03em' }], /* 26px */
      },
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
      boxShadow: {
        gold: '0 0 20px rgba(250, 204, 21, 0.3)',
        'gold-lg': '0 0 30px rgba(234, 179, 8, 0.5)',
      },
      backgroundImage: {
        'gold-gradient': 'linear-gradient(135deg, #facc15 0%, #eab308 100%)',
        'gold-shine': 'linear-gradient(to right, #eab308 20%, #fef08a 40%, #fef08a 60%, #eab308 80%)',
      },
      letterSpacing: {
        tighter: '-0.04em',
        tight:   '-0.02em',
        snug:    '-0.01em',
        normal:  '0',
        wide:    '0.04em',
        wider:   '0.08em',
        widest:  '0.16em',
      },
    },
  },
  plugins: [],
}