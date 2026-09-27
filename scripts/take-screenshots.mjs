/**
 * Screenshot app untuk README GitHub.
 * Syarat: server produksi jalan di :3000 (npm run build && npm run start).
 * Output: docs/screenshot-kasir.png, docs/screenshot-dashboard.png, docs/screenshot-produk.png
 *
 * Pendekatan:
 *  - Akun demo dibuat/dipakai via UI login (register → fallback login).
 *  - Transaksi demo diisi LANGSUNG ke IndexedDB (Dexie) via page context —
 *    tanpa UI checkout, sehingga bebas dari popup struk yang bisa menggantung.
 *
 * Jalankan: node scripts/take-screenshots.mjs
 */
import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const CHROME =
  process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const OUT_DIR = path.resolve("docs");
const LOG_FILE = path.join(OUT_DIR, ".screenshot-progress.log");

const results = [];
function log(name, ok, detail = "") {
  const line = `[${ok ? "PASS" : "FAIL"}] ${name}${detail ? " — " + detail : ""}`;
  console.log(line);
  try {
    fs.appendFileSync(LOG_FILE, line + "\n");
  } catch {
    /* ignore */
  }
  results.push({ name, ok });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const text = (p) => p.evaluate(() => document.body.innerText);

async function typeInto(page, sel, val) {
  await page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) throw new Error("element not found: " + s);
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setter.call(el, "");
  }, sel);
  await page.click(sel, { clickCount: 3, timeout: 5000 });
  await page.type(sel, val, { delay: 5 });
}
async function clickButton(page, label) {
  await page.evaluate((l) => {
    const b = [...document.querySelectorAll("button")].find((x) => x.innerText.includes(l));
    if (!b) throw new Error("Tombol tidak ditemukan: " + l);
    b.click();
  }, label);
}
async function clickProductCard(page, nama) {
  await page.evaluate((n) => {
    const card = [...document.querySelectorAll("div.cursor-pointer")].find((d) =>
      d.innerText.includes(n)
    );
    if (!card) throw new Error("Kartu " + n + " tidak ditemukan");
    card.click();
  }, nama);
}
async function goto(page, path, label) {
  await page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 20000 });
  await sleep(1200);
  log(label, true, page.url().replace(BASE, ""));
}

fs.mkdirSync(OUT_DIR, { recursive: true });
try {
  fs.unlinkSync(LOG_FILE);
} catch {
  /* belum ada */
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  protocolTimeout: 30000,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1366, height: 850, deviceScaleFactor: 2 });
page.on("pageerror", (e) => console.log("  [pageerror]", e.message));
page.on("dialog", (d) => d.dismiss().catch(() => {}));

