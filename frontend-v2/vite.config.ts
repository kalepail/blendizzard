import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { cloudflare } from '@cloudflare/vite-plugin'
import path from 'path'

export default defineConfig({
  plugins: [react(), cloudflare()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  define: {
    global: 'globalThis',
  },
  ssr: {
    // Force Vite to bundle stellar-sdk (resolves subpath export issues like /contract, /rpc)
    noExternal: ['@stellar/stellar-sdk', 'blendizzard', 'fee-vault'],
  },
  optimizeDeps: {
    include: ['@stellar/stellar-sdk', 'buffer'],
  },
})
