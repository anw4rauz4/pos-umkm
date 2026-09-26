// ============================================
// TIPE DOMAIN KASIRKU AI
// Semua tipe data utama aplikasi dikumpulkan di sini
// ============================================
import type { TierHarga } from "./tierPricing";

export interface UserRow {
  id?: number;
  nama: string;
  email: string;
  password_hash: string;
  nama_toko: string;
  alamat_toko?: string;
  telepon_toko?: string;
  role: "admin" | "kasir";
  aktif: boolean;
  created_at: string;
}

export interface Supplier {
  id?: number;
  nama_supplier: string;
  kontak?: string;
  alamat?: string;
  created_at: string;
}

export interface Product {
  id?: number;
  nama_produk: string;
  sku?: string;
  barcode?: string;
  harga_beli: number;
  harga_jual: number;
  stok: number;
  stok_minimal?: number;
  supplier_id?: number | null;
  gambar?: string | null;
  harga_bertingkat?: TierHarga[];
  created_at?: string;
}

export interface Transaction {
  id?: number;
  total: number;
  metode_bayar: string;
  /** Uang tunai yang dibayarkan pelanggan (hanya metode cash) */
  uang_bayar?: number | null;
  /** Kembalian yang diberikan ke pelanggan (hanya metode cash) */
  kembalian?: number | null;
  created_at: string;
  synced?: number;
}

export interface TransactionItem {
  id?: number;
  transaction_id: number;
  product_id: number;
  qty: number;
  harga_satuan: number;
  harga_beli_satuan?: number | null;
  subtotal: number;
}

export interface PurchaseOrder {
  id?: number;
  supplier_id: number | null;
  status: string;
  created_at: string;
  synced?: number;
}

export interface SyncQueueItem {
  id?: number;
  table_name: string;
  action: string;
  data: unknown;
  created_at: string;
}
