"use client";
import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import db from "@/lib/db";
import {
  Plus,
  Edit2,
  Trash2,
  X,
  Search,
  Building2,
  Phone,
  MapPin,
  Package,
} from "lucide-react";
import type { Supplier } from "@/lib/types";

const emptyForm = { nama_supplier: "", kontak: "", alamat: "" };

export default function SupplierPage() {
  const suppliers = useLiveQuery(() => db.suppliers.toArray(), []);
  const supplierList = useMemo(() => suppliers ?? [], [suppliers]);
  const products = useLiveQuery(() => db.products.toArray(), []);
  const productList = useMemo(() => products ?? [], [products]);

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ ...emptyForm });
  const [error, setError] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return supplierList;
    return supplierList.filter(
      (s) =>
        s.nama_supplier?.toLowerCase().includes(q) ||
        s.kontak?.includes(q) ||
        s.alamat?.toLowerCase().includes(q)
    );
  }, [supplierList, search]);

  const openAdd = () => {
    setForm({ ...emptyForm });
    setEditId(null);
    setError("");
    setShowForm(true);
  };

  const openEdit = (s: Supplier) => {
    setForm({ nama_supplier: s.nama_supplier || "", kontak: s.kontak || "", alamat: s.alamat || "" });
    setEditId(s.id!);
    setError("");
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.nama_supplier.trim()) {
      setError("Nama supplier wajib diisi");
      return;
    }
    try {
      if (editId) {
        await db.suppliers.update(editId, form);
      } else {
        await db.suppliers.add({ ...form, created_at: new Date().toISOString() });
      }
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDelete = async (s: Supplier) => {
    const count = productList.filter((p) => p.supplier_id === s.id).length;
    const msg =
      count > 0
        ? `Supplier "${s.nama_supplier}" memiliki ${count} produk. Produk tetap tersimpan tapi tanpa supplier. Hapus supplier ini?`
        : `Hapus supplier "${s.nama_supplier}"?`;
    if (!confirm(msg)) return;
    await db.transaction("rw", db.suppliers, db.products, async () => {
      await db.products.where("supplier_id").equals(s.id!).modify({ supplier_id: null });
      await db.suppliers.delete(s.id!);
    });
  };

  const set =
    (k: "nama_supplier" | "kontak" | "alamat") =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-5">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">🏭 Manajemen Supplier</h1>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-semibold"
        >
          <Plus size={16} /> Tambah Supplier
        </button>
      </div>

      {/* Pencarian */}
      <div className="relative mb-5">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari nama, kontak, atau alamat supplier..."
          className="w-full bg-white border border-gray-200 rounded-lg pl-9 pr-9 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((s) => {
          const supplierProducts = productList.filter((p) => p.supplier_id === s.id);
          const lowStock = supplierProducts.filter((p) => p.stok <= (p.stok_minimal ?? 10)).length;

          return (
            <div key={s.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
                    <Building2 className="text-blue-600" size={20} />
                  </div>
                  <h2 className="text-lg font-bold text-gray-800 truncate">{s.nama_supplier}</h2>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => openEdit(s)}
                    className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg"
                    title="Edit"
                  >
                    <Edit2 size={15} />
                  </button>
                  <button
                    onClick={() => handleDelete(s)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                    title="Hapus"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              <div className="text-sm text-gray-600 space-y-1 mb-3">
                <div className="flex items-center gap-2">
                  <Phone size={14} className="text-gray-400" /> {s.kontak || "-"}
                </div>
                <div className="flex items-center gap-2">
                  <MapPin size={14} className="text-gray-400" />
                  <span className="truncate">{s.alamat || "-"}</span>
                </div>
              </div>

              <div className="border-t pt-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Produk</span>
                  <div className="flex gap-1.5">
                    <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-semibold">
                      {supplierProducts.length} item
                    </span>
                    {lowStock > 0 && (
                      <span className="bg-red-100 text-red-600 text-xs px-2 py-0.5 rounded-full font-semibold">
                        {lowStock} menipis
                      </span>
                    )}
                  </div>
                </div>
                {supplierProducts.length === 0 ? (
                  <p className="text-xs text-gray-400 py-2">Belum ada produk dari supplier ini.</p>
                ) : (
                  <div className="max-h-40 overflow-y-auto">
                    {supplierProducts.map((p) => (
                      <div key={p.id} className="flex justify-between items-center py-1.5 border-b last:border-0">
                        <span className="text-sm text-gray-700 truncate pr-2">
                          <Package size={12} className="inline mr-1 text-gray-300" />
                          {p.nama_produk}
                        </span>
                        <span
                          className={`text-sm font-bold shrink-0 ${
                            p.stok <= (p.stok_minimal ?? 10) ? "text-red-500" : "text-green-600"
                          }`}
                        >
                          {p.stok} pcs
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {supplierList.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <Building2 size={48} className="mx-auto mb-3 text-gray-300" />
          <p>Belum ada supplier. Klik &quot;Tambah Supplier&quot; untuk mulai.</p>
        </div>
      )}

      {/* MODAL FORM */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="font-bold text-lg">
                {editId ? "✏️ Edit Supplier" : "➕ Tambah Supplier"}
              </h3>
              <button onClick={() => setShowForm(false)} className="text-gray-500 hover:text-red-500">
                <X size={20} />
              </button>
            </div>
            <div className="p-4 space-y-3">
              {error && (
                <div className="bg-red-50 border-l-4 border-red-500 text-red-700 text-sm px-3 py-2 rounded">
                  {error}
                </div>
              )}
              <div>
                <label className="text-sm font-medium">Nama Supplier *</label>
                <input
                  type="text"
                  value={form.nama_supplier}
                  onChange={set("nama_supplier")}
                  className="w-full border rounded px-3 py-2 mt-1"
                  placeholder="PT Maju Jaya"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Kontak / Telepon</label>
                <input
                  type="text"
                  value={form.kontak}
                  onChange={set("kontak")}
                  className="w-full border rounded px-3 py-2 mt-1"
                  placeholder="0812-3456-7890"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Alamat</label>
                <textarea
                  value={form.alamat}
                  onChange={set("alamat")}
                  rows={2}
                  className="w-full border rounded px-3 py-2 mt-1"
                  placeholder="Jl. Contoh No. 123, Jakarta"
                />
              </div>
            </div>
            <div className="p-4 border-t flex gap-2">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 border border-gray-300 py-2 rounded hover:bg-gray-50"
              >
                Batal
              </button>
              <button
                onClick={handleSave}
                className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
              >
                {editId ? "Update" : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
