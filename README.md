# Aktivitas Harian — Aplikasi Manajemen Titipan Lapak

Aplikasi pencatatan titipan produk konsinyasi harian: titipan pagi → transaksi
penjualan → tutup hari & retur → pembayaran ke produsen esok pagi. Dibangun
dengan React + Firebase (Auth & Firestore), di-deploy ke Netlify.

> Lihat `PRD_Aplikasi_Aktivitas_Harian.md` (dokumen terpisah) untuk detail
> logika bisnis lengkap. Dokumen ini fokus ke instruksi teknis deploy & pakai.

---

## 1. Prasyarat

- Node.js versi 18 ke atas
- Akun [GitHub](https://github.com)
- Akun [Firebase](https://console.firebase.google.com) (gratis, pakai akun Google)
- Akun [Netlify](https://netlify.com)
- (Opsional tapi disarankan) Firebase CLI: `npm install -g firebase-tools`

---

## 2. Setup Project Firebase

1. Buka [Firebase Console](https://console.firebase.google.com) → **Add project** → beri nama (misal `aktivitas-harian`).
2. Di dashboard project → **Build > Authentication** → tab **Sign-in method** → aktifkan **Email/Password**.
3. Di **Build > Firestore Database** → **Create database** → pilih mode **Production** → pilih lokasi server (misal `asia-southeast2` untuk Indonesia).
4. Di **Project settings** (ikon gerigi) → scroll ke **Your apps** → klik ikon web `</>` → daftarkan app (nama bebas, tidak perlu centang Hosting) → salin objek `firebaseConfig` yang muncul.
5. Di folder project ini, salin `.env.example` menjadi `.env`, lalu isi sesuai `firebaseConfig` yang tadi disalin:

```
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=aktivitas-harian.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=aktivitas-harian
VITE_FIREBASE_STORAGE_BUCKET=aktivitas-harian.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
```

### 2.1 Deploy Firestore Rules & Indexes

Rules keamanan (`firestore.rules`) dan index (`firestore.indexes.json`) sudah
disiapkan di project ini. Deploy dengan Firebase CLI:

```bash
firebase login
firebase use --add        # pilih project Firebase yang tadi dibuat
firebase deploy --only firestore:rules,firestore:indexes
```

Jika Anda skip langkah ini, aplikasi tetap bisa jalan untuk development, tapi
**Firestore secara default menolak semua read/write** sampai rules di-deploy.

### 2.2 Buat User Admin Pertama

Aplikasi ini **tidak punya halaman signup** (disengaja, agar user tidak bisa
daftar sendiri tanpa kontrol admin). Buat user pertama secara manual:

1. **Authentication > Users > Add user** → isi email & password.
2. Salin **User UID** yang muncul setelah user dibuat.
3. Buka **Firestore Database > Start collection** → beri nama koleksi `users`.
4. Document ID: **tempel UID** yang tadi disalin (bukan auto-ID).
5. Isi field berikut:
   | Field | Tipe | Nilai |
   |---|---|---|
   | `name` | string | Nama admin |
   | `email` | string | Email yang sama dengan Authentication |
   | `role` | string | `admin` |
   | `lapakIds` | array | `["ALL"]` (akses semua lapak) |

Setelah ini, Anda bisa login ke aplikasi dengan email/password tadi.

> User berikutnya (misal kasir) dibuat dengan cara sama, tapi `role: "kasir"`
> dan `lapakIds` diisi array berisi ID lapak spesifik (ID lapak bisa dilihat
> di Firestore setelah Anda menambah lapak lewat menu Master Data).

---

## 3. Jalankan di Lokal (Opsional, untuk Testing)

```bash
npm install
npm run dev
```

Buka `http://localhost:5173`, login dengan akun admin yang tadi dibuat.

---

## 4. Push ke GitHub

```bash
git init
git add .
git commit -m "Initial commit: aplikasi aktivitas harian"
git branch -M main
git remote add origin https://github.com/USERNAME/NAMA-REPO.git
git push -u origin main
```

Ganti `USERNAME/NAMA-REPO` dengan repo GitHub Anda (buat dulu repo kosong di
GitHub jika belum ada). **Pastikan `.env` tidak ikut ter-commit** — file ini
sudah masuk `.gitignore`, jadi aman secara default.

---

## 5. Deploy ke Netlify

1. Login ke [Netlify](https://app.netlify.com) → **Add new site > Import an existing project**.
2. Pilih **GitHub**, otorisasi, lalu pilih repo yang tadi di-push.
3. Netlify akan otomatis mendeteksi `netlify.toml` (build command `npm run build`, publish folder `dist`) — biarkan default.
4. Sebelum klik Deploy, buka **Add environment variables** dan isi **persis sama** seperti isi `.env` Anda:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
5. Klik **Deploy site**. Setelah selesai, Netlify memberi URL (misal `nama-app.netlify.app`).
6. Kembali ke **Firebase Console > Authentication > Settings > Authorized domains** → tambahkan domain Netlify Anda (misal `nama-app.netlify.app`), atau login akan ditolak oleh Firebase Auth.

---

## 6. Alur Pakai Pertama Kali Setelah Deploy

1. Login dengan akun admin.
2. Buka **Master Data > Lapak** → tambahkan lapak (misal "Lapak Pasar Pagi", "Lapak Stasiun").
3. Buka **Master Data > Produsen** → tambahkan produsen, centang lapak mana saja yang berhak menerima titipannya.
4. Buka **Master Data > Produk** → pilih produsen, tambahkan katalog produk beserta harga default.
5. Buka **Titipan Harian** → pilih lapak (di pojok kanan atas) → pilih produsen → input qty & harga titipan pagi ini.
6. Buka **Transaksi Penjualan** untuk mencatat penjualan sepanjang hari.
7. Sore/malam hari, buka **Tutup Hari & Retur** untuk mengunci titipan hari itu.
8. Esok pagi, buka **Pembayaran Produsen** untuk menandai lunas setelah membayar produsen secara fisik.
9. Buka **Laporan** kapan saja untuk melihat rekap per tanggal.

---

## 7. Batasan Versi Ini (Perlu Diperkuat Sebelum Produksi Skala Besar)

Ini bukan daftar lengkap, tapi hal-hal yang **paling penting untuk disadari**:

- **Firestore Security Rules masih longgar** (`firestore.rules`): hanya cek
  "sudah login", belum membatasi per role/lapak secara ketat di level rules
  (validasi role saat ini murni di sisi UI React, yang secara teknis bisa
  di-bypass oleh user yang paham cara memanggil Firestore API langsung).
  Untuk data finansial produksi, rules ini **wajib diperketat** sebelum
  benar-benar dipakai banyak orang.
- **Tidak ada halaman manajemen user di UI** — user baru (kasir baru, dsb)
  masih harus dibuat manual lewat Firebase Console seperti langkah 2.2.
- **Tidak ada penanganan offline** — jika koneksi internet putus saat kasir
  input transaksi, transaksi bisa gagal tersimpan (Firestore SDK punya
  dukungan offline persistence, tapi belum diaktifkan di versi ini).
- **Laporan masih per-lapak**, belum ada mode konsolidasi lintas lapak untuk
  Owner yang ingin lihat total gabungan (lihat catatan di PRD §12 rencana iterasi).

---

## 8. Instalasi sebagai Aplikasi Smartphone (PWA)

Aplikasi ini sudah dikonfigurasi sebagai **Progressive Web App (PWA)** — bisa
di-"install" ke home screen HP dan dibuka fullscreen seperti aplikasi native,
**tanpa perlu Play Store/App Store**.

### Android (Chrome)
1. Buka URL aplikasi (misal `namasite.netlify.app`) di Chrome.
2. Akan muncul banner "Tambahkan Aktivitas Harian ke layar utama", atau buka
   menu titik tiga (⋮) di pojok kanan atas → **Instal aplikasi** / **Add to
   Home screen**.
3. Ikon aplikasi akan muncul di home screen, terbuka tanpa address bar
   browser (mode `standalone`).

### iPhone/iPad (Safari)
1. Buka URL aplikasi di **Safari** (bukan Chrome — iOS hanya mengizinkan
   instalasi PWA lewat Safari).
2. Tap ikon **Share** (kotak dengan panah ke atas) di bagian bawah.
3. Pilih **Add to Home Screen**.
4. Ikon aplikasi akan muncul di home screen dengan nama "Aktivitas Harian".

### Catatan Penting — Batasan PWA Ini

- **Ini bukan aplikasi native** dan tidak akan muncul di Google Play Store
  atau Apple App Store. Kalau nanti butuh itu, langkah selanjutnya adalah
  membungkus project ini dengan [Capacitor](https://capacitorjs.com) untuk
  menghasilkan APK/IPA — di luar cakupan setup PWA ini.
- Service worker yang dipakai (`registerType: 'autoUpdate'`) hanya
  mem-precache **file statis** (JS/CSS/HTML/ikon) agar loading lebih cepat.
  **Ini TIDAK membuat transaksi bisa disimpan saat HP offline** — mencatat
  penjualan/titipan tetap butuh koneksi internet karena data disimpan
  langsung ke Firestore.
- Setelah deploy versi baru ke Netlify, user yang sudah install PWA akan
  otomatis dapat versi terbaru di kunjungan berikutnya (tidak perlu uninstall
  ulang), karena `autoUpdate` mengganti service worker di background.

---

## 9. Struktur Data Firestore (Ringkas)

```
lapak/{lapakId}                        { name, address, isActive }
producers/{producerId}                 { name, phone, address, lapakIds:[], isActive }
products/{productId}                   { producerId, producerName, name, category, unit, defaultCostPrice, defaultSellPrice }
consignments/{consignmentId}           { producerId, producerName, lapakId, lapakName, date, status, paymentStatus, paidAt, paidBy, closedAt }
  └ items/{itemId}                     { productId, productName, qtyTitipan, costPrice, sellPrice, qtySold, qtyReturned }
salesTransactions/{transactionId}      { lapakId, cashierId, cashierName, transactionTime, totalAmount, status }
  └ items/{itemId}                     { consignmentId, consignmentItemId, productName, qty, priceAtSale, subtotal }
users/{uid}                            { name, email, role, lapakIds:[] }
```
