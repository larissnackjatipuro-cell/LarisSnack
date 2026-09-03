import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, query, where,
  runTransaction, serverTimestamp, orderBy, onSnapshot,
} from 'firebase/firestore'
import { db } from './firebase'
import { todayStr } from './dateUtils'

/* =========================================================
 * MASTER DATA
 * =======================================================*/

export async function listLapak() {
  const snap = await getDocs(collection(db, 'lapak'))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function createLapak(data) {
  return addDoc(collection(db, 'lapak'), { ...data, isActive: true, createdAt: serverTimestamp() })
}

export async function updateLapak(id, data) {
  return updateDoc(doc(db, 'lapak', id), data)
}

// Hapus master data AMAN dilakukan meski sudah punya riwayat titipan, karena
// nama lapak/produsen/produk selalu disalin (denormalisasi) ke dalam dokumen
// consignments/products saat dibuat — riwayat lama tidak akan rusak/hilang.
// Yang hilang cuma kemampuan membuat titipan BARU yang mereferensikan data ini.
export async function deleteLapak(id) {
  return deleteDoc(doc(db, 'lapak', id))
}

export async function listProducers() {
  const snap = await getDocs(collection(db, 'producers'))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

// Produsen yang terdaftar (array-contains) untuk lapak tertentu.
export async function listProducersForLapak(lapakId) {
  const q = query(collection(db, 'producers'), where('lapakIds', 'array-contains', lapakId))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.isActive !== false)
}

export async function createProducer(data) {
  // data.lapakIds: string[] — daftar lapak tempat produsen ini terdaftar
  return addDoc(collection(db, 'producers'), { ...data, isActive: true, createdAt: serverTimestamp() })
}

export async function updateProducer(id, data) {
  return updateDoc(doc(db, 'producers', id), data)
}

export async function deleteProducer(id) {
  return deleteDoc(doc(db, 'producers', id))
}

export async function listProductsByProducer(producerId) {
  const q = query(collection(db, 'products'), where('producerId', '==', producerId))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.isActive !== false)
}

export async function createProduct(data) {
  return addDoc(collection(db, 'products'), { ...data, isActive: true, createdAt: serverTimestamp() })
}

export async function updateProduct(id, data) {
  return updateDoc(doc(db, 'products', id), data)
}

export async function deleteProduct(id) {
  return deleteDoc(doc(db, 'products', id))
}

/* =========================================================
 * TITIPAN (CONSIGNMENT)
 * =======================================================*/

// Cari apakah sudah ada titipan utk producer+lapak+tanggal (mencegah duplikasi,
// setara dgn UNIQUE constraint di versi SQL).
export async function findConsignment(producerId, lapakId, date) {
  const q = query(
    collection(db, 'consignments'),
    where('producerId', '==', producerId),
    where('lapakId', '==', lapakId),
    where('date', '==', date),
  )
  const snap = await getDocs(q)
  if (snap.empty) return null
  const d = snap.docs[0]
  return { id: d.id, ...d.data() }
}

export async function createConsignment({ producerId, producerName, lapakId, lapakName, date, items, createdBy, status = 'active' }) {
  const existing = await findConsignment(producerId, lapakId, date)
  if (existing) {
    throw new Error(
      `Titipan untuk produsen ini di lapak ini pada tanggal ${date} sudah ada. ` +
      `Tambahkan item ke titipan yang sudah ada, jangan buat baru (mencegah duplikasi rekap).`
    )
  }

  const consignmentRef = await addDoc(collection(db, 'consignments'), {
    producerId, producerName, lapakId, lapakName, date,
    status, // 'active' kalau dibuat staf lapak, 'pending' kalau diajukan produsen sendiri
    paymentStatus: 'unpaid',
    paidAt: null,
    paidBy: null,
    closedAt: null,
    confirmedAt: null,
    confirmedBy: null,
    rejectedAt: null,
    rejectedBy: null,
    rejectionReason: '',
    createdBy,
    createdAt: serverTimestamp(),
  })

  for (const item of items) {
    await addDoc(collection(db, 'consignments', consignmentRef.id, 'items'), {
      productId: item.productId,
      productName: item.productName,
      qtyTitipan: Number(item.qtyTitipan),
      costPrice: Number(item.costPrice),     // snapshot — TIDAK boleh update dari master produk lagi
      sellPrice: Number(item.sellPrice),     // snapshot
      qtySold: 0,
      qtyReturned: 0,
      returnNote: '',
      returnedAt: null,
      createdAt: serverTimestamp(),
    })
  }

  return consignmentRef.id
}

