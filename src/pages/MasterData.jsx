import { useEffect, useState } from 'react'
import {
  listLapak, createLapak, updateLapak, deleteLapak,
  listProducers, createProducer, updateProducer, deleteProducer,
  listProductsByProducer, createProduct, updateProduct, deleteProduct,
  generateInviteCode,
} from '../lib/domain'
import { useAuth } from '../context/AuthContext'
import { useLapak } from '../context/LapakContext'
import { formatRupiah } from '../lib/dateUtils'

export default function MasterData() {
  const [tab, setTab] = useState('lapak')
  return (
    <div>
      <div className="page-title">Master Data</div>
      <div className="page-subtitle">Kelola lapak, produsen, dan katalog produk.</div>
      <div className="tabs">
        <button className={tab === 'lapak' ? 'active' : ''} onClick={() => setTab('lapak')}>Lapak</button>
        <button className={tab === 'produsen' ? 'active' : ''} onClick={() => setTab('produsen')}>Produsen</button>
        <button className={tab === 'produk' ? 'active' : ''} onClick={() => setTab('produk')}>Produk</button>
      </div>
      {tab === 'lapak' && <LapakTab />}
      {tab === 'produsen' && <ProdusenTab />}
      {tab === 'produk' && <ProdukTab />}
    </div>
  )
}

/* =========================================================
 * LAPAK
 * =======================================================*/

