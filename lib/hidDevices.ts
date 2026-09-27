// ============================================
// PERANGKAT PLUG-N-PLAY
// Printer thermal Bluetooth (Web Bluetooth + ESC/POS)
// & barcode scanner USB/Bluetooth HID (WebHID)
//
// Plug-n-play: perangkat di-pair SEKALI (dipilih via dialog browser),
// disimpan di localStorage, lalu otomatis di-reconnect setiap aplikasi dibuka.
// Tanpa driver, tanpa konfigurasi tambahan.
// ============================================

import type { ReceiptData } from "./printReceipt";

// ---------- Tipe minimal Web Bluetooth / WebHID (DOM lib belum menyediakan) ----------

interface BluetoothRemoteGATTCharacteristicLike {
  writeValue(value: BufferSource): Promise<void>;
  writeValueWithoutResponse?(value: BufferSource): Promise<void>;
}

interface BluetoothServiceLike {
  getCharacteristic(uuid: string): Promise<BluetoothRemoteGATTCharacteristicLike>;
}

interface BluetoothServerLike {
  connect(): Promise<BluetoothServerLike>;
  getPrimaryService(uuid: string): Promise<BluetoothServiceLike>;
  disconnect(): void;
  connected: boolean;
}

interface BluetoothDeviceLike {
  id: string;
  name?: string;
  gatt?: BluetoothServerLike;
}

interface BluetoothLike {
  requestDevice(options: {
    acceptAllDevices?: boolean;
    filters?: Array<{ services?: string[] }>;
    optionalServices?: string[];
  }): Promise<BluetoothDeviceLike>;
}

interface HIDInputEventLike {
  data: DataView;
  device: { product?: { name?: string } };
}

interface HIDDeviceLike {
  opened: boolean;
  productName?: string;
  vendorId: number;
  productId: number;
  collections?: unknown[];
  open(): Promise<void>;
  close(): Promise<void>;
  addEventListener(type: "inputreport", listener: (e: HIDInputEventLike) => void): void;
  removeEventListener(type: "inputreport", listener: (e: HIDInputEventLike) => void): void;
}

interface HIDLike {
  requestDevice(options: { filters: unknown[] }): Promise<HIDDeviceLike[]>;
  getDevices(): Promise<HIDDeviceLike[]>;
}

declare global {
  interface Navigator {
    bluetooth?: BluetoothLike;
    hid?: HIDLike;
  }
}

// ---------- Penyimpanan perangkat ter-pair ----------

const PRINTER_KEY = "kasirku_printer";
const SCANNER_KEY = "kasirku_scanner";
const AUTOPRINT_KEY = "kasirku_autoprint_bt";

export interface PairedPrinter {
  id: string;
  name: string;
}

export interface PairedScanner {
  /** key "vendorId:productId" untuk pencocokan ulang via getDevices() */
  key: string;
  name: string;
}

export const isBluetoothSupported = () =>
  typeof navigator !== "undefined" && !!navigator.bluetooth?.requestDevice;
export const isWebHIDSupported = () =>
  typeof navigator !== "undefined" && !!navigator.hid?.requestDevice;

export function getSavedPrinter(): PairedPrinter | null {
  try {
    const raw = localStorage.getItem(PRINTER_KEY);
    return raw ? (JSON.parse(raw) as PairedPrinter) : null;
  } catch {
    return null;
  }
}
export function savePrinter(p: PairedPrinter) {
  localStorage.setItem(PRINTER_KEY, JSON.stringify(p));
}
export function clearPrinter() {
  localStorage.removeItem(PRINTER_KEY);
}

export function getSavedScanner(): PairedScanner | null {
  try {
    const raw = localStorage.getItem(SCANNER_KEY);
    return raw ? (JSON.parse(raw) as PairedScanner) : null;
  } catch {
    return null;
  }
}
export function saveScanner(s: PairedScanner) {
  localStorage.setItem(SCANNER_KEY, JSON.stringify(s));
}
export function clearScanner() {
  localStorage.removeItem(SCANNER_KEY);
}

export function getAutoPrint(): boolean {
  return localStorage.getItem(AUTOPRINT_KEY) !== "0"; // default: aktif
}
export function setAutoPrint(on: boolean) {
  localStorage.setItem(AUTOPRINT_KEY, on ? "1" : "0");
}

// ---------- Pairing (dipanggil dari gesture user / tombol) ----------

/** Buka dialog pilih printer Bluetooth. SIMPALAN: user pilih 1x, selanjutnya auto-reconnect. */
export async function requestPrinterPairing(): Promise<PairedPrinter> {
  if (!navigator.bluetooth) throw new Error("Browser tidak mendukung Web Bluetooth");
  const device = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: [ESCPOS_SERVICE_UUID],
  });
  const printer = { id: device.id, name: device.name || "Printer Bluetooth" };
  savePrinter(printer);

  // Coba sambungkan langsung & simpan referensi sesi agar auto-reconnect berikutnya bekerja
  try {
    if (device.gatt) {
      await device.gatt.connect();
      rememberConnectedPrinter(device);
    }
  } catch {
    // printer mungkin sedang mati — status "Perlu sambung" tampil di modal
  }
  return printer;
}

