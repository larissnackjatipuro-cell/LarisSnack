import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useLapak } from '../context/LapakContext'
import { listUnpaidConsignments, markConsignmentPaid } from '../lib/domain'
import { formatRupiah, formatDateDisplay } from '../lib/dateUtils'

export default function Pembayaran() {
  const { firebaseUser } = useAuth()
  const { selectedLapakId, selectedLapak } = useLapak()
  const [unpaid, setUnpaid] = useState([])
  const [busy, setBusy] = useState({})
  const [error, setError] = useState('')

  useEffect(() => {
    if (selectedLapakId) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLapakId])

  async function load() {
    setUnpaid(await listUnpaidConsignments(selectedLapakId))
  }

  async function handleMarkPaid(id) {
    setError('')
    setBusy(prev => ({ ...prev, [id]: true }))
    try {
      await markConsignmentPaid(id, firebaseUser.uid)
      await load()
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
        Daftar titipan yang sudah ditutup (closed) di {selectedLapak?.name} dan belum dibayar.
        Total di bawah dihitung dari qty terjual × harga titipan (bukan harga jual).
      </div>

      {error && <div className="error-text">{error}</div>}

      <div className="stat-grid" style={{ gridTemplateColumns: '1fr' }}>
        <div className="stat-card">
          <div className="label">Total Kewajiban Belum Dibayar</div>
          <div className="value">{formatRupiah(grandTotal)}</div>
        </div>
      </div>

      {unpaid.map(c => (
        <div className="card" key={c.id}>
          <div className="toolbar">
            <div>
              <strong>{c.producerName}</strong>
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
