"use client";
import { useEffect, useState } from "react";
import { X, Bluetooth, ScanBarcode, Printer, TestTube2, Unplug, Zap, PlugZap } from "lucide-react";
import {
  getSavedPrinter,
  requestPrinterPairing,
  printTestPage,
  disconnectPrinter,
  clearPrinter,
  isPrinterConnected,
  getAutoPrint,
  setAutoPrint,
  getSavedScanner,
  requestScannerPairing,
  clearScanner,
  isBluetoothSupported,
  isWebHIDSupported,
} from "@/lib/hidDevices";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Dipanggil saat status printer/scanner berubah agar halaman kasir ikut update */
  onDeviceChange?: () => void;
}

export default function DevicesModal({ open, onClose, onDeviceChange }: Props) {
  const [printer, setPrinter] = useState<{ id: string; name: string } | null>(null);
  const [printerConnected, setPrinterConnected] = useState(false);
  const [autoPrint, setAutoPrintState] = useState(true);
  const [scanner, setScanner] = useState<{ key: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = () => {
    setPrinter(getSavedPrinter());
    setPrinterConnected(isPrinterConnected());
    setAutoPrintState(getAutoPrint());
    setScanner(getSavedScanner());
  };

  useEffect(() => {
    if (!open) return;
    // defer via setTimeout 0 — hindari setState langsung di effect (react-hooks/set-state-in-effect)
    const t = setTimeout(() => {
      refresh();
      setMsg(null);
    }, 0);
    return () => clearTimeout(t);
  }, [open]);

  if (!open) return null;

  const notify = () => onDeviceChange?.();

  const handlePairPrinter = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const p = await requestPrinterPairing(); // auto-connect + simpan referensi sesi
      setPrinter(p);
      setPrinterConnected(isPrinterConnected());
      setMsg(`✅ Printer "${p.name}" terhubung`);
      notify();
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      setMsg(m.includes("cancel") || m.includes("pilih") ? null : "❌ " + m);
    } finally {
      setBusy(false);
    }
  };

  const handleTest = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await printTestPage();
      setMsg("✅ Halaman tes terkirim ke printer");
    } catch (e) {
      setMsg("❌ " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  };

  const handleUnpairPrinter = () => {
    disconnectPrinter();
    clearPrinter();
    refresh();
    setMsg("Printer dilupakan");
    notify();
  };

  const handlePairScanner = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const s = await requestScannerPairing();
      setScanner(s);
      setMsg(`✅ Scanner "${s.name}" tersimpan`);
      notify();
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      setMsg(m.includes("cancel") || m.includes("pilih") ? null : "❌ " + m);
    } finally {
      setBusy(false);
    }
  };

  const handleUnpairScanner = () => {
    clearScanner();
    refresh();
    setMsg("Scanner dilupakan");
    notify();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-800 text-lg">Perangkat Plug-n-Play</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" title="Tutup">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {!isBluetoothSupported() && !isWebHIDSupported() && (
            <p className="text-sm text-gray-500 bg-cream-soft border border-cream rounded-lg p-3">
              Browser ini tidak mendukung Web Bluetooth/WebHID. Gunakan Chrome atau Edge di desktop.
            </p>
          )}

          {/* ===== PRINTER ===== */}
          <section className="border border-gray-100 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 font-semibold text-gray-800">
                <Bluetooth size={18} className="text-navy" /> Printer Struk Bluetooth
              </div>
              {printer && (
                <span
                  className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                    printerConnected ? "bg-olive text-white" : "bg-cream text-gray-600"
                  }`}
                >
                  {printerConnected ? "Terhubung" : "Perlu sambung"}
                </span>
              )}
            </div>

            {printer ? (
              <>
                <p className="text-sm text-gray-600 mb-3">
                  🖨️ {printer.name}
                  {printerConnected && <span className="text-olive font-medium"> — siap cetak</span>}
                </p>
                <div className="flex flex-wrap gap-2">
                  {!printerConnected && (
                    <button
                      onClick={handlePairPrinter}
                      disabled={busy}
                      className="flex items-center gap-1.5 bg-navy text-white px-3 py-2 rounded-lg text-sm font-semibold hover:bg-navy-deep disabled:opacity-50"
                    >
                      <PlugZap size={15} /> Sambungkan
                    </button>
                  )}
                  <button
                    onClick={handleTest}
                    disabled={busy || !printerConnected}
                    className="flex items-center gap-1.5 bg-white border border-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
                  >
                    <TestTube2 size={15} /> Tes Cetak
                  </button>
                  <button
                    onClick={handleUnpairPrinter}
                    className="flex items-center gap-1.5 text-red-600 text-sm px-3 py-2 rounded-lg hover:bg-red-50"
                  >
                    <Unplug size={15} /> Lupakan
                  </button>
                </div>
                <label className="flex items-center gap-2 mt-3 text-sm text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoPrint}
                    onChange={(e) => {
                      setAutoPrint(e.target.checked);
                      setAutoPrintState(e.target.checked);
                    }}
                    className="w-4 h-4 accent-[#1d2733]"
                  />
                  <Zap size={14} className="text-cream" />
                  Otomatis cetak struk saat checkout
                </label>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-500 mb-3">
                  Pair sekali — setelah itu cukup satu klik untuk sambung ulang. Struk dikirim langsung
                  via ESC/POS (58mm) tanpa dialog print.
                </p>
                <button
                  onClick={handlePairPrinter}
                  disabled={busy || !isBluetoothSupported()}
                  className="flex items-center gap-2 bg-navy text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-navy-deep disabled:opacity-50"
                >
                  <Printer size={15} /> Pair Printer
                </button>
              </>
            )}
          </section>

          {/* ===== SCANNER ===== */}
          <section className="border border-gray-100 rounded-xl p-4">
            <div className="flex items-center gap-2 font-semibold text-gray-800 mb-3">
              <ScanBarcode size={18} className="text-sage" /> Barcode Scanner (WebHID)
            </div>
            {scanner ? (
              <>
                <p className="text-sm text-gray-600 mb-3">
                  🔍 {scanner.name} <span className="text-gray-400">— aktif otomatis saat tersambung</span>
                </p>
                <button
                  onClick={handleUnpairScanner}
                  className="flex items-center gap-1.5 text-red-600 text-sm px-3 py-2 rounded-lg hover:bg-red-50"
                >
                  <Unplug size={15} /> Lupakan
                </button>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-500 mb-3">
                  Pair scanner USB/BT-dongle sekali; hasil scan langsung masuk keranjang. Scanner mode
                  keyboard biasa (USB) tetap didukung tanpa pairing.
                </p>
                <button
                  onClick={handlePairScanner}
                  disabled={busy || !isWebHIDSupported()}
                  className="flex items-center gap-2 bg-sage text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-sage-deep disabled:opacity-50"
                >
                  <ScanBarcode size={15} /> Pair Scanner
                </button>
              </>
            )}
          </section>

          {msg && <p className="text-sm text-center text-gray-600 bg-gray-50 rounded-lg p-2.5">{msg}</p>}
        </div>
      </div>
    </div>
  );
}
