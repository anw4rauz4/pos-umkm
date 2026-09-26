# 🛒 KasirKu AI — POS UMKM 100% Offline

Aplikasi kasir UMKM yang berjalan **sepenuhnya di localhost laptop Anda**. Semua data tersimpan di browser (IndexedDB), semua fitur berfungsi tanpa internet.

> **Filosofi:** "Simple enough for a warung, powerful enough for a retail chain."

> ⚠️ **PENTING: TIDAK ADA CLOUD / SUPABASE / SERVER EKSTERNAL.**
> Aplikasi ini TIDAK memiliki backend cloud, TIDAK ada sync ke internet, dan TIDAK mengirim data keluar dari laptop Anda. Semua data 100% lokal (IndexedDB browser). Bekerja penuh saat online maupun offline — status internet tidak berpengaruh sama sekali.

---

## 📖 Daftar Isi

1. [Kenapa 100% Offline?](#-kenapa-100-offline)
2. [Tech Stack](#️-tech-stack)
3. [Struktur Project](#-struktur-project)
4. [Instalasi & Menjalankan](#-instalasi--menjalankan)
5. [Panduan Penggunaan](#-panduan-penggunaan)
6. [Fitur](#-fitur)
7. [Database Schema (IndexedDB)](#-database-schema-indexeddb)
8. [Backup & Restore](#-backup--restore)
9. [FAQ](#-faq)

---

## 🚫 Kenapa 100% Offline?

| Pertanyaan | Jawaban |
|---|---|
| Apakah butuh internet? | **Tidak.** Setelah `npm run dev` / `npm run start` jalan, internet tidak diperlukan |
| Ke mana data dikirim? | **Tidak ke mana-mana.** Data tersimpan di IndexedDB browser di laptop Anda |
| Ada Supabase/Firebase/server cloud? | **Tidak ada.** Tidak ada dependency cloud, tidak ada env var API, tidak ada HTTP call keluar |
| Laptop mati, apakah data hilang? | Tidak, selama profil browser tidak dihapus. Tetap lakukan backup rutin (JSON) |
| Ganti browser/ganti laptop? | Data tidak otomatis ikut. Gunakan **Backup → Upload Backup** untuk memindahkan |

**Arsitektur:**

```
┌─────────────────────────────────────────────┐
│              BROWSER (localhost:3000)        │
│                                             │
│  UI (React) ── Business Logic (lib/*.ts)    │
│                    │                        │
│              IndexedDB (Dexie)               │
│         products / suppliers /               │
│         transactions / users / dsb.          │
│                                             │
│         🔒 Tidak ada koneksi keluar          │
└─────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

| Teknologi | Versi | Fungsi |
|---|---|---|
| Next.js | 16.3.6 | Framework (dijalankan lokal, bukan di Vercel/cloud) |
| React | 19.2.8 | UI Library |
| TypeScript | 5.x | Type safety penuh (0 `any`) |
| Tailwind CSS | 4.x | Styling |
| Dexie.js | 4.4.6 | Wrapper IndexedDB (database lokal browser) |
| dexie-react-hooks | 4.4.0 | Reactive queries ke IndexedDB |
| crypto-js | 4.2.0 | Hash password (SHA-256 + salt) & PIN |
| html5-qrcode | 2.3.8 | Scan barcode via kamera (bundled lokal, bukan CDN) |
| lucide-react | 1.48.0 | Ikon |
| xlsx | 0.18.5 | Import/Export Excel |

**Tidak ada:** Supabase, Firebase, Prisma, server database, API eksternal, env var rahasia.

---

## 📁 Struktur Project

```
kasirku-ai/
├── start-kasirku.bat           # 🖱️ Launcher 1 klik (Windows)
├── stop-kasirku.bat            # 🛑 Matikan server
├── app/                        # Next.js App Router
│   ├── layout.tsx              # Root layout + AuthGuard + Navbar
│   ├── page.tsx                # Beranda
│   ├── login/                  # Login & daftar (akun lokal IndexedDB)
│   ├── kasir/                  # POS: keranjang, scan, checkout, cetak struk
│   ├── produk/                 # CRUD produk, harga bertingkat, import/export Excel
│   ├── supplier/               # Manajemen supplier
│   ├── dashboard/              # Grafik penjualan (SVG murni, tanpa library chart)
│   ├── users/                  # Manajemen pengguna (admin)
│   ├── profile/                # Profil toko & ganti password
│   ├── lock/                   # Kunci layar dengan PIN
│   ├── offline/                # Halaman fallback offline (PWA)
│   └── settings/backup/        # Backup & restore JSON
│
├── lib/                        # Business logic (semua TypeScript)
│   ├── db.ts                   # Skema Dexie (IndexedDB) + seed data
│   ├── auth.ts                 # Register/login/sesi (sessionStorage lokal)
│   ├── auth.types.ts           # Tipe UserSession
│   ├── types.ts                # Tipe domain (Product, Transaction, dll)
│   ├── dbHelpers.ts            # productService / supplierService / transactionService
│   ├── backup.ts               # Export/import database ke JSON
│   ├── encryption.ts           # PIN lock (hash SHA-256, localStorage)
│   ├── tierPricing.ts          # Harga grosir bertingkat
│   ├── printReceipt.ts         # Struk thermal 58mm
│   ├── exportHelpers.ts        # Export Excel & laporan PDF
│   ├── imageHelper.ts          # Kompres gambar → base64
│   ├── syncDual.ts             # Placeholder sync (mati, mode "local-only" permanen)
│   └── components/             # Navbar, AuthGuard, BarcodeScanner, Charts, PWARegister, dll.
├── public/
│   ├── sw.js                   # Service worker (cache offline-first PWA)
│   └── icons/                  # Ikon PWA 192/512 + maskable
│
├── scripts/e2e-test.mjs        # Smoke test dengan Puppeteer (localhost)
└── package.json
```

---

## 🚀 Instalasi & Menjalankan

### Prasyarat
- Node.js v20+ → https://nodejs.org
- Tidak perlu akun apa pun, tidak perlu API key, tidak perlu internet setelah `npm install`

### Langkah

#### Cara termudah (Windows) — 1 klik

1. Double-click **`start-kasirku.bat`**
2. Browser terbuka otomatis di `http://localhost:3000`
3. Untuk mematikan server: jalankan **`stop-kasirku.bat`**

> Script `start-kasirku.bat` otomatis: cek Node.js → install dependencies (sekali saja) → build produksi (sekali saja) → start server → buka browser. Biarkan jendela hitamnya tetap terbuka selama aplikasi dipakai.

#### Cara manual

```bash
# 1. Install dependencies (sekali saja, butuh internet)
npm install

# 2. Jalankan di localhost
npm run dev

# 3. Buka browser
# http://localhost:3000
```

### Mode produksi (lebih cepat & stabil untuk dipakai harian)

```bash
npm run build
npm run start
# → http://localhost:3000
```

### Environment variables

**Tidak diperlukan sama sekali.** Jangan buat file `.env` berisi `SUPABASE_URL`, `OPENAI_API_KEY`, dsb. — aplikasi tidak membaca variabel lingkungan mana pun.

---

## 📚 Panduan Penggunaan

### Alur kerja harian

```
MULAI HARI
1. Buka http://localhost:3000 → login / masukkan PIN
2. Cek stok di menu "Produk"
        ↓
TRANSAKSI (menu "Kasir")
3. Scan barcode ATAU klik produk
4. Pilih metode bayar: 💵 Cash / 📱 QRIS / 🏦 Transfer
5. Struk otomatis tercetak (thermal 58mm / PDF)
        ↓
AKHIR HARI
6. Lihat ringkasan di "Dashboard"
7. Backup di menu "Backup" → simpan file JSON
```

### Multi-user
- **Admin:** akses penuh termasuk manajemen pengguna
- **Kasir:** hanya transaksi

### Harga grosir bertingkat
Saat edit produk, centang tier qty (mis. beli 3+ → harga khusus). Di kasir, harga otomatis mengikuti qty, atau bisa dipilih manual lewat checklist di keranjang.

---

## ✨ Fitur

| # | Fitur | Status |
|---|---|---|
| 1 | 🛒 Kasir POS (keranjang real-time) | ✅ |
| 2 | 📷 Scan barcode via kamera (bundled lokal, offline) | ✅ |
| 3 | 🖨️ Print struk thermal 58mm / Save as PDF | ✅ |
| 4 | 📦 CRUD produk + gambar (auto-compress) | ✅ |
| 5 | 🏷️ Harga bertingkat / grosir | ✅ |
| 6 | 🏭 Multi-supplier | ✅ |
| 7 | 📊 Dashboard grafik (SVG murni) | ✅ |
| 8 | 💾 Backup & restore JSON 1 klik | ✅ |
| 9 | 📈 Export/import Excel | ✅ |
| 10 | 🔐 PIN lock + login lokal | ✅ |
| 11 | 👥 Multi-user (admin/kasir) | ✅ |
| 12 | 🌐 100% offline, tanpa cloud | ✅ |
| 13 | 📲 PWA — install seperti app desktop/HP + ikon di layar | ✅ |
| 14 | 💵 Laporan kas harian (tunai diterima / kembalian) | ✅ |

---

## 📲 Install sebagai Aplikasi (PWA)

KasirKu AI adalah **PWA (Progressive Web App)** — bisa dipasang seperti aplikasi biasa:

1. Buka `http://localhost:3000` lewat **`start-kasirku.bat`** atau browser
2. Klik tombol **"Install App"** di pojok kanan bawah (atau ikon install di address bar Chrome/Edge)
3. Aplikasi muncul di Start Menu / desktop dengan ikon sendiri — tanpa address bar
4. Setelah terpasang, buka instan dan tetap berfungsi penuh **tanpa internet**

**Di HP** (jaringan sama dengan laptop, mode dev `-H 0.0.0.0`): buka URL di Chrome → menu ⋮ → **Tambahkan ke layar utama**.

> Catatan: service worker meng-cache halaman yang pernah dibuka. Untuk coverage offline penuh, buka sekali semua menu (Kasir, Produk, Dashboard, dll.) saat pertama install.

---

## 💵 Laporan Kas Harian

Setiap transaksi cash menyimpan **uang diterima** dan **kembalian** ke database. Dashboard menampilkan ringkasan kas hari ini:

- **Tunai Diterima** — total uang fisik yang masuk ke laci
- **Kembalian Diberikan** — total uang yang keluar
- **Kas Bersih** — selisih keduanya (angka yang seharusnya ada di laci)

---

## 💾 Database Schema (IndexedDB)

Database: **`KasirKuAI_Local`** (Dexie v3, tersimpan di browser laptop Anda)

| Tabel | Isi |
|---|---|
| `users` | Akun (nama, email, password hash, peran, toko) |
| `suppliers` | Supplier (nama, kontak, alamat) |
| `products` | Produk (nama, SKU, barcode, harga beli/jual, stok, gambar base64, harga bertingkat) |
| `transactions` | Transaksi (total, metode bayar, timestamp) |
| `transaction_items` | Item per transaksi (+ snapshot harga beli untuk laporan profit) |
| `purchase_orders` | Reserved untuk pengembangan |
| `sync_queue` | Reserved (tidak dipakai — mode local-only permanen) |

---

## 🔄 Backup & Restore

### Backup
1. Menu **Backup** → **Download Backup**
2. File `kasirku-backup-YYYY-MM-DD.json` terdownload
3. Simpan ke Google Drive / flashdisk / email

**Rekomendasi: minimal 1x seminggu.**

### Restore (mis. pindah laptop / browser baru)
1. Menu **Backup** → **Upload Backup**
2. Pilih file JSON → konfirmasi
3. Semua data diganti dengan isi backup

⚠️ Restore **menimpa** data saat ini. Backup dulu sebelum restore.

---

## ❓ FAQ

**Q: "SELAMA ONLINE MAKA ONLINE" — apakah app butuh internet?**
Tidak. Internet online atau tidak, aplikasi tetap berfungsi penuh karena semua data & logika ada di localhost. Tidak ada satu pun request ke server eksternal.

**Q: Apakah bisa diakses dari HP di jaringan yang sama?**
Bisa, dengan mode dev: `npm run dev -- -H 0.0.0.0` lalu buka `http://<IP-laptop>:3000` dari HP. Catatan: IndexedDB per-browser-per-perangkat, jadi data di HP terpisah dari laptop. Gunakan backup JSON untuk memindahkan.

**Q: Bagaimana menghapus semua data?**
Hapus site data browser untuk `localhost:3000` (DevTools → Application → Storage → Clear site data), atau jalankan restore dengan backup kosong.

**Q: Kenapa struk tidak muncul?**
Pop-up blocker. Izinkan pop-up untuk `localhost:3000`.

**Q: Apakah password & PIN aman?**
Password di-hash SHA-256 + salt unik per akun; PIN juga di-hash. Karena datanya hanya di laptop Anda, risiko kebocoran ke internet adalah nol — tidak ada yang bisa diserang dari luar.

---

## 📄 Lisensi

MIT — bebas dipakai dan dimodifikasi untuk UMKM Anda.
