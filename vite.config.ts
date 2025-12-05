import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler']],
      },
      // Ensure all .tsx files are processed
      include: '**/*.{jsx,tsx}',
    }),
    basicSsl(),
  ],
  base: '/vnge/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        fullscreen: resolve(__dirname, 'fullscreen.html'),
      },
    },
  },
})
