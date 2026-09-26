/**
 * E2E test mode PRODUKSI: PWA (manifest, service worker, ikon) + laporan kas.
 * Jalankan: node scripts/e2e-pwa.mjs (server produksi harus sudah jalan di :3000)
 */
import puppeteer from "puppeteer-core";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const CHROME =
  process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const results = [];
function log(name, ok, detail = "") {
  const mark = ok ? "PASS" : "FAIL";
  console.log(`[${mark}] ${name}${detail ? " — " + detail : ""}`);
  results.push({ name, ok, detail });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function typeInto(page, sel, val) {
  await page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) throw new Error("element not found: " + s);
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setter.call(el, "");
  }, sel);
  await page.click(sel, { clickCount: 3 });
  await page.type(sel, val, { delay: 10 });
}

async function text(page) {
  return page.evaluate(() => document.body.innerText);
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

async function clickButton(page, label) {
  await page.evaluate((l) => {
    const b = [...document.querySelectorAll("button")].find((x) => x.innerText.includes(l));
    if (!b) throw new Error("Tombol tidak ditemukan: " + l);
    b.click();
  }, label);
}

// ---------- main ----------
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });
const popups = [];
page.on("popup", (p) => popups.push(p));
const dialogs = [];
page.on("dialog", async (d) => {
  dialogs.push(d.message());
  await d.dismiss().catch(() => {});
});
page.on("pageerror", (e) => console.log("  [pageerror]", e.message));

try {
  // ============ 1. PWA: MANIFEST & SERVICE WORKER ============
  console.log("\n== 1. PWA ==");
  await page.goto(BASE + "/login", { waitUntil: "networkidle0", timeout: 30000 });
  await sleep(800);

  const manifestLink = await page.evaluate(() => {
    const l = document.querySelector('link[rel="manifest"]');
    return l ? l.getAttribute("href") : null;
  });
  log("Link manifest di <head>", manifestLink === "/manifest.webmanifest", String(manifestLink));

  const manifestOk = await page.evaluate(async () => {
    const res = await fetch("/manifest.webmanifest");
    const m = await res.json();
    return (
      res.ok &&
      m.name?.includes("KasirKu") &&
      m.display === "standalone" &&
      Array.isArray(m.icons) &&
      m.icons.some((i) => i.purpose === "maskable")
    );
  });
  log("Manifest valid (name, standalone, ikon maskable)", manifestOk);

  const themeColor = await page.evaluate(() =>
    document.querySelector('meta[name="theme-color"]')?.getAttribute("content")
  );
  log("Meta theme-color terpasang", themeColor === "#1d2733", String(themeColor));

  // Tunggu service worker aktif (polling hingga 10 detik)
  let swActive = false;
  for (let i = 0; i < 20 && !swActive; i++) {
    swActive = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      return !!(reg && (reg.active || reg.installing || reg.waiting));
    });
    if (!swActive) await sleep(500);
  }
  log("Service worker terdaftar", swActive);

  // ============ 2. REGISTER ============
  console.log("\n== 2. REGISTER ==");
  await page.goto(BASE + "/login", { waitUntil: "networkidle0", timeout: 30000 });
  await sleep(500);
  await clickButton(page, "Daftar");
  await sleep(300);

  const stamp = Date.now();
  const EMAIL = `pwa${stamp}@test.com`;
  await typeInto(page, 'input[type="text"]', "Kasir PWA");
  const inputs = await page.$$("input[type='text']");
  if (inputs.length >= 2) await inputs[1].type("Toko PWA Uji");
  await typeInto(page, 'input[type="email"]', EMAIL);
  await typeInto(page, 'input[type="password"]', "rahasia123");
  await page.evaluate(() => document.querySelector('button[type="submit"]').click());
  await sleep(2500);
  const body = await text(page);
  log("Register + auto-login sukses", page.url().replace(BASE, "") === "/" && body.includes("Kasir PWA"));

  // /offline dilindungi AuthGuard — dites setelah login (polling hingga render)
  await page.goto(BASE + "/offline", { waitUntil: "networkidle0", timeout: 30000 });
  let offlineOk = false;
  let offlineBody = "";
  for (let i = 0; i < 12 && !offlineOk; i++) {
    offlineBody = await text(page);
    offlineOk = offlineBody.includes("Anda Sedang Offline") && offlineBody.includes("IndexedDB");
    if (!offlineOk) await sleep(500);
  }
  log("Halaman /offline render", offlineOk, offlineBody.slice(0, 80).replace(/\n/g, " | "));

  // ============ 3. CHECKOUT CASH ============
  console.log("\n== 3. CHECKOUT CASH ==");
  await page.goto(BASE + "/kasir", { waitUntil: "networkidle0", timeout: 30000 });
  // Polling hingga kartu produk muncul (maks 8 detik) — hidrasi + live query
  let cardFound = false;
  for (let i = 0; i < 16 && !cardFound; i++) {
    cardFound = await page.evaluate(
      () => [...document.querySelectorAll("div.cursor-pointer")].some((d) => d.innerText.includes("Kopi Arabica"))
    );
    if (!cardFound) await sleep(500);
  }
  log("Daftar produk termuat di kasir", cardFound);
  await clickProductCard(page, "Kopi Arabica"); // 1 x Rp 25.000
  await sleep(500);
  await clickButton(page, "Cash");
  await sleep(400);
  await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) => x.innerText.trim() === "50rb");
    if (!b) throw new Error("Preset 50rb tidak ditemukan");
    b.click();
  });
  await sleep(300);
  let body2 = await text(page);
  log("Kembalian Rp 25.000 tampil di modal", body2.includes("Kembalian: Rp 25.000"));

  popups.length = 0;
  await clickButton(page, "Selesaikan Transaksi");
  await sleep(2000);
  let struk = "";
  if (popups.length > 0) {
    await sleep(800);
    struk = await popups[0].evaluate(() => document.body.innerText).catch(() => "");
  }
  log(
    "Struk: TOTAL 25.000 / Tunai 50.000 / Kembalian 25.000",
    struk.includes("Tunai") && struk.includes("Rp 50.000") && struk.includes("Kembalian"),
    ""
  );

  // ============ 4. LAPORAN KAS DI DASHBOARD ============
  console.log("\n== 4. LAPORAN KAS ==");
  await page.goto(BASE + "/dashboard", { waitUntil: "networkidle0", timeout: 30000 });
  await sleep(1000);
  body2 = await text(page);
  log(
    "Kartu kas tampil (diterima 50rb / kembalian 25rb / bersih 25rb)",
    body2.includes("Kas Hari Ini") &&
      body2.includes("Tunai Diterima") &&
      body2.includes("Kembalian Diberikan") &&
      body2.includes("Kas Bersih") &&
      body2.includes("Rp 50.000") &&
      body2.includes("Rp 25.000"),
    ""
  );

  log("Tidak ada dialog error tak terduga", dialogs.length === 0, dialogs.join("; "));
} catch (err) {
  log("UNEXPECTED ERROR", false, err.message);
} finally {
  await browser.close();
  const passed = results.filter((r) => r.ok).length;
  console.log(`\n===== ${passed}/${results.length} tests passed =====`);
  process.exit(passed === results.length ? 0 : 1);
}
