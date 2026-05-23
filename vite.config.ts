import { defineConfig } from 'vite'
import path from 'node:path'
import electron from 'vite-plugin-electron/simple'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    electron({
      main: {
        entry: 'electron/main.ts',
        // 🌟 AGREGAMOS ESTO: Configuración específica de Vite para el proceso Main
        vite: {
          build: {
            rollupOptions: {
              // Le decimos a Rollup que trate estos drivers como dependencias externas nativas de Node
              external: ['pg', 'mongodb'],
            },
          },
        },
      },
      preload: {
        input: path.join(__dirname, 'electron/preload.ts'),
      },
      renderer: process.env.NODE_ENV === 'test'
        ? undefined
        : {},
    }),
  ],
})