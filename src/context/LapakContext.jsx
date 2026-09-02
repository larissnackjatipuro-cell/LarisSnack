import { createContext, useContext, useEffect, useState } from 'react'
import { useAuth } from './AuthContext'
import { listLapak } from '../lib/domain'

const LapakContext = createContext(null)

export function LapakProvider({ children }) {
  const { profile } = useAuth()
  const [allLapak, setAllLapak] = useState([])
  const [availableLapak, setAvailableLapak] = useState([])
  const [selectedLapakId, setSelectedLapakId] = useState(() => localStorage.getItem('selectedLapakId') || '')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      setError('')
      try {
        const lapakList = await listLapak()
        setAllLapak(lapakList)

        // Admin dgn lapakIds kosong/berisi 'ALL' dianggap punya akses ke semua lapak.
        // Kasir hanya melihat lapak yang eksplisit ada di profile.lapakIds.
        const isGlobalAdmin = profile?.role === 'admin' &&
          (!profile.lapakIds || profile.lapakIds.length === 0 || profile.lapakIds.includes('ALL'))

        const filtered = isGlobalAdmin
          ? lapakList
          : lapakList.filter(l => (profile?.lapakIds || []).includes(l.id))

        setAvailableLapak(filtered)

        setSelectedLapakId(prev => {
          if (prev && filtered.some(l => l.id === prev)) return prev
          return filtered[0]?.id || ''
        })
      } catch (err) {
        // Ditampilkan langsung di UI (lihat Layout.jsx) — supaya kegagalan
        // ambil data lapak tidak lagi "diam-diam" tanpa jejak yang kelihatan
        // di HP tanpa perlu buka DevTools.
        console.error('Gagal memuat data lapak:', err)
        setError(err.message || 'Gagal memuat data lapak.')
      } finally {
        setLoading(false)
      }
    }
    if (profile) load()
  }, [profile])

  useEffect(() => {
    if (selectedLapakId) localStorage.setItem('selectedLapakId', selectedLapakId)
  }, [selectedLapakId])

  const selectedLapak = availableLapak.find(l => l.id === selectedLapakId) || null

  return (
    <LapakContext.Provider value={{ allLapak, availableLapak, selectedLapakId, setSelectedLapakId, selectedLapak, loading, error }}>
      {children}
    </LapakContext.Provider>
  )
}

export function useLapak() {
  return useContext(LapakContext)
}
