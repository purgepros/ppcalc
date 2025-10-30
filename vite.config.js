import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // I have REMOVED the entire css.postcss block to prevent conflicts.
  // Vite will now find and use postcss.config.js automatically.
})

