"use client";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";

export default function BarcodeScanner({
  onDetected,
  onClose,
}: {
  onDetected: (barcode: string) => void;
  onClose: () => void;
}) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadScanner = async () => {
      try {
        const scanner = new Html5Qrcode("barcode-reader");
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" }, // kamera belakang
          {
            fps: 10,
            qrbox: { width: 250, height: 150 },
            aspectRatio: 1.777,
          },
          (decodedText: string) => {
            // Sukses scan
            onDetected(decodedText);
            scanner
              .stop()
              .then(() => scanner.clear())
              .catch(() => {});
          },
          () => {} // Abaikan error frame
        );

        if (mounted) setLoading(false);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Gagal akses kamera");
        setLoading(false);
      }
    };

    loadScanner();

    return () => {
      mounted = false;
      const scanner = scannerRef.current;
      if (scanner) {
        scanner
          .stop()
          .then(() => scanner.clear())
          .catch(() => {});
      }
    };
  }, [onDetected]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg w-full max-w-md overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="font-bold text-lg">📷 Scan Barcode</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-red-500">
            <X size={24} />
          </button>
        </div>

        <div className="p-4">
          <div
            id="barcode-reader"
            className="w-full rounded-lg overflow-hidden bg-black"
            style={{ minHeight: 250 }}
          />

          {loading && !error && (
            <p className="text-center text-sm text-gray-500 mt-4">
              📡 Memuat kamera...
            </p>
          )}

          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-3 mt-4 text-sm text-red-700">
              ❌ {error}
              <p className="text-xs mt-1">
                Pastikan browser diberi izin akses kamera & gunakan HTTPS/localhost.
              </p>
            </div>
          )}

          <p className="text-center text-xs text-gray-500 mt-4">
            Arahkan barcode ke dalam kotak
          </p>
        </div>
      </div>
    </div>
  );
}