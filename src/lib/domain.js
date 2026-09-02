import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, query, where,
  runTransaction, serverTimestamp, orderBy,
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

export async function listProductsByProducer(producerId) {
  const q = query(collection(db, 'products'), where('producerId', '==', producerId))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.isActive !== false)
}

export async function createProduct(data) {
  return addDoc(collection(db, 'products'), { ...data, isActive: true, createdAt: serverTimestamp() })
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

export async function createConsignment({ producerId, producerName, lapakId, lapakName, date, items, createdBy }) {
  const existing = await findConsignment(producerId, lapakId, date)
  if (existing) {
    throw new Error(
      `Titipan untuk produsen ini di lapak ini pada tanggal ${date} sudah ada. ` +
      `Tambahkan item ke titipan yang sudah ada, jangan buat baru (mencegah duplikasi rekap).`
    )
  }

  const consignmentRef = await addDoc(collection(db, 'consignments'), {
    producerId, producerName, lapakId, lapakName, date,
    status: 'active',
    paymentStatus: 'unpaid',
    paidAt: null,
    paidBy: null,
    closedAt: null,
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