// Dipakai halaman produsen: titipan yang mereka ajukan sendiri masuk sebagai
// 'pending' — TIDAK langsung bisa dijual sampai staf lapak konfirmasi lewat
// confirmConsignment() di bawah. Ini menjaga kontrol silang: produsen tidak
// bisa self-report lalu langsung jadi dasar pembayaran tanpa dicek.
export async function createConsignmentProposal(params) {
  return createConsignment({ ...params, status: 'pending' })
}

export async function listPendingConsignments(lapakId) {
  const q = query(
    collection(db, 'consignments'),
    where('lapakId', '==', lapakId),
    where('status', '==', 'pending'),
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

// Staf lapak konfirmasi titipan yang diajukan produsen, SETELAH mengecek fisik
// barang (dan kalau perlu, mengoreksi qty/harga lewat updateConsignmentItem
// sebelum memanggil ini). Ini mengubah status jadi 'active' — baru dari titik
// ini item-itemnya muncul sebagai stok yang bisa dijual di POS.
export async function confirmConsignment(consignmentId, confirmedBy) {
  const ref = doc(db, 'consignments', consignmentId)
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error('Titipan tidak ditemukan.')
  if (snap.data().status !== 'pending') throw new Error('Titipan ini bukan status pending.')
  await updateDoc(ref, { status: 'active', confirmedAt: serverTimestamp(), confirmedBy })
}

// Tolak titipan yang diajukan produsen (misal barang tidak jadi diantar, atau
// datanya salah total). Status jadi 'void', tidak bisa dijual, tidak masuk
// rekap pembayaran.
export async function rejectConsignment(consignmentId, reason, rejectedBy) {
  const ref = doc(db, 'consignments', consignmentId)
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error('Titipan tidak ditemukan.')
  if (snap.data().status !== 'pending') throw new Error('Titipan ini bukan status pending.')
  await updateDoc(ref, {
    status: 'void',
    rejectedAt: serverTimestamp(),
    rejectedBy,
    rejectionReason: reason || '',
  })
}

// Monitoring untuk halaman produsen: riwayat titipan milik produsen ini
// lintas lapak & tanggal (tidak pakai orderBy field lain supaya tidak perlu
// index komposit baru — diurutkan di sisi klien saja).
export async function listConsignmentsForProducer(producerId) {
  const q = query(collection(db, 'consignments'), where('producerId', '==', producerId))
  const snap = await getDocs(q)
  const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  return rows.sort((a, b) => (b.date || '').localeCompare(a.date || ''))
}

export async function getProducerById(producerId) {
  const snap = await getDoc(doc(db, 'producers', producerId))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() }
}

// ===== REAL-TIME (onSnapshot) — dipakai halaman produsen untuk memantau
// stok yang berubah langsung saat kasir menjual, tanpa perlu refresh manual.
// Mengembalikan fungsi unsubscribe — WAJIB dipanggil saat komponen unmount
// (lihat pemakaian di useEffect cleanup) supaya tidak bocor listener.

export function subscribeActiveConsignmentsForProducer(producerId, callback) {
  const q = query(
    collection(db, 'consignments'),
    where('producerId', '==', producerId),
    where('status', '==', 'active'),
  )
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  })
}

export function subscribeConsignmentItems(consignmentId, callback) {
  return onSnapshot(collection(db, 'consignments', consignmentId, 'items'), (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  })
}

