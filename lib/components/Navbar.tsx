"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  ShoppingCart,
  Building2,
  Save,
  Package,
  LayoutDashboard,
  Users,
  LogOut,
  Lock,
  ChevronDown,
  Store,
  UserRound,
} from "lucide-react";
import { useAuth, logoutUser } from "@/lib/auth";

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Tutup dropdown saat klik di luar
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Halaman tanpa navbar (login) - dicek SETELAH semua hooks
  const bareRoutes = ["/login"];
  if (bareRoutes.some((r) => pathname.startsWith(r))) return null;

  const menus = [
    { href: "/", icon: Home, label: "Home" },
    { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/kasir", icon: ShoppingCart, label: "Kasir" },
    { href: "/produk", icon: Package, label: "Produk" },
    { href: "/supplier", icon: Building2, label: "Supplier" },
    { href: "/users", icon: Users, label: "Pengguna", adminOnly: true },
    { href: "/settings/backup", icon: Save, label: "Backup" },
  ];

  const handleLogout = async () => {
    await logoutUser();
    router.replace("/login");
  };

  const visibleMenus = menus.filter((m) => !m.adminOnly || user?.role === "admin");

  return (
    <nav className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 font-bold text-lg text-gray-800 shrink-0">
            <Store className="text-navy" size={22} />
            <span className="hidden sm:inline">KasirKu AI</span>
          </Link>

          {/* Menu */}
          <div className="flex gap-1 overflow-x-auto">
            {visibleMenus.map((m) => {
              const Icon = m.icon;
              const isActive = pathname === m.href;
              return (
                <Link
                  key={m.href}
                  href={m.href}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                    isActive
                      ? "bg-navy text-white"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  }`}
                >
                  <Icon size={16} />
                  <span className="hidden md:inline">{m.label}</span>
                </Link>
              );
            })}
          </div>

          {/* Profil */}
          <div className="relative shrink-0" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-100"
            >
              <div className="w-8 h-8 rounded-full bg-navy text-white flex items-center justify-center text-sm font-bold uppercase">
                {user?.nama?.charAt(0) || "?"}
              </div>
              <div className="hidden sm:block text-left leading-tight">
                <div className="text-sm font-semibold text-gray-800 max-w-[120px] truncate">
                  {user?.nama || "Tamu"}
                </div>
                <div className="text-[10px] text-gray-400 uppercase">{user?.role || "-"}</div>
              </div>
              <ChevronDown size={14} className="text-gray-400" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50">
                <div className="px-4 py-2.5 border-b">
                  <p className="text-sm font-semibold text-gray-800 truncate">{user?.nama}</p>
                  <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                  {user?.nama_toko && (
                    <p className="text-xs text-navy mt-1 truncate">🏪 {user.nama_toko}</p>
                  )}
                </div>
                <Link
                  href="/profile"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <UserRound size={15} /> Profil
                </Link>
                <Link
                  href="/lock"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Lock size={15} /> Kunci Layar (PIN)
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
                >
                  <LogOut size={15} /> Keluar
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
