import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // autoUpdate: service worker versi baru langsung dipakai di kunjungan
      // berikutnya tanpa perlu user hapus cache manual (belajar dari kejadian
      // env variable yang butuh "deploy without cache" sebelumnya — jangan
      // sampai PWA ini malah bikin user stuck di versi lama).
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico'],
      manifest: {
        name: 'Aktivitas Harian - Manajemen Titipan Lapak',
        short_name: 'Aktivitas Harian',
        description: 'Pencatatan titipan, penjualan, retur, dan pembayaran produsen harian.',
        theme_color: '#2563eb',
        background_color: '#f4f5f7',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache hanya file build statis (JS/CSS/HTML/gambar).
        // Panggilan ke Firestore/Auth TIDAK lewat service worker ini
        // (Firestore SDK pakai WebChannel, bukan fetch() biasa), jadi data
        // selalu live — service worker ini murni mempercepat load shell app,
        // BUKAN membuat transaksi bisa disimpan saat offline.
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
      },
    }),
  ],
  build: {
    outDir: 'dist',
  },
})
