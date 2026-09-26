// ============================================
// PIN LOCK - hash disimpan persisten (localStorage) per user
// ============================================
import CryptoJS from "crypto-js";

let ENCRYPTION_KEY: string | null = null;
const PIN_HASH_KEY = "kasirku_pin_hash";

export function setPin(pin: string): boolean {
  if (!pin || pin.length < 6) throw new Error("PIN minimal 6 karakter");
  ENCRYPTION_KEY = CryptoJS.SHA256(pin + "kasirku-salt-2025").toString();
  localStorage.setItem(PIN_HASH_KEY, CryptoJS.SHA256(pin).toString());
  return true;
}

export function hasPin(): boolean {
  if (typeof window === "undefined") return false;
  return !!localStorage.getItem(PIN_HASH_KEY);
}

export function verifyPin(pin: string): boolean {
  const stored = localStorage.getItem(PIN_HASH_KEY);
  if (!stored) return false;
  const ok = CryptoJS.SHA256(pin).toString() === stored;
  if (ok) {
    ENCRYPTION_KEY = CryptoJS.SHA256(pin + "kasirku-salt-2025").toString();
  }
  return ok;
}

export function isUnlocked(): boolean {
  return !!ENCRYPTION_KEY;
}

export function lock(): void {
  ENCRYPTION_KEY = null;
}
