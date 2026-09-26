"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth, getSession } from "@/lib/auth";
import { Store, Loader2 } from "lucide-react";

export default function AuthGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();

  // Halaman login selalu boleh tampil
  if (pathname === "/login") {
    // Sudah login tapi buka /login? Tetap tampilkan form (bisa ganti akun via logout).
    return <>{children}</>;
  }

  if (user) {
    return <>{children}</>;
  }

  return <RedirectToLogin pathname={pathname} router={router} />;
}

function RedirectToLogin({
  pathname,
  router,
}: {
  pathname: string;
  router: ReturnType<typeof useRouter>;
}) {
  const [fired, setFired] = useState(false);

  useEffect(() => {
    if (fired) return;
    // Beri waktu hydration & pembacaan localStorage sebelum memutuskan.
    // Tanpa jeda ini, render pertama setelah hard-reload bisa salah sikap.
    const t = setTimeout(() => {
      setFired(true);
      // Cek ulang langsung ke storage — hindari lempar login jika sesi
      // sebenarnya ada (mis. snapshot hook belum diperbarui).
      if (pathname !== "/login" && !getSession()) {
        router.replace("/login");
      }
    }, 150);
    return () => clearTimeout(t);
  }, [fired, pathname, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center">
        <Loader2 size={36} className="animate-spin mx-auto text-navy" />
        <p className="mt-3 text-gray-500 text-sm">Memeriksa sesi login...</p>
        <Store className="mt-6 mx-auto text-gray-200" size={40} />
      </div>
    </div>
  );
}
