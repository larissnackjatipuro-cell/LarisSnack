import { useEffect, useState } from 'react'
import { useLapak } from '../context/LapakContext'
import { listConsignmentsForLapak, getConsignmentItems, closeConsignmentDay } from '../lib/domain'
import { todayStr } from '../lib/dateUtils'

export default function TutupHari() {
  const { selectedLapakId, selectedLapak, availableLapak } = useLapak()
  const [mode, setMode] = useState('single')
  const [activeConsignments, setActiveConsignments] = useState([])
  const [itemsByConsignment, setItemsByConsignment] = useState({})
  const [overrides, setOverrides] = useState({}) // { consignmentId: { itemId: qty } }
  const [busy, setBusy] = useState({})
  const [error, setError] = useState('')

  useEffect(() => {
    if (mode === 'single' && selectedLapakId) load()
    if (mode === 'gabungan' && availableLapak.length > 0) loadGabungan()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLapakId, mode, availableLapak])

  async function load() {
    const list = await listConsignmentsForLapak(selectedLapakId, todayStr())
    const active = list.filter(c => c.status === 'active')
    setActiveConsignments(active)
    const map = {}
    for (const c of active) {
      map[c.id] = await getConsignmentItems(c.id)
    }
    setItemsByConsignment(map)
  }

  async function loadGabungan() {
    const all = []
    for (const l of availableLapak) {
      const list = await listConsignmentsForLapak(l.id, todayStr())
      all.push(...list.filter(c => c.status === 'active'))
    }
    setActiveConsignments(all)
    const map = {}
    for (const c of all) {
      map[c.id] = await getConsignmentItems(c.id)
    }
    setItemsByConsignment(map)
  }

  function refresh() {
    return mode === 'gabungan' ? loadGabungan() : load()
  }

  function sisaStok(item) {
    return Number(item.qtyTitipan) - Number(item.qtySold) - Number(item.qtyReturned)
  }

  function handleOverride(consignmentId, itemId, value) {
    setOverrides(prev => ({
      ...prev,
      [consignmentId]: { ...(prev[consignmentId] || {}), [itemId]: value },
    }))
  }

  async function handleClose(consignmentId) {
    setError('')
    setBusy(prev => ({ ...prev, [consignmentId]: true }))
    try {
      const rawOverrides = overrides[consignmentId] || {}
      const parsed = Object.fromEntries(
        Object.entries(rawOverrides).filter(([, v]) => v !== '' && v !== undefined)
      )
      await closeConsignmentDay(consignmentId, parsed)
      await refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(prev => ({ ...prev, [consignmentId]: false }))
    }
  }

  return (
    <div>
      <div className="page-title">Tutup Hari & Retur</div>
      <div className="page-subtitle">
        {mode === 'single'
          ? `Kunci titipan hari ini di ${selectedLapak?.name}.`
          : `Kunci titipan hari ini di semua lapak (${availableLapak.length} lapak) dari satu layar.`}
        {' '}Sisa stok otomatis dihitung sebagai retur ke produsen — Anda bisa mengubah nilainya manual jika ada catatan khusus (misal rusak) sebelum menutup.
      </div>

      {availableLapak.length > 1 && (
        <div className="card">
          <label>Tampilan</label>
          <select value={mode} onChange={e => setMode(e.target.value)} style={{ width: 280 }}>
            <option value="single">Per Lapak ({selectedLapak?.name})</option>
            <option value="gabungan">Gabungan Semua Lapak ({availableLapak.length} lapak)</option>
          </select>
        </div>
      )}

      {error && <div className="error-text">{error}</div>}

      {activeConsignments.length === 0 && (
        <div className="card" style={{ color: '#9ca3af' }}>Tidak ada titipan aktif untuk ditutup hari ini.</div>
      )}

      {activeConsignments.map(c => (
        <div className="card" key={c.id}>
          <div className="toolbar">
            <div>
              <strong>{c.producerName}</strong>
              {mode === 'gabungan' && <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 8 }}>({c.lapakName})</span>}
            </div>
            <button onClick={() => handleClose(c.id)} disabled={busy[c.id]}>
              {busy[c.id] ? 'Memproses...' : 'Tutup Titipan Ini'}
            </button>
          </div>
          <table>
            <thead>
              <tr><th>Produk</th><th>Titipan</th><th>Terjual</th><th>Sisa (Otomatis Retur)</th><th>Override Retur (opsional)</th></tr>
            </thead>
            <tbody>
              {(itemsByConsignment[c.id] || []).map(item => (
                <tr key={item.id}>
                  <td>{item.productName}</td>
                  <td>{item.qtyTitipan}</td>
                  <td>{item.qtySold}</td>
                  <td>{sisaStok(item)}</td>
                  <td>
                    <input
                      type="number"
                      placeholder={String(sisaStok(item))}
                      style={{ width: 90, marginBottom: 0 }}
                      value={overrides[c.id]?.[item.id] ?? ''}
                      onChange={e => handleOverride(c.id, item.id, e.target.value)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}
