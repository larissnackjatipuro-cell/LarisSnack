import React from 'react'
import ReactDOM from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App.jsx'

// Daftarkan service worker (dari vite-plugin-pwa). onNeedRefresh/onOfflineReady
// dibiarkan diam-diam (autoUpdate) — kalau nanti mau kasih notifikasi
// "Ada versi baru, refresh?" ke user, tinggal isi callback di bawah ini.
registerSW({ immediate: true })

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