/** Buka dialog pilih scanner HID (USB/Bluetooth dongle keyboard-emulation). */
export async function requestScannerPairing(): Promise<PairedScanner> {
  if (!navigator.hid) throw new Error("Browser tidak mendukung WebHID");
  const devices = await navigator.hid.requestDevice({ filters: [] });
  const dev = devices[0];
  if (!dev) throw new Error("Tidak ada scanner dipilih");
  const scanner = {
    key: `${dev.vendorId}:${dev.productId}`,
    name: dev.productName || "Scanner HID",
  };
  saveScanner(scanner);
  return scanner;
}

// ---------- ESC/POS ----------

const ESCPOS_SERVICE_UUID = "000018f0-0000-1000-8000-00805f9b34fb"; // standar printer thermal BLE
const ESCPOS_CHAR_UUID = "00002af1-0000-1000-8000-00805f9b34fb";
const LINE_W = 32; // 58mm ≈ 32 kolom

const enc = new TextEncoder();
const center = () => new Uint8Array([0x1b, 0x61, 0x01]);
const alignLeft = () => new Uint8Array([0x1b, 0x61, 0x00]);
const bigOn = () => new Uint8Array([0x1b, 0x21, 0x30]); // double height + width
const bigOff = () => new Uint8Array([0x1b, 0x21, 0x00]);
const cut = () => new Uint8Array([0x1d, 0x56, 0x42, 0x00]);
const text = (s: string) => enc.encode(s + "\n");

function row(left: string, right: string, w = LINE_W): Uint8Array {
  const space = Math.max(1, w - left.length - right.length);
  return text(left + " ".repeat(space) + right);
}

const divider = () => text("-".repeat(LINE_W));

/** Susun byte struk ESC/POS dari data struk yang sama dengan versi popup. */
export function buildEscPosReceipt(data: ReceiptData): Uint8Array {
  const chunks: Uint8Array[] = [];

  chunks.push(center(), bigOn(), text(data.toko.slice(0, LINE_W)), bigOff(), alignLeft());
  if (data.alamat) chunks.push(center(), text(data.alamat.slice(0, LINE_W)), alignLeft());
  if (data.telepon) chunks.push(center(), text("Telp: " + data.telepon.slice(0, LINE_W - 6)), alignLeft());
  chunks.push(divider());
  chunks.push(
    row(
      data.tanggal.slice(0, 20),
      data.nomor_transaksi ? "#" + data.nomor_transaksi.slice(0, 10) : ""
    ),
    divider()
  );

  for (const item of data.items) {
    chunks.push(text(item.nama_produk.slice(0, LINE_W)));
    chunks.push(
      row(
        `  ${item.qty} x ${item.harga_jual.toLocaleString("id-ID")}`,
        item.subtotal.toLocaleString("id-ID")
      )
    );
  }

  chunks.push(divider());
  chunks.push(
    enc.encode("\x1b\x61\x00\x1b\x21\x20"),
    row("TOTAL", "Rp " + data.total.toLocaleString("id-ID")),
    new Uint8Array([0x1b, 0x21, 0x00])
  );

  if (data.uang_bayar != null) {
    chunks.push(row("Tunai", "Rp " + data.uang_bayar.toLocaleString("id-ID")));
    chunks.push(row("Kembalian", "Rp " + Math.max(0, data.kembalian ?? 0).toLocaleString("id-ID")));
  }
  chunks.push(row("Bayar via", data.metode_bayar.toUpperCase()));

  chunks.push(divider());
  chunks.push(center(), text("Terima kasih atas kunjungan"), text("Anda!"), alignLeft());
  chunks.push(text(""));

  const body = chunks.reduce<Uint8Array[]>((acc, c) => [...acc, c], []);
  const totalLen = body.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(totalLen + cut().length);
  let off = 0;
  for (const c of body) {
    out.set(c, off);
    off += c.length;
  }
  out.set(cut(), off);
  return out;
}

/** Struk uji singkat untuk tombol "Tes Cetak". */
export function buildTestPage(printerName: string): Uint8Array {
  const chunks = [
    center(),
    bigOn(),
    text("TES CETAK"),
    bigOff(),
    alignLeft(),
    text(printerName.slice(0, LINE_W)),
    divider(),
    text("Jika ini terbaca, printer"),
    text("Bluetooth siap dipakai."),
    divider(),
    text(new Date().toLocaleString("id-ID")),
    text(""),
  ];
  const body = chunks.reduce<Uint8Array[]>((acc, c) => [...acc, c], []);
  const totalLen = body.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(totalLen + cut().length);
  let off = 0;
  for (const c of body) {
    out.set(c, off);
    off += c.length;
  }
  out.set(cut(), off);
  return out;
}

