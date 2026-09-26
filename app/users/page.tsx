"use client";
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import db from "@/lib/db";
import { useAuth, addUserByAdmin, setUserActive, resetUserPassword, deleteUser } from "@/lib/auth";
import {
  Plus,
  Trash2,
  X,
  UserRound,
  ShieldCheck,
  KeyRound,
  Power,
} from "lucide-react";
import type { UserRow } from "@/lib/types";

export default function UsersPage() {
  const { user: me } = useAuth();
  const users = useLiveQuery(() => db.users.toArray(), []) || [];
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<{ nama: string; email: string; password: string; role: "kasir" | "admin" }>({
    nama: "",
    email: "",
    password: "",
    role: "kasir",
  });
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const isAdmin = me?.role === "admin";

  const handleAdd = async () => {
    setError("");
    try {
      await addUserByAdmin({ ...form, nama_toko: me?.nama_toko });
      setForm({ nama: "", email: "", password: "", role: "kasir" });
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleToggleActive = async (u: UserRow) => {
    try {
      await setUserActive(u.id!, !u.aktif);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  const handleResetPassword = async (u: UserRow) => {
    const newPass = prompt(`Masukkan password baru untuk "${u.nama}" (min. 6 karakter):`);
    if (newPass === null) return;
    try {
      await resetUserPassword(u.id!, newPass);
      setMsg(`Password ${u.nama} berhasil direset.`);
      setTimeout(() => setMsg(""), 3000);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDelete = async (u: UserRow) => {
    if (!confirm(`Hapus akun "${u.nama}"? Tindakan ini tidak bisa dibatalkan.`)) return;
    try {
      await deleteUser(u.id!);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-6 max-w-6xl mx-auto text-center py-20">
        <ShieldCheck size={48} className="mx-auto text-gray-300 mb-3" />
        <h1 className="text-xl font-bold text-gray-700">Akses Khusus Admin</h1>
        <p className="text-gray-500 text-sm mt-1">Halaman ini hanya dapat diakses oleh admin.</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-5">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">👥 Manajemen Pengguna</h1>
        <button
          onClick={() => {
            setError("");
            setShowForm(true);
          }}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-semibold"
        >
          <Plus size={16} /> Tambah Pengguna
        </button>
      </div>

      {msg && (
        <div className="bg-green-50 border-l-4 border-green-500 text-green-700 text-sm px-3 py-2 rounded mb-4">
          {msg}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr className="text-left">
              <th className="px-4 py-3">Pengguna</th>
              <th className="px-4 py-3">Peran</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold uppercase shrink-0">
                      {u.nama?.charAt(0) || "?"}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-800 truncate">
                        {u.nama}
                        {me?.id === u.id && (
                          <span className="ml-2 text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full">
                            Anda
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500 truncate">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`text-xs font-semibold px-2 py-1 rounded-full ${
                      u.role === "admin"
                        ? "bg-purple-50 text-purple-600"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`text-xs font-semibold px-2 py-1 rounded-full ${
                      u.aktif ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500"
                    }`}
                  >
                    {u.aktif ? "Aktif" : "Nonaktif"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <button
                      onClick={() => handleToggleActive(u)}
                      disabled={me?.id === u.id}
                      className="p-2 text-gray-500 hover:bg-gray-50 rounded-lg disabled:opacity-30"
                      title={u.aktif ? "Nonaktifkan" : "Aktifkan"}
                    >
                      <Power size={15} />
                    </button>
                    <button
                      onClick={() => handleResetPassword(u)}
                      className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg"
                      title="Reset password"
                    >
                      <KeyRound size={15} />
                    </button>
                    <button
                      onClick={() => handleDelete(u)}
                      disabled={me?.id === u.id}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg disabled:opacity-30"
                      title="Hapus"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400 mt-3">
        Akun dengan peran <b>kasir</b> dapat melakukan transaksi tetapi tidak dapat membuka menu
        Pengguna.
      </p>

      {/* MODAL FORM */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <UserRound size={20} className="text-blue-600" /> Tambah Pengguna
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
                <label className="text-sm font-medium">Nama *</label>
                <input
                  type="text"
                  value={form.nama}
                  onChange={(e) => setForm({ ...form, nama: e.target.value })}
                  className="w-full border rounded px-3 py-2 mt-1"
                  placeholder="Nama kasir"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Email *</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full border rounded px-3 py-2 mt-1"
                  placeholder="kasir@toko.com"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Password * (min. 6 karakter)</label>
                <input
                  type="text"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full border rounded px-3 py-2 mt-1"
                  placeholder="password"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Peran *</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value as "kasir" | "admin" })}
                  className="w-full border rounded px-3 py-2 mt-1"
                >
                  <option value="kasir">Kasir</option>
                  <option value="admin">Admin</option>
                </select>
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
                onClick={handleAdd}
                className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
