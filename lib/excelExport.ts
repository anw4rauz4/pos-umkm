// ============================================
// EXPORT EXCEL — modul terpisah agar library xlsx
// hanya dimuat saat fitur export benar-benar dipakai.
// ============================================
import * as XLSX from "xlsx";
import { shareOrDownloadFile } from "./exportHelpers";

export interface SheetSpec {
  name: string;
  rows: Record<string, string | number>[];
  columnWidths?: number[];
}

export function exportExcel(sheets: SheetSpec[], filename: string, shareTitle?: string) {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const ws = XLSX.utils.json_to_sheet(s.rows.length ? s.rows : [{ Info: "Tidak ada data" }]);
    if (s.columnWidths?.length) ws["!cols"] = s.columnWidths.map((w) => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31));
  }
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([out], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  return shareOrDownloadFile(blob, filename, shareTitle || "Laporan Excel");
}
