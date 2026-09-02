import { useEffect, useState } from 'react'
import {
  listLapak, createLapak, listProducers, createProducer, updateProducer,
  listProductsByProducer, createProduct,
} from '../lib/domain'
import { useLapak } from '../context/LapakContext'

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

function LapakTab() {
  const [list, setList] = useState([])
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => { load() }, [])
  async function load() { setList(await listLapak()) }

  async function handleAdd(e) {
    e.preventDefault()
    setBusy(true)
    await createLapak({ name, address })
    setName(''); setAddress('')
    await load()
    setBusy(false)
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
      <div className="card">
        <table>
          <thead><tr><th>Nama</th><th>Alamat</th></tr></thead>
          <tbody>
            {list.map(l => <tr key={l.id}><td>{l.name}</td><td>{l.address}</td></tr>)}
          </tbody>
        </table>
      </div>
    </>
  )
}

function ProdusenTab() {
  const { allLapak } = useLapak()
  const [list, setList] = useState([])
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [selectedLapak, setSelectedLapak] = useState([])
  const [busy, setBusy] = useState(false)

  useEffect(() => { load() }, [])
  async function load() { setList(await listProducers()) }

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
    const next = current.includes(lapakId)
      ? current.filter(id => id !== lapakId)
      : [...current, lapakId]
    await updateProducer(p.id, { lapakIds: next })
    await load()
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
      <div className="card">
        <table>
          <thead><tr><th>Nama</th><th>Telepon</th><th>Terdaftar di Lapak (klik untuk ubah)</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {list.map(p => (
              <tr key={p.id}>
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
                <td><button className="secondary" onClick={() => toggleActive(p)}>{p.isActive ? 'Nonaktifkan' : 'Aktifkan'}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function ProdukTab() {
  const [producers, setProducers] = useState([])
  const [producerId, setProducerId] = useState('')
  const [products, setProducts] = useState([])
  const [form, setForm] = useState({ name: '', category: '', unit: 'pcs', defaultCostPrice: '', defaultSellPrice: '' })
  const [busy, setBusy] = useState(false)

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

      {producerId && (
        <div className="card">
          <table>
            <thead><tr><th>Produk</th><th>Kategori</th><th>Satuan</th><th>Harga Titipan</th><th>Harga Jual</th></tr></thead>
            <tbody>
              {products.map(p => (
                <tr key={p.id}>
                  <td>{p.name}</td><td>{p.category}</td><td>{p.unit}</td>
                  <td>{p.defaultCostPrice}</td><td>{p.defaultSellPrice}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
