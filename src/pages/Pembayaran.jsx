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

  // Di mode gabungan, satu produsen yang supply ke >1 lapak bisa punya
  // beberapa tagihan terpisah (beda lapak/tanggal) — digabung jadi satu
  // kartu per produsen supaya totalnya langsung kelihatan, dengan opsi
  // "Tandai Semua Lunas" sekali klik, tanpa kehilangan rincian per lapak.
  async function handleMarkPaidGroup(group) {
    setError('')
    setBusy(prev => ({ ...prev, [`group-${group.producerId}`]: true }))
    try {
      for (const c of group.consignments) {
        await markConsignmentPaid(c.id, firebaseUser.uid)
      }
      await refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(prev => ({ ...prev, [`group-${group.producerId}`]: false }))
    }
  }

  function groupByProducer(list) {
    const map = {}
    list.forEach(c => {
      const key = c.producerId
      if (!map[key]) {
        map[key] = { producerId: c.producerId, producerName: c.producerName, totalAmount: 0, consignments: [] }
      }
      map[key].totalAmount += c.totalAmount
      map[key].consignments.push(c)
    })
    return Object.values(map).sort((a, b) => b.totalAmount - a.totalAmount)
  }

  const grandTotal = unpaid.reduce((s, c) => s + c.totalAmount, 0)
  const grouped = mode === 'gabungan' ? groupByProducer(unpaid) : null

  return (
    <div>
      <div className="page-title">Pembayaran Produsen</div>
      <div className="page-subtitle">
        {mode === 'single'
          ? `Daftar titipan yang sudah ditutup (closed) di ${selectedLapak?.name} dan belum dibayar.`
          : `Digabung per produsen dari semua lapak (${availableLapak.length} lapak) — satu produsen yang supply ke beberapa lapak akan tampil sebagai satu total.`}
        {' '}Total dihitung dari qty terjual × harga titipan (bukan harga jual).
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
          <div className="label">Total Kewajiban Belum Dibayar {mode === 'gabungan' ? '(Semua Lapak, per Produsen)' : ''}</div>
          <div className="value">{formatRupiah(grandTotal)}</div>
        </div>
      </div>

      {mode === 'gabungan' ? (
        <>
          {grouped.map(group => (
            <div className="card" key={group.producerId}>
              <div className="toolbar">
                <strong>{group.producerName}</strong>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{formatRupiah(group.totalAmount)}</div>
                  <button onClick={() => handleMarkPaidGroup(group)} disabled={busy[`group-${group.producerId}`]}>
                    {busy[`group-${group.producerId}`] ? 'Memproses...' : `Tandai Semua Lunas (${group.consignments.length})`}
                  </button>
                </div>
              </div>
              <table>
                <thead><tr><th>Lapak</th><th>Tanggal</th><th>Jumlah</th><th></th></tr></thead>
                <tbody>
                  {group.consignments.map(c => (
                    <tr key={c.id}>
                      <td>{c.lapakName}</td>
                      <td>{formatDateDisplay(c.date)}</td>
                      <td>{formatRupiah(c.totalAmount)}</td>
                      <td>
                        <button className="secondary" onClick={() => handleMarkPaid(c.id)} disabled={busy[c.id]}>
                          {busy[c.id] ? '...' : 'Tandai Lunas'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          {grouped.length === 0 && (
            <div className="card" style={{ color: '#9ca3af' }}>Tidak ada tagihan yang belum dibayar di lapak manapun.</div>
          )}
        </>
      ) : (
        <>
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
        </>
      )}
    </div>
  )
}
