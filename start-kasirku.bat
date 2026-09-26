@echo off
REM ============================================================
REM  KasirKu AI - Launcher 1 Klik (Windows)
REM  Memulai server lokal lalu membuka aplikasi di browser.
REM  Install sebagai aplikasi (PWA): klik tombol "Install App"
REM  di pojok kanan bawah setelah aplikasi terbuka.
REM ============================================================
setlocal EnableExtensions
title KasirKu AI - POS UMKM Offline
cd /d "%~dp0"

REM ---- 1. Pastikan Node.js terpasang ----
where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js tidak ditemukan!
  echo Silakan install dari https://nodejs.org ^(versi 20 atau lebih baru^), lalu jalankan lagi.
  pause
  exit /b 1
)

REM ---- 2. Install dependencies jika belum ada ----
if not exist "node_modules\" (
  echo [1/3] Pertama kali: menginstall dependencies... ^(butuh internet sekali saja^)
  call npm install
  if errorlevel 1 (
    echo [ERROR] npm install gagal. Periksa koneksi internet lalu coba lagi.
    pause
    exit /b 1
  )
)

REM ---- 3. Build produksi jika belum ada (lebih cepat & stabil utk harian) ----
if not exist ".next\BUILD_ID" (
  echo [2/3] Membangun aplikasi ^(sekali saja, beberapa detik^)...
  call npm run build
  if errorlevel 1 (
    echo [ERROR] Build gagal. Jalankan "npm run build" secara manual untuk melihat error.
    pause
    exit /b 1
  )
)

REM ---- 4. Cek apakah server sudah jalan di port 3000 ----
netstat -ano | findstr ":3000 " | findstr "LISTENING" >nul 2>nul
if not errorlevel 1 (
  echo [3/3] Server sudah berjalan - membuka browser...
  start "" http://localhost:3000
  echo.
  echo   KasirKu AI terbuka di browser. Minimize jendela ini TIDAK mematikan server.
  echo   Untuk mematikan: jalankan stop-kasirku.bat
  timeout /t 4 >nul
  exit /b 0
)

REM ---- 5. Start server + buka browser otomatis ----
echo [3/3] Memulai server KasirKu AI...
echo.
echo   ============================================
echo     KasirKu AI berjalan di: http://localhost:3000
echo     BIARKAN jendela ini terbuka selama dipakai.
echo     Untuk mematikan: jalankan stop-kasirku.bat
echo   ============================================
echo.
start "" http://localhost:3000
call npm run start