// ---------- Koneksi & kirim ----------

let connectedDevice: BluetoothDeviceLike | null = null;

export const isPrinterConnected = () => !!connectedDevice?.gatt?.connected;

async function ensurePrinterConnection(): Promise<BluetoothRemoteGATTCharacteristicLike> {
  const saved = getSavedPrinter();
  if (!saved) throw new Error("Belum ada printer ter-pair");
  if (!connectedDevice) throw new Error("Perlu sambung ulang dari menu Perangkat");

  if (!connectedDevice.gatt?.connected) {
    // Auto-reconnect: device hasil pairing masih di memori — cukup connect lagi.
    await connectedDevice.gatt?.connect();
  }
  if (!connectedDevice.gatt?.connected) throw new Error("Printer tidak merespons");

  const server = connectedDevice.gatt;
  const service = await server.getPrimaryService(ESCPOS_SERVICE_UUID);
  return service.getCharacteristic(ESCPOS_CHAR_UUID);
}

/** Kirim byte ke printer (di-chunk ≤ 20 byte — batas khas BLE). */
export async function sendToPrinter(bytes: Uint8Array): Promise<void> {
  const char = await ensurePrinterConnection();
  for (let i = 0; i < bytes.length; i += 20) {
    const chunk = bytes.slice(i, i + 20);
    if (char.writeValueWithoutResponse) await char.writeValueWithoutResponse(chunk);
    else await char.writeValue(chunk);
  }
}

export async function printReceiptToBluetooth(data: ReceiptData): Promise<void> {
  return sendToPrinter(buildEscPosReceipt(data));
}

export async function printTestPage(): Promise<void> {
  const saved = getSavedPrinter();
  return sendToPrinter(buildTestPage(saved?.name || "Printer"));
}

export function disconnectPrinter() {
  try {
    connectedDevice?.gatt?.disconnect();
  } catch {
    /* ignore */
  }
  connectedDevice = null;
}

/** Simpan referensi device hasil pairing agar auto-reconnect bisa jalan tanpa pair ulang. */
export function rememberConnectedPrinter(device: BluetoothDeviceLike) {
  connectedDevice = device;
}

// ---------- Scanner HID (keyboard-emulation via inputreport) ----------

// Peta keycode HID usage → karakter (layout US, angka & huruf yang dipakai barcode)
const HID_KEYMAP: Record<number, string> = {
  0x1d: "0", 0x1e: "1", 0x1f: "2", 0x20: "3", 0x21: "4",
  0x22: "5", 0x23: "6", 0x24: "7", 0x25: "8", 0x26: "9",
  0x04: "a", 0x05: "b", 0x06: "c", 0x07: "d", 0x08: "e", 0x09: "f",
  0x0a: "g", 0x0b: "h", 0x0c: "i", 0x0d: "j", 0x0e: "k", 0x0f: "l",
  0x10: "m", 0x11: "n", 0x12: "o", 0x13: "p", 0x14: "q", 0x15: "r",
  0x16: "s", 0x17: "t", 0x18: "u", 0x19: "v", 0x1a: "w", 0x1b: "x",
  0x1c: "y", 0x27: "0", // numpad 0 fallback
};
const HID_ENTER = 0x28;

let scannerBuffer = "";

/**
 * Hubungkan scanner HID yang sudah ter-pair & pasang listener.
 * Plug-n-play: dipanggil sekali saat app dibuka; setiap scan memanggil onScan(kode).
 * Return fungsi cleanup (memutus & menghapus listener).
 */
export async function connectScanner(onScan: (kode: string) => void): Promise<() => void> {
  if (!navigator.hid) throw new Error("Browser tidak mendukung WebHID");
  const saved = getSavedScanner();
  if (!saved) throw new Error("Belum ada scanner ter-pair");

  const granted = await navigator.hid.getDevices();
  const dev = granted.find((d) => `${d.vendorId}:${d.productId}` === saved.key);
  if (!dev) throw new Error("Scanner tidak ditemukan — pastikan sudah tersambung");

  if (!dev.opened) await dev.open();

  const listener = (e: HIDInputEventLike) => {
    const data = e.data;
    // laporan keyboard standar: byte0 modifier, byte1 reserved, byte2..7 keycodes
    for (let i = 2; i < data.byteLength; i++) {
      const key = data.getUint8(i);
      if (key === 0) continue;
      if (key === HID_ENTER) {
        if (scannerBuffer) {
          onScan(scannerBuffer);
          scannerBuffer = "";
        }
      } else {
        const ch = HID_KEYMAP[key];
        if (ch) scannerBuffer += ch;
      }
    }
  };
  dev.addEventListener("inputreport", listener);

  return () => {
    dev.removeEventListener("inputreport", listener);
    dev.close().catch(() => {});
  };
}
