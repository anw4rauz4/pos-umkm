"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import db from "@/lib/db";
import { useAuth } from "@/lib/auth";
import { setPin as savePin, hasPin, verifyPin, isUnlocked } from "@/lib/encryption";
import { Lock, Delete, ShieldCheck, Wallet, ArrowLeft } from "lucide-react";

type LockMode = "loading" | "setup" | "verify" | "unlocked";

export default function LockPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [mode, setMode] = useState<LockMode>("loading");
  const [error, setError] = useState("");

  const transactions = useLiveQuery(() => db.transactions.toArray(), []) || [];

  // Tanggal dihitung sekali saat mount agar render tetap murni (React Compiler)
  const [today] = useState(() => new Date().toISOString().split("T")[0]);
  const omzetToday = transactions
    .filter((t) => t.created_at?.startsWith(today))
    .reduce((s, t) => s + t.total, 0);

  // Tentukan mode awal setelah mount (hindari setState sinkron di effect)
  useEffect(() => {
    const t = setTimeout(() => {
      setMode(hasPin() ? (isUnlocked() ? "unlocked" : "verify") : "setup");
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const press = (d: string) => {
    setError("");
    if (mode === "setup") {
      if (pin.length < 6) setPin(pin + d);
      else if (pin2.length < 6) setPin2(pin2 + d);
    } else if (mode === "verify") {
      if (pin.length < 6) setPin(pin + d);
    }
  };

  const backspace = () => {
    if (mode === "setup") {
      if (pin2.length) setPin2(pin2.slice(0, -1));
      else if (pin.length) setPin(pin.slice(0, -1));
    } else {
      setPin(pin.slice(0, -1));
    }
  };

  // Auto-verifikasi saat 6 digit tercapai (mode verify)
  useEffect(() => {
    if (mode !== "verify" || pin.length !== 6) return;
    const t = setTimeout(() => {
      if (verifyPin(pin)) {
        setMode("unlocked");
        setTimeout(() => router.push("/"), 600);
      } else {
        setError("PIN salah, coba lagi");
        setPin("");
      }
    }, 0);
    return () => clearTimeout(t);
  }, [pin, mode, router]);

  const confirmSetup = () => {
    if (pin.length < 6) {
      setError("PIN minimal 6 digit");
      return;
    }
    if (pin !== pin2) {
      setError("PIN tidak sama, ulangi dari awal");
      setPin("");
      setPin2("");
      return;
    }
    try {
      savePin(pin);
      setMode("unlocked");
      setTimeout(() => router.push("/"), 600);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const dots = (n: number) =>
    Array.from({ length: 6 }, (_, i) => (
      <span
        key={i}
        className={`w-3.5 h-3.5 rounded-full border-2 ${
          i < n ? "bg-navy border-blue-600" : "border-gray-300"
        }`}
      />
    ));

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center">
        <div className="w-16 h-16 bg-navy/5 rounded-2xl flex items-center justify-center mx-auto mb-4">
          {mode === "unlocked" ? (
            <ShieldCheck className="text-olive" size={32} />
          ) : (
            <Lock className="text-navy" size={32} />
          )}
        </div>

        {mode === "loading" && <p className="text-gray-500">Memuat...</p>}

        {mode === "unlocked" && (
          <div>
            <h1 className="text-2xl font-bold text-gray-800">PIN aktif ✅</h1>
            <p className="text-gray-500 mt-2">Mengalihkan ke beranda...</p>
          </div>
        )}

        {mode === "setup" && (
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Buat PIN Keamanan</h1>
            <p className="text-gray-500 text-sm mt-1 mb-6">
              {pin.length < 6 ? "Masukkan PIN baru (6 digit)" : "Ulangi PIN untuk konfirmasi"}
            </p>
            <div className="flex justify-center gap-3 mb-6">
              {pin.length < 6 ? dots(pin.length) : dots(pin2.length)}
            </div>
            {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
            <Keypad onPress={press} onBackspace={backspace} />
            {pin.length >= 6 && (
              <button
                onClick={confirmSetup}
                className="mt-5 w-full bg-navy text-white py-3 rounded-xl font-semibold hover:bg-navy-deep"
              >
                Simpan PIN
              </button>
            )}
          </div>
        )}

        {mode === "verify" && (
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Layar Terkunci</h1>
            <p className="text-gray-500 text-sm mt-1 mb-2">Masukkan PIN untuk membuka</p>
            <p className="text-xs text-gray-400 mb-6">
              {user?.nama} • {user?.nama_toko}
            </p>
            <div className="flex justify-center gap-3 mb-4">{dots(pin.length)}</div>
            {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
            <Keypad onPress={press} onBackspace={backspace} />
            <div className="mt-6 bg-white rounded-xl border border-gray-100 p-4 inline-flex items-center gap-3">
              <Wallet className="text-olive" size={20} />
              <div className="text-left">
                <p className="text-xs text-gray-500">Omzet hari ini</p>
                <p className="font-bold text-gray-800">
                  Rp {omzetToday.toLocaleString("id-ID")}
                </p>
              </div>
            </div>
            <button
              onClick={() => router.back()}
              className="mt-5 text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1 mx-auto"
            >
              <ArrowLeft size={14} /> Kembali
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Keypad({
  onPress,
  onBackspace,
}: {
  onPress: (d: string) => void;
  onBackspace: () => void;
}) {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];
  return (
    <div className="grid grid-cols-3 gap-3 max-w-[260px] mx-auto">
      {keys.map((k, i) =>
        k === "" ? (
          <span key={i} />
        ) : k === "⌫" ? (
          <button
            key={i}
            onClick={onBackspace}
            className="h-14 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 active:scale-95 transition"
          >
            <Delete size={20} />
          </button>
        ) : (
          <button
            key={i}
            onClick={() => onPress(k)}
            className="h-14 rounded-xl bg-white border border-gray-200 text-xl font-semibold text-gray-800 hover:bg-gray-50 active:scale-95 transition"
          >
            {k}
          </button>
        )
      )}
    </div>
  );
}
