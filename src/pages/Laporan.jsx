import { useEffect, useState } from 'react'
import { useLapak } from '../context/LapakContext'
import { getDailyReport } from '../lib/domain'
import { todayStr, formatRupiah, formatDateDisplay } from '../lib/dateUtils'

export default function Laporan() {
  const { selectedLapakId, selectedLapak } = useLapak()
  const [date, setDate] = useState(todayStr())
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (selectedLapakId) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLapakId, date])

  async function load() {
    setLoading(true)
    setRows(await getDailyReport(selectedLapakId, date))
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

  return (
    <div>
      <div className="page-title">Laporan Harian</div>
      <div className="page-subtitle">Rekap per produsen untuk {selectedLapak?.name}.</div>

      <div className="card">
        <label>Tanggal</label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ width: 200 }} />
      </div>

      <div className="card">
        {loading ? <p>Memuat...</p> : (
          <table>
            <thead>
              <tr>
                <th>Produsen</th><th>Status</th><th>Titipan</th><th>Terjual</th><th>Retur</th>
                <th>Nilai Penjualan</th><th>Dibayar ke Produsen</th><th>Margin Lapak</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.consignmentId}>
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
              {rows.length === 0 && <tr><td colSpan={8} style={{ color: '#9ca3af' }}>Tidak ada data untuk tanggal ini.</td></tr>}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr style={{ fontWeight: 700 }}>
                  <td colSpan={2}>Total</td>
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
