"use client";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import db from "@/lib/db";
import { useAuth } from "@/lib/auth";
import {
  ShoppingCart,
  Building2,
  Save,
  Package,
  LayoutDashboard,
  Wallet,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";

export default function Home() {
  const { user } = useAuth();
  const transactions = useLiveQuery(() => db.transactions.toArray(), []) || [];
  const products = useLiveQuery(() => db.products.toArray(), []) || [];
  const today = new Date().toISOString().split("T")[0];
  const omzetToday = transactions
    .filter((t) => t.created_at?.startsWith(today))
    .reduce((s, t) => s + t.total, 0);
  const lowStock = products.filter((p) => p.stok <= (p.stok_minimal ?? 10)).length;

  const menu = [
    { href: "/dashboard", icon: LayoutDashboard, title: "Dashboard", desc: "Grafik & analytics", color: "bg-indigo-500" },
    { href: "/kasir", icon: ShoppingCart, title: "Kasir", desc: "Transaksi penjualan", color: "bg-green-500" },
    { href: "/produk", icon: Package, title: "Produk", desc: "Master data & import Excel", color: "bg-blue-500" },
    { href: "/supplier", icon: Building2, title: "Supplier", desc: "Kelola supplier", color: "bg-cyan-500" },
    { href: "/settings/backup", icon: Save, title: "Backup", desc: "Backup & restore", color: "bg-purple-500" },
  ];

  const fmtRp = (n: number) => "Rp " + Math.round(n || 0).toLocaleString("id-ID");

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      {/* Sambutan */}
      <div className="text-center mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-800">🛒 KasirKu AI</h1>
        <p className="text-gray-500 mt-2">
          Selamat datang{user?.nama ? `, ${user.nama}` : ""}!
          {user?.nama_toko ? ` — ${user.nama_toko}` : ""}
        </p>
      </div>

      {/* Ringkasan */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-center">
          <Wallet className="mx-auto text-green-500 mb-1.5" size={22} />
          <p className="text-xs text-gray-500">Omzet Hari Ini</p>
          <p className="font-bold text-gray-800 text-sm sm:text-base">{fmtRp(omzetToday)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-center">
          <Package className="mx-auto text-blue-500 mb-1.5" size={22} />
          <p className="text-xs text-gray-500">Total Produk</p>
          <p className="font-bold text-gray-800 text-sm sm:text-base">{products.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-center">
          <AlertTriangle className="mx-auto text-red-500 mb-1.5" size={22} />
          <p className="text-xs text-gray-500">Stok Menipis</p>
          <p className="font-bold text-gray-800 text-sm sm:text-base">{lowStock}</p>
        </div>
      </div>

      {/* Menu */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {menu.map((m) => {
          const Icon = m.icon;
          return (
            <Link
              key={m.href}
              href={m.href}
              className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all active:scale-95"
            >
              <div className={`w-12 h-12 ${m.color} rounded-xl flex items-center justify-center text-white mb-3`}>
                <Icon size={24} />
              </div>
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-1">
                {m.title} <ArrowRight size={14} className="text-gray-300" />
              </h2>
              <p className="text-sm text-gray-500">{m.desc}</p>
            </Link>
          );
        })}
      </div>

      <div className="mt-8 bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
        <p className="text-blue-800 text-sm">
          ✅ Database: IndexedDB (Localhost) | 🔐 Login lokal | 💾 Backup: JSON | 🚫 Tanpa Cloud/Server
        </p>
      </div>
    </div>
  );
}
