// ============================================
// AUTENTIKASI OFFLINE (IndexedDB / Dexie)
// Akun & sesi disimpan lokal di browser.
// Password di-hash SHA-256 + salt per akun.
// ============================================
import { useSyncExternalStore } from "react";
import CryptoJS from "crypto-js";
import db from "./db";
import type { UserSession } from "./auth.types";
import type { UserRow } from "./types";

const SESSION_KEY = "kasirku_session";
const SALT = "kasirku-salt-2025";

export type { UserSession };

export function hashPassword(password: string, email: string): string {
  return CryptoJS.SHA256(`${email.toLowerCase()}::${password}::${SALT}`).toString();
}

// ---------- Register ----------
export async function registerUser(data: {
  nama: string;
  email: string;
  password: string;
  nama_toko: string;
  role?: "admin" | "kasir";
}): Promise<number> {
  const { nama, email, password, nama_toko, role = "admin" } = data;
  if (!nama?.trim()) throw new Error("Nama wajib diisi");
  if (!email?.trim()) throw new Error("Email wajib diisi");
  if (!password || password.length < 6) throw new Error("Password minimal 6 karakter");
  if (!nama_toko?.trim()) throw new Error("Nama toko wajib diisi");

  const emailNorm = email.trim().toLowerCase();
  const exists = await db.users.where("email").equals(emailNorm).count();
  if (exists > 0) throw new Error("Email sudah terdaftar");

  return db.users.add({
    nama: nama.trim(),
    email: emailNorm,
    password_hash: hashPassword(password, emailNorm),
    nama_toko: nama_toko.trim(),
    alamat_toko: "",
    telepon_toko: "",
    role,
    aktif: true,
    created_at: new Date().toISOString(),
  });
}

// ---------- Login ----------
export async function loginUser(email: string, password: string): Promise<UserSession> {
  if (!email?.trim() || !password) throw new Error("Email dan password wajib diisi");
  const emailNorm = email.trim().toLowerCase();
  const user = await db.users.where("email").equals(emailNorm).first();
  if (!user) throw new Error("Akun tidak ditemukan. Silakan daftar dulu.");
  if (!user.aktif) throw new Error("Akun dinonaktifkan. Hubungi admin.");

  if (user.password_hash !== hashPassword(password, emailNorm)) {
    throw new Error("Password salah");
  }

  const session: UserSession = {
    id: user.id as number,
    nama: user.nama,
    email: user.email,
    nama_toko: user.nama_toko,
    alamat_toko: user.alamat_toko || "",
    telepon_toko: user.telepon_toko || "",
    role: user.role,
    login_at: new Date().toISOString(),
  };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  notifyAuthChange();
  return session;
}

// ---------- Sesi ----------
export function getSession(): UserSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as UserSession) : null;
  } catch {
    return null;
  }
}

export function updateSessionStore(patch: Partial<UserSession>): void {
  const s = getSession();
  if (!s) return;
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ ...s, ...patch }));
  notifyAuthChange();
}

export async function logoutUser(): Promise<void> {
  sessionStorage.removeItem(SESSION_KEY);
  notifyAuthChange();
}

// ---------- Hook reaktif (external store: sessionStorage) ----------
const authListeners = new Set<() => void>();

export function notifyAuthChange(): void {
  authListeners.forEach((cb) => cb());
}

function subscribeAuth(cb: () => void): () => void {
  authListeners.add(cb);
  return () => {
    authListeners.delete(cb);
  };
}

function getAuthSnapshot(): string {
  return sessionStorage.getItem(SESSION_KEY) ?? "";
}

function getServerSnapshot(): string {
  return "";
}

export function useAuth(): { user: UserSession | null; loading: boolean; refresh: () => void } {
  const raw = useSyncExternalStore(subscribeAuth, getAuthSnapshot, getServerSnapshot);
  let user: UserSession | null = null;
  try {
    user = raw ? (JSON.parse(raw) as UserSession) : null;
  } catch {
    user = null;
  }
  return { user, loading: false, refresh: notifyAuthChange };
}

// ---------- Update profil & password ----------
export async function updateProfile(userId: number, patch: Partial<UserSession>): Promise<void> {
  const clean = { ...patch };
  delete (clean as Record<string, unknown>).id;
  delete (clean as Record<string, unknown>).password_hash;
  delete (clean as Record<string, unknown>).created_at;
  await db.users.update(userId, clean as Partial<UserRow>);
  const u = await db.users.get(userId);
  if (!u) return;
  updateSessionStore({
    nama: u.nama,
    email: u.email,
    nama_toko: u.nama_toko,
    alamat_toko: u.alamat_toko || "",
    telepon_toko: u.telepon_toko || "",
    role: u.role,
  });
}

export async function changePassword(userId: number, oldPassword: string, newPassword: string): Promise<void> {
  const u = await db.users.get(userId);
  if (!u) throw new Error("Akun tidak ditemukan");
  if (u.password_hash !== hashPassword(oldPassword, u.email)) {
    throw new Error("Password lama salah");
  }
  if (!newPassword || newPassword.length < 6) throw new Error("Password baru minimal 6 karakter");
  await db.users.update(userId, { password_hash: hashPassword(newPassword, u.email) });
}

// ---------- Manajemen pengguna (admin) ----------
export async function listUsers(): Promise<UserRow[]> {
  return db.users.toArray();
}

export async function addUserByAdmin(data: {
  nama: string;
  email: string;
  password: string;
  role?: "admin" | "kasir";
  nama_toko?: string;
}): Promise<number> {
  const { nama, email, password, role, nama_toko } = data;
  if (!nama?.trim()) throw new Error("Nama wajib diisi");
  if (!email?.trim()) throw new Error("Email wajib diisi");
  if (!password || password.length < 6) throw new Error("Password minimal 6 karakter");
  const emailNorm = email.trim().toLowerCase();
  const exists = await db.users.where("email").equals(emailNorm).count();
  if (exists > 0) throw new Error("Email sudah terdaftar");
  return db.users.add({
    nama: nama.trim(),
    email: emailNorm,
    password_hash: hashPassword(password, emailNorm),
    nama_toko: nama_toko?.trim() || "",
    alamat_toko: "",
    telepon_toko: "",
    role: role || "kasir",
    aktif: true,
    created_at: new Date().toISOString(),
  });
}

export async function setUserActive(userId: number, aktif: boolean): Promise<void> {
  const s = getSession();
  if (s && s.id === userId && aktif === false) throw new Error("Tidak bisa menonaktifkan akun sendiri");
  await db.users.update(userId, { aktif });
}

export async function resetUserPassword(userId: number, newPassword: string): Promise<void> {
  const u = await db.users.get(userId);
  if (!u) throw new Error("Akun tidak ditemukan");
  if (!newPassword || newPassword.length < 6) throw new Error("Password minimal 6 karakter");
  await db.users.update(userId, { password_hash: hashPassword(newPassword, u.email) });
}

export async function deleteUser(userId: number): Promise<void> {
  const s = getSession();
  if (s && s.id === userId) throw new Error("Tidak bisa menghapus akun sendiri");
  await db.users.delete(userId);
}
