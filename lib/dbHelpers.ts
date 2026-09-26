import db from "./db";
import { resolveTierPrice } from "./tierPricing";
import type { Product, Supplier, Transaction, TransactionItem } from "./types";

/** Item keranjang dari halaman kasir: produk + qty + harga manual opsional. */
export interface CartItem extends Product {
  id: number;
  qty: number;
  harga_manual: number | null;
}

/** Hitung harga satuan efektif untuk item keranjang.
 *  Prioritas: harga_manual (dari checklist tier di kasir) > harga_jual. */
function hargaSatuanEfektif(item: CartItem): number {
  if (item.harga_manual != null && item.harga_manual > 0) return Number(item.harga_manual);
  return resolveTierPrice(item, item.qty || 1);
}

// ============ PRODUCTS ============
export const productService = {
  async getAll(): Promise<Product[]> {
    return db.products.toArray();
  },

  async create(data: Omit<Product, "id">): Promise<number> {
    return db.products.add({ ...data, created_at: new Date().toISOString() });
  },

  async update(id: number, data: Partial<Product>): Promise<void> {
    await db.products.update(id, data);
  },

  async delete(id: number): Promise<void> {
    await db.products.delete(id);
  },

  async getLowStock(): Promise<Product[]> {
    const all = await db.products.toArray();
    return all.filter((p) => p.stok <= (p.stok_minimal || 10));
  },
};

// ============ SUPPLIERS ============
export const supplierService = {
  async getAll(): Promise<Supplier[]> {
    return db.suppliers.toArray();
  },

  async create(data: Omit<Supplier, "id">): Promise<number> {
    return db.suppliers.add({ ...data, created_at: new Date().toISOString() });
  },
};

// ============ TRANSACTIONS ============
export const transactionService = {
  async createTransaction(
    cart: CartItem[],
    metode: string,
    pembayaran?: { uang_bayar: number; kembalian: number }
  ): Promise<number> {
    // Hitung harga efektif di luar transaksi Dexie (support harga_manual dari tier)
    const items = cart.map((item) => {
      const harga = hargaSatuanEfektif(item);
      return { ...item, _harga: harga, _subtotal: harga * item.qty };
    });
    const total = items.reduce((sum, item) => sum + item._subtotal, 0);

    return db.transaction("rw", db.transactions, db.transaction_items, db.products, async () => {
      // Validasi stok SEBELUM menulis apa pun — jika ada yang kurang, seluruh
      // transaksi dibatalkan (throw di dalam tx = rollback otomatis oleh Dexie).
      for (const item of items) {
        const produk = await db.products.get(item.id);
        if (!produk) throw new Error(`Produk "${item.nama_produk}" tidak ditemukan`);
        if ((produk.stok ?? 0) < item.qty) {
          throw new Error(`Stok ${item.nama_produk} tidak cukup (sisa ${produk.stok ?? 0}, butuh ${item.qty})`);
        }
      }

      const trxId = await db.transactions.add({
        total,
        metode_bayar: metode,
        uang_bayar: pembayaran?.uang_bayar ?? null,
        kembalian: pembayaran?.kembalian ?? null,
        created_at: new Date().toISOString(),
        synced: 0,
      });

      for (const item of items) {
        const produk = await db.products.get(item.id);
        const trxItem: Omit<TransactionItem, "id"> = {
          transaction_id: trxId,
          product_id: item.id,
          qty: item.qty,
          harga_satuan: item._harga,
          harga_beli_satuan: produk ? Number(produk.harga_beli) || 0 : 0, // snapshot utk laporan profit
          subtotal: item._subtotal,
        };
        await db.transaction_items.add(trxItem);

        await db.products.update(item.id, { stok: (produk?.stok ?? 0) - item.qty });
      }

      return trxId;
    });
  },

  async getTodaySales(): Promise<Transaction[]> {
    const today = new Date().toISOString().split("T")[0];
    const all = await db.transactions.toArray();
    return all.filter((t) => t.created_at.startsWith(today));
  },
};