function LapakTab() {
  const { firebaseUser } = useAuth()
  const [list, setList] = useState([])
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({ name: '', address: '' })
  const [generatedCode, setGeneratedCode] = useState(null) // { lapakId, code }

  useEffect(() => { load() }, [])
  async function load() { setList(await listLapak()) }

  async function handleGenerateCode(l) {
    setError('')
    try {
      const code = await generateInviteCode({
        type: 'kasir', lapakId: l.id, lapakName: l.name, lapakIds: [l.id],
        createdBy: firebaseUser.uid,
      })
      setGeneratedCode({ lapakId: l.id, code })
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleAdd(e) {
    e.preventDefault()
    setBusy(true)
    await createLapak({ name, address })
    setName(''); setAddress('')
    await load()
    setBusy(false)
  }

  function startEdit(l) {
    setError('')
    setEditingId(l.id)
    setEditForm({ name: l.name, address: l.address || '' })
  }

  async function saveEdit(l) {
    setError('')
    try {
      await updateLapak(l.id, editForm)
      setEditingId(null)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDelete(l) {
    setError('')
    if (!window.confirm(
      `Hapus lapak "${l.name}"? Riwayat titipan/penjualan lama TETAP ADA (nama lapak tersimpan di riwayat), ` +
      `tapi lapak ini tidak akan bisa dipilih lagi untuk titipan/transaksi baru.`
    )) return
    try {
      await deleteLapak(l.id)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <>
      <div className="card">
        <form onSubmit={handleAdd} className="grid-2">
          <div>
            <label>Nama Lapak</label>
            <input value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div>
            <label>Alamat</label>
            <input value={address} onChange={e => setAddress(e.target.value)} />
          </div>
          <div><button type="submit" disabled={busy}>Tambah Lapak</button></div>
        </form>
      </div>
      {error && <div className="error-text">{error}</div>}
      <div className="card">
        <table>
          <thead><tr><th>Nama</th><th>Alamat</th><th>Aksi</th></tr></thead>
          <tbody>
            {list.map(l => {
              const isEditing = editingId === l.id
              return (
                <tr key={l.id}>
                  {isEditing ? (
                    <>
                      <td><input style={{ marginBottom: 0 }} value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} /></td>
                      <td><input style={{ marginBottom: 0 }} value={editForm.address} onChange={e => setEditForm({ ...editForm, address: e.target.value })} /></td>
                      <td style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => saveEdit(l)}>Simpan</button>
                        <button className="secondary" onClick={() => setEditingId(null)}>Batal</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td>{l.name}</td>
                      <td>{l.address}</td>
                      <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button className="secondary" onClick={() => startEdit(l)}>Edit</button>
                        <button className="secondary" onClick={() => handleGenerateCode(l)}>Buat Kode Kasir</button>
                        <button className="danger" onClick={() => handleDelete(l)}>Hapus</button>
                      </td>
                    </>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
        {generatedCode && (
          <div style={{ marginTop: 14, padding: 12, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8 }}>
            Kode undangan kasir untuk <strong>{list.find(l => l.id === generatedCode.lapakId)?.name}</strong>:{' '}
            <span style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 700, letterSpacing: 1 }}>{generatedCode.code}</span>
            {' '}
            <button
              className="secondary"
              onClick={() => { navigator.clipboard?.writeText(generatedCode.code); }}
            >
              Salin
            </button>
            <p className="help-text" style={{ marginTop: 6, marginBottom: 0 }}>
              Bagikan kode ini ke calon kasir. Kode hanya bisa dipakai SATU KALI untuk mendaftar di halaman "Daftar".
            </p>
          </div>
        )}
      </div>
    </>
  )
}

/* =========================================================
 * PRODUSEN
 * =======================================================*/

function ProdusenTab() {
  const { firebaseUser } = useAuth()
  const { allLapak } = useLapak()
  const [list, setList] = useState([])
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [selectedLapak, setSelectedLapak] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({ name: '', phone: '', address: '' })
  const [generatedCode, setGeneratedCode] = useState(null) // { producerId, code }

  useEffect(() => { load() }, [])
  async function load() { setList(await listProducers()) }

  async function handleGenerateCode(p) {
    setError('')
    if (!p.lapakIds || p.lapakIds.length === 0) {
      setError(`Produsen "${p.name}" belum terdaftar ke lapak manapun. Centang minimal 1 lapak dulu sebelum buat kode.`)
      return
    }
    try {
      const code = await generateInviteCode({
        type: 'produsen', producerId: p.id, producerName: p.name, lapakIds: p.lapakIds,
        createdBy: firebaseUser.uid,
      })
      setGeneratedCode({ producerId: p.id, code })
    } catch (err) {
      setError(err.message)
    }
  }

  function toggleLapak(id) {
    setSelectedLapak(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  async function handleAdd(e) {
    e.preventDefault()
    setBusy(true)
    await createProducer({ name, phone, address, lapakIds: selectedLapak })
    setName(''); setPhone(''); setAddress(''); setSelectedLapak([])
    await load()
    setBusy(false)
  }

  async function toggleActive(p) {
    await updateProducer(p.id, { isActive: !p.isActive })
    await load()
  }

  async function toggleProducerLapak(p, lapakId) {
    const current = p.lapakIds || []
    const next = current.includes(lapakId) ? current.filter(id => id !== lapakId) : [...current, lapakId]
    await updateProducer(p.id, { lapakIds: next })
    await load()
  }

  function startEdit(p) {
    setError('')
    setEditingId(p.id)
    setEditForm({ name: p.name, phone: p.phone || '', address: p.address || '' })
  }

  async function saveEdit(p) {
    setError('')
    try {
      await updateProducer(p.id, editForm)
      setEditingId(null)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDelete(p) {
    setError('')
    if (!window.confirm(
      `Hapus produsen "${p.name}"? Riwayat titipan lama TETAP ADA, tapi produsen ini (dan produk-produknya) ` +
      `tidak akan bisa dipilih lagi untuk titipan baru. Kalau produsen ini punya akun login, akun itu juga akan gagal masuk.`
    )) return
    try {
      await deleteProducer(p.id)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <>
      <div className="card">
        <form onSubmit={handleAdd}>
          <div className="grid-3">
            <div>
              <label>Nama Produsen</label>
              <input value={name} onChange={e => setName(e.target.value)} required />
            </div>
            <div>
              <label>No. Telepon</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} />
            </div>
            <div>
              <label>Alamat</label>
              <input value={address} onChange={e => setAddress(e.target.value)} />
            </div>
          </div>
          <label>Terdaftar di Lapak (bisa pilih lebih dari satu)</label>
          <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
            {allLapak.map(l => (
              <label key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 400, marginBottom: 0 }}>
                <input
                  type="checkbox"
                  style={{ width: 'auto', marginBottom: 0 }}
                  checked={selectedLapak.includes(l.id)}
                  onChange={() => toggleLapak(l.id)}
                />
                {l.name}
              </label>
            ))}
          </div>
          <button type="submit" disabled={busy}>Tambah Produsen</button>
        </form>
      </div>

      {error && <div className="error-text">{error}</div>}

      <div className="card">
        <table>
          <thead><tr><th>Nama</th><th>Telepon</th><th>Terdaftar di Lapak</th><th>Status</th><th>Aksi</th></tr></thead>
          <tbody>
            {list.map(p => {
              const isEditing = editingId === p.id
              return (
                <tr key={p.id}>
                  {isEditing ? (
                    <>
                      <td><input style={{ marginBottom: 0 }} value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} /></td>
                      <td><input style={{ marginBottom: 0 }} value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} /></td>
                      <td><input style={{ marginBottom: 0 }} placeholder="Alamat" value={editForm.address} onChange={e => setEditForm({ ...editForm, address: e.target.value })} /></td>
                      <td colSpan={2} style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => saveEdit(p)}>Simpan</button>
                        <button className="secondary" onClick={() => setEditingId(null)}>Batal</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td>{p.name}</td>
                      <td>{p.phone}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                          {allLapak.map(l => (
                            <label key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 400, marginBottom: 0, fontSize: 13 }}>
                              <input
                                type="checkbox"
                                style={{ width: 'auto', marginBottom: 0 }}
                                checked={(p.lapakIds || []).includes(l.id)}
                                onChange={() => toggleProducerLapak(p, l.id)}
                              />
                              {l.name}
                            </label>
                          ))}
                          {allLapak.length === 0 && <span style={{ color: '#9ca3af' }}>Belum ada lapak.</span>}
                        </div>
                      </td>
                      <td><span className={`badge ${p.isActive ? 'active' : 'unpaid'}`}>{p.isActive ? 'Aktif' : 'Nonaktif'}</span></td>
                      <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button className="secondary" onClick={() => startEdit(p)}>Edit</button>
                        <button className="secondary" onClick={() => toggleActive(p)}>{p.isActive ? 'Nonaktifkan' : 'Aktifkan'}</button>
                        <button className="secondary" onClick={() => handleGenerateCode(p)}>Buat Kode</button>
                        <button className="danger" onClick={() => handleDelete(p)}>Hapus</button>
                      </td>
                    </>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
        {generatedCode && (
          <div style={{ marginTop: 14, padding: 12, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8 }}>
            Kode undangan produsen untuk <strong>{list.find(p => p.id === generatedCode.producerId)?.name}</strong>:{' '}
            <span style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 700, letterSpacing: 1 }}>{generatedCode.code}</span>
            {' '}
            <button className="secondary" onClick={() => { navigator.clipboard?.writeText(generatedCode.code); }}>Salin</button>
            <p className="help-text" style={{ marginTop: 6, marginBottom: 0 }}>
              Bagikan kode ini ke produsen tsb. Kode hanya bisa dipakai SATU KALI untuk mendaftar di halaman "Daftar".
            </p>
          </div>
        )}
      </div>
    </>
  )
}

/* =========================================================
 * PRODUK
 * =======================================================*/

function ProdukTab() {
  const [producers, setProducers] = useState([])
  const [producerId, setProducerId] = useState('')
  const [products, setProducts] = useState([])
  const [form, setForm] = useState({ name: '', category: '', unit: 'pcs', defaultCostPrice: '', defaultSellPrice: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({ name: '', category: '', unit: 'pcs', defaultCostPrice: '', defaultSellPrice: '' })

  useEffect(() => { listProducers().then(setProducers) }, [])
  useEffect(() => { if (producerId) loadProducts() }, [producerId])

  async function loadProducts() { setProducts(await listProductsByProducer(producerId)) }

  async function handleAdd(e) {
    e.preventDefault()
    if (!producerId) return
    setBusy(true)
    const producer = producers.find(p => p.id === producerId)
    await createProduct({
      producerId,
      producerName: producer?.name || '',
      name: form.name,
      category: form.category,
      unit: form.unit,
      defaultCostPrice: Number(form.defaultCostPrice) || 0,
      defaultSellPrice: Number(form.defaultSellPrice) || 0,
    })
    setForm({ name: '', category: '', unit: 'pcs', defaultCostPrice: '', defaultSellPrice: '' })
    await loadProducts()
    setBusy(false)
  }

  function startEdit(p) {
    setError('')
    setEditingId(p.id)
    setEditForm({
      name: p.name, category: p.category || '', unit: p.unit || 'pcs',
      defaultCostPrice: p.defaultCostPrice, defaultSellPrice: p.defaultSellPrice,
    })
  }

  async function saveEdit(p) {
    setError('')
    try {
      await updateProduct(p.id, {
        name: editForm.name,
        category: editForm.category,
        unit: editForm.unit,
        defaultCostPrice: Number(editForm.defaultCostPrice) || 0,
        defaultSellPrice: Number(editForm.defaultSellPrice) || 0,
      })
      setEditingId(null)
      await loadProducts()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDelete(p) {
    setError('')
    if (!window.confirm(
      `Hapus produk "${p.name}"? Riwayat titipan lama yang sudah memakai produk ini TETAP ADA ` +
      `(nama produk tersimpan di riwayat), tapi produk ini tidak bisa dipilih lagi untuk titipan baru.`
    )) return
    try {
      await deleteProduct(p.id)
      await loadProducts()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <>
      <div className="card">
        <label>Pilih Produsen</label>
        <select value={producerId} onChange={e => setProducerId(e.target.value)}>
          <option value="">-- pilih produsen --</option>
          {producers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>

        {producerId && (
          <form onSubmit={handleAdd}>
            <div className="grid-3">
              <div>
                <label>Nama Produk</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div>
                <label>Kategori</label>
                <input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} />
              </div>
              <div>
                <label>Satuan</label>
                <select value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}>
                  <option value="pcs">pcs</option>
                  <option value="kg">kg</option>
                  <option value="pack">pack</option>
                  <option value="porsi">porsi</option>
                </select>
              </div>
              <div>
                <label>Harga Titipan Default (Rp)</label>
                <input type="number" value={form.defaultCostPrice} onChange={e => setForm({ ...form, defaultCostPrice: e.target.value })} />
              </div>
              <div>
                <label>Harga Jual Default (Rp)</label>
                <input type="number" value={form.defaultSellPrice} onChange={e => setForm({ ...form, defaultSellPrice: e.target.value })} />
              </div>
            </div>
            <button type="submit" disabled={busy}>Tambah Produk</button>
          </form>
        )}
      </div>

      {error && <div className="error-text">{error}</div>}

      {producerId && (
        <div className="card">
          <table>
            <thead><tr><th>Produk</th><th>Kategori</th><th>Satuan</th><th>Harga Titipan</th><th>Harga Jual</th><th>Aksi</th></tr></thead>
            <tbody>
              {products.map(p => {
                const isEditing = editingId === p.id
                return (
                  <tr key={p.id}>
                    {isEditing ? (
                      <>
                        <td><input style={{ marginBottom: 0, width: 120 }} value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} /></td>
                        <td><input style={{ marginBottom: 0, width: 100 }} value={editForm.category} onChange={e => setEditForm({ ...editForm, category: e.target.value })} /></td>
                        <td>
                          <select style={{ marginBottom: 0 }} value={editForm.unit} onChange={e => setEditForm({ ...editForm, unit: e.target.value })}>
                            <option value="pcs">pcs</option>
                            <option value="kg">kg</option>
                            <option value="pack">pack</option>
                            <option value="porsi">porsi</option>
                          </select>
                        </td>
                        <td><input type="number" style={{ marginBottom: 0, width: 100 }} value={editForm.defaultCostPrice} onChange={e => setEditForm({ ...editForm, defaultCostPrice: e.target.value })} /></td>
                        <td><input type="number" style={{ marginBottom: 0, width: 100 }} value={editForm.defaultSellPrice} onChange={e => setEditForm({ ...editForm, defaultSellPrice: e.target.value })} /></td>
                        <td style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => saveEdit(p)}>Simpan</button>
                          <button className="secondary" onClick={() => setEditingId(null)}>Batal</button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td>{p.name}</td><td>{p.category}</td><td>{p.unit}</td>
                        <td>{formatRupiah(p.defaultCostPrice)}</td><td>{formatRupiah(p.defaultSellPrice)}</td>
                        <td style={{ display: 'flex', gap: 6 }}>
                          <button className="secondary" onClick={() => startEdit(p)}>Edit</button>
                          <button className="danger" onClick={() => handleDelete(p)}>Hapus</button>
                        </td>
                      </>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
