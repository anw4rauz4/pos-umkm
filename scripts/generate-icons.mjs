/**
 * Generate ikon PWA (PNG 192/512, biasa + maskable) tanpa dependency tambahan.
 * SVG logo dirasterisasi via Chrome headless (puppeteer-core) — konsisten dengan stack project.
 *
 * Jalankan: node scripts/generate-icons.mjs
 */
import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";

const CHROME =
  process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const OUT_DIR = path.resolve("public/icons");

const icons = [
  { file: "icon-192.png", size: 192, pad: 0 },
  { file: "icon-512.png", size: 512, pad: 0 },
  { file: "maskable-192.png", size: 192, pad: 12 }, // safe zone utk mask bundar
  { file: "maskable-512.png", size: 512, pad: 12 },
];

// Logo keranjang belanja + spark "AI" (kuning) pada bg biru.
// pad > 0 → versi maskable: bg penuh 100x100, logo diskalakan ke safe zone.
const svg = (size, pad) => {
  const inner = 100 - pad * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
  <rect x="${pad}" y="${pad}" width="${inner}" height="${inner}" rx="${pad === 0 ? 18 : 0}" fill="#2563eb"/>
  <g transform="translate(0,${pad})" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path d="M22 30 L31 30 L38 62 L72 62 L78 40 L34 40 Z" stroke="#fff" stroke-width="5.5"/>
    <circle cx="43" cy="72" r="4.5" fill="#fff"/>
    <circle cx="66" cy="72" r="4.5" fill="#fff"/>
    <path d="M80 18 L80 28 M75 23 L85 23" stroke="#fbbf24" stroke-width="4"/>
  </g>
</svg>`;
};

fs.mkdirSync(OUT_DIR, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

try {
  const page = await browser.newPage();
  for (const ic of icons) {
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
      svg(ic.size, ic.pad)
    );

    fs.writeFileSync(path.join(OUT_DIR, ic.file), Buffer.from(b64.split(",")[1], "base64"));
    console.log("✓ " + ic.file);
  }
} finally {
  await browser.close();
}
console.log("Ikon PWA selesai → public/icons/");
