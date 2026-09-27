# Changelog

Semua perubahan penting pada project ini didokumentasikan di file ini.
Format mengikuti [Keep a Changelog](https://keepachangelog.com/id/1.1.0/);
versi mengikuti [Semantic Versioning](https://semver.org/lang/id/).

## [Unreleased]

## [0.1.0] - 2026-09-27

Rilis pertama.

### Ditambahkan

- 🛒 Kasir POS: keranjang real-time, scan barcode via kamera & USB scanner, beep, struk thermal 58mm / save PDF
- 💵 Pembayaran tunai dengan preset nominal, tombol uang pas, validasi, checkout via Enter; QRIS & Transfer
- 📦 CRUD produk + gambar auto-compress, harga grosir bertingkat, import/export Excel (lazy-loaded)
- 🏭 Manajemen supplier
- 📊 Dashboard grafik penjualan (SVG murni) + laporan kas harian (tunai diterima / kembalian / kas bersih)
- 🧮 Tutup kas: rekap, kas fisik, selisih otomatis, riwayat (tabel `cash_sessions`)
- 🔐 Login lokal multi-user (admin/kasir), sesi localStorage, quick-lock layar dengan PIN per perangkat
- 💾 Backup & restore JSON 1 klik (menyertakan users & purchase orders)
- 📲 PWA offline-first: install seperti app desktop/HP, service worker precache 11 route, halaman /offline
- 🪟 Launcher Windows 1 klik (`start-kasirku.bat` / `stop-kasirku.bat`)
- 🤖 CI GitHub Actions (typecheck + lint + build) dan release otomatis per tag `v*` (zip + SHA256)

### Keamanan

- Password & PIN di-hash SHA-256 + salt unik; semua data tetap di laptop pengguna (IndexedDB), tanpa cloud
