"use client";
import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import db from "@/lib/db";
import { transactionService, type CartItem } from "@/lib/dbHelpers";
import { useAuth } from "@/lib/auth";
import { printReceipt, type ReceiptData } from "@/lib/printReceipt";
import BarcodeScanner from "@/lib/components/BarcodeScanner";
import DevicesModal from "@/lib/components/DevicesModal";
import {
  isPrinterConnected,
  printReceiptToBluetooth,
  connectScanner,
  getAutoPrint,
} from "@/lib/hidDevices";
import { ScanBarcode, Printer, Search, Package, Trash2, Percent, RotateCcw, X } from "lucide-react";
import { getTiers, resolveTierPrice, findActiveTier, formatRp, type TierHarga } from "@/lib/tierPricing";

const CASH_PRESETS = [5000, 10000, 20000, 50000, 100000];

export default function KasirPage() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showScanner, setShowScanner] = useState(false);
  const [lastTrx, setLastTrx] = useState<ReceiptData | null>(null);
  const [search, setSearch] = useState("");
  const [payModal, setPayModal] = useState(false);
  const [bayar, setBayar] = useState("");
  const [showDevices, setShowDevices] = useState(false);
  const [printerOn, setPrinterOn] = useState(false);
  const { user } = useAuth();
  const produk = useLiveQuery(() => db.products.toArray(), []) || [];

  const filtered = search.trim()
    ? produk.filter(
        (p) =>
          p.nama_produk?.toLowerCase().includes(search.toLowerCase()) ||
          p.sku?.toLowerCase().includes(search.toLowerCase()) ||
          p.barcode?.includes(search.trim())
      )
    : produk;

  const addToCart = (p: CartItem) => {
    const exist = cart.find((c) => c.id === p.id);
    if (exist) {
      if (exist.qty + 1 > p.stok) return alert(`Stok ${p.nama_produk} hanya ${p.stok}!`);
      // Naikkan qty; jika masih mode otomatis, harga ikut tier terbaik untuk qty baru
      setCart(
        cart.map((c) =>
          c.id === p.id
            ? {
                ...c,
                qty: c.qty + 1,
                harga_manual: c.harga_manual ?? resolveTierPrice(p, c.qty + 1),
              }
            : c
        )
      );
    } else {
      if (p.stok <= 0) return alert(`Stok ${p.nama_produk} habis!`);
      setCart([...cart, { ...p, qty: 1, harga_manual: null }]);
    }
  };

  const updateQty = (id: number, delta: number) => {
    const item = cart.find((c) => c.id === id);
    const prod = produk.find((p) => p.id === id);
    if (!item) return;
    const newQty = item.qty + delta;
    if (newQty <= 0) {
      setCart(cart.filter((c) => c.id !== id));
    } else if (prod && newQty > prod.stok) {
      alert(`Stok ${prod.nama_produk} hanya ${prod.stok}!`);
    } else {
      setCart(
        cart.map((c) =>
          c.id === id
            ? {
                ...c,
                qty: newQty,
                harga_manual:
                  c.harga_manual != null && c.harga_manual !== resolveTierPrice(prod, newQty)
                    ? c.harga_manual
                    : resolveTierPrice(prod, newQty),
              }
            : c
        )
      );
    }
  };

  /** Checklist tier di keranjang: null = otomatis sesuai qty */
  const setTierMode = (id: number, harga: number | null) => {
    setCart(cart.map((c) => (c.id === id ? { ...c, harga_manual: harga } : c)));
  };

  const removeItem = (id: number) => setCart(cart.filter((c) => c.id !== id));

  // ============ BARCODE SCAN HANDLER ============
  const playBeep = (ok: boolean) => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = ok ? 800 : 300;
      gain.gain.value = 0.1;
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } catch {
      // Audio tidak tersedia — abaikan
    }
  };

  const handleBarcodeDetected = (barcode: string) => {
    setShowScanner(false);
    const found = produk.find((p) => p.barcode === barcode || p.sku === barcode);
    if (found) {
      addToCart(found as CartItem);
      playBeep(true);
    } else {
      playBeep(false);
      alert(`❌ Produk dengan barcode "${barcode}" tidak ditemukan`);
    }
  };

  // Scanner hardware (USB) mengetik barcode lalu Enter — tangkap di level dokumen
  useEffect(() => {
    let buffer = "";
    let timer: ReturnType<typeof setTimeout> | undefined;
    const KEYPRESS_MS = 50; // scanner mengetik sangat cepat; manusia jauh lebih lambat
    const isTyping = (el: EventTarget | null) => {
      const t = el as HTMLElement | null;
      return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        if (buffer) {
          e.preventDefault();
          handleBarcodeDetected(buffer);
          buffer = "";
        }
        return;
      }
      if (e.key.length === 1 && !isTyping(e.target)) {
        clearTimeout(timer);
        buffer += e.key;
        timer = setTimeout(() => (buffer = ""), KEYPRESS_MS * 20);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      clearTimeout(timer);
    };
  });

  const itemHarga = (item: CartItem) =>
    item.harga_manual != null && item.harga_manual > 0 ? item.harga_manual : resolveTierPrice(item, item.qty);
  const itemSubtotal = (item: CartItem) => itemHarga(item) * item.qty;

  // ============ CHECKOUT + PRINT ============
  const handleCheckout = async (metode: string, uangBayar?: number) => {
    if (cart.length === 0) return alert("Keranjang kosong!");
    try {
      const total = cart.reduce((s, i) => s + itemSubtotal(i), 0);
      if (metode === "cash" && uangBayar != null && uangBayar < total) {
        return alert("Uang bayar kurang dari total!");
      }

      await transactionService.createTransaction(
        cart,
        metode,
        metode === "cash" && uangBayar != null
          ? { uang_bayar: uangBayar, kembalian: Math.max(0, uangBayar - total) }
          : undefined
      );

      const trxData: ReceiptData = {
        toko: user?.nama_toko || "Toko UMKM Saya",
        alamat: user?.alamat_toko || "",
        telepon: user?.telepon_toko || "",
        items: cart.map((c) => ({
          nama_produk: c.nama_produk,
          qty: c.qty,
          harga_jual: itemHarga(c),
          subtotal: itemSubtotal(c),
        })),
        total,
        metode_bayar: metode,
        uang_bayar: metode === "cash" ? (uangBayar ?? total) : undefined,
        kembalian: metode === "cash" ? Math.max(0, (uangBayar ?? total) - total) : undefined,
        tanggal: new Date().toLocaleString("id-ID"),
        nomor_transaksi: Date.now().toString().slice(-6),
      };

      setLastTrx(trxData);

      // Cetak: printer Bluetooth plug-n-play dulu (tanpa dialog); gagal → fallback popup
      if (isPrinterConnected() && getAutoPrint()) {
        try {
          await printReceiptToBluetooth(trxData);
        } catch {
          printReceipt(trxData);
        }
      } else {
        printReceipt(trxData);
      }
      setCart([]);
    } catch (err) {
      alert("❌ Error: " + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handleReprint = () => {
    if (!lastTrx) return;
    if (isPrinterConnected()) {
      printReceiptToBluetooth(lastTrx).catch(() => printReceipt(lastTrx));
    } else {
      printReceipt(lastTrx);
    }
  };

  // Scanner HID plug-n-play: aktif otomatis saat ada scanner ter-pair (WebHID).
  // USB scanner mode keyboard tetap ditangkap handler keydown dokumen.
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    connectScanner((kode) => handleBarcodeDetected(kode))
      .then((fn) => (cleanup = fn))
      .catch(() => {}); // belum ter-pair / tidak tersambung — abaikan
    return () => cleanup?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [produk]);

  // Indikator printer di-refresh lewat onDeviceChange dari modal (bukan effect,
  // untuk menghindari setState langsung dalam effect).

  const total = cart.reduce((s, i) => s + itemSubtotal(i), 0);

  return (
    <div className="p-4 grid grid-cols-1 lg:grid-cols-3 gap-4 max-w-6xl mx-auto">
      {/* KIRI: Daftar Produk */}
      <div className="lg:col-span-2">
        <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
          <h2 className="text-2xl font-bold text-gray-800">🛒 Pilih Produk</h2>
          <button
            onClick={() => setShowScanner(true)}
            className="flex items-center gap-2 bg-navy text-white px-4 py-2 rounded-lg hover:bg-navy-deep active:scale-95 text-sm font-semibold"
          >
            <ScanBarcode size={18} />
            Scan Barcode
          </button>
          <button
            onClick={() => setShowDevices(true)}
            title="Printer & scanner plug-n-play"
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${
              printerOn
                ? "bg-olive text-white border-olive"
                : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
            }`}
          >
            <Printer size={18} />
            <span className="hidden sm:inline">Perangkat</span>
          </button>
        </div>

        {/* Pencarian */}
        <div className="relative mb-4">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari produk untuk ditambahkan..."
            className="w-full bg-white border border-gray-200 rounded-lg pl-9 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-navy focus:border-navy outline-none"
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {filtered.map((p) => (
            <div
              key={p.id}
              onClick={() => addToCart(p as CartItem)}
              className={`bg-white rounded-lg shadow-sm border border-gray-100 cursor-pointer hover:shadow-md active:scale-95 transition-all overflow-hidden ${
                p.stok <= 0 ? "opacity-50" : ""
              }`}
            >
              <div className="w-full h-28 bg-gray-100 flex items-center justify-center overflow-hidden">
                {p.gambar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.gambar} alt={p.nama_produk} className="w-full h-full object-cover" />
                ) : (
                  <Package size={32} className="text-gray-300" />
                )}
              </div>
              <div className="p-2.5">
                <div className="font-semibold text-gray-800 text-sm truncate">{p.nama_produk}</div>
                <div className="text-navy font-bold text-sm">
                  Rp {Number(p.harga_jual).toLocaleString()}
                </div>
                <div
                  className={`text-xs mt-1 ${
                    p.stok <= 0
                      ? "text-red-500 font-bold"
                      : p.stok <= (p.stok_minimal ?? 10)
                        ? "text-[#8A795C] font-bold"
                        : "text-gray-500"
                  }`}
                >
                  {p.stok <= 0 ? "Stok habis" : `Stok: ${p.stok}`}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* KANAN: Keranjang */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 h-fit lg:sticky lg:top-20">
        <h2 className="text-xl font-bold mb-4 text-gray-800">🧾 Keranjang ({cart.length})</h2>

        <div className="max-h-72 overflow-y-auto mb-4">
          {cart.length === 0 && (
            <p className="text-gray-400 text-sm text-center py-8">Keranjang kosong</p>
          )}
          {cart.map((item) => {
            const tiers: TierHarga[] = getTiers(item);
            const active = itemHarga(item);
            const autoTier = findActiveTier(item, item.qty);
            return (
              <div key={item.id} className="border-b py-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2 min-w-0">
                    {item.gambar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.gambar}
                        alt={item.nama_produk}
                        className="w-8 h-8 object-cover rounded shrink-0"
                      />
                    ) : null}
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{item.nama_produk}</div>
                      <div className="text-xs text-gray-500">
                        {formatRp(active)} × {item.qty} = <b className="text-gray-700">{formatRp(itemSubtotal(item))}</b>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => updateQty(item.id, -1)}
                      className="w-6 h-6 rounded border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm leading-none"
                    >
                      −
                    </button>
                    <span className="text-sm font-semibold w-5 text-center">{item.qty}</span>
                    <button
                      onClick={() => updateQty(item.id, 1)}
                      className="w-6 h-6 rounded border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm leading-none"
                    >
                      +
                    </button>
                    <button onClick={() => removeItem(item.id)} className="text-red-400 hover:text-red-600 ml-1">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* CHECKLIST HARGA BERTINGKAT */}
                {tiers.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-1">
                    <Percent size={11} className="text-sage/70 shrink-0" />
                    <button
                      onClick={() => setTierMode(item.id, null)}
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border transition-colors ${
                        item.harga_manual == null
                          ? "bg-sage border-sage text-white"
                          : "border-gray-200 text-gray-500 hover:border-sage/40"
                      }`}
                      title="Harga otomatis mengikuti qty"
                    >
                      Otomatis{autoTier ? ` (${autoTier.qty}+)` : ""}
                    </button>
                    {tiers.map((t) => {
                      const isActive = item.harga_manual === t.harga && (!autoTier || autoTier.qty !== t.qty || item.harga_manual != null);
                      const qualifies = item.qty >= t.qty;
                      return (
                        <button
                          key={t.qty}
                          onClick={() => setTierMode(item.id, t.harga)}
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border transition-colors ${
                            isActive
                              ? "bg-sage border-sage text-white"
                              : qualifies
                                ? "border-emerald-200 bg-sage/10 text-sage-deep hover:border-sage/60"
                                : "border-dashed border-gray-200 text-gray-400 hover:border-sage/40"
                          }`}
                          title={`Beli ${t.qty}+: ${formatRp(t.harga)}/pcs${qualifies ? "" : " (qty belum cukup)"}`}
                        >
                          {t.qty}+: {t.harga.toLocaleString("id-ID")}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="border-t pt-3">
          {cart.some((c) => c.harga_manual != null) && (
            <button
              onClick={() => setCart(cart.map((c) => ({ ...c, harga_manual: null })))}
              className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-sage hover:text-sage-deep mb-2"
            >
              <RotateCcw size={12} /> Reset semua harga ke otomatis
            </button>
          )}
          <div className="flex justify-between text-lg font-bold mb-3">
            <span>Total:</span>
            <span className="text-navy">Rp {total.toLocaleString("id-ID")}</span>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-2">
            <button
              onClick={() => {
                setBayar("");
                setPayModal(true);
              }}
              className="bg-olive text-white py-2.5 rounded-lg hover:bg-olive-deep text-sm font-semibold"
            >
              💵 Cash
            </button>
            <button
              onClick={() => handleCheckout("qris")}
              className="bg-powder text-white py-2.5 rounded-lg hover:bg-powder/80 text-sm font-semibold"
            >
              📱 QRIS
            </button>
            <button
              onClick={() => handleCheckout("transfer")}
              className="bg-navy text-white py-2.5 rounded-lg hover:bg-navy-deep text-sm font-semibold"
            >
              🏦 TF
            </button>
          </div>

          {lastTrx && (
            <button
              onClick={handleReprint}
              className="w-full flex items-center justify-center gap-2 border border-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-50 text-sm mt-2"
            >
              <Printer size={14} />
              Print Ulang Struk
            </button>
          )}
        </div>
      </div>

      {/* MODAL SCANNER */}
      {showScanner && (
        <BarcodeScanner
          onDetected={handleBarcodeDetected}
          onClose={() => setShowScanner(false)}
        />
      )}

      {/* MODAL BAYAR CASH */}
      {payModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-800">💵 Pembayaran Cash</h3>
              <button onClick={() => setPayModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <p className="text-sm text-gray-500 mb-1">Total belanja</p>
            <p className="text-2xl font-bold text-navy mb-4">Rp {total.toLocaleString("id-ID")}</p>

            <label className="block text-sm font-semibold text-gray-700 mb-1">Uang diterima</label>
            <input
              type="number"
              min={0}
              autoFocus
              value={bayar}
              onChange={(e) => setBayar(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const n = Number(bayar);
                  if (!bayar || n < total) return; // Enter hanya konfirmasi jika valid
                  setPayModal(false);
                  handleCheckout("cash", n);
                }
              }}
              placeholder={String(total)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-lg font-semibold focus:ring-2 focus:ring-olive focus:border-olive outline-none"
            />

            <div className="grid grid-cols-4 gap-1.5 mt-3">
              {CASH_PRESETS.map((v) => (
                <button
                  key={v}
                  onClick={() => setBayar(String(v))}
                  className="border border-gray-200 rounded-lg py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 active:scale-95"
                >
                  {v >= 1000 ? `${v / 1000}rb` : v}
                </button>
              ))}
              <button
                onClick={() => setBayar(String(total))}
                className="col-span-3 border border-gray-200 rounded-lg py-1.5 text-xs font-semibold text-navy hover:bg-navy/5 active:scale-95"
              >
                Uang pas
              </button>
            </div>

            {Number(bayar) >= total && bayar !== "" && (
              <p className="mt-3 text-center text-sm">
                Kembalian: <b className="text-olive">Rp {(Number(bayar) - total).toLocaleString("id-ID")}</b>
              </p>
            )}

            <button
              onClick={() => {
                const n = Number(bayar);
                if (!bayar || n < total) return alert("Uang bayar kurang dari total!");
                setPayModal(false);
                handleCheckout("cash", n);
              }}
              className="w-full bg-olive text-white py-3 rounded-lg hover:bg-olive-deep font-semibold mt-4 disabled:opacity-50"
              disabled={!bayar || Number(bayar) < total}
            >
              Selesaikan Transaksi
            </button>
          </div>
        </div>
      )}

      <DevicesModal
        open={showDevices}
        onClose={() => setShowDevices(false)}
        onDeviceChange={() => setPrinterOn(isPrinterConnected())}
      />
    </div>
  );
}
