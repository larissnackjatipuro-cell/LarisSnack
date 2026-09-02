import { useEffect, useState } from 'react'
import { useLapak } from '../context/LapakContext'
import { listConsignmentsForLapak, getConsignmentItems, closeConsignmentDay } from '../lib/domain'
import { todayStr } from '../lib/dateUtils'

export default function TutupHari() {
  const { selectedLapakId, selectedLapak } = useLapak()
  const [activeConsignments, setActiveConsignments] = useState([])
  const [itemsByConsignment, setItemsByConsignment] = useState({})
  const [overrides, setOverrides] = useState({}) // { consignmentId: { itemId: qty } }
  const [busy, setBusy] = useState({})
  const [error, setError] = useState('')

  useEffect(() => {
    if (selectedLapakId) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLapakId])

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
      await load()
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
        Kunci titipan hari ini di {selectedLapak?.name}. Sisa stok otomatis dihitung sebagai retur ke produsen —
        Anda bisa mengubah nilainya manual jika ada catatan khusus (misal rusak) sebelum menutup.
      </div>

      {error && <div className="error-text">{error}</div>}

      {activeConsignments.length === 0 && (
        <div className="card" style={{ color: '#9ca3af' }}>Tidak ada titipan aktif untuk ditutup hari ini.</div>
      )}

      {activeConsignments.map(c => (
        <div className="card" key={c.id}>
          <div className="toolbar">
            <strong>{c.producerName}</strong>
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
