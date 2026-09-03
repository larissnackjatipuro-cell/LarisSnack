import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useLapak } from '../context/LapakContext'
import { listUnpaidConsignments, markConsignmentPaid } from '../lib/domain'
import { formatRupiah, formatDateDisplay } from '../lib/dateUtils'

export default function Pembayaran() {
  const { firebaseUser } = useAuth()
  const { selectedLapakId, selectedLapak, availableLapak } = useLapak()
  const [mode, setMode] = useState('single')
  const [unpaid, setUnpaid] = useState([])
  const [busy, setBusy] = useState({})
  const [error, setError] = useState('')

  useEffect(() => {
    if (mode === 'single' && selectedLapakId) load()
    if (mode === 'gabungan' && availableLapak.length > 0) loadGabungan()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLapakId, mode, availableLapak])

  async function load() {
    setUnpaid(await listUnpaidConsignments(selectedLapakId))
  }

  async function loadGabungan() {
    const all = []
    for (const l of availableLapak) {
      const list = await listUnpaidConsignments(l.id)
      all.push(...list)
    }
    setUnpaid(all)
  }

  function refresh() {
    return mode === 'gabungan' ? loadGabungan() : load()
  }

  async function handleMarkPaid(id) {
    setError('')
    setBusy(prev => ({ ...prev, [id]: true }))
    try {
      await markConsignmentPaid(id, firebaseUser.uid)
      await refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(prev => ({ ...prev, [id]: false }))
    }
  }

  const grandTotal = unpaid.reduce((s, c) => s + c.totalAmount, 0)

  return (
    <div>
      <div className="page-title">Pembayaran Produsen</div>
      <div className="page-subtitle">
        {mode === 'single'
          ? `Daftar titipan yang sudah ditutup (closed) di ${selectedLapak?.name} dan belum dibayar.`
          : `Daftar titipan yang sudah ditutup dan belum dibayar di semua lapak (${availableLapak.length} lapak).`}
        {' '}Total di bawah dihitung dari qty terjual × harga titipan (bukan harga jual).
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

      <div className="stat-grid" style={{ gridTemplateColumns: '1fr' }}>
        <div className="stat-card">
          <div className="label">Total Kewajiban Belum Dibayar {mode === 'gabungan' ? '(Semua Lapak)' : ''}</div>
          <div className="value">{formatRupiah(grandTotal)}</div>
        </div>
      </div>

      {unpaid.map(c => (
        <div className="card" key={c.id}>
          <div className="toolbar">
            <div>
              <strong>{c.producerName}</strong>
              {mode === 'gabungan' && <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 8 }}>({c.lapakName})</span>}
              <div style={{ fontSize: 12, color: '#6b7280' }}>{formatDateDisplay(c.date)}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{formatRupiah(c.totalAmount)}</div>
              <button onClick={() => handleMarkPaid(c.id)} disabled={busy[c.id]}>
                {busy[c.id] ? 'Memproses...' : 'Tandai Lunas'}
              </button>
            </div>
          </div>
          <table>
            <thead><tr><th>Produk</th><th>Qty Terjual</th><th>Harga Titipan</th><th>Subtotal</th></tr></thead>
            <tbody>
              {c.items.filter(it => it.qtySold > 0).map(it => (
                <tr key={it.id}>
                  <td>{it.productName}</td>
                  <td>{it.qtySold}</td>
                  <td>{formatRupiah(it.costPrice)}</td>
                  <td>{formatRupiah(it.qtySold * it.costPrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {unpaid.length === 0 && (
        <div className="card" style={{ color: '#9ca3af' }}>Tidak ada tagihan yang belum dibayar.</div>
      )}
    </div>
  )
}
