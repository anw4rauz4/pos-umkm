"use client";
import { useState } from "react";
import { exportDatabase, importDatabase } from "@/lib/backup";

export default function BackupPage() {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const result = await exportDatabase();
      if (result.success) {
        alert("✅ Backup berhasil didownload!");
      } else {
        alert("❌ Error: " + (result.error || "Gagal membuat backup"));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const result = await importDatabase(file);
      if (result.success) {
        alert("✅ Restore berhasil!");
        window.location.reload();
      } else if (result.reason !== "cancelled") {
        alert("❌ Error: " + (result.error || "Gagal restore backup"));
      }
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <h1 className="text-3xl font-bold mb-6">💾 Backup & Restore</h1>

      <div className="bg-cream-soft border-l-4 border-[#B9A88A] p-4 mb-6 rounded">
        <p className="font-semibold text-[#8A795C]">⚠️ Backup Rutin!</p>
        <p className="text-sm text-[#8A795C]">Lakukan backup minimal 1x seminggu.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-4xl mb-4">📥</div>
          <h2 className="text-xl font-bold mb-2">Export Data</h2>
          <p className="text-gray-600 text-sm mb-4">Simpan semua data ke file JSON.</p>
          <button
            onClick={handleExport}
            disabled={loading}
            className="w-full bg-navy text-white py-3 rounded-lg hover:bg-navy-deep disabled:opacity-50"
          >
            {loading ? "Memproses..." : "Download Backup"}
          </button>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-4xl mb-4">📤</div>
          <h2 className="text-xl font-bold mb-2">Import Data</h2>
          <p className="text-gray-600 text-sm mb-4">Restore dari file backup.</p>
          <label className="block w-full bg-olive text-white py-3 rounded-lg text-center cursor-pointer hover:bg-olive-deep">
            {loading ? "Memproses..." : "Upload Backup"}
            <input type="file" accept=".json" onChange={handleImport} className="hidden" disabled={loading} />
          </label>
        </div>
      </div>
    </div>
  );
}