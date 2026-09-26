// Sync engine (opsional, hanya jika nanti mau connect cloud)
// Untuk sekarang biarkan kosong saja karena kita 100% offline.

export interface SyncStatus {
  mode: "local-only";
  online: boolean;
  cloudConnected: boolean;
}

export function getSyncStatus(): SyncStatus {
  return {
    mode: "local-only",
    online: typeof navigator !== "undefined" ? navigator.onLine : false,
    cloudConnected: false,
  };
}
