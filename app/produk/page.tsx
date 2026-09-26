"use client";
import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import db from "@/lib/db";
import { compressImage } from "@/lib/imageHelper";
import dynamic from "next/dynamic";

const BulkUploadModal = dynamic(() => import("@/lib/components/BulkUploadModal"), {
  ssr: false,
});
import {
  Plus,
  Trash2,
  Upload,
  Edit2,
  X,
  Search,
  FileSpreadsheet,
  Package,
  Download,
  Layers,
} from "lucide-react";
import TierPriceEditor from "@/lib/components/TierPriceEditor";
import { normalizeTiers, tiersToText, marginPercent, type TierHarga } from "@/lib/tierPricing";
import type { Product, Supplier } from "@/lib/types";

interface ProdukForm {
  nama_produk: string;
  sku: string;
  barcode: string;
  harga_beli: number;
  harga_jual: number;
  stok: number;
  stok_minimal: number;
  supplier_id: number | null;
  gambar: string | null;
  harga_bertingkat: TierHarga[];
}

const emptyForm: ProdukForm = {
  nama_produk: "",
  sku: "",
  barcode: "",
  harga_beli: 0,
  harga_jual: 0,
  stok: 0,
  stok_minimal: 10,
  supplier_id: null,
  gambar: null,
  harga_bertingkat: [],
};

