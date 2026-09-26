// ============================================
// HELPER HARGA BERTINGKAT (GROSIR / RESELLER)
// Format data di produk: harga_bertingkat = [{ qty: 3, harga: 22000 }, ...]
// ============================================

export interface TierHarga {
  qty: number; // pembelian minimal
  harga: number; // harga satuan untuk qty tersebut ke atas
}

/** Preset qty yang ditawarkan di form */
export const TIER_PRESETS = [1, 3, 6, 9, 12, 24];

/** Sumber tier apa pun: array mentah dari DB, hasil parse Excel, dll. */
export type TierSource = unknown;

/** Bersihkan & urutkan array tier dari sumber apa pun */
export function normalizeTiers(raw: TierSource): TierHarga[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<number>();
  return raw
    .map((t): TierHarga => {
      const tier = t as Partial<TierHarga> | null;
      return {
        qty: Math.max(1, Math.floor(Number(tier?.qty) || 0)),
        harga: Math.max(0, Number(tier?.harga) || 0),
      };
    })
    .filter((t) => t.harga > 0 && !seen.has(t.qty) && (seen.add(t.qty), true))
    .sort((a, b) => a.qty - b.qty);
}

/** Produk minimal yang dibutuhkan helper tier (Product memenuhi kontrak ini). */
export interface TieredProduct {
  harga_jual?: number;
  harga_bertingkat?: TierSource;
}

/** Ambil tier milik sebuah produk (sudah dinormalisasi) */
export function getTiers(product: TieredProduct | null | undefined): TierHarga[] {
  return normalizeTiers(product?.harga_bertingkat);
}

/**
 * Harga satuan efektif (mode otomatis) untuk qty tertentu.
 * Tier dengan qty terbesar yang masih <= qty pembelian yang menang;
 * kalau tidak ada tier yang cocok → harga_jual dasar.
 */
export function resolveTierPrice(product: TieredProduct | null | undefined, qty: number): number {
  const base = Number(product?.harga_jual) || 0;
  let price = base;
  for (const t of getTiers(product)) {
    if (qty >= t.qty) price = t.harga;
  }
  return price;
}

/** Tier yang sedang berlaku untuk qty tertentu (null = harga dasar) */
export function findActiveTier(
  product: TieredProduct | null | undefined,
  qty: number
): TierHarga | null {
  let active: TierHarga | null = null;
  for (const t of getTiers(product)) {
    if (qty >= t.qty) active = t;
  }
  return active;
}

/** Parse teks tier dari Excel/CSV, contoh: "3:22000,6:21000,12:20000" atau "3=22000; 6=21000" */
export function parseTiersFromText(text: TierSource): TierHarga[] {
  if (Array.isArray(text)) return normalizeTiers(text);
  if (!text || typeof text !== "string") return [];
  const tiers: TierHarga[] = [];
  for (const part of text.split(/[,;\n]+/)) {
    const m = part.trim().match(/^(\d+)\s*[:=>xX*-]+\s*([\d.,]+)$/);
    if (!m) continue;
    const harga = Number(m[2].replace(/\.(?=\d{3}\b)/g, "").replace(",", "."));
    if (!isNaN(harga) && harga > 0) tiers.push({ qty: Number(m[1]), harga });
  }
  return normalizeTiers(tiers);
}

/** Serialize tier menjadi teks singkat untuk export Excel */
export function tiersToText(tiers: TierHarga[] | TierSource): string {
  const list = normalizeTiers(tiers);
  if (!list.length) return "";
  return list.map((t) => `${t.qty}:${t.harga}`).join(",");
}

/** Label margin (%) harga terhadap harga beli */
export function marginPercent(hargaBeli: number, harga: number): number {
  if (!hargaBeli || hargaBeli <= 0) return 0;
  return ((harga - hargaBeli) / hargaBeli) * 100;
}

export function formatRp(n: number): string {
  return "Rp " + Math.round(n || 0).toLocaleString("id-ID");
}
