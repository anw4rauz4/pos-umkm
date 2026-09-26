"use client";

import { useEffect, useState } from "react";
import { Download, RefreshCw, X, Wifi, WifiOff } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function PWARegister() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [needRefresh, setNeedRefresh] = useState(false);
  const [offline, setOffline] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // ---- Registrasi service worker ----
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.warn("SW registration gagal:", err);
      });

      // Deteksi service worker baru menunggu aktivasi (ada update)
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        // SW baru mengambil kontrol setelah skipWaiting → tawarkan reload
        if (sessionStorage.getItem("kasirku_sw_updated")) setNeedRefresh(true);
      });
    }

    // ---- Prompt install PWA (Chrome/Edge) ----
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    // ---- Status online/offline ----
    const syncOnline = () => setOffline(!navigator.onLine);
    syncOnline();
    window.addEventListener("online", syncOnline);
    window.addEventListener("offline", syncOnline);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("online", syncOnline);
      window.removeEventListener("offline", syncOnline);
    };
  }, []);

  const handleInstall = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
  };

  const handleUpdate = () => {
    sessionStorage.setItem("kasirku_sw_updated", "1");
    window.location.reload();
  };

  if (dismissed) return null;

  // Banner offline kecil (tidak menghalangi kerja kasir)
  if (offline) {
    return (
      <div className="fixed bottom-4 left-4 z-40 flex items-center gap-2 bg-gray-800 text-white text-xs px-3 py-2 rounded-full shadow-lg">
        <WifiOff size={13} className="text-yellow-400" />
        Mode offline — semua fitur tetap jalan
      </div>
    );
  }

  // Banner install / update
  if (!installEvent && !needRefresh) return (
    <div className="fixed bottom-4 right-4 z-40 flex items-center gap-2 bg-green-600 text-white text-xs px-3 py-2 rounded-full shadow-lg pointer-events-none">
      <Wifi size={13} />
      Online
    </div>
  );

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-white rounded-xl shadow-xl border border-gray-200 p-4 w-72">
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
        aria-label="Tutup"
      >
        <X size={16} />
      </button>
      {needRefresh ? (
        <>
          <p className="text-sm font-semibold text-gray-800 pr-4">Update tersedia</p>
          <p className="text-xs text-gray-500 mt-1 mb-3">Versi baru aplikasi sudah siap.</p>
          <button
            onClick={handleUpdate}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-blue-700"
          >
            <RefreshCw size={14} /> Muat Ulang
          </button>
        </>
      ) : (
        <>
          <p className="text-sm font-semibold text-gray-800 pr-4">Install KasirKu AI</p>
          <p className="text-xs text-gray-500 mt-1 mb-3">
            Pasang di desktop/HP — buka instan, tetap jalan tanpa internet.
          </p>
          <button
            onClick={handleInstall}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-blue-700"
          >
            <Download size={14} /> Install App
          </button>
        </>
      )}
    </div>
  );
}
