"use client";
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import db from "@/lib/db";
import { useAuth, updateProfile, changePassword } from "@/lib/auth";
import {
  UserRound,
  Store,
  MapPin,
  Phone,
  Save,
  KeyRound,
  Loader2,
  CheckCircle2,
} from "lucide-react";

interface ProfileForm {
  nama: string;
  nama_toko: string;
  alamat_toko: string;
  telepon_toko: string;
}

function toForm(u: {
  nama?: string;
  nama_toko?: string;
  alamat_toko?: string;
  telepon_toko?: string;
} | undefined): ProfileForm {
  return {
    nama: u?.nama || "",
    nama_toko: u?.nama_toko || "",
    alamat_toko: u?.alamat_toko || "",
    telepon_toko: u?.telepon_toko || "",
  };
}

export default function ProfilePage() {
  const { user } = useAuth();
  const userRow = useLiveQuery(() => (user ? db.users.get(user.id) : undefined), [user?.id]);

  const [form, setForm] = useState<ProfileForm>(toForm(undefined));
  const [formSource, setFormSource] = useState<ProfileForm | null>(null);
  const [profileMsg, setProfileMsg] = useState("");
  const [profileErr, setProfileErr] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const [pass, setPass] = useState({ old_password: "", new_password: "", confirm: "" });
  const [passMsg, setPassMsg] = useState("");
  const [passErr, setPassErr] = useState("");
  const [savingPass, setSavingPass] = useState(false);

  // Isi form dari data DB (sumber kebenaran).
  // Pattern "adjust state during render": reset hanya saat data DB berubah
  // (dibandingkan per-field, bukan referensi) — tanpa setState di dalam effect.
  const rowForm = toForm(userRow);
  const sourceMatches =
    formSource !== null &&
    rowForm.nama === formSource.nama &&
    rowForm.nama_toko === formSource.nama_toko &&
    rowForm.alamat_toko === formSource.alamat_toko &&
    rowForm.telepon_toko === formSource.telepon_toko;
  if (userRow && !sourceMatches) {
    setForm(rowForm);
    setFormSource(rowForm);
  }

  const set =
    (k: keyof ProfileForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSaveProfile = async () => {
    setProfileMsg("");
    setProfileErr("");
    if (!form.nama.trim()) return setProfileErr("Nama wajib diisi");
    if (!form.nama_toko.trim()) return setProfileErr("Nama toko wajib diisi");
    setSavingProfile(true);
    try {
      await updateProfile(user!.id, form);
      setFormSource(rowForm);
      setProfileMsg("Profil berhasil tersimpan ✓");
      setTimeout(() => setProfileMsg(""), 4000);
    } catch (err) {
      setProfileErr(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    setPassMsg("");
    setPassErr("");
    if (!pass.old_password) return setPassErr("Password lama wajib diisi");
    if (pass.new_password.length < 6) return setPassErr("Password baru minimal 6 karakter");
    if (pass.new_password !== pass.confirm) return setPassErr("Konfirmasi password tidak sama");
    setSavingPass(true);
    try {
      await changePassword(user!.id, pass.old_password, pass.new_password);
      setPass({ old_password: "", new_password: "", confirm: "" });
      setPassMsg("Password berhasil diganti ✓");
      setTimeout(() => setPassMsg(""), 4000);
    } catch (err) {
      setPassErr(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingPass(false);
    }
  };

  const inputCls =
    "w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none";

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-1">👤 Profil</h1>
      <p className="text-gray-500 text-sm mb-6">
        {user?.email} • Peran: <span className="uppercase font-semibold">{user?.role}</span>
      </p>

      <div className="grid grid-cols-1 gap-6">
        {/* ====== DATA PROFIL & TOKO ====== */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-bold text-gray-800 flex items-center gap-2 mb-4">
            <Store size={18} className="text-blue-600" /> Data Toko & Akun
          </h2>

          {profileMsg && (
            <div className="mb-4 flex items-center gap-2 bg-green-50 border-l-4 border-green-500 text-green-700 text-sm px-3 py-2 rounded">
              <CheckCircle2 size={15} /> {profileMsg}
            </div>
          )}
          {profileErr && (
            <div className="mb-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm px-3 py-2 rounded">
              {profileErr}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                <UserRound size={14} className="text-gray-400" /> Nama Lengkap *
              </label>
              <input type="text" name="nama" value={form.nama} onChange={set("nama")} className={inputCls + " mt-1"} />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                <Store size={14} className="text-gray-400" /> Nama Toko *
              </label>
              <input
                type="text"
                name="nama_toko"
                value={form.nama_toko}
                onChange={set("nama_toko")}
                className={inputCls + " mt-1"}
                placeholder="Toko Maju Jaya"
              />
              <p className="text-xs text-gray-400 mt-1">
                Nama ini tampil di beranda, dashboard, dan struk pembayaran.
              </p>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                <MapPin size={14} className="text-gray-400" /> Alamat Toko
              </label>
              <textarea
                name="alamat_toko"
                value={form.alamat_toko}
                onChange={set("alamat_toko")}
                rows={2}
                className={inputCls + " mt-1"}
                placeholder="Jl. Contoh No. 123, Jakarta"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                <Phone size={14} className="text-gray-400" /> Telepon Toko
              </label>
              <input
                type="text"
                name="telepon_toko"
                value={form.telepon_toko}
                onChange={set("telepon_toko")}
                className={inputCls + " mt-1"}
                placeholder="0812-3456-7890"
              />
            </div>

            <button
              onClick={handleSaveProfile}
              disabled={savingProfile}
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-semibold"
            >
              {savingProfile ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Simpan Perubahan
            </button>
          </div>
        </div>

        {/* ====== GANTI PASSWORD ====== */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-bold text-gray-800 flex items-center gap-2 mb-4">
            <KeyRound size={18} className="text-amber-500" /> Ganti Password
          </h2>

          {passMsg && (
            <div className="mb-4 flex items-center gap-2 bg-green-50 border-l-4 border-green-500 text-green-700 text-sm px-3 py-2 rounded">
              <CheckCircle2 size={15} /> {passMsg}
            </div>
          )}
          {passErr && (
            <div className="mb-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm px-3 py-2 rounded">
              {passErr}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Password Lama *</label>
              <input
                type="password"
                name="old_password"
                value={pass.old_password}
                onChange={(e) => setPass((p) => ({ ...p, old_password: e.target.value }))}
                className={inputCls + " mt-1"}
                autoComplete="current-password"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Password Baru *</label>
                <input
                  type="password"
                  name="new_password"
                  value={pass.new_password}
                  onChange={(e) => setPass((p) => ({ ...p, new_password: e.target.value }))}
                  className={inputCls + " mt-1"}
                  placeholder="Minimal 6 karakter"
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Ulangi Password Baru *</label>
                <input
                  type="password"
                  name="confirm_password"
                  value={pass.confirm}
                  onChange={(e) => setPass((p) => ({ ...p, confirm: e.target.value }))}
                  className={inputCls + " mt-1"}
                  autoComplete="new-password"
                />
              </div>
            </div>

            <button
              onClick={handleChangePassword}
              disabled={savingPass}
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-amber-500 text-white px-5 py-2.5 rounded-lg hover:bg-amber-600 disabled:opacity-50 font-semibold"
            >
              {savingPass ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
              Ganti Password
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
