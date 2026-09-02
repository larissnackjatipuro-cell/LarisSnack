import { useEffect, useState } from 'react'
import { useLapak } from '../context/LapakContext'
import { listConsignmentsForLapak, getConsignmentItems, listSalesTransactions } from '../lib/domain'
import { formatRupiah, todayStr, formatDateDisplay } from '../lib/dateUtils'

export default function Dashboard() {
  const { selectedLapakId, selectedLapak } = useLapak()
  const [stats, setStats] = useState({ titipanAktif: 0, totalTerjualHariIni: 0, totalNilaiJual: 0, belumLunas: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!selectedLapakId) return
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLapakId])

  async function load() {
    setLoading(true)
    const date = todayStr()
    const consignments = await listConsignmentsForLapak(selectedLapakId, date)

    let totalTerjual = 0
    let totalNilaiJual = 0
    let belumLunas = 0
    let titipanAktif = 0

    for (const c of consignments) {
      if (c.status === 'active') titipanAktif++
      if (c.status === 'closed' && c.paymentStatus === 'unpaid') belumLunas++
      const items = await getConsignmentItems(c.id)
      for (const it of items) {
        totalTerjual += Number(it.qtySold)
        totalNilaiJual += Number(it.qtySold) * Number(it.sellPrice)
      }
    }

    setStats({ titipanAktif, totalTerjualHariIni: totalTerjual, totalNilaiJual, belumLunas })
    setLoading(false)
  }

  return (
    <div>
      <div className="page-title">Dashboard</div>
      <div className="page-subtitle">
        {selectedLapak?.name || '-'} • {formatDateDisplay(todayStr())}
      </div>

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
