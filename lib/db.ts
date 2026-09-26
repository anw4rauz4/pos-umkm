import Dexie, { type Table } from "dexie";
import type {
  Product,
  Supplier,
  Transaction,
  TransactionItem,
  UserRow,
  PurchaseOrder,
  SyncQueueItem,
  CashSession,
} from "./types";

export class KasirDB extends Dexie {
  users!: Table<UserRow, number>;
  suppliers!: Table<Supplier, number>;
  products!: Table<Product, number>;
  transactions!: Table<Transaction, number>;
  transaction_items!: Table<TransactionItem, number>;
  purchase_orders!: Table<PurchaseOrder, number>;
  sync_queue!: Table<SyncQueueItem, number>;
  cash_sessions!: Table<CashSession, number>;

  constructor() {
    super("KasirKuAI_Local");

    this.version(2).stores({
      users: "++id, email, nama_toko",
      suppliers: "++id, nama_supplier, kontak, alamat, created_at",
      products: "++id, nama_produk, supplier_id, stok, harga_beli, harga_jual, sku, barcode",
      transactions: "++id, total, metode_bayar, created_at, synced",
      transaction_items: "++id, transaction_id, product_id, qty, subtotal",
      purchase_orders: "++id, supplier_id, status, created_at, synced",
      sync_queue: "++id, table_name, action, data, created_at",
    });

    this.version(2).upgrade(async (tx) => {
      // Tambah field barcode ke produk existing (opsional)
      await tx
        .table("products")
        .toCollection()
        .modify((product: Product) => {
          if (!product.barcode) product.barcode = product.sku || "";
          if (product.gambar === undefined) product.gambar = null;
        });
    });

    // v3: harga bertingkat (grosir) + snapshot harga beli pada item transaksi (untuk laporan profit)
    this.version(3).stores({
      products:
        "++id, nama_produk, supplier_id, stok, harga_beli, harga_jual, sku, barcode, harga_bertingkat",
      transaction_items: "++id, transaction_id, product_id, qty, subtotal, harga_beli_satuan",
    });

    this.version(3).upgrade(async (tx) => {
      await tx
        .table("products")
        .toCollection()
        .modify((product: Product) => {
          if (!Array.isArray(product.harga_bertingkat)) product.harga_bertingkat = [];
        });
      await tx
        .table("transaction_items")
        .toCollection()
        .modify((item: TransactionItem) => {
          if (item.harga_beli_satuan === undefined) item.harga_beli_satuan = null;
        });
    });

    // v4: sesi tutup kas (setoran & selisih harian)
    this.version(4).stores({
      cash_sessions: "++id, opened_at, closed_at, user_id",
    });
  }
}

export const db = new KasirDB();

// Seed data awal (hanya sekali, saat database pertama kali dibuat)
db.on("populate", () => {
  db.suppliers.bulkAdd([
    { nama_supplier: "PT Maju Jaya", kontak: "0812-3456-7890", alamat: "Jakarta", created_at: new Date().toISOString() },
    { nama_supplier: "CV Sentosa", kontak: "0856-7890-1234", alamat: "Bandung", created_at: new Date().toISOString() },
  ]);

  db.products.bulkAdd([
    { nama_produk: "Kopi Arabica", harga_beli: 20000, harga_jual: 25000, stok: 50, stok_minimal: 10, sku: "KOPI-01", barcode: "8991234567890", gambar: null, supplier_id: 1 },
    { nama_produk: "Gula Pasir", harga_beli: 10000, harga_jual: 12000, stok: 8, stok_minimal: 15, sku: "GULA-01", barcode: "8991234567891", gambar: null, supplier_id: 2 },
    { nama_produk: "Susu UHT", harga_beli: 15000, harga_jual: 18000, stok: 120, stok_minimal: 20, sku: "SUSU-01", barcode: "8991234567892", gambar: null, supplier_id: 1 },
    { nama_produk: "Teh Celup", harga_beli: 5000, harga_jual: 8000, stok: 200, stok_minimal: 30, sku: "TEH-01", barcode: "8991234567893", gambar: null, supplier_id: 2 },
  ]);
});

export default db;
