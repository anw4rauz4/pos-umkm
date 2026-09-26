"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import db from "@/lib/db";
import { useAuth } from "@/lib/auth";
import { StatCard, AreaChart, BarChart, DonutChart } from "@/lib/components/Charts";
import {
  Wallet,
  ShoppingCart,
  AlertTriangle,
  TrendingUp,
  ArrowRight,
  Banknote,
  HandCoins,
} from "lucide-react";

const fmtRp = (n: number) => "Rp " + Math.round(n || 0).toLocaleString("id-ID");

function dayLabel(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

export default function DashboardPage() {
  const { user } = useAuth();
  const transactions = useLiveQuery(() => db.transactions.toArray(), []);
  const items = useLiveQuery(() => db.transaction_items.toArray(), []);
  const products = useLiveQuery(() => db.products.toArray(), []);

  // Tanggal dihitung sekali saat mount agar render tetap murni (React Compiler)
  const [dates] = useState(() => {
    const now = Date.now();
    return {
      today: new Date(now).toISOString().split("T")[0],
      yesterday: new Date(now - 86400000).toISOString().split("T")[0],
    };
  });

  const stats = useMemo(() => {
    const trxs = transactions || [];
    const itemArr = items || [];
    const prodArr = products || [];

    const today = dates.today;
    const yesterday = dates.yesterday;

    const trxToday = trxs.filter((t) => t.created_at?.startsWith(today));
    const trxYesterday = trxs.filter((t) => t.created_at?.startsWith(yesterday));

    const omzetToday = trxToday.reduce((s, t) => s + t.total, 0);
    const omzetYesterday = trxYesterday.reduce((s, t) => s + t.total, 0);
    const itemsToday = itemArr
      .filter((i) => trxToday.some((t) => t.id === i.transaction_id))
      .reduce((s, i) => s + i.qty, 0);

    // Seri 14 hari terakhir (berbasis tanggal hari ini saat mount)
    const days: { label: string; value: number }[] = [];
    const todayMs = new Date(dates.today + "T00:00:00Z").getTime();
    for (let d = 13; d >= 0; d--) {
      const iso = new Date(todayMs - d * 86400000).toISOString().split("T")[0];
      const omzet = trxs
        .filter((t) => t.created_at?.startsWith(iso))
        .reduce((s, t) => s + t.total, 0);
      days.push({ label: dayLabel(iso), value: omzet });
    }

    // Produk terlaris (berdasarkan pendapatan)
    const perProduct: Record<number, { qty: number; revenue: number }> = {};
    for (const it of itemArr) {
      if (!perProduct[it.product_id]) perProduct[it.product_id] = { qty: 0, revenue: 0 };
      perProduct[it.product_id].qty += it.qty;
      perProduct[it.product_id].revenue += it.subtotal || it.qty * (it.harga_satuan || 0);
    }
    const topProducts = Object.entries(perProduct)
      .map(([pid, v]) => {
        const p = prodArr.find((x) => x.id === Number(pid));
        return { label: p?.nama_produk || `Produk #${pid}`, value: v.revenue, qty: v.qty };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    // Metode pembayaran
    const metode: Record<string, number> = {};
    for (const t of trxs) {
      const key = (t.metode_bayar || "lainnya").toUpperCase();
      metode[key] = (metode[key] || 0) + t.total;
    }
    const metodeItems = Object.entries(metode)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);

    // Stok menipis
    const lowStock = prodArr.filter((p) => p.stok <= (p.stok_minimal ?? 10));

    // Kas harian: uang tunai masuk vs kembalian keluar (laporan kas)
    const cashToday = trxToday.reduce((s, t) => s + (t.uang_bayar || 0), 0);
    const kembalianToday = trxToday.reduce((s, t) => s + (t.kembalian || 0), 0);

    // Total sepanjang waktu
    const totalOmzet = trxs.reduce((s, t) => s + t.total, 0);
    const totalTrx = trxs.length;

    return {
      omzetToday,
      trxToday: trxToday.length,
      itemsToday,
      trend:
        omzetYesterday > 0
          ? ((omzetToday - omzetYesterday) / omzetYesterday) * 100
          : omzetToday > 0
            ? 100
            : 0,
      days,
      topProducts,
      metodeItems,
      lowStock,
      totalOmzet,
      totalTrx,
      totalProducts: prodArr.length,
      cashToday,
      kembalianToday,
    };
  }, [transactions, items, products, dates]);

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">📊 Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">
            Ringkasan bisnis {user?.nama_toko ? `— ${user.nama_toko}` : ""}
          </p>
        </div>
        <Link
          href="/kasir"
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-semibold"
        >
          Buka Kasir <ArrowRight size={16} />
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard
          icon={Wallet}
          label="Omzet Hari Ini"
          value={fmtRp(stats.omzetToday)}
          color="green"
          trend={stats.trend}
          sub="vs kemarin"
        />
        <StatCard
          icon={ShoppingCart}
          label="Transaksi Hari Ini"
          value={String(stats.trxToday)}
          sub={`${stats.itemsToday} item terjual`}
          color="blue"
        />
        <StatCard
          icon={TrendingUp}
          label="Total Omzet"
          value={fmtRp(stats.totalOmzet)}
          sub={`${stats.totalTrx} transaksi total`}
          color="purple"
        />
        <StatCard
          icon={AlertTriangle}
          label="Stok Menipis"
          value={String(stats.lowStock.length)}
          sub={`dari ${stats.totalProducts} produk`}
          color={stats.lowStock.length ? "red" : "orange"}
        />
      </div>

      {/* Laporan kas harian */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
            <Banknote className="text-green-600" size={22} />
          </div>
          <div>
            <p className="text-xs text-gray-500">Kas Hari Ini — Tunai Diterima</p>
            <p className="text-xl font-bold text-gray-800">{fmtRp(stats.cashToday)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
            <HandCoins className="text-red-500" size={22} />
          </div>
          <div>
            <p className="text-xs text-gray-500">Kembalian Diberikan</p>
            <p className="text-xl font-bold text-gray-800">{fmtRp(stats.kembalianToday)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
            <Wallet className="text-blue-600" size={22} />
          </div>
          <div>
            <p className="text-xs text-gray-500">Kas Bersih Hari Ini</p>
            <p className="text-xl font-bold text-green-600">{fmtRp(stats.cashToday - stats.kembalianToday)}</p>
          </div>
        </div>
      </div>

      {/* Grafik utama */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-bold text-gray-800">Pendapatan 14 Hari Terakhir</h2>
            <span className="text-xs text-gray-400">hover untuk detail</span>
          </div>
          <AreaChart data={stats.days} height={230} />
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <h2 className="font-bold text-gray-800 mb-3">Metode Pembayaran</h2>
          <DonutChart items={stats.metodeItems} size={150} />
        </div>
      </div>

      {/* Bawah */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-gray-800">🏆 Produk Terlaris</h2>
            <Link href="/produk" className="text-xs text-blue-600 hover:underline">
              Kelola produk
            </Link>
          </div>
          <BarChart
            items={stats.topProducts.map((p) => ({
              label: `${p.label} (${p.qty} pcs)`,
              value: p.value,
            }))}
            color="#10b981"
          />
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={18} className="text-orange-500" />
            <h2 className="font-bold text-gray-800">Perlu Restok</h2>
          </div>
          {stats.lowStock.length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">✅ Semua stok aman</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {stats.lowStock.map((p) => (
                <div
                  key={p.id}
                  className="flex justify-between items-center text-sm bg-red-50 border border-red-100 rounded-lg px-3 py-2"
                >
                  <span className="text-gray-700 truncate pr-2">{p.nama_produk}</span>
                  <span
                    className={`font-bold shrink-0 ${
                      p.stok <= 0 ? "text-red-600" : "text-orange-500"
                    }`}
                  >
                    {p.stok} / min {p.stok_minimal ?? 10}
                  </span>
                </div>
              ))}
            </div>
          )}
          <Link
            href="/supplier"
            className="block text-center text-xs text-blue-600 hover:underline mt-3"
          >
            Lihat supplier →
          </Link>
        </div>
      </div>
    </div>
  );
}
