export interface UserSession {
  id: number;
  nama: string;
  email: string;
  nama_toko: string;
  alamat_toko: string;
  telepon_toko: string;
  role: "admin" | "kasir";
  login_at: string;
}
