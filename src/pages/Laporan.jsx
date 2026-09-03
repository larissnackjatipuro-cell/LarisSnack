import { useEffect, useState } from 'react'
import { useLapak } from '../context/LapakContext'
import { getDailyReport } from '../lib/domain'
import { todayStr, formatRupiah } from '../lib/dateUtils'

export default function Laporan() {
  const { selectedLapakId, selectedLapak, availableLapak } = useLapak()
  const [date, setDate] = useState(todayStr())
  const [mode, setMode] = useState('single') // 'single' | 'gabungan'
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (mode === 'single' && selectedLapakId) load()
    if (mode === 'gabungan' && availableLapak.length > 0) loadGabungan()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLapakId, date, mode, availableLapak])

  async function load() {
    setLoading(true)
    setRows(await getDailyReport(selectedLapakId, date))
    setLoading(false)
  }

  async function loadGabungan() {
    setLoading(true)
    const all = []
    for (const l of availableLapak) {
      const r = await getDailyReport(l.id, date)
      all.push(...r)
    }
    setRows(all)
    setLoading(false)
  }

  const totals = rows.reduce((acc, r) => ({
    titipan: acc.titipan + r.totalTitipan,
    terjual: acc.terjual + r.totalTerjual,
    retur: acc.retur + r.totalRetur,
    nilaiPenjualan: acc.nilaiPenjualan + r.nilaiPenjualan,
    nilaiDibayar: acc.nilaiDibayar + r.nilaiDibayar,
    margin: acc.margin + r.margin,
  }), { titipan: 0, terjual: 0, retur: 0, nilaiPenjualan: 0, nilaiDibayar: 0, margin: 0 })

  // Subtotal per lapak — hanya relevan & ditampilkan di mode gabungan.
  const perLapak = {}
  if (mode === 'gabungan') {
    for (const r of rows) {
      const key = r.lapakId
      if (!perLapak[key]) {
        perLapak[key] = { lapakName: r.lapakName, nilaiPenjualan: 0, nilaiDibayar: 0, margin: 0 }
      }
      perLapak[key].nilaiPenjualan += r.nilaiPenjualan
      perLapak[key].nilaiDibayar += r.nilaiDibayar
      perLapak[key].margin += r.margin
    }
  }

  return (
    <div>
      <div className="page-title">Laporan Harian</div>
      <div className="page-subtitle">
        {mode === 'single' ? `Rekap per produsen untuk ${selectedLapak?.name}.` : 'Rekap gabungan seluruh lapak yang bisa Anda akses.'}
      </div>

      <div className="card">
        <div className="grid-2">
          <div>
            <label>Tanggal</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          {availableLapak.length > 1 && (
            <div>
              <label>Tampilan</label>
              <select value={mode} onChange={e => setMode(e.target.value)}>
                <option value="single">Per Lapak ({selectedLapak?.name})</option>
                <option value="gabungan">Gabungan Semua Lapak ({availableLapak.length} lapak)</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {mode === 'gabungan' && Object.keys(perLapak).length > 0 && (
        <div className="card">
          <strong>Ringkasan per Lapak</strong>
          <table style={{ marginTop: 8 }}>
            <thead><tr><th>Lapak</th><th>Nilai Penjualan</th><th>Dibayar ke Produsen</th><th>Margin</th></tr></thead>
            <tbody>
              {Object.values(perLapak).map(l => (
                <tr key={l.lapakName}>
                  <td>{l.lapakName}</td>
                  <td>{formatRupiah(l.nilaiPenjualan)}</td>
                  <td>{formatRupiah(l.nilaiDibayar)}</td>
                  <td>{formatRupiah(l.margin)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="card">
        {loading ? <p>Memuat...</p> : (
          <table>
            <thead>
              <tr>
                {mode === 'gabungan' && <th>Lapak</th>}
                <th>Produsen</th><th>Status</th><th>Titipan</th><th>Terjual</th><th>Retur</th>
                <th>Nilai Penjualan</th><th>Dibayar ke Produsen</th><th>Margin Lapak</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.consignmentId}>
                  {mode === 'gabungan' && <td>{r.lapakName}</td>}
                  <td>{r.producerName}</td>
                  <td><span className={`badge ${r.status}`}>{r.status}</span></td>
                  <td>{r.totalTitipan}</td>
                  <td>{r.totalTerjual}</td>
                  <td>{r.totalRetur}</td>
                  <td>{formatRupiah(r.nilaiPenjualan)}</td>
                  <td>{formatRupiah(r.nilaiDibayar)}</td>
                  <td>{formatRupiah(r.margin)}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={mode === 'gabungan' ? 9 : 8} style={{ color: '#9ca3af' }}>Tidak ada data untuk tanggal ini.</td></tr>
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr style={{ fontWeight: 700 }}>
                  <td colSpan={mode === 'gabungan' ? 3 : 2}>Total {mode === 'gabungan' ? '(Semua Lapak)' : ''}</td>
                  <td>{totals.titipan}</td>
                  <td>{totals.terjual}</td>
                  <td>{totals.retur}</td>
                  <td>{formatRupiah(totals.nilaiPenjualan)}</td>
                  <td>{formatRupiah(totals.nilaiDibayar)}</td>
                  <td>{formatRupiah(totals.margin)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        )}
      </div>
    </div>
  )
}
