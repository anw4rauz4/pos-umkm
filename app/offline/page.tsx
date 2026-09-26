"use client";

import Link from "next/link";
import { WifiOff, RefreshCw, Store } from "lucide-react";

export default function OfflinePage() {
  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center p-4">
      <div className="text-center max-w-sm">
        <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-5">
          <WifiOff className="text-blue-600" size={36} />
        </div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Anda Sedang Offline</h1>
        <p className="text-gray-500 text-sm mb-6">
          Jangan khawatir — KasirKu AI tetap berfungsi penuh tanpa internet. Data Anda tersimpan
          aman di perangkat ini (IndexedDB). Halaman yang belum pernah dibuka belum tersimpan di
          cache; buka saat online sekali agar tersedia offline.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <button
            onClick={() => window.location.reload()}
            className="flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 text-sm font-semibold"
          >
            <RefreshCw size={16} /> Coba Lagi
          </button>
          <Link
            href="/kasir"
            className="flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-2.5 rounded-lg hover:bg-green-700 text-sm font-semibold"
          >
            <Store size={16} /> Buka Kasir (Offline OK)
          </Link>
        </div>
      </div>
    </div>
  );
}