export default function ProdukPage() {
  const [showForm, setShowForm] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<ProdukForm>({ ...emptyForm });

  const produk = useLiveQuery(() => db.products.toArray(), []);
  const produkList = useMemo(() => produk ?? [], [produk]);
  const suppliers = useLiveQuery(() => db.suppliers.toArray(), []);
  const supplierList = useMemo(() => suppliers ?? [], [suppliers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return produkList;
    return produkList.filter(
      (p) =>
        p.nama_produk?.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q) ||
        p.barcode?.includes(q)
    );
  }, [produkList, search]);

  const resetForm = () => {
    setForm({ ...emptyForm });
    setEditId(null);
  };

  const handleUploadGambar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return alert("File harus gambar!");
    try {
      const base64 = await compressImage(file, 400, 0.7);
      setForm((f) => ({ ...f, gambar: base64 }));
    } catch (err) {
      alert("❌ Gagal upload: " + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handleSave = async () => {
    if (!form.nama_produk) return alert("Nama produk wajib diisi!");
    if (form.harga_jual <= 0) return alert("Harga jual harus > 0!");
    try {
      if (editId) {
        // Jangan ikutkan primary key saat update
        const { nama_produk, sku, barcode, harga_beli, harga_jual, stok, stok_minimal, supplier_id, gambar, harga_bertingkat } = form;
        await db.products.update(editId, {
          nama_produk, sku, barcode, harga_beli, harga_jual, stok, stok_minimal, supplier_id, gambar, harga_bertingkat,
        });
      } else {
        await db.products.add({ ...form, created_at: new Date().toISOString() });
      }
      resetForm();
      setShowForm(false);
    } catch (err) {
      alert("❌ Error: " + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handleEdit = (p: Product) => {
    setForm({
      nama_produk: p.nama_produk || "",
      sku: p.sku || "",
      barcode: p.barcode || "",
      harga_beli: Number(p.harga_beli) || 0,
      harga_jual: Number(p.harga_jual) || 0,
      stok: p.stok ?? 0,
      stok_minimal: p.stok_minimal ?? 10,
      supplier_id: p.supplier_id ?? null,
      gambar: p.gambar ?? null,
      harga_bertingkat: normalizeTiers(p.harga_bertingkat),
    });
    setEditId(p.id!);
    setShowForm(true);
  };

  const handleExportExcel = async () => {
    const rows = produkList.map((p) => {
      const beli = Number(p.harga_beli) || 0;
      const jual = Number(p.harga_jual) || 0;
      return {
        nama_produk: p.nama_produk,
        sku: p.sku || "",
        barcode: p.barcode || "",
        harga_beli: beli,
        harga_jual: jual,
        margin_per_pcs: jual - beli,
        margin_persen: beli > 0 ? `${(((jual - beli) / beli) * 100).toFixed(1)}%` : "-",
        harga_bertingkat: tiersToText(p.harga_bertingkat),
        stok: p.stok ?? 0,
        stok_minimal: p.stok_minimal ?? 10,
      };
    });
    // Lazy-load library xlsx hanya saat export dipakai (hemat bundle awal)
    const { exportExcel } = await import("@/lib/excelExport");
    await exportExcel(
      [
        {
          name: "Produk",
          rows,
          columnWidths: [24, 12, 16, 11, 11, 13, 13, 26, 8, 12],
        },
      ],
      `produk-kasirku-${new Date().toISOString().split("T")[0]}.xlsx`,
      "Master Produk"
    );
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Hapus produk ini?")) return;
    await db.products.delete(id);
  };

  const set =
    (k: "harga_beli" | "harga_jual" | "stok" | "stok_minimal") =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value === "" ? 0 : Number(e.target.value) }));

  const setText =
    (k: "nama_produk" | "sku" | "barcode") =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-5">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">📦 Kelola Produk</h1>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 bg-sage text-white px-4 py-2 rounded-lg hover:bg-sage-deep text-sm font-semibold"
          >
            <Download size={16} /> Export Excel
          </button>
          <button
            onClick={() => setShowBulk(true)}
            className="flex items-center gap-2 bg-olive text-white px-4 py-2 rounded-lg hover:bg-olive-deep text-sm font-semibold"
          >
            <FileSpreadsheet size={16} /> Import Excel
          </button>
          <button
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className="flex items-center gap-2 bg-navy text-white px-4 py-2 rounded-lg hover:bg-navy-deep text-sm font-semibold"
          >
            <Plus size={16} /> Tambah Produk
          </button>
        </div>
      </div>

      {/* Pencarian */}
      <div className="relative mb-5">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari nama produk, SKU, atau barcode..."
          className="w-full bg-white border border-gray-200 rounded-lg pl-9 pr-9 py-2.5 text-sm focus:ring-2 focus:ring-navy focus:border-navy outline-none"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X size={14} />
          </button>
        )}
      </div>

      <p className="text-xs text-gray-400 mb-3">
        Menampilkan {filtered.length} dari {produkList.length} produk
      </p>

      {/* GRID PRODUK */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filtered.map((p) => (
          <div key={p.id} className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
            <div className="w-full h-36 bg-gray-100 flex items-center justify-center overflow-hidden">
              {p.gambar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.gambar} alt={p.nama_produk} className="w-full h-full object-cover" />
              ) : (
                <Package size={40} className="text-gray-300" />
              )}
            </div>
            <div className="p-3.5">
              <div className="font-bold text-gray-800 truncate">{p.nama_produk}</div>
              <div className="text-xs text-gray-500">SKU: {p.sku || "-"}</div>
              <div className="text-xs text-gray-500 mb-2">Barcode: {p.barcode || "-"}</div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-navy font-bold text-sm">
                  Rp {Number(p.harga_jual).toLocaleString()}
                </span>
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    p.stok <= (p.stok_minimal ?? 10)
                      ? "bg-red-50 text-red-500"
                      : "bg-olive/10 text-olive"
                  }`}
                >
                  Stok {p.stok}
                </span>
              </div>
              <div className="flex flex-wrap gap-1 mb-2.5">
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-sage/10 text-sage">
                  margin {marginPercent(Number(p.harga_beli) || 0, Number(p.harga_jual) || 0).toFixed(0)}%
                </span>
                {normalizeTiers(p.harga_bertingkat).length > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-sage/10 text-sage flex items-center gap-0.5">
                    <Layers size={9} /> {normalizeTiers(p.harga_bertingkat).length} harga grosir
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(p)}
                  className="flex-1 bg-cream-soft0 text-white py-1.5 rounded text-sm hover:bg-[#A6956F] flex items-center justify-center gap-1"
                >
                  <Edit2 size={12} /> Edit
                </button>
                <button
                  onClick={() => handleDelete(p.id!)}
                  className="bg-red-500 text-white px-3 rounded hover:bg-red-600"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {produkList.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <Package size={48} className="mx-auto mb-3 text-gray-300" />
          <p>Belum ada produk. Klik &quot;Tambah Produk&quot; atau &quot;Import Excel&quot;.</p>
        </div>
      )}
      {produkList.length > 0 && filtered.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <Search size={40} className="mx-auto mb-3 text-gray-300" />
          <p>Tidak ada produk yang cocok dengan &quot;{search}&quot;.</p>
        </div>
      )}

      {/* MODAL FORM */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl w-full max-w-lg my-8">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="font-bold text-lg">
                {editId ? "✏️ Edit Produk" : "➕ Tambah Produk"}
              </h3>
              <button
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
                className="text-gray-500 hover:text-red-500"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
              {/* Upload Gambar */}
              <div className="flex items-center gap-4">
                <div className="w-24 h-24 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden border-2 border-dashed border-gray-300">
                  {form.gambar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={form.gambar} alt="preview" className="w-full h-full object-cover" />
                  ) : (
                    <Upload size={28} className="text-gray-400" />
                  )}
                </div>
                <div className="flex-1">
                  <label className="flex items-center gap-2 bg-navy/5 text-navy px-3 py-2 rounded border border-blue-200 cursor-pointer hover:bg-navy/10 w-fit">
                    <Upload size={16} />
                    <span className="text-sm">Upload Gambar Produk</span>
                    <input type="file" accept="image/*" onChange={handleUploadGambar} className="hidden" />
                  </label>
                  <p className="text-xs text-gray-500 mt-1">JPG/PNG, auto-compress ke 400px</p>
                  {form.gambar && (
                    <button
                      onClick={() => setForm((f) => ({ ...f, gambar: null }))}
                      className="text-xs text-red-500 hover:underline mt-1"
                    >
                      Hapus gambar
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Nama Produk *</label>
                <input
                  type="text"
                  value={form.nama_produk}
                  onChange={setText("nama_produk")}
                  className="w-full border rounded px-3 py-2 mt-1"
                  placeholder="Contoh: Kopi Arabica"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">SKU</label>
                  <input
                    type="text"
                    value={form.sku}
                    onChange={setText("sku")}
                    className="w-full border rounded px-3 py-2 mt-1"
                    placeholder="KOPI-01"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Barcode</label>
                  <input
                    type="text"
                    value={form.barcode}
                    onChange={setText("barcode")}
                    className="w-full border rounded px-3 py-2 mt-1"
                    placeholder="8991234567890"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Harga Beli</label>
                  <input
                    type="number"
                    value={form.harga_beli}
                    onChange={set("harga_beli")}
                    className="w-full border rounded px-3 py-2 mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Harga Jual *</label>
                  <input
                    type="number"
                    value={form.harga_jual}
                    onChange={set("harga_jual")}
                    className="w-full border rounded px-3 py-2 mt-1"
                  />
                </div>
              </div>

              {/* HARGA BERTINGKAT */}
              <TierPriceEditor
                value={form.harga_bertingkat || []}
                onChange={(tiers) => setForm((f) => ({ ...f, harga_bertingkat: tiers }))}
                hargaBeli={form.harga_beli}
                hargaJual={form.harga_jual}
              />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Stok</label>
                  <input
                    type="number"
                    value={form.stok}
                    onChange={set("stok")}
                    className="w-full border rounded px-3 py-2 mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Stok Minimal</label>
                  <input
                    type="number"
                    value={form.stok_minimal}
                    onChange={set("stok_minimal")}
                    className="w-full border rounded px-3 py-2 mt-1"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Supplier</label>
                <select
                  value={form.supplier_id || ""}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      supplier_id: e.target.value ? Number(e.target.value) : null,
                    }))
                  }
                  className="w-full border rounded px-3 py-2 mt-1"
                >
                  <option value="">-- Pilih Supplier --</option>
                  {supplierList.map((s: Supplier) => (
                    <option key={s.id} value={s.id}>
                      {s.nama_supplier}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="p-4 border-t flex gap-2">
              <button
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
                className="flex-1 border border-gray-300 py-2 rounded hover:bg-gray-50"
              >
                Batal
              </button>
              <button
                onClick={handleSave}
                className="flex-1 bg-navy text-white py-2 rounded hover:bg-navy-deep"
              >
                {editId ? "Update" : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL BULK UPLOAD */}
      {showBulk && <BulkUploadModal onClose={() => setShowBulk(false)} />}
    </div>
  );
}
