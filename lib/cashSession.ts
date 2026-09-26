// ============================================
// SESI TUTUP KAS — rekap setoran & selisih harian
// ============================================
import db from "./db";
import type { CashSession } from "./types";

export interface RekapKas {
  periode: string;
  tunai_diterima: number;
  kembalian: number;
  kas_diharapkan: number;
  jumlah_transaksi: number;
  /** Transaksi cash periode terkait (untuk detail modal) */
  transaksi: { id: number; total: number; uang_bayar: number; kembalian: number; created_at: string }[];
  /** Sudah ada sesi tutup kas untuk periode ini? */
  sudahTutup: boolean;
}

function todayPeriode(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Rekap kas untuk periode (default: hari ini, berbasis waktu LOKAL bukan UTC). */
export async function getRekapKas(periode: string = todayPeriode()): Promise<RekapKas> {
  const all = await db.transactions.toArray();
  const trx = all
    .filter((t) => t.metode_bayar === "cash" && localDate(t.created_at) === periode)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  const tunai_diterima = trx.reduce((s, t) => s + (t.uang_bayar || 0), 0);
  const kembalian = trx.reduce((s, t) => s + (t.kembalian || 0), 0);

  const sessions = await db.cash_sessions.where("closed_at").startsWith(periode).toArray();

  return {
    periode,
    tunai_diterima,
    kembalian,
    kas_diharapkan: tunai_diterima - kembalian,
    jumlah_transaksi: trx.length,
    transaksi: trx.map((t) => ({
      id: t.id as number,
      total: t.total,
      uang_bayar: t.uang_bayar || 0,
      kembalian: t.kembalian || 0,
      created_at: t.created_at,
    })),
    sudahTutup: sessions.length > 0,
  };
}

/** Simpan tutup kas: hitung selisih dari kas fisik yang dihitung kasir. */
export async function tutupKas(opts: {
  kas_fisik: number;
  catatan?: string;
  periode?: string;
}): Promise<CashSession> {
  const rekap = await getRekapKas(opts.periode);
  const session: Omit<CashSession, "id"> = {
    closed_at: new Date().toISOString(),
    periode: rekap.periode,
    tunai_diterima: rekap.tunai_diterima,
    kembalian: rekap.kembalian,
    kas_diharapkan: rekap.kas_diharapkan,
    kas_fisik: opts.kas_fisik,
    selisih: Math.round((opts.kas_fisik - rekap.kas_diharapkan) * 100) / 100,
    catatan: opts.catatan?.trim() || undefined,
    jumlah_transaksi: rekap.jumlah_transaksi,
  };
  const id = await db.cash_sessions.add(session);
  return { ...session, id };
}

/** Riwayat tutup kas (terbaru dulu). */
export async function listSesiKas(limit = 30): Promise<CashSession[]> {
  const all = await db.cash_sessions.toArray();
  return all.sort((a, b) => b.closed_at.localeCompare(a.closed_at)).slice(0, limit);
}

/** Tanggal lokal YYYY-MM-DD dari ISO datetime (bukan UTC). */
export function localDate(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
