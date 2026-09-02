import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLapak } from '../context/LapakContext'

const navItems = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/titipan', label: 'Titipan Harian' },
  { to: '/pos', label: 'Transaksi Penjualan' },
  { to: '/tutup-hari', label: 'Tutup Hari & Retur' },
  { to: '/pembayaran', label: 'Pembayaran Produsen' },
  { to: '/laporan', label: 'Laporan' },
  { to: '/master-data', label: 'Master Data' },
]

export default function Layout({ children }) {
  const { profile, logout } = useAuth()
  const { availableLapak, selectedLapakId, setSelectedLapakId } = useLapak()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h1>Aktivitas Harian</h1>
        <nav>
          {navItems.map(item => (
            <NavLink key={item.to} to={item.to} end={item.end}>
              {item.label}
            </NavLink>
          ))}
          <button onClick={handleLogout}>Keluar</button>
        </nav>
      </aside>
      <main className="main">
        <div className="toolbar">
          <div style={{ fontSize: 13, color: '#6b7280' }}>
            Masuk sebagai <strong>{profile?.name}</strong> ({profile?.role})
          </div>
          {availableLapak.length > 0 && (
            <div>
              <label style={{ marginBottom: 0, display: 'inline', marginRight: 8 }}>Lapak:</label>
              <select
                style={{ width: 200, display: 'inline-block', marginBottom: 0 }}
                value={selectedLapakId}
                onChange={e => setSelectedLapakId(e.target.value)}
              >
                {availableLapak.map(l => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
        {children}
      </main>
    </div>
  )
}
