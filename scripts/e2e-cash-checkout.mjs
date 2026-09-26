/**
 * E2E test khusus: alur checkout CASH dengan uang bayar & kembalian di halaman kasir.
 * Jalankan: node scripts/e2e-cash-checkout.mjs (dev server harus sudah jalan di :3000)
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
page.on("popup", (p) => {
  popups.push(p);
  p.on("pageerror", (e) => console.log("  [popup pageerror]", e.message));
});
const dialogs = [];
page.on("dialog", async (d) => {
  dialogs.push(d.message());
  console.log("  [dialog]", d.message());
  await d.dismiss().catch(() => {});
});
page.on("pageerror", (e) => console.log("  [pageerror]", e.message));

try {
  // ============ 1. REGISTER ============
  console.log("\n== 1. REGISTER ==");
  await page.goto(BASE + "/login", { waitUntil: "networkidle0", timeout: 30000 });
  await sleep(500);

  await clickButton(page, "Daftar");
  await sleep(300);

  const stamp = Date.now();
  const EMAIL = `kasir${stamp}@test.com`;

  await typeInto(page, 'input[type="text"]', "Kasir Uji");
  const inputs = await page.$$("input[type='text']");
  if (inputs.length >= 2) await inputs[1].type("Toko Kasir Uji");
  await typeInto(page, 'input[type="email"]', EMAIL);
  await typeInto(page, 'input[type="password"]', "rahasia123");

  await page.evaluate(() => document.querySelector('button[type="submit"]').click());
  await sleep(2500);
  const body = await text(page);
  log("Register + auto-login sukses", page.url().replace(BASE, "") === "/" && body.includes("Kasir Uji"));

  // ============ 2. BUKA KASIR & TAMBAH KE KERANJANG ============
  console.log("\n== 2. KASIR: TAMBAH PRODUK ==");
  await page.goto(BASE + "/kasir", { waitUntil: "networkidle0", timeout: 30000 });
  await sleep(800);
  let body2 = await text(page);
  log("Halaman kasir termuat", body2.includes("Pilih Produk") && body2.includes("Keranjang"));

  // Seed: Kopi Arabica Rp 25.000, stok 50. Dua klik terpisah agar state React update.
  await clickProductCard(page, "Kopi Arabica");
  await sleep(400);
  await clickProductCard(page, "Kopi Arabica");
  await sleep(600);
  body2 = await text(page);
  log("Produk masuk keranjang qty 2 (total 50.000)", body2.includes("Keranjang (1)") && body2.includes("Rp 50.000"), "total = 2 x 25.000");

  // ============ 3. MODAL BAYAR CASH ============
  console.log("\n== 3. MODAL CASH ==");
  await clickButton(page, "Cash");
  await sleep(400);
  body2 = await text(page);
  log("Modal cash terbuka dengan total", body2.includes("Pembayaran Cash") && body2.includes("Total belanja") && body2.includes("Rp 50.000"));

  const disabledEmpty = await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) => x.innerText.includes("Selesaikan Transaksi"));
    return b ? b.disabled : null;
  });
  log("Tombol checkout disabled saat uang kosong", disabledEmpty === true);

  // Isi kurang dari total -> tetap disabled
  await typeInto(page, 'input[type="number"]', "20000");
  await sleep(300);
  const disabledLess = await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) => x.innerText.includes("Selesaikan Transaksi"));
    return b ? b.disabled : null;
  });
  body2 = await text(page);
  log("Uang kurang -> tombol disabled & tanpa kembalian", disabledLess === true && !body2.includes("Kembalian:"));

  // Preset 100rb -> kembalian 50rb, tombol aktif
  await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) => x.innerText.trim() === "100rb");
    if (!b) throw new Error("Preset 100rb tidak ditemukan");
    b.click();
  });
  await sleep(300);
  body2 = await text(page);
  log("Preset 100rb -> kembalian Rp 50.000 tampil", body2.includes("Kembalian:") && body2.includes("Rp 50.000"));

  const disabledEnough = await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) => x.innerText.includes("Selesaikan Transaksi"));
    return b ? b.disabled : null;
  });
  log("Tombol checkout aktif setelah uang cukup", disabledEnough === false);

  // ============ 4. CHECKOUT VIA ENTER ============
  console.log("\n== 4. CHECKOUT ==");
  popups.length = 0;
  await page.focus('input[type="number"]');
  await page.keyboard.press("Enter");
  await sleep(2000);
  body2 = await text(page);

  log("Modal tertutup & keranjang kosong", !body2.includes("Pembayaran Cash") && body2.includes("Keranjang (0)"));

  let struk = "";
  if (popups.length > 0) {
    await sleep(800);
    struk = await popups[0].evaluate(() => document.body.innerText).catch(() => "");
  }
  log("Struk tercetak (popup terbuka)", struk.length > 0, `${popups.length} popup`);
  log(
    "Struk: TOTAL 50.000 / Tunai 100.000 / Kembalian 50.000",
    struk.toUpperCase().includes("TOTAL") &&
      struk.includes("Rp 50.000") &&
      struk.includes("Tunai") &&
      struk.includes("Rp 100.000") &&
      struk.includes("Kembalian"),
    struk.split("\n").filter((l) => /TOTAL|Tunai|Kembalian/.test(l)).join(" | ")
  );

  // Stok berkurang: 50 - 2 = 48
  await typeInto(page, 'input[placeholder*="Cari produk"]', "Kopi Arabica");
  await sleep(600);
  body2 = await text(page);
  log("Stok berkurang jadi 48", body2.includes("Stok: 48"));
  log("Tombol Print Ulang Struk muncul", body2.includes("Print Ulang Struk"));

  // ============ 5. TRANSAKSI KEDUA: UANG PAS ============
  console.log("\n== 5. UANG PAS ==");
  await clickProductCard(page, "Kopi Arabica");
  await sleep(400);
  await clickButton(page, "Cash");
  await sleep(400);
  await clickButton(page, "Uang pas");
  await sleep(300);
  body2 = await text(page);
  log("Uang pas -> kembalian Rp 0 tampil", body2.includes("Kembalian: Rp 0"));

  popups.length = 0;
  await clickButton(page, "Selesaikan Transaksi");
  await sleep(2000);

  let struk2 = "";
  if (popups.length > 0) {
    await sleep(800);
    struk2 = await popups[0].evaluate(() => document.body.innerText).catch(() => "");
  }
  log(
    "Struk 2: Tunai 25.000 / Kembalian Rp 0",
    struk2.includes("Tunai") && struk2.includes("Rp 25.000") && struk2.includes("Kembalian"),
    ""
  );

  // Stok akhir 47
  await sleep(400);
  body2 = await text(page);
  log("Stok berkurang jadi 47", body2.includes("Stok: 47"));

  log("Tidak ada dialog alert/error tak terduga", dialogs.length === 0, dialogs.join("; "));
} catch (err) {
  log("UNEXPECTED ERROR", false, err.message);
} finally {
  await browser.close();
  const passed = results.filter((r) => r.ok).length;
  console.log(`\n===== ${passed}/${results.length} tests passed =====`);
  process.exit(passed === results.length ? 0 : 1);
}
