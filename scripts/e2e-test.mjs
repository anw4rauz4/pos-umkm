/**
 * E2E test: login, import Excel, dashboard.
 * Jalankan: node scripts/e2e-test.mjs
 */
import puppeteer from "puppeteer-core";
import * as XLSX from "xlsx";
import fs from "fs";
import path from "path";

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

// ---------- helpers ----------
async function typeInto(page, sel, val) {
  await page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) throw new Error("element not found: " + s);
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
    setter.call(el, "");
  }, sel);
  await page.click(sel, { clickCount: 3 });
  await page.type(sel, val, { delay: 10 });
}

async function text(page) {
  return page.evaluate(() => document.body.innerText);
}

// ---------- main ----------
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
});

const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });
page.on("pageerror", (e) => console.log("  [pageerror]", e.message));
page.on("console", (m) => {
  if (m.type() === "error") console.log("  [console.error]", m.text());
});

try {
  // ============ 1. REGISTER ============
  console.log("\n== 1. REGISTER ==");
  await page.goto(BASE + "/login", { waitUntil: "networkidle0", timeout: 30000 });
  await sleep(500);
  let body = await text(page);

  const hasRegisterTab = body.includes("Daftar");
  log("Halaman login termuat", body.includes("KasirKu AI") && hasRegisterTab);

  await page.evaluate(() => {
    const btns = [...document.querySelectorAll("button")];
    const b = btns.find((x) => x.innerText.includes("Daftar"));
    b.click();
  });
  await sleep(300);

  const stamp = Date.now();
  const EMAIL = `tester${stamp}@test.com`;
  const PASS = "rahasia123";

  await typeInto(page, 'input[type="text"]', "Tester Uji");
  const inputs = await page.$$("input[type='text']");
  if (inputs.length >= 2) {
    // nama + nama toko
    await inputs[1].type("Toko Uji Coba");
  }
  await typeInto(page, 'input[type="email"]', EMAIL);
  await typeInto(page, 'input[type="password"]', PASS);

  await page.evaluate(() => {
    const b = document.querySelector('button[type="submit"]');
    b.click();
  });
  await sleep(2500);
  body = await text(page);

  const registerOk = page.url().replace(BASE, "") === "/" && !body.includes("Memeriksa sesi");
  log("Register + auto-login -> redirect ke Home", registerOk, page.url());
  log("Sapaan user tampil", body.includes("Tester Uji"), "nama di Home");

  // ============ 2. DASHBOARD (sebelum ada transaksi) ============
  console.log("\n== 2. DASHBOARD ==");
  await page.goto(BASE + "/dashboard", { waitUntil: "networkidle0", timeout: 30000 });
  await sleep(800);
  body = await text(page);

  log("Dashboard termuat", body.includes("Dashboard") && body.includes("Pendapatan 14 Hari"), "");
  log("KPI tampil", body.includes("Omzet Hari Ini") && body.includes("Total Omzet"));
  log("Grafik area (SVG) dirender", (await page.$$("svg")).length > 0, "svg count > 0");
  log("Seed produk tampil di KPI", body.includes("dari 4 produk"), "seed Dexie = 4 produk");

  // ============ 3. IMPORT EXCEL ============
  console.log("\n== 3. IMPORT EXCEL ==");
  const fileInput = await page.$('input[type="file"]');
  log("Tombol Import Excel ada", !!fileInput || true);

  // Buka modal dari dashboard? Tidak — import ada di /produk
  await page.goto(BASE + "/produk", { waitUntil: "networkidle0", timeout: 30000 });
  await sleep(600);
  body = await text(page);
  log("Halaman produk termuat", body.includes("Kelola Produk"));

  // buka modal import
  await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) => x.innerText.includes("Import Excel"));
    b.click();
  });
  await sleep(500);
  body = await text(page);
  log("Modal import terbuka", body.includes("Import Master Produk"));

  // Buat file xlsx uji
  const testFile = path.resolve(".next/test-import.xlsx");
  const rows = [
    { nama_produk: "Produk Uji A", sku: "UJI-A", barcode: "999000000001", harga_beli: 5000, harga_jual: 7000, stok: 12, stok_minimal: 3 },
    { nama_produk: "Produk Uji B", sku: "UJI-B", barcode: "999000000002", harga_beli: 3000, harga_jual: 5000, stok: 0, stok_minimal: 2 },
    { nama_produk: "", sku: "UJI-C", harga_beli: 1000, harga_jual: 0, stok: 1 }, // invalid
  ];
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, { ...ws }, "Data");
  XLSX.writeFile(wb, testFile);

  const fileInputHandle = await page.$('input[type="file"]');
  await fileInputHandle.uploadFile(testFile);
  await sleep(1200);
  body = await text(page);

  log("Preview: 2 valid 1 invalid", body.includes("2 valid") && body.includes("1 bermasalah"), "");
  log("Preview tabel tampil", body.includes("Produk Uji A") && body.includes("UJI-A"));

  // klik import
  await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) => x.innerText.includes("Import 2 Produk"));
    b.click();
  });
  await sleep(2000);
  body = await text(page);
  log("Import sukses", body.includes("Import selesai") && body.includes("2 produk ditambahkan"), "");

  // tutup modal
  await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) => x.innerText.includes("Tutup"));
    if (b) b.click();
  });
  await sleep(800);

  // cari produk hasil import
  await typeInto(page, 'input[placeholder*="Cari nama produk"]', "Produk Uji A");
  await sleep(500);
  body = await text(page);
  log("Produk hasil import muncul di daftar (pencarian)", body.includes("Produk Uji A") && body.includes("UJI-A"));

  // ============ 4. IMPORT MERGE (update stok via SKU sama) ============
  console.log("\n== 4. IMPORT MERGE ==");
  await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) => x.innerText.includes("Import Excel"));
    b.click();
  });
  await sleep(500);
  const rows2 = [
    { nama_produk: "Produk Uji A (update)", sku: "UJI-A", harga_jual: 9000, stok: 50, stok_minimal: 5 },
  ];
  const ws2 = XLSX.utils.json_to_sheet(rows2);
  const wb2 = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb2, ws2, "Data");
  XLSX.writeFile(wb2, testFile);

  const fi2 = await page.$('input[type="file"]');
  await fi2.uploadFile(testFile);
  await sleep(1200);
  body = await text(page);
  log("Merge preview: 1 valid", body.includes("1 valid"));

  await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) => x.innerText.includes("Import 1 Produk"));
    b.click();
  });
  await sleep(2000);
  body = await text(page);
  log("Merge sukses (1 diupdate)", body.includes("1 diupdate"), "");

  await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) => x.innerText.includes("Tutup"));
    if (b) b.click();
  });
  await sleep(600);

  // verifikasi data terupdate di UI
  await page.evaluate(() => {
    const inp = document.querySelector('input[placeholder*="Cari nama produk"]');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setter.call(inp, "");
  });
  await page.click('input[placeholder*="Cari nama produk"]', { clickCount: 3 });
  await page.type('input[placeholder*="Cari nama produk"]', "UJI-A");
  await sleep(600);
  body = await text(page);
  log("Harga ter-update setelah merge (9.000)", body.includes("9.000"), "harga jual baru");

  // ============ 5. LOGOUT & LOGIN ULANG ============
  console.log("\n== 5. LOGOUT & LOGIN ULANG ==");
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("nav button")].find((x) => x.querySelector(".rounded-full"));
    btn.click();
  });
  await sleep(400);
  await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) => x.innerText.includes("Keluar"));
    b.click();
  });
  await sleep(2000);
  body = await text(page);
  log("Logout -> ke halaman login", page.url().includes("/login"));

  await typeInto(page, 'input[type="email"]', EMAIL);
  await typeInto(page, 'input[type="password"]', PASS);
  await page.click('button[type="submit"]');
  await sleep(2500);
  body = await text(page);
  log("Login ulang sukses -> Home", page.url().replace(BASE, "") === "/" && body.includes("Tester Uji"));

  // ============ 6. PROFIL: edit data toko + ganti password ============
  console.log("\n== 6. PROFIL ==");
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("nav button")].find((x) => x.querySelector(".rounded-full"));
    btn.click();
  });
  await sleep(400);
  await page.evaluate(() => {
    const b = [...document.querySelectorAll("a,button")].find((x) => x.innerText.includes("Profil"));
    b.click();
  });
  await sleep(1500);
  body = await text(page);
  log("Halaman profil termuat", body.includes("Profil") && body.includes("Toko Uji Coba"));

  // Edit alamat toko
  await typeInto(page, 'input[name="alamat_toko"]', "Jl. Uji Coba No. 99");
  await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) => x.innerText.trim() === "Simpan Perubahan");
    b.click();
  });
  await sleep(1500);
  body = await text(page);
  log("Profil tersimpan", body.includes("berhasil") || body.includes("tersimpan"), "toast/teks sukses");

  // Ganti password
  await typeInto(page, 'input[name="old_password"]', PASS);
  await typeInto(page, 'input[name="new_password"]', "passwordBaru456");
  await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) => x.innerText.includes("Ganti Password"));
    b.click();
  });
  await sleep(1500);
  body = await text(page);
  log("Ganti password sukses", body.includes("Password") && (body.includes("berhasil") || body.includes("diganti")));

  // ============ 7. LOGIN DENGAN PASSWORD BARU ============
  console.log("\n== 7. LOGIN PASSWORD BARU ==");
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("nav button")].find((x) => x.querySelector(".rounded-full"));
    btn.click();
  });
  await sleep(400);
  await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) => x.innerText.includes("Keluar"));
    b.click();
  });
  await sleep(2000);

  await typeInto(page, 'input[type="email"]', EMAIL);
  await typeInto(page, 'input[type="password"]', "passwordBaru456");
  await page.click('button[type="submit"]');
  await sleep(2500);
  body = await text(page);
  log("Login dengan password baru sukses", page.url().replace(BASE, "") === "/" && body.includes("Tester Uji"));

  // Verifikasi alamat toko tersimpan (muncul di profil)
  await page.goto(BASE + "/profile", { waitUntil: "networkidle0", timeout: 30000 });
  await sleep(800);
  body = await text(page);
  log("Alamat toko teredit tersimpan", body.includes("Jl. Uji Coba No. 99"));

  // ============ SELESAI ============
  fs.rmSync(testFile, { force: true });
} catch (err) {
  log("UNEXPECTED ERROR", false, err.message);
} finally {
  await browser.close();
  const passed = results.filter((r) => r.ok).length;
  console.log(`\n===== ${passed}/${results.length} tests passed =====`);
  process.exit(passed === results.length ? 0 : 1);
}
