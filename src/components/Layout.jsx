import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLapak } from '../context/LapakContext'

const staffNavItems = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/titipan', label: 'Titipan Harian' },
  { to: '/pos', label: 'Transaksi Penjualan' },
  { to: '/tutup-hari', label: 'Tutup Hari & Retur' },
  { to: '/pembayaran', label: 'Pembayaran Produsen' },
  { to: '/pesanan-terjadwal', label: 'Pesanan Terjadwal' },
  { to: '/laporan', label: 'Laporan' },
  { to: '/master-data', label: 'Master Data' },
]

const producerNavItems = [
  { to: '/titipan-saya', label: 'Titipan Saya', end: true },
]

export default function Layout({ children }) {
  const { profile, logout } = useAuth()
  const { availableLapak, selectedLapakId, setSelectedLapakId, error: lapakError } = useLapak()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <div className="app-shell">
      {/* Top bar hanya tampil di layar sempit (smartphone) — lihat index.css */}
      <div className="mobile-topbar">
        <button
          className="hamburger-btn"
          aria-label="Buka menu"
          onClick={() => setMenuOpen(true)}
        >
          <span /><span /><span />
        </button>
        <span className="mobile-topbar-title">Aktivitas Harian</span>
      </div>

      {/* Overlay gelap di belakang sidebar saat menu mobile terbuka */}
      {menuOpen && <div className="sidebar-overlay" onClick={() => setMenuOpen(false)} />}

      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h1>Aktivitas Harian</h1>
          <button className="sidebar-close-btn" onClick={() => setMenuOpen(false)} aria-label="Tutup menu">✕</button>
        </div>
        <nav onClick={() => setMenuOpen(false)}>
          {(profile?.role === 'produsen' ? producerNavItems : staffNavItems).map(item => (
            <NavLink key={item.to} to={item.to} end={item.end}>
              {item.label}
            </NavLink>
          ))}
          <button onClick={handleLogout}>Keluar</button>
        </nav>
      </aside>
      <main className="main">
        {lapakError && (
          <div style={{ background: '#fee2e2', color: '#991b1b', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
            <strong>Gagal memuat data lapak:</strong> {lapakError}
          </div>
        )}
        <div className="toolbar">
          <div style={{ fontSize: 13, color: '#6b7280' }}>
            Masuk sebagai <strong>{profile?.name}</strong> ({profile?.role})
          </div>
          {availableLapak.length > 0 ? (
            <div className="lapak-picker">
              <label style={{ marginBottom: 0, display: 'inline', marginRight: 8 }}>Lapak:</label>
              <select
                value={selectedLapakId}
                onChange={e => setSelectedLapakId(e.target.value)}
              >
                {availableLapak.map(l => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
          ) : !lapakError && (
            <div style={{ fontSize: 12, color: '#d97706' }}>
              Tidak ada lapak yang bisa diakses akun ini (cek role &amp; lapakIds di Firestore).
            </div>
          )}
        </div>
        {children}
      </main>
    </div>
  )
}
