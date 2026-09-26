import db from "./db";
import { downloadBlob } from "./exportHelpers";

// ============================================
// EXPORT: Semua tabel → 1 file JSON
// ============================================
interface BackupFile {
  version: string;
  exported_at: string;
  app: string;
  data: Record<string, unknown[]>;
}

export async function exportDatabase(): Promise<{ success: boolean; size?: number; error?: string }> {
  try {
    const backup: BackupFile = {
      version: "1.0.0",
      exported_at: new Date().toISOString(),
      app: "KasirKu AI",
      data: {
        users: await db.users.toArray(),
        suppliers: await db.suppliers.toArray(),
        products: await db.products.toArray(),
        transactions: await db.transactions.toArray(),
        transaction_items: await db.transaction_items.toArray(),
        purchase_orders: await db.purchase_orders.toArray(),
      },
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    downloadBlob(blob, `kasirku-backup-${new Date().toISOString().split("T")[0]}.json`);

    return { success: true, size: blob.size };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ============================================
// IMPORT: File JSON → Database
// ============================================
export async function importDatabase(file: File): Promise<{ success: boolean; reason?: string; error?: string }> {
  try {
    const text = await file.text();
    const backup = JSON.parse(text) as BackupFile;

    if (backup.app !== "KasirKu AI") {
      throw new Error("File backup tidak valid!");
    }

    const confirmed = confirm(
      `⚠️ PERINGATAN!\n\nSemua data saat ini akan DIGANTI dengan backup dari:\n${backup.exported_at}\n\nLanjutkan?`
    );
    if (!confirmed) return { success: false, reason: "cancelled" };

    await db.transaction("rw", db.tables, async () => {
      await Promise.all([
        db.users.clear(),
        db.suppliers.clear(),
        db.products.clear(),
        db.transactions.clear(),
        db.transaction_items.clear(),
        db.purchase_orders.clear(),
        db.sync_queue.clear(),
      ]);

      for (const [table, rows] of Object.entries(backup.data)) {
        const t = (db as unknown as Record<string, { bulkAdd: (rows: unknown[]) => Promise<unknown> }>)[table];
        if (t && rows.length > 0) {
          await t.bulkAdd(rows);
        }
      }
    });

    // Sesi lama bisa merujuk akun yang id-nya berubah — paksa login ulang
    sessionStorage.removeItem("kasirku_session");

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
