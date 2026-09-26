"use client";
import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { X, Upload, FileSpreadsheet, CheckCircle2, XCircle, Download, Loader2 } from "lucide-react";
import type { Product } from "@/lib/types";

// Baris Excel mentah: kolom header bisa apa saja
type ExcelRow = Record<string, unknown>;

// Baris Excel -> object produk
function mapRowToProduct(row: ExcelRow): Product {
  const get = (...keys: string[]): unknown => {
    for (const k of keys) {
      const found = Object.keys(row).find((rk) => rk.toLowerCase().trim() === k.toLowerCase());
      if (found !== undefined && row[found] !== undefined && row[found] !== "") {
        return row[found];
      }
    }
    return undefined;
  };
  const toStr = (v: unknown): string => (v === undefined ? "" : String(v).trim());
  const toNum = (v: unknown): number => {
    if (v === undefined || v === null || v === "") return 0;
    const n = Number(
      String(v)
        .replace(/[^0-9.,-]/g, "")
        .replace(/\.(?=\d{3}\b)/g, "")
        .replace(",", ".")
    );
    return isNaN(n) ? 0 : n;
  };

  return {
    nama_produk: toStr(get("nama_produk", "nama", "nama barang", "product", "name")),
    sku: toStr(get("sku", "kode", "kode produk")),
    barcode: toStr(get("barcode", "barode", "kode bar")),
    harga_beli: toNum(get("harga_beli", "harga beli", "hbeli", "buy price")),
    harga_jual: toNum(get("harga_jual", "harga jual", "hjual", "price", "harga")),
    stok: toNum(get("stok", "stock", "qty", "jumlah")),
    stok_minimal: toNum(get("stok_minimal", "stok minimal", "min", "min stock")) || 10,
    supplier_id: null,
    gambar: null,
  };
}

function validateProduct(p: Product): string[] {
  const errors: string[] = [];
  if (!p.nama_produk) errors.push("nama kosong");
  if (!p.harga_jual || p.harga_jual <= 0) errors.push("harga jual ≤ 0");
  if (p.harga_beli > 0 && p.harga_jual > 0 && p.harga_jual < p.harga_beli)
    errors.push("harga jual < harga beli");
  return errors;
}

interface ImportRow {
  product: Product;
  errors: string[];
}

type ImportMode = "merge" | "replace";

interface BulkUploadModalProps {
  onClose: () => void;
  onImported?: () => void;
  modeDefault?: ImportMode;
}

