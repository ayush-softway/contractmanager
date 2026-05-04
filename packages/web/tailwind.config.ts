import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#2f6feb',
          dark: '#1f52c1',
        },
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};

export default config;
