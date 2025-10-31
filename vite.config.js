import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // This will now correctly find 'tailwind.config.js' by default
    tailwindcss(), 
  ],
})