export default function BulkUploadModal({ onClose, onImported, modeDefault = "merge" }: BulkUploadModalProps) {
  const [step, setStep] = useState<"pick" | "preview" | "done">("pick");
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [mode, setMode] = useState<ImportMode>(modeDefault);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ inserted: number; updated: number; skipped: number } | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!["xlsx", "xls", "csv", "txt"].includes(ext)) {
      alert("Format file harus .xlsx, .xls, atau .csv");
      return;
    }
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<ExcelRow>(ws, { defval: "" });
      if (!json.length) {
        alert("File kosong atau format tidak dikenali. Baris pertama harus header kolom.");
        return;
      }
      const mapped: ImportRow[] = json.map((r) => {
        const product = mapRowToProduct(r);
        return { product, errors: validateProduct(product) };
      });
      setFileName(file.name);
      setRows(mapped);
      setStep("preview");
    } catch (err) {
      alert("Gagal membaca file: " + (err instanceof Error ? err.message : String(err)));
    }
    e.target.value = "";
  };

  const validRows = rows.filter((r) => r.errors.length === 0);
  const invalidRows = rows.filter((r) => r.errors.length > 0);

  const doImport = async () => {
    if (!validRows.length) return;
    setImporting(true);
    try {
      const { default: db } = await import("@/lib/db");
      const now = new Date().toISOString();
      const records = validRows.map((r) => ({ ...r.product, created_at: now }));

      let inserted = 0;
      let updated = 0;
      await db.transaction("rw", db.products, async () => {
        if (mode === "replace") {
          await db.products.clear();
          await db.products.bulkAdd(records);
          inserted = records.length;
        } else {
          // merge: update jika SKU/barcode sudah ada, selain itu tambah
          const existing = await db.products.toArray();
          const byKey = new Map<string, Product>();
          for (const p of existing) {
            if (p.sku) byKey.set("s:" + p.sku.toLowerCase(), p);
            if (p.barcode) byKey.set("b:" + p.barcode, p);
          }
          const toAdd: Product[] = [];
          for (const rec of records) {
            const key = rec.sku ? "s:" + rec.sku.toLowerCase() : rec.barcode ? "b:" + rec.barcode : null;
            const found = key ? byKey.get(key) : undefined;
            if (found?.id !== undefined) {
              const rest: Partial<Product> = { ...rec };
              delete rest.id;
              await db.products.update(found.id, {
                ...rest,
                nama_produk: rest.nama_produk || found.nama_produk,
                sku: rest.sku || found.sku,
                barcode: rest.barcode || found.barcode,
                harga_beli: rest.harga_beli || found.harga_beli,
                harga_jual: rest.harga_jual || found.harga_jual,
                stok_minimal: rest.stok_minimal || found.stok_minimal,
                // Jangan timpa data yang tidak ada di file import
                gambar: rest.gambar || found.gambar,
                supplier_id: rest.supplier_id ?? found.supplier_id,
                created_at: found.created_at || rest.created_at,
              });
              updated++;
            } else {
              toAdd.push(rec);
            }
          }
          if (toAdd.length) {
            await db.products.bulkAdd(toAdd);
            inserted = toAdd.length;
          }
        }
      });

      setResult({ inserted, updated, skipped: invalidRows.length });
      setStep("done");
      onImported?.();
    } catch (err) {
      alert("Gagal import: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const template = [
      { nama_produk: "Kopi Arabica 250g", sku: "KOPI-01", barcode: "8991234567890", harga_beli: 20000, harga_jual: 25000, stok: 50, stok_minimal: 10 },
      { nama_produk: "Gula Pasir 1kg", sku: "GULA-01", barcode: "8991234567891", harga_beli: 10000, harga_jual: 12000, stok: 8, stok_minimal: 15 },
      { nama_produk: "Susu UHT 1L", sku: "SUSU-01", barcode: "8991234567892", harga_beli: 15000, harga_jual: 18000, stok: 120, stok_minimal: 20 },
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template Produk");
    XLSX.writeFile(wb, "template-import-produk.xlsx");
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <FileSpreadsheet className="text-green-600" size={22} />
            Import Master Produk (Bulk)
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-red-500">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1">
          {/* STEP 1: pilih file */}
          {step === "pick" && (
            <div>
              <div
                onClick={() => inputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 rounded-xl p-10 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/40 transition-colors"
              >
                <Upload size={40} className="mx-auto text-gray-400 mb-3" />
                <p className="font-semibold text-gray-700">Klik untuk pilih file Excel / CSV</p>
                <p className="text-sm text-gray-400 mt-1">Format: .xlsx, .xls, .csv</p>
              </div>
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls,.csv,.txt"
                onChange={handleFile}
                className="hidden"
              />

              <div className="mt-4 bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-blue-800">
                <p className="font-semibold mb-1">Kolom yang dikenali:</p>
                <p className="text-xs leading-relaxed">
                  <b>nama_produk</b> (wajib) • <b>sku</b> • <b>barcode</b> • <b>harga_beli</b> •{" "}
                  <b>harga_jual</b> (wajib) • <b>stok</b> • <b>stok_minimal</b>
                </p>
              </div>

              <button
                onClick={downloadTemplate}
                className="mt-3 flex items-center gap-2 text-sm text-blue-600 hover:underline"
              >
                <Download size={14} /> Download template Excel
              </button>
            </div>
          )}

          {/* STEP 2: preview */}
          {step === "preview" && (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="text-sm">
                  <p className="font-semibold text-gray-800 truncate max-w-xs">📄 {fileName}</p>
                  <p className="text-xs text-gray-500">
                    {rows.length} baris •{" "}
                    <span className="text-green-600 font-semibold">{validRows.length} valid</span> •{" "}
                    <span className="text-red-500 font-semibold">{invalidRows.length} bermasalah</span>
                  </p>
                </div>
                <button
                  onClick={() => { setStep("pick"); setRows([]); }}
                  className="text-sm text-blue-600 hover:underline"
                >
                  Pilih file lain
                </button>
              </div>

              {/* Mode import */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                <button
                  onClick={() => setMode("merge")}
                  className={`p-3 rounded-lg border-2 text-left transition-colors ${
                    mode === "merge" ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <p className="font-semibold text-sm text-gray-800">➕ Gabungkan</p>
                  <p className="text-xs text-gray-500">Update produk dengan SKU/barcode sama, tambah yang baru</p>
                </button>
                <button
                  onClick={() => {
                    if (confirm("Mode Ganti Semua akan MENGHAPUS semua produk existing. Lanjutkan?")) setMode("replace");
                  }}
                  className={`p-3 rounded-lg border-2 text-left transition-colors ${
                    mode === "replace" ? "border-red-500 bg-red-50" : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <p className="font-semibold text-sm text-gray-800">🔄 Ganti Semua</p>
                  <p className="text-xs text-gray-500">Hapus semua produk, ganti dengan file ini</p>
                </button>
              </div>

              {/* Tabel preview */}
              <div className="border rounded-lg overflow-auto max-h-72">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr className="text-left text-gray-500">
                      <th className="px-2 py-2">Status</th>
                      <th className="px-2 py-2">Nama</th>
                      <th className="px-2 py-2">SKU</th>
                      <th className="px-2 py-2 text-right">H. Beli</th>
                      <th className="px-2 py-2 text-right">H. Jual</th>
                      <th className="px-2 py-2 text-right">Stok</th>
                      <th className="px-2 py-2">Masalah</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 100).map((r, i) => (
                      <tr key={i} className={`border-t ${r.errors.length ? "bg-red-50/50" : ""}`}>
                        <td className="px-2 py-1.5">
                          {r.errors.length === 0 ? (
                            <CheckCircle2 size={14} className="text-green-500" />
                          ) : (
                            <XCircle size={14} className="text-red-500" />
                          )}
                        </td>
                        <td className="px-2 py-1.5 font-medium text-gray-800 max-w-[140px] truncate">
                          {r.product.nama_produk || <span className="text-red-400">—</span>}
                        </td>
                        <td className="px-2 py-1.5 text-gray-500">{r.product.sku || "-"}</td>
                        <td className="px-2 py-1.5 text-right">{r.product.harga_beli.toLocaleString("id-ID")}</td>
                        <td className="px-2 py-1.5 text-right font-semibold">
                          {r.product.harga_jual.toLocaleString("id-ID")}
                        </td>
                        <td className="px-2 py-1.5 text-right">{r.product.stok}</td>
                        <td className="px-2 py-1.5 text-red-500">{r.errors.join(", ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.length > 100 && (
                <p className="text-xs text-gray-400 mt-1">Menampilkan 100 baris pertama dari {rows.length}.</p>
              )}
            </div>
          )}

          {/* STEP 3: selesai */}
          {step === "done" && result && (
            <div className="text-center py-8">
              <CheckCircle2 size={56} className="mx-auto text-green-500 mb-3" />
              <h4 className="text-lg font-bold text-gray-800 mb-1">Import selesai!</h4>
              <p className="text-sm text-gray-600">
                {[
                  result.inserted > 0 ? `${result.inserted} produk ditambahkan` : "",
                  result.updated > 0 ? `${result.updated} produk diupdate` : "",
                  result.skipped > 0 ? `${result.skipped} dilewati (data tidak valid)` : "",
                ]
                  .filter(Boolean)
                  .join(", ") || "Tidak ada perubahan"}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-300 py-2.5 rounded-lg hover:bg-gray-50 font-medium"
          >
            {step === "done" ? "Tutup" : "Batal"}
          </button>
          {step === "preview" && (
            <button
              onClick={doImport}
              disabled={importing || validRows.length === 0}
              className="flex-[2] bg-green-600 text-white py-2.5 rounded-lg hover:bg-green-700 disabled:opacity-50 font-semibold flex items-center justify-center gap-2"
            >
              {importing ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Mengimpor...
                </>
              ) : (
                <>
                  <Upload size={16} /> Import {validRows.length} Produk
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
