"use client";
import { useMemo } from "react";
import { Check, Percent, Sparkles, X } from "lucide-react";
import { TIER_PRESETS, marginPercent, type TierHarga } from "@/lib/tierPricing";

interface Props {
  value: TierHarga[];
  onChange: (tiers: TierHarga[]) => void;
  hargaBeli: number;
  hargaJual: number;
}

const fmtRp = (n: number) => "Rp " + Math.round(n || 0).toLocaleString("id-ID");

export default function TierPriceEditor({ value, onChange, hargaBeli, hargaJual }: Props) {
  const customTiers = useMemo(() => value.filter((t) => !TIER_PRESETS.includes(t.qty)), [value]);

  const isChecked = (qty: number) => value.some((t) => t.qty === qty);

  const togglePreset = (qty: number) => {
    if (isChecked(qty)) {
      onChange(value.filter((t) => t.qty !== qty));
    } else {
      // Harga awal disarankan: diskon mengikuti pola tier yang sudah ada (5% per level) atau 2% dari harga jual
      const existing = [...value].sort((a, b) => a.qty - b.qty);
      const prev = [...existing].reverse().find((t) => t.qty < qty);
      let suggested = prev ? Math.round((prev.harga * 0.95) / 100) * 100 : Math.round((hargaJual * 0.95) / 100) * 100;
      if (hargaBeli > 0 && suggested <= hargaBeli) suggested = Math.max(hargaBeli + 100, Math.round(hargaJual * 0.9));
      onChange([...value, { qty, harga: Math.max(0, suggested) }].sort((a, b) => a.qty - b.qty));
    }
  };

  const updateTier = (qty: number, harga: number) => {
    const next = value.map((t) => (t.qty === qty ? { ...t, harga: Math.max(0, harga) } : t));
    onChange(next.sort((a, b) => a.qty - b.qty));
  };

  const addCustom = () => {
    const usedQty = new Set(value.map((t) => t.qty));
    let q = 2;
    while (usedQty.has(q)) q++;
    onChange([...value, { qty: q, harga: Math.round((hargaJual * 0.93) / 100) * 100 }].sort((a, b) => a.qty - b.qty));
  };

  const removeTier = (qty: number) => onChange(value.filter((t) => t.qty !== qty));

  const marginColor = (p: number) =>
    p <= 0 ? "bg-red-50 text-red-500" : p < 10 ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600";

  return (
    <div className="border border-indigo-100 bg-indigo-50/40 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-semibold text-indigo-900 flex items-center gap-1.5">
          <Percent size={14} /> Harga Bertingkat (Grosir)
        </label>
        <span className="text-[11px] text-indigo-400">Centang qty yang pakai harga khusus</span>
      </div>

      {/* Preset qty: 1, 3, 6, 9, 12, 24 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {TIER_PRESETS.map((qty) => {
          const active = isChecked(qty);
          const tier = value.find((t) => t.qty === qty);
          const margin = tier ? marginPercent(hargaBeli, tier.harga) : 0;
          return (
            <div
              key={qty}
              className={`rounded-lg border-2 p-2 transition-colors ${
                active ? "border-indigo-500 bg-white shadow-sm" : "border-dashed border-indigo-200 bg-white/50"
              }`}
            >
              <button
                type="button"
                onClick={() => togglePreset(qty)}
                className={`w-full flex items-center gap-1.5 text-left text-xs font-bold ${
                  active ? "text-indigo-700" : "text-gray-500 hover:text-indigo-600"
                }`}
              >
                <span
                  className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                    active ? "bg-indigo-600 border-indigo-600 text-white" : "border-gray-300 bg-white"
                  }`}
                >
                  {active && <Check size={11} strokeWidth={3} />}
                </span>
                Beli {qty}
              </button>
              {active && tier && (
                <div className="mt-1.5">
                  <input
                    type="number"
                    min={0}
                    value={tier.harga}
                    onChange={(e) => updateTier(qty, Number(e.target.value))}
                    className="w-full border border-indigo-200 rounded px-2 py-1 text-sm font-semibold text-indigo-900 focus:ring-2 focus:ring-indigo-400 outline-none"
                  />
                  <div className={`mt-1 inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${marginColor(margin)}`}>
                    margin {margin.toFixed(0)}%
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Custom qty */}
        {customTiers.map((t) => {
          const margin = marginPercent(hargaBeli, t.harga);
          return (
            <div key={"c" + t.qty} className="rounded-lg border-2 border-fuchsia-400 bg-white shadow-sm p-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-fuchsia-700">⚡ Custom</span>
                <button type="button" onClick={() => removeTier(t.qty)} className="text-gray-400 hover:text-red-500">
                  <X size={13} />
                </button>
              </div>
              <div className="mt-1.5 flex gap-1.5">
                <input
                  type="number"
                  min={1}
                  value={t.qty}
                  onChange={(e) => {
                    const q = Math.max(1, Math.floor(Number(e.target.value) || 1));
                    onChange(value.map((x) => (x.qty === t.qty ? { ...x, qty: q } : x)).sort((a, b) => a.qty - b.qty));
                  }}
                  className="w-16 border border-fuchsia-200 rounded px-2 py-1 text-sm font-semibold text-fuchsia-900 outline-none focus:ring-2 focus:ring-fuchsia-300"
                  title="Qty minimal"
                />
                <input
                  type="number"
                  min={0}
                  value={t.harga}
                  onChange={(e) => updateTier(t.qty, Number(e.target.value))}
                  className="flex-1 min-w-0 border border-fuchsia-200 rounded px-2 py-1 text-sm font-semibold text-fuchsia-900 outline-none focus:ring-2 focus:ring-fuchsia-300"
                  title="Harga satuan"
                />
              </div>
              <div className={`mt-1 inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${marginColor(margin)}`}>
                margin {margin.toFixed(0)}%
              </div>
            </div>
          );
        })}

        <button
          type="button"
          onClick={addCustom}
          className="rounded-lg border-2 border-dashed border-fuchsia-300 bg-white/50 p-2 text-xs font-bold text-fuchsia-600 hover:bg-fuchsia-50 flex flex-col items-center justify-center gap-1 min-h-[64px]"
        >
          <Sparkles size={15} /> Tambah Qty Custom
        </button>
      </div>

      <p className="text-[11px] text-indigo-400 mt-2">
        Harga dasar {fmtRp(hargaJual)} berlaku di luar tier. Di kasir, tier otomatis aktif saat qty mencapai batas minimal.
      </p>
    </div>
  );
}