// Ringkasan finansial produsen lintas SEMUA lapak (bukan cuma yang sedang
// dipilih di dropdown atas) — dipecah per status supaya jelas mana yang masih
// estimasi (aktif, bisa berubah), mana yang sudah pasti tapi belum dibayar
// (closed), dan mana yang sudah benar-benar diterima (settled).
export async function getProducerFinancialSummary(producerId) {
  const all = await listConsignmentsForProducer(producerId)
  let estimasiAktif = 0, menungguBayar = 0, sudahDiterima = 0
  const perLapak = {}

  for (const c of all) {
    const items = await getConsignmentItems(c.id)
    const nilai = items.reduce((s, it) => s + Number(it.qtySold) * Number(it.costPrice), 0)

    if (c.status === 'active') estimasiAktif += nilai
    else if (c.status === 'closed' && c.paymentStatus === 'unpaid') menungguBayar += nilai
    else if (c.status === 'settled') sudahDiterima += nilai

    if (!perLapak[c.lapakId]) perLapak[c.lapakId] = { lapakName: c.lapakName, estimasiAktif: 0, menungguBayar: 0, sudahDiterima: 0 }
    if (c.status === 'active') perLapak[c.lapakId].estimasiAktif += nilai
    else if (c.status === 'closed' && c.paymentStatus === 'unpaid') perLapak[c.lapakId].menungguBayar += nilai
    else if (c.status === 'settled') perLapak[c.lapakId].sudahDiterima += nilai
  }

  return { estimasiAktif, menungguBayar, sudahDiterima, perLapak: Object.values(perLapak) }
}

export async function addItemToConsignment(consignmentId, item) {
  return addDoc(collection(db, 'consignments', consignmentId, 'items'), {
    productId: item.productId,
    productName: item.productName,
    qtyTitipan: Number(item.qtyTitipan),
    costPrice: Number(item.costPrice),
    sellPrice: Number(item.sellPrice),
    qtySold: 0,
    qtyReturned: 0,
    returnNote: '',
    returnedAt: null,
    createdAt: serverTimestamp(),
  })
}

