import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler']],
      },
    }),
    basicSsl(),
  ],
  base: process.env.NODE_ENV === 'production' ? '/vnge/' : '/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
})
