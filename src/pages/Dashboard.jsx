import { useEffect, useState } from 'react'
import { useLapak } from '../context/LapakContext'
import { listConsignmentsForLapak, getConsignmentItems } from '../lib/domain'
import { formatRupiah, todayStr, formatDateDisplay } from '../lib/dateUtils'

export default function Dashboard() {
  const { selectedLapakId, selectedLapak, availableLapak } = useLapak()
  const [mode, setMode] = useState('single') // 'single' | 'gabungan'
  const [stats, setStats] = useState({ titipanAktif: 0, totalTerjualHariIni: 0, totalNilaiJual: 0, belumLunas: 0 })
  const [perLapak, setPerLapak] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (mode === 'single' && selectedLapakId) loadSingle()
    if (mode === 'gabungan' && availableLapak.length > 0) loadGabungan()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLapakId, mode, availableLapak])

  async function computeStatsForLapak(lapakId, date) {
    const consignments = await listConsignmentsForLapak(lapakId, date)
    let totalTerjual = 0, totalNilaiJual = 0, belumLunas = 0, titipanAktif = 0

    for (const c of consignments) {
      if (c.status === 'active') titipanAktif++
      if (c.status === 'closed' && c.paymentStatus === 'unpaid') belumLunas++
      const items = await getConsignmentItems(c.id)
      for (const it of items) {
        totalTerjual += Number(it.qtySold)
        totalNilaiJual += Number(it.qtySold) * Number(it.sellPrice)
      }
    }
    return { titipanAktif, totalTerjualHariIni: totalTerjual, totalNilaiJual, belumLunas }
  }

  async function loadSingle() {
    setLoading(true)
    const date = todayStr()
    setStats(await computeStatsForLapak(selectedLapakId, date))
    setPerLapak([])
    setLoading(false)
  }

  async function loadGabungan() {
    setLoading(true)
    const date = todayStr()
    const combined = { titipanAktif: 0, totalTerjualHariIni: 0, totalNilaiJual: 0, belumLunas: 0 }
    const rows = []
    for (const l of availableLapak) {
      const s = await computeStatsForLapak(l.id, date)
      combined.titipanAktif += s.titipanAktif
      combined.totalTerjualHariIni += s.totalTerjualHariIni
      combined.totalNilaiJual += s.totalNilaiJual
      combined.belumLunas += s.belumLunas
      rows.push({ lapakName: l.name, ...s })
    }
    setStats(combined)
    setPerLapak(rows)
    setLoading(false)
  }

  return (
    <div>
      <div className="page-title">Dashboard</div>
      <div className="page-subtitle">
        {mode === 'single' ? `${selectedLapak?.name || '-'} • ${formatDateDisplay(todayStr())}` : `Gabungan ${availableLapak.length} lapak • ${formatDateDisplay(todayStr())}`}
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

      {loading ? <p>Memuat...</p> : (
        <div className="stat-grid">
          <div className="stat-card">
            <div className="label">Titipan Aktif Hari Ini</div>
            <div className="value">{stats.titipanAktif}</div>
          </div>
          <div className="stat-card">
            <div className="label">Total Unit Terjual</div>
            <div className="value">{stats.totalTerjualHariIni}</div>
          </div>
          <div className="stat-card">
            <div className="label">Total Nilai Penjualan</div>
            <div className="value">{formatRupiah(stats.totalNilaiJual)}</div>
          </div>
          <div className="stat-card">
            <div className="label">Titipan Belum Dibayar</div>
            <div className="value">{stats.belumLunas}</div>
          </div>
        </div>
      )}

      {mode === 'gabungan' && perLapak.length > 0 && (
        <div className="card">
          <strong>Rincian per Lapak</strong>
          <table style={{ marginTop: 8 }}>
            <thead><tr><th>Lapak</th><th>Titipan Aktif</th><th>Unit Terjual</th><th>Nilai Penjualan</th><th>Belum Dibayar</th></tr></thead>
            <tbody>
              {perLapak.map(l => (
                <tr key={l.lapakName}>
                  <td>{l.lapakName}</td>
                  <td>{l.titipanAktif}</td>
                  <td>{l.totalTerjualHariIni}</td>
                  <td>{formatRupiah(l.totalNilaiJual)}</td>
                  <td>{l.belumLunas}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="card">
        <strong>Alur kerja harian:</strong>
        <ol style={{ color: '#4b5563', fontSize: 14, lineHeight: 1.8 }}>
          <li>Pagi hari: buka menu <em>Titipan Harian</em> untuk mencatat produk masuk dari produsen.</li>
          <li>Sepanjang hari: gunakan menu <em>Transaksi Penjualan</em> untuk mencatat penjualan.</li>
          <li>Akhir hari: buka <em>Tutup Hari & Retur</em> untuk mengunci stok dan menghitung retur.</li>
          <li>Pagi berikutnya: buka <em>Pembayaran Produsen</em> untuk menandai lunas.</li>
        </ol>
      </div>
    </div>
  )
}
