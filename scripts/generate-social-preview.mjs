/**
 * Generate gambar social preview GitHub (1280x640 PNG) bertema frost-berries.
 * Hasil: docs/social-preview.png — upload manual ke
 * https://github.com/anw4rauz4/pos-umkm/settings → Social preview.
 *
 * Jalankan: node scripts/generate-social-preview.mjs
 */
import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";

const CHROME =
  process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const OUT = path.resolve("docs/social-preview.png");
const W = 1280;
const H = 640;

// Latar navy + aksen "beri beku" (frost berries) + judul besar.
// Font pakai system sans (Arial/Helvetica) agar tidak bergantung font eksternal.
const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 1280 640">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#16202a"/>
      <stop offset="0.6" stop-color="#1d2733"/>
      <stop offset="1" stop-color="#243244"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#a9bfc9"/>
      <stop offset="1" stop-color="#5c6f67"/>
    </linearGradient>
  </defs>

  <rect width="1280" height="640" fill="url(#bg)"/>

  <!-- panel sage di kanan -->
  <circle cx="1160" cy="120" r="260" fill="#5c6f67" opacity="0.25"/>
  <circle cx="1230" cy="560" r="180" fill="#a9bfc9" opacity="0.15"/>

  <!-- beri beku (frost berries) dekoratif -->
  <g fill="none" stroke-linecap="round">
    <circle cx="1090" cy="200" r="16" fill="#a9bfc9" opacity="0.9"/>
    <circle cx="1135" cy="240" r="11" fill="#e5dccb" opacity="0.8"/>
    <circle cx="1055" cy="255" r="9"  fill="#5c6f67" opacity="0.9"/>
    <path d="M1090 184 Q1096 150 1120 140" stroke="#5b7337" stroke-width="6"/>
    <circle cx="1180" cy="330" r="14" fill="#a9bfc9" opacity="0.7"/>
    <circle cx="1215" cy="300" r="9"  fill="#e5dccb" opacity="0.6"/>
    <path d="M1180 316 Q1186 284 1206 276" stroke="#5b7337" stroke-width="5"/>
    <!-- sparkle -->
    <path d="M960 110 l0 34 M943 127 l34 0" stroke="#a9bfc9" stroke-width="6"/>
    <path d="M1030 470 l0 26 M1017 483 l26 0" stroke="#e5dccb" stroke-width="5" opacity="0.7"/>
  </g>

  <!-- logo keranjang (dari ikon PWA) -->
  <g transform="translate(84,96) scale(3.2)" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <rect x="-6" y="-6" width="56" height="56" rx="10" fill="#a9bfc9" opacity="0.12"/>
    <path d="M22 30 L31 30 L38 62 L72 62 L78 40 L34 40 Z" stroke="#e5dccb" stroke-width="5.5"/>
    <circle cx="43" cy="72" r="4.5" fill="#a9bfc9"/>
    <circle cx="66" cy="72" r="4.5" fill="#a9bfc9"/>
    <path d="M80 18 L80 28 M75 23 L85 23" stroke="#a9bfc9" stroke-width="4"/>
  </g>

  <!-- judul -->
  <text x="84" y="330" font-family="Arial, Helvetica, sans-serif" font-size="84" font-weight="800" fill="#f1ece1">KasirKu AI</text>
  <text x="84" y="392" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="600" fill="#a9bfc9">POS UMKM 100% Offline</text>

  <!-- garis aksen -->
  <rect x="84" y="424" width="220" height="6" rx="3" fill="url(#accent)"/>

  <!-- fitur -->
  <g font-family="Arial, Helvetica, sans-serif" font-size="26" fill="#e5dccb" opacity="0.95">
    <text x="84"  y="492">🧾 Kasir &amp; struk</text>
    <text x="360" y="492">📦 Stok &amp; supplier</text>
    <text x="668" y="492">📊 Laporan harian</text>
    <text x="84"  y="540">🧮 Tutup kas</text>
    <text x="360" y="540">📶 Tanpa internet</text>
    <text x="668" y="540">💾 Data di laptop Anda</text>
  </g>

  <!-- strip bawah -->
  <rect x="0" y="600" width="1280" height="40" fill="#5c6f67" opacity="0.35"/>
  <text x="84" y="627" font-family="Arial, Helvetica, sans-serif" font-size="20" fill="#dce6ea" opacity="0.9">Next.js 16 · React 19 · Dexie (IndexedDB) · PWA</text>
</svg>`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

try {
  const page = await browser.newPage();
  const b64 = await page.evaluate(
    (svgStr) =>
      new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL("image/png"));
        };
        img.onerror = () => reject(new Error("gagal memuat SVG"));
        img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgStr)));
      }),
    svg
  );
  fs.writeFileSync(OUT, Buffer.from(b64.split(",")[1], "base64"));
  console.log("✓ " + OUT);
} finally {
  await browser.close();
}
console.log("Social preview selesai → upload manual di GitHub → Settings → Social preview");
