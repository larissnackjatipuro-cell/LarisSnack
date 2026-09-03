import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useLapak } from '../context/LapakContext'
import {
  listProducersForLapak, listProductsByProducer, createConsignment,
  addItemToConsignment, findConsignment, listConsignmentsForLapak, getConsignmentItems,
  updateConsignmentItem, deleteConsignmentItem, listPendingConsignments,
  confirmConsignment, rejectConsignment,
} from '../lib/domain'
import { todayStr, formatRupiah } from '../lib/dateUtils'

export default function Titipan() {
  const { firebaseUser } = useAuth()
  const { selectedLapakId, selectedLapak, availableLapak } = useLapak()

  const [producers, setProducers] = useState([])
  const [producerId, setProducerId] = useState('')
  const [products, setProducts] = useState([])
  const [rows, setRows] = useState([])
  const [existingConsignment, setExistingConsignment] = useState(null)
  const [existingItems, setExistingItems] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [todayList, setTodayList] = useState([])

  const [editingItemId, setEditingItemId] = useState(null)
  const [editForm, setEditForm] = useState({ qtyTitipan: '', costPrice: '', sellPrice: '' })
  const [rowError, setRowError] = useState('')
  const [rowBusy, setRowBusy] = useState(false)

  const [pendingList, setPendingList] = useState([])
  const [pendingEdits, setPendingEdits] = useState({})
  const [confirmBusy, setConfirmBusy] = useState({})
  const [confirmError, setConfirmError] = useState('')

  const [mode, setMode] = useState('single') // 'single' | 'gabungan' — hanya utk daftar/listing, bukan form buat titipan

  useEffect(() => {
    if (selectedLapakId) {
      listProducersForLapak(selectedLapakId).then(setProducers)
    }
  }, [selectedLapakId])

  useEffect(() => {
    if (mode === 'single' && selectedLapakId) {
      loadTodayList()
      loadPending()
    }
    if (mode === 'gabungan' && availableLapak.length > 0) {
      loadTodayListGabungan()
      loadPendingGabungan()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLapakId, mode, availableLapak])

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

  async function refreshLists() {
    if (mode === 'gabungan') { await loadPendingGabungan(); await loadTodayListGabungan() }
    else { await loadPending(); await loadTodayList() }
  }

  async function loadTodayList() {
    const list = await listConsignmentsForLapak(selectedLapakId, todayStr())
    setTodayList(list)
  }

  async function loadTodayListGabungan() {
    const all = []
    for (const l of availableLapak) {
      const list = await listConsignmentsForLapak(l.id, todayStr())
      all.push(...list)
    }
    setTodayList(all)
  }

  async function loadPending() {
    const list = await listPendingConsignments(selectedLapakId)
    const withItems = []
    for (const c of list) {
      const items = await getConsignmentItems(c.id)
      withItems.push({ ...c, items })
    }
    setPendingList(withItems)
    const edits = {}
    withItems.forEach(c => {
      edits[c.id] = {}
      c.items.forEach(it => {
        edits[c.id][it.id] = { qtyTitipan: it.qtyTitipan, costPrice: it.costPrice, sellPrice: it.sellPrice }
      })
    })
    setPendingEdits(edits)
  }

  async function loadPendingGabungan() {
    const allPending = []
    for (const l of availableLapak) {
      const list = await listPendingConsignments(l.id)
      for (const c of list) {
        const items = await getConsignmentItems(c.id)
        allPending.push({ ...c, items })
      }
    }
    setPendingList(allPending)
    const edits = {}
    allPending.forEach(c => {
      edits[c.id] = {}
      c.items.forEach(it => {
        edits[c.id][it.id] = { qtyTitipan: it.qtyTitipan, costPrice: it.costPrice, sellPrice: it.sellPrice }
      })
    })
    setPendingEdits(edits)
  }

  function updatePendingField(consignmentId, itemId, field, value) {
    setPendingEdits(prev => ({
      ...prev,
      [consignmentId]: { ...prev[consignmentId], [itemId]: { ...prev[consignmentId][itemId], [field]: value } },
    }))
  }

  async function handleConfirmPending(consignment) {
    setConfirmError('')
    setConfirmBusy(prev => ({ ...prev, [consignment.id]: true }))
    try {
      for (const item of consignment.items) {
        const edit = pendingEdits[consignment.id][item.id]
        await updateConsignmentItem(consignment.id, item.id, edit)
      }
      await confirmConsignment(consignment.id, firebaseUser.uid)
      await refreshLists()
    } catch (err) {
      setConfirmError(err.message)
    } finally {
      setConfirmBusy(prev => ({ ...prev, [consignment.id]: false }))
    }
  }

  async function handleRejectPending(consignment) {
    const reason = window.prompt('Alasan menolak titipan ini (boleh dikosongkan):') || ''
    setConfirmError('')
    setConfirmBusy(prev => ({ ...prev, [consignment.id]: true }))
    try {
      await rejectConsignment(consignment.id, reason, firebaseUser.uid)
      await refreshLists()
    } catch (err) {
      setConfirmError(err.message)
    } finally {
      setConfirmBusy(prev => ({ ...prev, [consignment.id]: false }))
    }
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
      await refreshLists()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  function startEdit(item) {
    setRowError('')
    setEditingItemId(item.id)
    setEditForm({ qtyTitipan: item.qtyTitipan, costPrice: item.costPrice, sellPrice: item.sellPrice })
  }

  function cancelEdit() {
    setEditingItemId(null)
    setRowError('')
  }

  async function saveEdit(item) {
    setRowError('')
    setRowBusy(true)
    try {
      await updateConsignmentItem(existingConsignment.id, item.id, {
        qtyTitipan: editForm.qtyTitipan,
        costPrice: editForm.costPrice,
        sellPrice: editForm.sellPrice,
      })
      setEditingItemId(null)
      await checkExisting()
    } catch (err) {
      setRowError(err.message)
    } finally {
      setRowBusy(false)
    }
  }

  async function handleDelete(item) {
    setRowError('')
    if (!window.confirm(`Hapus item "${item.productName}" dari titipan hari ini?`)) return
    setRowBusy(true)
    try {
      await deleteConsignmentItem(existingConsignment.id, item.id)
      await checkExisting()
    } catch (err) {
      setRowError(err.message)
    } finally {
      setRowBusy(false)
    }
  }

  return (
    <div>
      <div className="page-title">Titipan Harian</div>
      <div className="page-subtitle">Catat produk yang dititipkan produsen pagi ini di {selectedLapak?.name}.</div>

      {availableLapak.length > 1 && (
        <div className="card">
          <label>Tampilan Daftar (form buat titipan baru tetap pakai lapak terpilih di atas)</label>
          <select value={mode} onChange={e => setMode(e.target.value)} style={{ width: 320 }}>
            <option value="single">Per Lapak ({selectedLapak?.name})</option>
            <option value="gabungan">Gabungan Semua Lapak ({availableLapak.length} lapak)</option>
          </select>
        </div>
      )}

      {confirmError && <div className="error-text">{confirmError}</div>}

      {pendingList.length > 0 && (
        <div className="card" style={{ borderColor: '#f59e0b' }}>
          <strong>Menunggu Konfirmasi dari Produsen ({pendingList.length})</strong>
          <p className="help-text" style={{ marginTop: 4 }}>
            Titipan ini diajukan langsung oleh produsen. Cocokkan qty & harga dengan barang fisik yang
            diterima sebelum konfirmasi — item BELUM bisa dijual sampai dikonfirmasi.
          </p>
          {pendingList.map(c => (
            <div key={c.id} style={{ borderTop: '1px solid #e2e4e9', paddingTop: 12, marginTop: 12 }}>
              <div className="toolbar">
                <strong>{c.producerName}</strong>
                {mode === 'gabungan' && <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 8 }}>({c.lapakName})</span>}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => handleConfirmPending(c)} disabled={confirmBusy[c.id]}>
                    {confirmBusy[c.id] ? 'Memproses...' : 'Konfirmasi'}
                  </button>
                  <button className="danger" onClick={() => handleRejectPending(c)} disabled={confirmBusy[c.id]}>
                    Tolak
                  </button>
                </div>
              </div>
              <table>
                <thead><tr><th>Produk</th><th>Qty Diajukan</th><th>Harga Titipan</th><th>Harga Jual</th></tr></thead>
                <tbody>
                  {c.items.map(it => (
                    <tr key={it.id}>
                      <td>{it.productName}</td>
                      <td>
                        <input
                          type="number" style={{ width: 80, marginBottom: 0 }}
                          value={pendingEdits[c.id]?.[it.id]?.qtyTitipan ?? ''}
                          onChange={e => updatePendingField(c.id, it.id, 'qtyTitipan', e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="number" style={{ width: 100, marginBottom: 0 }}
                          value={pendingEdits[c.id]?.[it.id]?.costPrice ?? ''}
                          onChange={e => updatePendingField(c.id, it.id, 'costPrice', e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="number" style={{ width: 100, marginBottom: 0 }}
                          value={pendingEdits[c.id]?.[it.id]?.sellPrice ?? ''}
                          onChange={e => updatePendingField(c.id, it.id, 'sellPrice', e.target.value)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

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
            {rowError && <div className="error-text" style={{ marginTop: 8 }}>{rowError}</div>}
            <table style={{ marginTop: 8 }}>
              <thead>
                <tr>
                  <th>Produk</th><th>Qty Titipan</th><th>Terjual</th><th>Retur</th>
                  <th>Harga Titipan</th><th>Harga Jual</th>
                  {existingConsignment?.status === 'active' && <th>Aksi</th>}
                </tr>
              </thead>
              <tbody>
                {existingItems.map(it => {
                  const isEditing = editingItemId === it.id
                  const isActive = existingConsignment?.status === 'active'
                  return (
                    <tr key={it.id}>
                      <td>{it.productName}</td>
                      {isEditing ? (
                        <>
                          <td>
                            <input
                              type="number" style={{ width: 80, marginBottom: 0 }}
                              value={editForm.qtyTitipan}
                              onChange={e => setEditForm({ ...editForm, qtyTitipan: e.target.value })}
                            />
                          </td>
                          <td>{it.qtySold}</td>
                          <td>{it.qtyReturned}</td>
                          <td>
                            <input
                              type="number" style={{ width: 100, marginBottom: 0 }}
                              value={editForm.costPrice}
                              onChange={e => setEditForm({ ...editForm, costPrice: e.target.value })}
                            />
                          </td>
                          <td>
                            <input
                              type="number" style={{ width: 100, marginBottom: 0 }}
                              value={editForm.sellPrice}
                              onChange={e => setEditForm({ ...editForm, sellPrice: e.target.value })}
                            />
                          </td>
                          <td style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => saveEdit(it)} disabled={rowBusy}>Simpan</button>
                            <button className="secondary" onClick={cancelEdit} disabled={rowBusy}>Batal</button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td>{it.qtyTitipan}</td>
                          <td>{it.qtySold}</td>
                          <td>{it.qtyReturned}</td>
                          <td>{formatRupiah(it.costPrice)}</td>
                          <td>{formatRupiah(it.sellPrice)}</td>
                          {isActive && (
                            <td style={{ display: 'flex', gap: 6 }}>
                              <button className="secondary" onClick={() => startEdit(it)}>Edit</button>
                              <button
                                className="danger"
                                onClick={() => handleDelete(it)}
                                disabled={rowBusy || it.qtySold > 0}
                                title={it.qtySold > 0 ? 'Tidak bisa dihapus, sudah ada penjualan. Gunakan Tutup Hari & Retur.' : ''}
                              >
                                Hapus
                              </button>
                            </td>
                          )}
                        </>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div className="help-text" style={{ marginTop: 8 }}>
              Item yang sudah ada penjualan tidak bisa dihapus (tombol Hapus dinonaktifkan) — gunakan menu Tutup Hari & Retur untuk mengembalikan sisa stok ke produsen.
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <strong>{mode === 'gabungan' ? `Semua Titipan Hari Ini (Gabungan ${availableLapak.length} Lapak)` : `Semua Titipan Hari Ini di ${selectedLapak?.name}`}</strong>
        <table style={{ marginTop: 8 }}>
          <thead>
            <tr>
              {mode === 'gabungan' && <th>Lapak</th>}
              <th>Produsen</th><th>Status</th><th>Status Bayar</th>
            </tr>
          </thead>
          <tbody>
            {todayList.map(c => (
              <tr key={c.id}>
                {mode === 'gabungan' && <td>{c.lapakName}</td>}
                <td>{c.producerName}</td>
                <td><span className={`badge ${c.status}`}>{c.status}</span></td>
                <td><span className={`badge ${c.paymentStatus}`}>{c.paymentStatus}</span></td>
              </tr>
            ))}
            {todayList.length === 0 && <tr><td colSpan={mode === 'gabungan' ? 4 : 3} style={{ color: '#9ca3af' }}>Belum ada titipan hari ini.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
