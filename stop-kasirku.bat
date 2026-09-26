@echo off
REM ============================================================
REM  KasirKu AI - Mematikan server localhost:3000
REM ============================================================
setlocal EnableExtensions
title KasirKu AI - Stop Server

netstat -ano | findstr ":3000 " | findstr "LISTENING" >nul 2>nul
if errorlevel 1 (
  echo Server tidak sedang berjalan.
  timeout /t 2 >nul
  exit /b 0
)

echo Mematikan server KasirKu AI...
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":3000 " ^| findstr "LISTENING"') do (
  taskkill /PID %%P /F >nul 2>nul
)

REM Tunggu sebentar lalu verifikasi
timeout /t 1 >nul
netstat -ano | findstr ":3000 " | findstr "LISTENING" >nul 2>nul
if errorlevel 1 (
  echo Server dimatikan. Data tetap aman di browser ^(IndexedDB^).
) else (
  echo Port 3000 masih terpakai - coba jalankan lagi atau matikan manual via Task Manager.
)
timeout /t 2 >nul