try {
  // ============ 1. LOGIN (akun demo, dibuat bila belum ada) ============
  await page.goto(BASE + "/login", { waitUntil: "domcontentloaded", timeout: 20000 });
  await sleep(800);
  await clickButton(page, "Daftar");
  await sleep(300);
  await typeInto(page, 'input[type="text"]', "Kasir Satu");
  const inputs = await page.$$("input[type='text']");
  if (inputs.length >= 2) await inputs[1].type("Toko Contoh Maju");
  await typeInto(page, 'input[type="email"]', "demo@kasirku.local");
  await typeInto(page, 'input[type="password"]', "demo1234");
  await page.evaluate(() => document.querySelector('button[type="submit"]').click());
  await sleep(2500);
  if (page.url().replace(BASE, "") !== "/") {
    // kemungkinan akun sudah ada — coba login
    await clickButton(page, "Masuk");
    await sleep(2000);
  }
  log("Login/daftar akun demo", page.url().replace(BASE, "") === "/", page.url().replace(BASE, ""));

  // ============ 2. SEED TRANSAKSI DEMO LANGSUNG VIA DEXIE ============
  const seeded = await page.evaluate(
    async () =>
      await (async () => {
        // import Dexie langsung dari bundle halaman (module Next tersedia via window? tidak) —
        // gunakan indexedDB API murni agar tidak bergantung bundler.
        const openDb = () =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open("KasirKuAI_Local");
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
          });
        const db = await openDb();
        const today = new Date();
        const iso = (h) =>
          new Date(today.getFullYear(), today.getMonth(), today.getDate(), h, 15).toISOString();

        const tx = db.transaction(["transactions", "transaction_items", "products"], "readwrite");
        const tStore = tx.objectStore("transactions");
        const iStore = tx.objectStore("transaction_items");
        const pStore = tx.objectStore("products");

        const allProducts = await new Promise((resolve, reject) => {
          const r = pStore.getAll();
          r.onsuccess = () => resolve(r.result);
          r.onerror = () => reject(r.error);
        });
        const byName = (n) => allProducts.find((p) => p.nama_produk.includes(n));
        const demo = [
          { nama: "Kopi Arabica", qty: 2, total: 50000, bayar: 100000, kembali: 50000, jam: 9 },
          { nama: "Gula Pasir", qty: 1, total: 12000, bayar: 20000, kembali: 8000, jam: 11 },
          { nama: "Susu UHT", qty: 1, total: 18000, bayar: 20000, kembali: 2000, jam: 14 },
        ];
        let count = 0;
        for (const d of demo) {
          const p = byName(d.nama);
          if (!p) continue;
          const txId = await new Promise((resolve, reject) => {
            const r = tStore.add({
              total: d.total,
              metode_bayar: "Cash",
              uang_bayar: d.bayar,
              kembalian: d.kembali,
              created_at: iso(d.jam),
              synced: 0,
            });
            r.onsuccess = () => resolve(r.result);
            r.onerror = () => reject(r.error);
          });
          await new Promise((resolve, reject) => {
            const r = iStore.add({
              transaction_id: txId,
              product_id: p.id,
              qty: d.qty,
              harga_satuan: p.harga_jual,
              harga_beli_satuan: p.harga_beli,
              subtotal: d.total,
            });
            r.onsuccess = () => resolve();
            r.onerror = () => reject(r.error);
          });
          count++;
        }
        db.close();
        return count;
      })()
  );
  log("Transaksi demo via IndexedDB", seeded === 3, `${seeded} transaksi`);

  // ============ 3. SCREENSHOT: KASIR (dengan isi keranjang) ============
  await goto(page, "/kasir", "Halaman kasir termuat");
  await sleep(1000);
  await clickProductCard(page, "Kopi Arabica");
  await sleep(400);
  await clickProductCard(page, "Kopi Arabica"); // qty 2
  await sleep(400);
  await clickProductCard(page, "Gula Pasir");
  await sleep(800);
  const keranjangIsi = (await text(page)).includes("Keranjang (2)");
  log("Keranjang terisi (2 item, 3 pcs)", keranjangIsi);
  await page.screenshot({ path: path.join(OUT_DIR, "screenshot-kasir.png") });
  log("Screenshot kasir", true, "docs/screenshot-kasir.png");

  // ============ 4. SCREENSHOT: DASHBOARD ============
  await goto(page, "/dashboard", "Halaman dashboard termuat");
  await sleep(1500);
  await page.screenshot({ path: path.join(OUT_DIR, "screenshot-dashboard.png") });
  log("Screenshot dashboard", true, "docs/screenshot-dashboard.png");

  // ============ 5. SCREENSHOT: PRODUK ============
  await goto(page, "/produk", "Halaman produk termuat");
  await sleep(1500);
  await page.screenshot({ path: path.join(OUT_DIR, "screenshot-produk.png") });
  log("Screenshot produk", true, "docs/screenshot-produk.png");
} catch (err) {
  log("UNEXPECTED ERROR", false, err.message);
} finally {
  await browser.close();
  const passed = results.filter((r) => r.ok).length;
  console.log(`\n===== ${passed}/${results.length} langkah OK =====`);
  process.exit(passed === results.length ? 0 : 1);
}
