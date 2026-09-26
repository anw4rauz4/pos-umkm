"use client";

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { getRekapKas, tutupKas, listSesiKas, type RekapKas } from "@/lib/cashSession";
import { formatRp } from "@/lib/exportHelpers";
import { X, Banknote, HandCoins, Wallet, History, AlertTriangle, CheckCircle2 } from "lucide-react";

export default function CashCloseModal({ onClose }: { onClose: () => void }) {
  const [rekap, setRekap] = useState<RekapKas | null>(null);
  const [kasFisik, setKasFisik] = useState("");
  const [catatan, setCatatan] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const riwayat = useLiveQuery(() => listSesiKas(10), []) || [];

  useEffect(() => {
    getRekapKas().then(setRekap).catch(() => setError("Gagal memuat rekap kas"));
  }, []);

  const fisik = Number(kasFisik) || 0;
  const selisih = rekap ? Math.round((fisik - rekap.kas_diharapkan) * 100) / 100 : 0;

  const handleSimpan = async () => {
    if (!rekap) return;
    if (fisik <= 0 && rekap.kas_diharapkan > 0) {
      setError("Isi uang fisik yang dihitung dari laci kas.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      await tutupKas({ kas_fisik: fisik, catatan });
      setSaved(true);
      setKasFisik("");
      setCatatan("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b sticky top-0 bg-white rounded-t-xl">
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            🧮 Tutup Kas Hari Ini
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <div className="p-4">
          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 text-red-700 text-sm p-3 rounded mb-4">
              {error}
            </div>
          )}

          {!rekap ? (
            <p className="text-center text-gray-400 py-10">Memuat rekap...</p>
          ) : (
            <>
              {/* Rekap */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="bg-green-50 border border-green-100 rounded-lg p-3 text-center">
                  <Banknote size={18} className="mx-auto text-green-600 mb-1" />
                  <p className="text-[10px] text-gray-500 uppercase">Tunai Diterima</p>
                  <p className="font-bold text-sm text-gray-800">{formatRp(rekap.tunai_diterima)}</p>
                </div>
                <div className="bg-red-50 border border-red-100 rounded-lg p-3 text-center">
                  <HandCoins size={18} className="mx-auto text-red-500 mb-1" />
                  <p className="text-[10px] text-gray-500 uppercase">Kembalian</p>
                  <p className="font-bold text-sm text-gray-800">{formatRp(rekap.kembalian)}</p>
                </div>
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-center">
                  <Wallet size={18} className="mx-auto text-blue-600 mb-1" />
                  <p className="text-[10px] text-gray-500 uppercase">Harus di Laci</p>
                  <p className="font-bold text-sm text-gray-800">{formatRp(rekap.kas_diharapkan)}</p>
                </div>
              </div>

              <p className="text-xs text-gray-400 mb-4">
                {rekap.jumlah_transaksi} transaksi cash hari ini
                {rekap.sudahTutup && " • ⚠️ kas sudah pernah ditutup hari ini (tutup ulang membuat rekap baru)"}
              </p>

              {/* Detail transaksi */}
              {rekap.transaksi.length > 0 && (
                <details className="mb-4 border border-gray-100 rounded-lg">
                  <summary className="cursor-pointer text-xs font-semibold text-gray-600 px-3 py-2">
                    Lihat detail {rekap.transaksi.length} transaksi
                  </summary>
                  <div className="max-h-40 overflow-y-auto px-3 pb-2">
                    {rekap.transaksi.map((t) => (
                      <div key={t.id} className="flex justify-between text-xs py-1 border-b border-gray-50">
                        <span className="text-gray-500">
                          {new Date(t.created_at).toLocaleTimeString("id-ID")} — Tunai {formatRp(t.uang_bayar)}
                        </span>
                        <span className="text-gray-700">
                          Nota {formatRp(t.total)} → kembali {formatRp(t.kembalian)}
                        </span>
                      </div>
                    ))}
                  </div>
                </details>
              )}

              {/* Input kas fisik */}
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Uang fisik dihitung dari laci (Rp)
              </label>
              <input
                type="number"
                min={0}
                value={kasFisik}
                onChange={(e) => setKasFisik(e.target.value)}
                placeholder={String(rekap.kas_diharapkan)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-lg font-semibold focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />

              {fisik > 0 && (
                <div
                  className={`mt-3 rounded-lg p-3 text-sm flex items-center gap-2 ${
                    selisih === 0
                      ? "bg-green-50 text-green-700"
                      : selisih > 0
                        ? "bg-amber-50 text-amber-700"
                        : "bg-red-50 text-red-700"
                  }`}
                >
                  {selisih === 0 ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                  {selisih === 0 ? (
                    <span>Kas cocok — tidak ada selisih 🎉</span>
                  ) : (
                    <span>
                      Selisih: <b>{formatRp(Math.abs(selisih))}</b>{" "}
                      {selisih > 0 ? "lebih (cek nota mundul)" : "kurang (cek kembalian/nota)"}
                    </span>
                  )}
                </div>
              )}

              <label className="block text-sm font-semibold text-gray-700 mt-4 mb-1">
                Catatan (opsional)
              </label>
              <input
                type="text"
                value={catatan}
                onChange={(e) => setCatatan(e.target.value)}
                placeholder="mis. nota mundul Rp 5.000"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />

              <button
                onClick={handleSimpan}
                disabled={saving || saved}
                className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 font-semibold mt-4 disabled:opacity-50"
              >
                {saving ? "Menyimpan..." : saved ? "✅ Tutup kas tersimpan" : "Simpan Tutup Kas"}
              </button>

              {saved && (
                <p className="text-center text-xs text-green-600 mt-2">
                  Tersimpan ke riwayat. Aman untuk setor uang ke kas bisnis.
                </p>
              )}
            </>
          )}

          {/* Riwayat */}
          <div className="mt-6">
            <h4 className="text-sm font-bold text-gray-700 flex items-center gap-1.5 mb-2">
              <History size={14} /> Riwayat Tutup Kas
            </h4>
            {riwayat.length === 0 ? (
              <p className="text-xs text-gray-400">Belum ada riwayat.</p>
            ) : (
              <div className="space-y-1.5 max-h-44 overflow-y-auto">
                {riwayat.map((s) => (
                  <div
                    key={s.id}
                    className="flex justify-between items-center text-xs bg-gray-50 rounded-lg px-3 py-2"
                  >
                    <div>
                      <span className="font-semibold text-gray-700">{s.periode}</span>
                      <span className="text-gray-400"> • {s.user_nama || s.jumlah_transaksi + " trx"}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-gray-700">Setor {formatRp(s.kas_fisik)}</span>
                      <span
                        className={`ml-2 font-bold ${
                          s.selisih === 0 ? "text-green-600" : s.selisih > 0 ? "text-amber-600" : "text-red-600"
                        }`}
                      >
                        {s.selisih > 0 ? "+" : ""}
                        {s.selisih !== 0 ? formatRp(s.selisih) : "cocok"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
