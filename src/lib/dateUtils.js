// Format tanggal konsisten sebagai string YYYY-MM-DD (dipakai sebagai key,
// bukan Firestore Timestamp, agar query "titipan hari ini" simpel & murah).
export function todayStr() {
  return toDateStr(new Date())
}

export function toDateStr(date) {
  const d = new Date(date)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export function formatRupiah(value) {
  const n = Number(value) || 0
  return 'Rp' + n.toLocaleString('id-ID', { maximumFractionDigits: 0 })
}

export function formatDateDisplay(dateStr) {
  if (!dateStr) return '-'
  const [y, m, d] = dateStr.split('-')
  const bulan = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']
  return `${d} ${bulan[Number(m) - 1]} ${y}`
}
