// ============================================
// PRINT STRUK - Thermal Printer Friendly (58mm / 80mm)
// ============================================

export interface ReceiptItem {
  nama_produk: string;
  qty: number;
  harga_jual: number;
  subtotal: number;
}

export interface ReceiptData {
  toko: string;
  alamat?: string;
  telepon?: string;
  items: ReceiptItem[];
  total: number;
  metode_bayar: string;
  /** Uang yang dibayarkan pelanggan (cash); undefined = tidak ditampilkan */
  uang_bayar?: number;
  /** Kembalian untuk pembayaran cash; undefined = tidak ditampilkan */
  kembalian?: number;
  tanggal: string;
  nomor_transaksi?: string;
}

/** Escape karakter berbahaya agar nama produk/toko tidak bisa menyuntik HTML ke struk. */
function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function printReceipt(data: ReceiptData) {
  const width = "58mm"; // standar thermal printer

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Struk - ${esc(data.tanggal)}</title>
      <style>
        @page { margin: 0; size: ${width} auto; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Courier New', monospace;
          font-size: 11px;
          line-height: 1.4;
          width: ${width};
          padding: 4mm 2mm;
          color: #000;
        }
        .center { text-align: center; }
        .bold { font-weight: bold; }
        .big { font-size: 14px; font-weight: bold; }
        .row { display: flex; justify-content: space-between; }
        .row-item { display: flex; justify-content: space-between; margin: 2px 0; }
        .divider { border-top: 1px dashed #000; margin: 4px 0; }
        .divider-solid { border-top: 1px solid #000; margin: 4px 0; }
        .total {
          display: flex;
          justify-content: space-between;
          font-weight: bold;
          font-size: 13px;
          margin-top: 6px;
          padding-top: 4px;
          border-top: 1px solid #000;
        }
        .small { font-size: 9px; }
        .item-name { font-weight: bold; word-break: break-word; }
        .thanks { margin-top: 8px; text-align: center; font-size: 10px; }
        @media print {
          body { padding: 2mm 1mm; }
        }
      </style>
    </head>
    <body>
      <div class="center bold big">${esc(data.toko)}</div>
      ${data.alamat ? `<div class="center small">${esc(data.alamat)}</div>` : ""}
      ${data.telepon ? `<div class="center small">Telp: ${esc(data.telepon)}</div>` : ""}

      <div class="divider-solid"></div>

      <div class="row small">
        <span>${esc(data.tanggal)}</span>
        ${data.nomor_transaksi ? `<span>#${esc(data.nomor_transaksi)}</span>` : ""}
      </div>

      <div class="divider"></div>

      ${data.items
        .map(
          (item) => `
        <div class="item-name">${esc(item.nama_produk)}</div>
        <div class="row-item small">
          <span>  ${esc(item.qty)} x ${item.harga_jual.toLocaleString("id-ID")}</span>
          <span>${item.subtotal.toLocaleString("id-ID")}</span>
        </div>
      `
        )
        .join("")}

      <div class="divider-solid"></div>

      <div class="total">
        <span>TOTAL</span>
        <span>Rp ${data.total.toLocaleString("id-ID")}</span>
      </div>

      ${
        data.uang_bayar != null
          ? `<div class="row small" style="margin-top: 4px;">
        <span>Tunai</span>
        <span class="bold">Rp ${data.uang_bayar.toLocaleString("id-ID")}</span>
      </div>
      <div class="row small">
        <span>Kembalian</span>
        <span class="bold">Rp ${Math.max(0, data.kembalian ?? 0).toLocaleString("id-ID")}</span>
      </div>`
          : ""
      }

      <div class="row small" style="margin-top: 4px;">
        <span>Bayar via</span>
        <span class="bold">${esc(data.metode_bayar.toUpperCase())}</span>
      </div>

      <div class="divider"></div>

      <div class="thanks">
        Terima kasih atas kunjungan Anda!<br>
        Barang yang sudah dibeli tidak dapat ditukar
      </div>

      <div class="center small" style="margin-top: 6px;">
        Powered by KasirKu AI
      </div>
    </body>
    </html>
  `;

  const printWindow = window.open("", "_blank", "width=400,height=600");
  if (!printWindow) {
    alert("❌ Pop-up diblokir. Izinkan pop-up untuk print struk.");
    return;
  }

  printWindow.document.write(html);
  printWindow.document.close();

  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
      // Auto-close setelah print dialog ditutup (opsional)
      // printWindow.close();
    }, 250);
  };
}
