/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  // Revert to the simple array safelist
  safelist: [
    'bg-opacity-25',
    'bg-opacity-50',
    'bg-opacity-90',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}