export async function listConsignmentsForLapak(lapakId, date = todayStr()) {
  const q = query(
    collection(db, 'consignments'),
    where('lapakId', '==', lapakId),
    where('date', '==', date),
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function getConsignmentItems(consignmentId) {
  const snap = await getDocs(collection(db, 'consignments', consignmentId, 'items'))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

// Edit item titipan SEBELUM tutup hari. Qty titipan tidak boleh diturunkan
// sampai di bawah (qtySold + qtyReturned) — itu akan merusak invarian stok
// (lihat business rule §7 di PRD: qtyTitipan harus selalu >= qtySold+qtyReturned).
export async function updateConsignmentItem(consignmentId, itemId, updates) {
  const ref = doc(db, 'consignments', consignmentId, 'items', itemId)
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error('Item titipan tidak ditemukan.')
  const data = snap.data()
  const qtySold = Number(data.qtySold)
  const qtyReturned = Number(data.qtyReturned)

  const payload = {}
  if (updates.qtyTitipan !== undefined) {
    const newQty = Number(updates.qtyTitipan)
    if (newQty < qtySold + qtyReturned) {
      throw new Error(
        `Qty titipan tidak boleh kurang dari ${qtySold + qtyReturned} ` +
        `(jumlah yang sudah terjual/diretur untuk item ini).`
      )
    }
    payload.qtyTitipan = newQty
  }
  if (updates.costPrice !== undefined) payload.costPrice = Number(updates.costPrice)
  if (updates.sellPrice !== undefined) payload.sellPrice = Number(updates.sellPrice)

  await updateDoc(ref, payload)
}

// Hapus item titipan. Hanya diizinkan kalau BELUM ada penjualan tercatat dari
// item ini (qtySold === 0) — kalau sudah ada, hapus akan membuat riwayat
// transaksi penjualan mengacu ke item yang tidak ada lagi (data orphan).
// Untuk item yang sudah terjual sebagian, gunakan proses Tutup Hari & Retur,
// bukan hapus.
export async function deleteConsignmentItem(consignmentId, itemId) {
  const ref = doc(db, 'consignments', consignmentId, 'items', itemId)
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error('Item titipan tidak ditemukan.')
  const data = snap.data()
  if (Number(data.qtySold) > 0) {
    throw new Error(
      'Item ini tidak bisa dihapus karena sudah ada penjualan tercatat. ' +
      'Gunakan proses Tutup Hari & Retur untuk mengembalikan sisa stok ke produsen.'
    )
  }
  await deleteDoc(ref)
}

/* =========================================================
 * PENJUALAN (POS) — bagian paling kritis: cegah oversell
 * =======================================================*/

// cart: [{ consignmentId, itemId, productName, qty, priceAtSale }]
// Semua validasi & update stok dilakukan DALAM SATU Firestore transaction,
// sehingga dua kasir yang submit bersamaan tidak akan membuat stok minus —
// Firestore otomatis retry transaction jika terjadi konflik baca/tulis.
export async function recordSale({ lapakId, cashierId, cashierName, paymentMethod, cart }) {
  if (!cart.length) throw new Error('Keranjang kosong.')

  const txRef = doc(collection(db, 'salesTransactions'))
  const itemRefs = cart.map(c => doc(db, 'consignments', c.consignmentId, 'items', c.itemId))

  const totalAmount = cart.reduce((sum, c) => sum + c.qty * c.priceAtSale, 0)

  await runTransaction(db, async (transaction) => {
    // 1. Baca semua item dulu (wajib sebelum write apa pun di Firestore transaction)
    const snapshots = []
    for (const ref of itemRefs) {
      const snap = await transaction.get(ref)
      if (!snap.exists()) throw new Error('Item titipan tidak ditemukan (mungkin sudah dihapus).')
      snapshots.push(snap)
    }

    // 2. Validasi stok utk tiap baris cart
    snapshots.forEach((snap, idx) => {
      const data = snap.data()
      const sisa = Number(data.qtyTitipan) - Number(data.qtySold) - Number(data.qtyReturned)
      const requested = cart[idx].qty
      if (requested > sisa) {
        throw new Error(
          `Stok "${data.productName}" tidak cukup. Sisa: ${sisa}, diminta: ${requested}.`
        )
      }
    })

    // 3. Update qtySold tiap item
    snapshots.forEach((snap, idx) => {
      const data = snap.data()
      transaction.update(itemRefs[idx], { qtySold: Number(data.qtySold) + cart[idx].qty })
    })

    // 4. Buat header transaksi penjualan
    transaction.set(txRef, {
      lapakId, cashierId, cashierName,
      transactionTime: serverTimestamp(),
      totalAmount,
      paymentMethod: paymentMethod || 'cash',
      status: 'completed',
      voidedAt: null,
      voidedReason: null,
    })

    // 5. Buat detail item transaksi
    cart.forEach((c) => {
      const itemDocRef = doc(collection(db, 'salesTransactions', txRef.id, 'items'))
      transaction.set(itemDocRef, {
        consignmentId: c.consignmentId,
        consignmentItemId: c.itemId,
        productName: c.productName,
        qty: c.qty,
        priceAtSale: c.priceAtSale,
        subtotal: c.qty * c.priceAtSale,
      })
    })
  })

  return txRef.id
}

export async function listSalesTransactions(lapakId, date = todayStr()) {
  // Catatan: Firestore tidak bisa filter langsung by "date" pada Timestamp
  // tanpa range query. Untuk MVP kita ambil semua transaksi hari ini via
  // range waktu awal-akhir hari (client-side, timezone lokal browser).
  const start = new Date(date + 'T00:00:00')
  const end = new Date(date + 'T23:59:59.999')
  const q = query(
    collection(db, 'salesTransactions'),
    where('lapakId', '==', lapakId),
    orderBy('transactionTime', 'desc'),
  )
  const snap = await getDocs(q)
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(t => {
      const ts = t.transactionTime?.toDate?.()
      if (!ts) return true // dokumen baru saja dibuat, cache lokal belum resolve timestamp
      return ts >= start && ts <= end
    })
}

export async function getSaleItems(transactionId) {
  const snap = await getDocs(collection(db, 'salesTransactions', transactionId, 'items'))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

// Void transaksi: kembalikan qtySold ke tiap consignment_item terkait.
export async function voidSaleTransaction(transactionId, reason) {
  const items = await getSaleItems(transactionId)

  await runTransaction(db, async (transaction) => {
    const txRef = doc(db, 'salesTransactions', transactionId)
    const txSnap = await transaction.get(txRef)
    if (!txSnap.exists()) throw new Error('Transaksi tidak ditemukan.')
    if (txSnap.data().status === 'void') throw new Error('Transaksi sudah di-void sebelumnya.')

    const itemRefs = items.map(it => doc(db, 'consignments', it.consignmentId, 'items', it.consignmentItemId))
    const itemSnaps = []
    for (const ref of itemRefs) {
      itemSnaps.push(await transaction.get(ref))
    }

    itemSnaps.forEach((snap, idx) => {
      if (!snap.exists()) return // item mungkin sudah dihapus, skip agar void tidak gagal total
      const data = snap.data()
      const newQtySold = Math.max(0, Number(data.qtySold) - items[idx].qty)
      transaction.update(itemRefs[idx], { qtySold: newQtySold })
    })

    transaction.update(txRef, { status: 'void', voidedAt: serverTimestamp(), voidedReason: reason || '' })
  })
}

/* =========================================================
 * TUTUP HARI & RETUR
 * =======================================================*/

// Set qtyReturned = sisa stok utk semua item pada satu titipan, lalu status -> closed.
// overrides: { [itemId]: qtyReturnedManual } jika admin mau override nilai default.
export async function closeConsignmentDay(consignmentId, overrides = {}) {
  const items = await getConsignmentItems(consignmentId)

  await runTransaction(db, async (transaction) => {
    const consignmentRef = doc(db, 'consignments', consignmentId)
    const consignmentSnap = await transaction.get(consignmentRef)
    if (!consignmentSnap.exists()) throw new Error('Titipan tidak ditemukan.')
    if (consignmentSnap.data().status !== 'active') {
      throw new Error('Titipan ini sudah ditutup atau belum aktif.')
    }

    for (const item of items) {
      const ref = doc(db, 'consignments', consignmentId, 'items', item.id)
      const sisaOtomatis = Number(item.qtyTitipan) - Number(item.qtySold) - Number(item.qtyReturned)
      const qtyReturnedFinal = overrides[item.id] !== undefined
        ? Number(overrides[item.id])
        : Number(item.qtyReturned) + Math.max(0, sisaOtomatis)

      transaction.update(ref, {
        qtyReturned: qtyReturnedFinal,
        returnedAt: serverTimestamp(),
      })
    }

    transaction.update(consignmentRef, { status: 'closed', closedAt: serverTimestamp() })
  })
}

/* =========================================================
 * REKAP & PEMBAYARAN
 * =======================================================*/

export async function listUnpaidConsignments(lapakId) {
  const q = query(
    collection(db, 'consignments'),
    where('lapakId', '==', lapakId),
    where('status', '==', 'closed'),
    where('paymentStatus', '==', 'unpaid'),
  )
  const snap = await getDocs(q)
  const results = []
  for (const d of snap.docs) {
    const consignment = { id: d.id, ...d.data() }
    const items = await getConsignmentItems(consignment.id)
    const totalQtySold = items.reduce((s, it) => s + Number(it.qtySold), 0)
    const totalAmount = items.reduce((s, it) => s + Number(it.qtySold) * Number(it.costPrice), 0)
    results.push({ ...consignment, totalQtySold, totalAmount, items })
  }
  return results
}

export async function markConsignmentPaid(consignmentId, userId) {
  const ref = doc(db, 'consignments', consignmentId)
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error('Titipan tidak ditemukan.')
  if (snap.data().status !== 'closed') throw new Error('Titipan harus berstatus "closed" sebelum dibayar.')

  await updateDoc(ref, {
    status: 'settled',
    paymentStatus: 'paid',
    paidAt: serverTimestamp(),
    paidBy: userId,
  })
}

/* =========================================================
 * LAPORAN
 * =======================================================*/

export async function getDailyReport(lapakId, date) {
  const consignments = await listConsignmentsForLapak(lapakId, date)
  const rows = []
  for (const c of consignments) {
    const items = await getConsignmentItems(c.id)
    const totalTitipan = items.reduce((s, it) => s + Number(it.qtyTitipan), 0)
    const totalTerjual = items.reduce((s, it) => s + Number(it.qtySold), 0)
    const totalRetur = items.reduce((s, it) => s + Number(it.qtyReturned), 0)
    const nilaiPenjualan = items.reduce((s, it) => s + Number(it.qtySold) * Number(it.sellPrice), 0)
    const nilaiDibayar = items.reduce((s, it) => s + Number(it.qtySold) * Number(it.costPrice), 0)
    rows.push({
      consignmentId: c.id,
      lapakId: c.lapakId,
      lapakName: c.lapakName,
      producerName: c.producerName,
      status: c.status,
      paymentStatus: c.paymentStatus,
      totalTitipan, totalTerjual, totalRetur,
      nilaiPenjualan, nilaiDibayar,
      margin: nilaiPenjualan - nilaiDibayar,
    })
  }
  return rows
}
