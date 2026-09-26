import type { Metadata, Viewport } from "next";
import "./globals.css";
import AuthGuard from "@/lib/components/AuthGuard";
import Navbar from "@/lib/components/Navbar";
import PWARegister from "@/lib/components/PWARegister";

export const metadata: Metadata = {
  title: "KasirKu AI - POS UMKM",
  description: "Aplikasi kasir offline 100% lokal untuk UMKM — tanpa cloud",
  applicationName: "KasirKu AI",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "KasirKu AI",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#2563eb",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body className="bg-gray-50">
        <AuthGuard>
          <Navbar />
          <main className="min-h-[calc(100vh-3.5rem)]">{children}</main>
          <PWARegister />
        </AuthGuard>
      </body>
    </html>
  );
}
