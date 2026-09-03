import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useLapak } from '../context/LapakContext'
import {
  listProductsByProducer, createConsignmentProposal, findConsignment,
  getConsignmentItems, listConsignmentsForProducer,
} from '../lib/domain'
import { todayStr, formatRupiah, formatDateDisplay } from '../lib/dateUtils'

export default function TitipanSaya() {
  const { firebaseUser, profile } = useAuth()
  const { selectedLapakId, selectedLapak, availableLapak } = useLapak()

  const [products, setProducts] = useState([])
  const [rows, setRows] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [success, setSuccess] = useState('')

  const [todayConsignment, setTodayConsignment] = useState(null)
  const [todayItems, setTodayItems] = useState([])
  const [history, setHistory] = useState([])
  const [loadError, setLoadError] = useState('')

  const producerId = profile?.producerId

  useEffect(() => {
    if (producerId) {
      setLoadError('')
      listProductsByProducer(producerId)
        .then(setProducts)
        .catch(err => {
          console.error('Gagal memuat produk:', err)
          setLoadError(`Gagal memuat katalog produk: ${err.message}`)
        })
      listConsignmentsForProducer(producerId)
        .then(setHistory)
        .catch(err => {
          console.error('Gagal memuat riwayat:', err)
          setLoadError(prev => prev || `Gagal memuat riwayat titipan: ${err.message}`)
        })
    }
  }, [producerId])

  useEffect(() => {
    if (producerId && selectedLapakId) checkToday()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [producerId, selectedLapakId])

  async function checkToday() {
    const existing = await findConsignment(producerId, selectedLapakId, todayStr())
    setTodayConsignment(existing)
    setTodayItems(existing ? await getConsignmentItems(existing.id) : [])
  }

  function addRow() {
    setRows([...rows, { productId: '', qtyTitipan: '', costPrice: '', sellPrice: '' }])
  }

  function updateRow(idx, field, value) {
    const next = [...rows]
    next[idx][field] = value
    if (field === 'productId') {
      const p = products.find(pr => pr.id === value)
      if (p) {
        next[idx].costPrice = p.defaultCostPrice
        next[idx].sellPrice = p.defaultSellPrice
      }
    }
    setRows(next)
  }

  function removeRow(idx) {
    setRows(rows.filter((_, i) => i !== idx))
  }

  async function handleSubmit() {
    setError(''); setSuccess('')
    if (!rows.length) { setError('Tambahkan minimal 1 produk.'); return }
    for (const r of rows) {
      if (!r.productId || !r.qtyTitipan) { setError('Lengkapi semua baris (produk & qty wajib diisi).'); return }
    }
    setBusy(true)
    try {
      const itemsPayload = rows.map(r => {
        const p = products.find(pr => pr.id === r.productId)
        return {
          productId: r.productId, productName: p?.name || '',
          qtyTitipan: r.qtyTitipan, costPrice: r.costPrice, sellPrice: r.sellPrice,
        }
      })
      await createConsignmentProposal({
        producerId, producerName: profile?.name,
        lapakId: selectedLapakId, lapakName: selectedLapak?.name,
        date: todayStr(), items: itemsPayload, createdBy: firebaseUser.uid,
      })
      setSuccess('Titipan berhasil diajukan. Menunggu konfirmasi dari staf lapak sebelum bisa dijual.')
      setRows([])
      await checkToday()
      setHistory(await listConsignmentsForProducer(producerId))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const statusLabel = {
    pending: 'Menunggu Konfirmasi',
    active: 'Dikonfirmasi (Aktif Dijual)',
    closed: 'Ditutup (Hari Sudah Selesai)',
    settled: 'Sudah Dibayar',
    void: 'Ditolak',
  }

  return (
    <div>
      <div className="page-title">Titipan Saya</div>
      <div className="page-subtitle">Ajukan titipan produk Anda dan pantau statusnya di {selectedLapak?.name || '-'}.</div>

      {loadError && (
        <div style={{ background: '#fee2e2', color: '#991b1b', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
          <strong>Error:</strong> {loadError}
        </div>
      )}

      {availableLapak.length === 0 && (
        <div className="card" style={{ color: '#d97706' }}>
          Akun Anda belum terhubung ke lapak manapun. Hubungi admin lapak untuk mengatur akses ini.
        </div>
      )}

      {availableLapak.length > 0 && (
        <>
          {todayConsignment ? (
            <div className="card">
              <div className="toolbar">
                <strong>Titipan Hari Ini</strong>
                <span className={`badge ${todayConsignment.status}`}>{statusLabel[todayConsignment.status] || todayConsignment.status}</span>
              </div>
              {todayConsignment.status === 'pending' && (
                <p className="help-text" style={{ marginTop: -4 }}>
                  Titipan ini sudah diajukan dan sedang menunggu dicek & dikonfirmasi oleh staf lapak.
                  Produk belum bisa dijual sampai dikonfirmasi.
                </p>
              )}
              {todayConsignment.status === 'void' && todayConsignment.rejectionReason && (
                <p className="error-text">Ditolak dengan alasan: {todayConsignment.rejectionReason}</p>
              )}
              <table>
                <thead><tr><th>Produk</th><th>Qty Titipan</th><th>Terjual</th><th>Retur</th><th>Harga Titipan</th><th>Harga Jual</th></tr></thead>
                <tbody>
                  {todayItems.map(it => (
                    <tr key={it.id}>
                      <td>{it.productName}</td><td>{it.qtyTitipan}</td><td>{it.qtySold}</td><td>{it.qtyReturned}</td>
                      <td>{formatRupiah(it.costPrice)}</td><td>{formatRupiah(it.sellPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {todayConsignment.status === 'pending' && (
                <p className="help-text">
                  Titipan sudah diajukan untuk hari ini. Kalau ada tambahan produk, hubungi staf lapak langsung
                  (belum bisa tambah item sendiri selama masih menunggu konfirmasi).
                </p>
              )}
            </div>
          ) : (
            <div className="card">
              <strong>Ajukan Titipan Hari Ini</strong>
              {rows.map((row, idx) => (
                <div className="item-row" key={idx}>
                  <select value={row.productId} onChange={e => updateRow(idx, 'productId', e.target.value)}>
                    <option value="">-- produk --</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <input type="number" placeholder="Qty" value={row.qtyTitipan} onChange={e => updateRow(idx, 'qtyTitipan', e.target.value)} />
                  <input type="number" placeholder="Harga Titipan" value={row.costPrice} onChange={e => updateRow(idx, 'costPrice', e.target.value)} />
                  <input type="number" placeholder="Harga Jual" value={row.sellPrice} onChange={e => updateRow(idx, 'sellPrice', e.target.value)} />
                  <button className="danger" type="button" onClick={() => removeRow(idx)}>Hapus</button>
                </div>
              ))}
              <button type="button" className="secondary" onClick={addRow}>+ Tambah Produk</button>
              {error && <div className="error-text" style={{ marginTop: 12 }}>{error}</div>}
              {success && <div style={{ color: '#16a34a', fontSize: 13, marginTop: 12 }}>{success}</div>}
              <div style={{ marginTop: 12 }}>
                <button onClick={handleSubmit} disabled={busy || !rows.length}>
                  {busy ? 'Mengirim...' : 'Ajukan Titipan'}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <div className="card">
        <strong>Riwayat Titipan Saya (Semua Lapak)</strong>
        <table style={{ marginTop: 8 }}>
          <thead><tr><th>Tanggal</th><th>Lapak</th><th>Status</th><th>Status Bayar</th></tr></thead>
          <tbody>
            {history.map(c => (
              <tr key={c.id}>
                <td>{formatDateDisplay(c.date)}</td>
                <td>{c.lapakName}</td>
                <td><span className={`badge ${c.status}`}>{statusLabel[c.status] || c.status}</span></td>
                <td><span className={`badge ${c.paymentStatus}`}>{c.paymentStatus}</span></td>
              </tr>
            ))}
            {history.length === 0 && <tr><td colSpan={4} style={{ color: '#9ca3af' }}>Belum ada riwayat titipan.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
