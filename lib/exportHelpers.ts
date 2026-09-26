// ============================================
// EXPORT / SHARE LAPORAN (Excel + PDF)
// ============================================
import * as XLSX from "xlsx";

export function formatRp(n: number): string {
  return "Rp " + Math.round(n || 0).toLocaleString("id-ID");
}

/** Buka dialog share (mobile) atau download file. */
export async function shareOrDownloadFile(blob: Blob, filename: string, title = "Laporan") {
  const file = new File([blob], filename, { type: blob.type });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title, text: title });
      return;
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return; // user membatalkan share
      // fallthrough ke download
    }
  }
  downloadBlob(blob, filename);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

// ---------- EXCEL ----------

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

// ---------- PDF (via print dialog → "Save as PDF") ----------

export interface PdfSection {
  heading?: string;
  columns: string[];
  rows: (string | number)[][];
  /** indeks kolom yang rata kanan */
  rightAlign?: number[];
}

export function printPdfReport(opts: {
  title: string;
  subtitle?: string;
  summary?: { label: string; value: string; accent?: string }[];
  sections?: PdfSection[];
  footer?: string;
}) {
  const esc = (v: unknown) =>
    String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const accent = (c?: string) =>
    c === "green" ? "#059669" : c === "red" ? "#dc2626" : c === "purple" ? "#7c3aed" : "#1d4ed8";

  const summaryHtml = (opts.summary || [])
    .map(
      (s) => `
      <div class="card">
        <div class="card-label">${esc(s.label)}</div>
        <div class="card-value" style="color:${accent(s.accent)}">${esc(s.value)}</div>
      </div>`
    )
    .join("");

  const sectionsHtml = (opts.sections || [])
    .map(
      (sec) => `
      ${sec.heading ? `<h2>${esc(sec.heading)}</h2>` : ""}
      <table>
        <thead>
          <tr>${sec.columns.map((c) => `<th>${esc(c)}</th>`).join("")}</tr>
        </thead>
        <tbody>
          ${
            sec.rows.length
              ? sec.rows
                  .map(
                    (r) =>
                      `<tr>${r
                        .map((cell, i) => {
                          const cls = sec.rightAlign?.includes(i) ? ' class="num"' : "";
                          const val = typeof cell === "number" && sec.rightAlign?.includes(i)
                            ? cell.toLocaleString("id-ID")
                            : cell;
                          return `<td${cls}>${esc(val)}</td>`;
                        })
                        .join("")}</tr>`
                  )
                  .join("")
              : `<tr><td colspan="${sec.columns.length}" class="empty">Tidak ada data</td></tr>`
          }
        </tbody>
      </table>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8">
<title>${esc(opts.title)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1f2937; padding: 28px 32px; font-size: 12px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #1d4ed8; padding-bottom: 12px; margin-bottom: 16px; }
  .header h1 { font-size: 20px; color: #1d4ed8; }
  .header .sub { color: #6b7280; font-size: 11px; margin-top: 2px; }
  .header .meta { text-align: right; font-size: 10px; color: #6b7280; }
  h2 { font-size: 14px; margin: 18px 0 8px; color: #111827; border-left: 4px solid #1d4ed8; padding-left: 8px; }
  .cards { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 6px; }
  .card { flex: 1; min-width: 140px; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 12px; background: #f9fafb; }
  .card-label { font-size: 10px; color: #6b7280; text-transform: uppercase; letter-spacing: .4px; }
  .card-value { font-size: 16px; font-weight: 700; margin-top: 3px; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  th { background: #1d4ed8; color: #fff; text-align: left; padding: 7px 8px; font-size: 10.5px; text-transform: uppercase; letter-spacing: .3px; }
  td { padding: 6px 8px; border-bottom: 1px solid #e5e7eb; }
  tr:nth-child(even) td { background: #f8fafc; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
  td.empty { text-align: center; color: #9ca3af; padding: 18px; }
  .footer { margin-top: 22px; padding-top: 8px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 10px; display: flex; justify-content: space-between; }
  @media print {
    body { padding: 12mm 10mm; }
    .no-print { display: none; }
    tr { page-break-inside: avoid; }
  }
  .toolbar { position: fixed; top: 12px; right: 16px; }
  .toolbar button { background: #1d4ed8; color: #fff; border: 0; padding: 10px 18px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,.2); }
</style>
</head>
<body>
  <div class="toolbar no-print"><button onclick="window.print()">🖨️ Simpan / Print PDF</button></div>
  <div class="header">
    <div>
      <h1>${esc(opts.title)}</h1>
      ${opts.subtitle ? `<div class="sub">${esc(opts.subtitle)}</div>` : ""}
    </div>
    <div class="meta">
      Dicetak: ${new Date().toLocaleString("id-ID")}<br>
      KasirKu AI — POS UMKM
    </div>
  </div>
  ${summaryHtml ? `<div class="cards">${summaryHtml}</div>` : ""}
  ${sectionsHtml}
  <div class="footer">
    <span>${esc(opts.footer || "Dokumen dibuat otomatis oleh KasirKu AI")}</span>
    <span>${new Date().getFullYear()}</span>
  </div>
  <script>window.addEventListener("load", function(){ setTimeout(function(){ window.print(); }, 400); });<\\/script>
</body>
</html>`;

  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) {
    alert("Popup diblokir browser. Izinkan popup untuk mencetak PDF.");
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}
