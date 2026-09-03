import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useLapak } from '../context/LapakContext'
import { listConsignmentsForLapak, getConsignmentItems, recordSale } from '../lib/domain'
import { todayStr, formatRupiah } from '../lib/dateUtils'

export default function POS() {
  const { firebaseUser, profile } = useAuth()
  const { selectedLapakId, selectedLapak, availableLapak } = useLapak()

  // 'single' = mode kasir biasa (checkout aktif). 'gabungan' = tabel stok
  // lintas lapak READ-ONLY untuk referensi — checkout TETAP harus di mode
  // single, karena penjualan secara fisik terjadi di satu lokasi kasir.
  const [mode, setMode] = useState('single')

  const [availableItems, setAvailableItems] = useState([]) // gabungan semua item dari semua titipan aktif (lapak terpilih)
  const [gabunganItems, setGabunganItems] = useState([]) // lintas semua lapak, read-only
  const [cart, setCart] = useState([]) // { itemId, consignmentId, productName, sellPrice, qty }
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (mode === 'single' && selectedLapakId) loadAvailableStock()
    if (mode === 'gabungan' && availableLapak.length > 0) loadGabunganStock()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLapakId, mode, availableLapak])

  async function loadAvailableStock() {
    const consignments = await listConsignmentsForLapak(selectedLapakId, todayStr())
    const active = consignments.filter(c => c.status === 'active')
    const all = []
    for (const c of active) {
      const items = await getConsignmentItems(c.id)
      items.forEach(it => {
        const sisa = Number(it.qtyTitipan) - Number(it.qtySold) - Number(it.qtyReturned)
        if (sisa > 0) {
          all.push({
            itemId: it.id, consignmentId: c.id, producerName: c.producerName,
            productName: it.productName, sellPrice: it.sellPrice, sisa,
          })
        }
      })
    }
    setAvailableItems(all)
  }

  async function loadGabunganStock() {
    const all = []
    for (const l of availableLapak) {
      const consignments = await listConsignmentsForLapak(l.id, todayStr())
      const active = consignments.filter(c => c.status === 'active')
      for (const c of active) {
        const items = await getConsignmentItems(c.id)
        items.forEach(it => {
          const sisa = Number(it.qtyTitipan) - Number(it.qtySold) - Number(it.qtyReturned)
          all.push({
            lapakName: l.name, producerName: c.producerName,
            productName: it.productName, sellPrice: it.sellPrice, sisa,
          })
        })
      }
    }
    setGabunganItems(all)
  }

  function addToCart(item) {
    setError('')
    const existing = cart.find(c => c.itemId === item.itemId)
    if (existing) {
      if (existing.qty + 1 > item.sisa) { setError(`Stok "${item.productName}" hanya tersisa ${item.sisa}.`); return }
      setCart(cart.map(c => c.itemId === item.itemId ? { ...c, qty: c.qty + 1 } : c))
    } else {
      setCart([...cart, {
        itemId: item.itemId, consignmentId: item.consignmentId,
        productName: item.productName, priceAtSale: item.sellPrice, qty: 1, maxQty: item.sisa,
      }])
    }
  }

  function updateQty(itemId, qty) {
    setCart(cart.map(c => c.itemId === itemId ? { ...c, qty: Math.max(1, Number(qty)) } : c))
  }

  function removeFromCart(itemId) {
    setCart(cart.filter(c => c.itemId !== itemId))
  }

  const total = cart.reduce((s, c) => s + c.qty * c.priceAtSale, 0)

  async function handleCheckout() {
    setError(''); setSuccess('')
    if (!cart.length) { setError('Keranjang kosong.'); return }
    setBusy(true)
    try {
      await recordSale({
        lapakId: selectedLapakId,
        cashierId: firebaseUser.uid,
        cashierName: profile?.name,
        paymentMethod: 'cash',
        cart: cart.map(c => ({
          consignmentId: c.consignmentId, itemId: c.itemId,
          productName: c.productName, qty: c.qty, priceAtSale: c.priceAtSale,
        })),
      })
      setSuccess(`Transaksi berhasil disimpan. Total: ${formatRupiah(total)}`)
      setCart([])
      await loadAvailableStock()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="page-title">Transaksi Penjualan</div>
      <div className="page-subtitle">Kasir: {profile?.name} • Lapak: {selectedLapak?.name}</div>

      {availableLapak.length > 1 && (
        <div className="card">
          <label>Tampilan</label>
          <select value={mode} onChange={e => setMode(e.target.value)} style={{ width: 320 }}>
            <option value="single">Kasir — {selectedLapak?.name} (bisa checkout)</option>
            <option value="gabungan">Lihat Stok Semua Lapak (referensi saja, tidak bisa checkout)</option>
          </select>
          {mode === 'gabungan' && (
            <p className="help-text" style={{ marginTop: 8 }}>
              Mode ini cuma untuk melihat-lihat stok lintas lapak. Untuk benar-benar menjual, pindah balik ke
              mode "Kasir" dan pastikan Anda memilih lapak tempat Anda berjualan di dropdown atas.
            </p>
          )}
        </div>
      )}

      {mode === 'gabungan' ? (
        <div className="card">
          <strong>Stok Tersedia — Semua Lapak ({availableLapak.length})</strong>
          <table style={{ marginTop: 10 }}>
            <thead><tr><th>Lapak</th><th>Produk</th><th>Produsen</th><th>Harga</th><th>Sisa</th></tr></thead>
            <tbody>
              {gabunganItems.map((item, idx) => (
                <tr key={idx}>
                  <td>{item.lapakName}</td>
                  <td>{item.productName}</td>
                  <td style={{ color: '#6b7280', fontSize: 12 }}>{item.producerName}</td>
                  <td>{formatRupiah(item.sellPrice)}</td>
                  <td>{item.sisa}</td>
                </tr>
              ))}
              {gabunganItems.length === 0 && (
                <tr><td colSpan={5} style={{ color: '#9ca3af' }}>Tidak ada stok aktif di lapak manapun hari ini.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid-2">
          <div className="card">
            <strong>Produk Tersedia Hari Ini</strong>
            <table style={{ marginTop: 10 }}>
              <thead><tr><th>Produk</th><th>Produsen</th><th>Harga</th><th>Sisa</th><th></th></tr></thead>
              <tbody>
                {availableItems.map(item => (
                  <tr key={item.itemId}>
                    <td>{item.productName}</td>
                    <td style={{ color: '#6b7280', fontSize: 12 }}>{item.producerName}</td>
                    <td>{formatRupiah(item.sellPrice)}</td>
                    <td>{item.sisa}</td>
                    <td><button className="secondary" onClick={() => addToCart(item)}>+ Tambah</button></td>
                  </tr>
                ))}
                {availableItems.length === 0 && (
                  <tr><td colSpan={5} style={{ color: '#9ca3af' }}>Belum ada stok titipan aktif hari ini.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="card">
            <strong>Keranjang</strong>
            <table style={{ marginTop: 10 }}>
              <thead><tr><th>Produk</th><th>Qty</th><th>Subtotal</th><th></th></tr></thead>
              <tbody>
                {cart.map(c => (
                  <tr key={c.itemId}>
                    <td>{c.productName}</td>
                    <td>
                      <input
                        type="number" min={1} max={c.maxQty} value={c.qty}
                        style={{ width: 70, marginBottom: 0 }}
                        onChange={e => updateQty(c.itemId, e.target.value)}
                      />
                    </td>
                    <td>{formatRupiah(c.qty * c.priceAtSale)}</td>
                    <td><button className="danger" onClick={() => removeFromCart(c.itemId)}>x</button></td>
                  </tr>
                ))}
                {cart.length === 0 && <tr><td colSpan={4} style={{ color: '#9ca3af' }}>Keranjang masih kosong.</td></tr>}
              </tbody>
            </table>
            <div style={{ marginTop: 16, fontSize: 18, fontWeight: 700 }}>Total: {formatRupiah(total)}</div>
            {error && <div className="error-text">{error}</div>}
            {success && <div style={{ color: '#16a34a', fontSize: 13, marginBottom: 10 }}>{success}</div>}
            <button onClick={handleCheckout} disabled={busy || !cart.length} style={{ marginTop: 10 }}>
              {busy ? 'Memproses...' : 'Simpan Transaksi'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
