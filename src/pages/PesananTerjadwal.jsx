import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useLapak } from '../context/LapakContext'
import {
  listAllProductsForLapak, createPreorder, listPreordersForLapak,
  updatePreorderFulfillment, markPreorderPaid, deletePreorder, summarizePreorders,
} from '../lib/domain'
import { todayStr, formatRupiah, formatDateDisplay } from '../lib/dateUtils'

export default function PesananTerjadwal() {
  const { firebaseUser } = useAuth()
  const { selectedLapakId, selectedLapak, availableLapak } = useLapak()
  const [mode, setMode] = useState('single')

  const [products, setProducts] = useState([])
  const [orders, setOrders] = useState([])
  const [summary, setSummary] = useState(null)

  const [showForm, setShowForm] = useState(false)
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerAddress, setCustomerAddress] = useState('')
  const [deliveryDate, setDeliveryDate] = useState(todayStr())
  const [paymentStatus, setPaymentStatus] = useState('dp')
  const [dpAmount, setDpAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [rows, setRows] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (selectedLapakId) listAllProductsForLapak(selectedLapakId).then(setProducts)
  }, [selectedLapakId])

  useEffect(() => {
    if (mode === 'single' && selectedLapakId) load()
    if (mode === 'gabungan' && availableLapak.length > 0) loadGabungan()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLapakId, mode, availableLapak])

  async function load() {
    const list = await listPreordersForLapak(selectedLapakId)
    setOrders(list)
    setSummary(summarizePreorders(list))
  }

  async function loadGabungan() {
    const all = []
    for (const l of availableLapak) {
      all.push(...await listPreordersForLapak(l.id))
    }
    all.sort((a, b) => (a.deliveryDate || '').localeCompare(b.deliveryDate || ''))
    setOrders(all)
    setSummary(summarizePreorders(all))
  }

  function refresh() {
    return mode === 'gabungan' ? loadGabungan() : load()
  }

  function addRow() {
    setRows([...rows, { productId: '', qty: '', costPrice: '', sellPrice: '' }])
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

  const formTotal = rows.reduce((s, r) => s + (Number(r.qty) || 0) * (Number(r.sellPrice) || 0), 0)

  function resetForm() {
    setCustomerName(''); setCustomerPhone(''); setCustomerAddress('')
    setDeliveryDate(todayStr()); setPaymentStatus('dp'); setDpAmount(''); setNotes('')
    setRows([]); setShowForm(false)
  }

  async function handleSubmit() {
    setError('')
    if (!customerName.trim()) { setError('Nama pemesan wajib diisi.'); return }
    if (!rows.length) { setError('Tambahkan minimal 1 produk.'); return }
    for (const r of rows) {
      if (!r.productId || !r.qty) { setError('Lengkapi semua baris produk (produk & qty wajib diisi).'); return }
    }
    if (paymentStatus === 'dp' && (!dpAmount || Number(dpAmount) <= 0)) {
      setError('Isi jumlah DP yang sudah dibayar.'); return
    }
    if (paymentStatus === 'dp' && Number(dpAmount) >= formTotal) {
      setError('Jumlah DP tidak boleh sama atau lebih dari total pesanan — kalau sudah lunas, pilih status "Lunas".'); return
    }
    setBusy(true)
    try {
      const itemsPayload = rows.map(r => {
        const p = products.find(pr => pr.id === r.productId)
        return { productId: r.productId, productName: p?.name || '', qty: r.qty, costPrice: r.costPrice, sellPrice: r.sellPrice }
      })
      await createPreorder({
        lapakId: selectedLapakId, lapakName: selectedLapak?.name,
        customerName, customerPhone, customerAddress,
        deliveryDate, paymentStatus, dpAmount, notes,
        items: itemsPayload, createdBy: firebaseUser.uid,
      })
      resetForm()
      await refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleMarkDone(order) {
    await updatePreorderFulfillment(order.id, 'selesai')
    await refresh()
  }

  async function handleCancel(order) {
    if (!window.confirm(`Batalkan pesanan "${order.customerName}"? Pesanan yang dibatalkan tidak ikut dihitung di omzet/laba.`)) return
    await updatePreorderFulfillment(order.id, 'batal')
    await refresh()
  }

  async function handleMarkPaid(order) {
    await markPreorderPaid(order.id)
    await refresh()
  }

  async function handleDelete(order) {
    if (!window.confirm(`Hapus pesanan "${order.customerName}" secara permanen?`)) return
    await deletePreorder(order.id)
    await refresh()
  }

  const fulfillmentLabel = { menunggu: 'Menunggu', selesai: 'Selesai', batal: 'Batal' }

  return (
    <div>
      <div className="page-title">Pesanan Terjadwal</div>
      <div className="page-subtitle">
        {mode === 'single' ? `Pesanan custom pelanggan untuk ${selectedLapak?.name}.` : `Gabungan pesanan dari ${availableLapak.length} lapak.`}
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

      {summary && (
        <div className="stat-grid">
          <div className="stat-card">
            <div className="label">Total Omzet (Belum Batal)</div>
            <div className="value">{formatRupiah(summary.totalOmzetSemua)}</div>
          </div>
          <div className="stat-card">
            <div className="label">Total Laba (Belum Batal)</div>
            <div className="value">{formatRupiah(summary.totalLabaSemua)}</div>
          </div>
          <div className="stat-card">
            <div className="label">Omzet Sudah Selesai</div>
            <div className="value">{formatRupiah(summary.totalOmzetSelesai)}</div>
          </div>
          <div className="stat-card">
            <div className="label">DP Belum Lunas</div>
            <div className="value">{formatRupiah(summary.totalDpBelumLunas)}</div>
          </div>
        </div>
      )}
      {summary && (
        <p className="help-text" style={{ marginTop: -12 }}>
          {summary.jumlahPesanan} pesanan aktif • {summary.jumlahLunas} lunas • {summary.jumlahDp} masih DP •
          Omzet menunggu jadwal kirim: {formatRupiah(summary.totalOmzetMenunggu)}
        </p>
      )}

      <div className="card">
        <div className="toolbar">
          <strong>Daftar Pesanan</strong>
          <button onClick={() => setShowForm(!showForm)}>{showForm ? 'Tutup Form' : '+ Pesanan Baru'}</button>
        </div>

        {showForm && (
          <div style={{ borderTop: '1px solid #e2e4e9', paddingTop: 14, marginTop: 10 }}>
            <div className="grid-3">
              <div>
                <label>Nama Pemesan</label>
                <input value={customerName} onChange={e => setCustomerName(e.target.value)} required />
              </div>
              <div>
                <label>No. Telepon</label>
                <input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} />
              </div>
              <div>
                <label>Tanggal Kirim</label>
                <input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} />
              </div>
            </div>
            <label>Alamat / Catatan Pengiriman</label>
            <input value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} />

            <label>Produk Dipesan</label>
            {rows.map((row, idx) => (
              <div className="item-row" key={idx}>
                <select value={row.productId} onChange={e => updateRow(idx, 'productId', e.target.value)}>
                  <option value="">-- produk --</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.producerName})</option>)}
                </select>
                <input type="number" placeholder="Qty" value={row.qty} onChange={e => updateRow(idx, 'qty', e.target.value)} />
                <input type="number" placeholder="Harga Modal" value={row.costPrice} onChange={e => updateRow(idx, 'costPrice', e.target.value)} />
                <input type="number" placeholder="Harga Jual" value={row.sellPrice} onChange={e => updateRow(idx, 'sellPrice', e.target.value)} />
                <button type="button" className="danger" onClick={() => removeRow(idx)}>Hapus</button>
              </div>
            ))}
            <button type="button" className="secondary" onClick={addRow}>+ Tambah Produk</button>

            <div style={{ fontSize: 16, fontWeight: 700, marginTop: 14 }}>Total: {formatRupiah(formTotal)}</div>

            <div className="grid-2" style={{ marginTop: 12 }}>
              <div>
                <label>Status Pembayaran</label>
                <select value={paymentStatus} onChange={e => setPaymentStatus(e.target.value)}>
                  <option value="dp">DP (Belum Lunas)</option>
                  <option value="lunas">Lunas</option>
                </select>
              </div>
              {paymentStatus === 'dp' && (
                <div>
                  <label>Jumlah DP Sudah Dibayar (Rp)</label>
                  <input type="number" value={dpAmount} onChange={e => setDpAmount(e.target.value)} />
                </div>
              )}
            </div>
            <label>Catatan Tambahan</label>
            <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Opsional" />

            {error && <div className="error-text">{error}</div>}
            <button onClick={handleSubmit} disabled={busy}>{busy ? 'Menyimpan...' : 'Simpan Pesanan'}</button>
          </div>
        )}
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              {mode === 'gabungan' && <th>Lapak</th>}
              <th>Pemesan</th><th>Tgl Kirim</th><th>Total</th><th>Bayar</th><th>Status</th><th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {orders.map(o => (
              <tr key={o.id}>
                {mode === 'gabungan' && <td>{o.lapakName}</td>}
                <td>
                  {o.customerName}
                  {o.customerPhone && <div style={{ fontSize: 11, color: '#6b7280' }}>{o.customerPhone}</div>}
                </td>
                <td>{formatDateDisplay(o.deliveryDate)}</td>
                <td>
                  {formatRupiah(o.totalAmount)}
                  {o.paymentStatus === 'dp' && (
                    <div style={{ fontSize: 11, color: '#d97706' }}>Sisa {formatRupiah(o.remainingAmount)}</div>
                  )}
                </td>
                <td><span className={`badge ${o.paymentStatus === 'lunas' ? 'paid' : 'unpaid'}`}>{o.paymentStatus === 'lunas' ? 'Lunas' : 'DP'}</span></td>
                <td><span className={`badge ${o.fulfillmentStatus === 'selesai' ? 'settled' : o.fulfillmentStatus === 'batal' ? 'unpaid' : 'active'}`}>{fulfillmentLabel[o.fulfillmentStatus]}</span></td>
                <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {o.paymentStatus === 'dp' && <button className="secondary" onClick={() => handleMarkPaid(o)}>Tandai Lunas</button>}
                  {o.fulfillmentStatus === 'menunggu' && <button onClick={() => handleMarkDone(o)}>Tandai Selesai</button>}
                  {o.fulfillmentStatus === 'menunggu' && <button className="danger" onClick={() => handleCancel(o)}>Batalkan</button>}
                  <button className="danger" onClick={() => handleDelete(o)}>Hapus</button>
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr><td colSpan={mode === 'gabungan' ? 7 : 6} style={{ color: '#9ca3af' }}>Belum ada pesanan terjadwal.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
