import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useLapak } from '../context/LapakContext'
import {
  listProducersForLapak, listProductsByProducer, createConsignment,
  addItemToConsignment, findConsignment, listConsignmentsForLapak, getConsignmentItems,
} from '../lib/domain'
import { todayStr, formatRupiah } from '../lib/dateUtils'

export default function Titipan() {
  const { firebaseUser } = useAuth()
  const { selectedLapakId, selectedLapak } = useLapak()

  const [producers, setProducers] = useState([])
  const [producerId, setProducerId] = useState('')
  const [products, setProducts] = useState([])
  const [rows, setRows] = useState([])
  const [existingConsignment, setExistingConsignment] = useState(null)
  const [existingItems, setExistingItems] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [todayList, setTodayList] = useState([])

  useEffect(() => {
    if (selectedLapakId) {
      listProducersForLapak(selectedLapakId).then(setProducers)
      loadTodayList()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLapakId])

  useEffect(() => {
    if (producerId) {
      listProductsByProducer(producerId).then(setProducts)
      checkExisting()
    } else {
      setProducts([])
      setExistingConsignment(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [producerId])

  async function loadTodayList() {
    const list = await listConsignmentsForLapak(selectedLapakId, todayStr())
    setTodayList(list)
  }

  async function checkExisting() {
    const existing = await findConsignment(producerId, selectedLapakId, todayStr())
    setExistingConsignment(existing)
    if (existing) {
      setExistingItems(await getConsignmentItems(existing.id))
    } else {
      setExistingItems([])
    }
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
    setError('')
    if (!rows.length) { setError('Tambahkan minimal 1 produk.'); return }
    for (const r of rows) {
      if (!r.productId || !r.qtyTitipan) { setError('Lengkapi semua baris produk (produk & qty wajib diisi).'); return }
    }
    setBusy(true)
    try {
      const producer = producers.find(p => p.id === producerId)
      const itemsPayload = rows.map(r => {
        const p = products.find(pr => pr.id === r.productId)
        return {
          productId: r.productId,
          productName: p?.name || '',
          qtyTitipan: r.qtyTitipan,
          costPrice: r.costPrice,
          sellPrice: r.sellPrice,
        }
      })

      if (existingConsignment) {
        for (const item of itemsPayload) {
          await addItemToConsignment(existingConsignment.id, item)
        }
      } else {
        await createConsignment({
          producerId, producerName: producer?.name,
          lapakId: selectedLapakId, lapakName: selectedLapak?.name,
          date: todayStr(), items: itemsPayload, createdBy: firebaseUser.uid,
        })
      }
      setRows([])
      await checkExisting()
      await loadTodayList()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="page-title">Titipan Harian</div>
      <div className="page-subtitle">Catat produk yang dititipkan produsen pagi ini di {selectedLapak?.name}.</div>

      <div className="card">
        <label>Produsen</label>
        <select value={producerId} onChange={e => setProducerId(e.target.value)}>
          <option value="">-- pilih produsen --</option>
          {producers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>

        {producerId && existingConsignment && (
          <div className="help-text" style={{ marginTop: -4 }}>
            Titipan untuk produsen ini hari ini sudah dibuat (status: {existingConsignment.status}).
            Item baru yang Anda tambahkan akan ditambahkan ke titipan yang sama.
          </div>
        )}

        {producerId && (
          <>
            {rows.map((row, idx) => (
              <div className="item-row" key={idx}>
                <select value={row.productId} onChange={e => updateRow(idx, 'productId', e.target.value)}>
                  <option value="">-- produk --</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <input type="number" placeholder="Qty" value={row.qtyTitipan} onChange={e => updateRow(idx, 'qtyTitipan', e.target.value)} />
                <input type="number" placeholder="Harga Titipan" value={row.costPrice} onChange={e => updateRow(idx, 'costPrice', e.target.value)} />
                <input type="number" placeholder="Harga Jual" value={row.sellPrice} onChange={e => updateRow(idx, 'sellPrice', e.target.value)} />
                <button className="danger" onClick={() => removeRow(idx)} type="button">Hapus</button>
              </div>
            ))}
            <button type="button" className="secondary" onClick={addRow}>+ Tambah Produk</button>
            {error && <div className="error-text" style={{ marginTop: 12 }}>{error}</div>}
            <div style={{ marginTop: 12 }}>
              <button onClick={handleSubmit} disabled={busy || !rows.length}>
                {busy ? 'Menyimpan...' : 'Simpan Titipan'}
              </button>
            </div>
          </>
        )}

        {existingItems.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <strong>Item titipan hari ini untuk produsen ini:</strong>
            <table style={{ marginTop: 8 }}>
              <thead><tr><th>Produk</th><th>Qty Titipan</th><th>Terjual</th><th>Retur</th><th>Harga Titipan</th><th>Harga Jual</th></tr></thead>
              <tbody>
                {existingItems.map(it => (
                  <tr key={it.id}>
                    <td>{it.productName}</td><td>{it.qtyTitipan}</td><td>{it.qtySold}</td><td>{it.qtyReturned}</td>
                    <td>{formatRupiah(it.costPrice)}</td><td>{formatRupiah(it.sellPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <strong>Semua Titipan Hari Ini di {selectedLapak?.name}</strong>
        <table style={{ marginTop: 8 }}>
          <thead><tr><th>Produsen</th><th>Status</th><th>Status Bayar</th></tr></thead>
          <tbody>
            {todayList.map(c => (
              <tr key={c.id}>
                <td>{c.producerName}</td>
                <td><span className={`badge ${c.status}`}>{c.status}</span></td>
                <td><span className={`badge ${c.paymentStatus}`}>{c.paymentStatus}</span></td>
              </tr>
            ))}
            {todayList.length === 0 && <tr><td colSpan={3} style={{ color: '#9ca3af' }}>Belum ada titipan hari ini.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
