/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: { extend: { fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui'] } } },
  plugins: [],
}
