/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  // ADD THIS SAFELIST BLOCK
  safelist: [
    'bg-opacity-50', // Force this class to be included
    'bg-opacity-25', // Might as well add this one too
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}

