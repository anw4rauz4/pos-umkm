/**
 * E2E test: alur TUTUP KAS (setoran & selisih) di dashboard.
 * Jalankan: node scripts/e2e-tutup-kas.mjs (server produksi jalan di :3000)
 */
import puppeteer from "puppeteer-core";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const CHROME =
  process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const results = [];
function log(name, ok, detail = "") {
  console.log(`[${ok ? "PASS" : "FAIL"}] ${name}${detail ? " — " + detail : ""}`);
  results.push({ name, ok });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const text = (page) => page.evaluate(() => document.body.innerText);

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

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });
const dialogs = [];
page.on("dialog", async (d) => {
  dialogs.push(d.message());
  await d.dismiss().catch(() => {});
});
page.on("pageerror", (e) => console.log("  [pageerror]", e.message));

try {
  // Register
  await page.goto(BASE + "/login", { waitUntil: "networkidle0", timeout: 30000 });
  await sleep(500);
  await clickButton(page, "Daftar");
  await sleep(300);
  const EMAIL = `kas${Date.now()}@test.com`;
  await typeInto(page, 'input[type="text"]', "Kasir Tutup");
  const inputs = await page.$$("input[type='text']");
  if (inputs.length >= 2) await inputs[1].type("Toko Tutup Kas");
  await typeInto(page, 'input[type="email"]', EMAIL);
  await typeInto(page, 'input[type="password"]', "rahasia123");
  await page.evaluate(() => document.querySelector('button[type="submit"]').click());
  await sleep(2500);
  log("Register sukses", page.url().replace(BASE, "") === "/");

  // Transaksi cash 1: Kopi 25rb, bayar 50rb (kembali 25rb) -> laci +25rb
  await page.goto(BASE + "/kasir", { waitUntil: "networkidle0", timeout: 30000 });
  await sleep(1000);
  await clickProductCard(page, "Kopi Arabica");
  await sleep(400);
  await clickButton(page, "Cash");
  await sleep(400);
  await clickButton(page, "Uang pas");
  await sleep(300);
  await clickButton(page, "Selesaikan Transaksi");
  await sleep(2000);
  log("Transaksi cash 25rb (uang pas) sukses", !(await text(page)).includes("Pembayaran Cash"));

  // Buka modal Tutup Kas (polling hingga tombol muncul setelah hidrasi)
  await page.goto(BASE + "/dashboard", { waitUntil: "networkidle0", timeout: 30000 });
  let tombolAda = false;
  for (let i = 0; i < 12 && !tombolAda; i++) {
    tombolAda = await page.evaluate(
      () => [...document.querySelectorAll("button")].some((x) => x.innerText.includes("Tutup Kas"))
    );
    if (!tombolAda) await sleep(500);
  }
  await clickButton(page, "Tutup Kas");
  await sleep(600);
  let body = await text(page);
  log("Modal tutup kas terbuka dengan rekap", body.includes("Tutup Kas Hari Ini") && body.includes("Uang fisik dihitung dari laci"));
  log("Rekap benar: 25.000 di laci, 1 transaksi", body.includes("Rp 25.000") && body.includes("1 transaksi cash"));

  // Detail transaksi expandable (element <details>/<summary>, bukan <button>)
  await page.evaluate(() => {
    const s = [...document.querySelectorAll("summary")].find((x) => x.innerText.includes("Lihat detail"));
    if (!s) throw new Error("Summary detail tidak ditemukan");
    s.click();
  });
  await sleep(300);
  body = await text(page);
  log("Detail transaksi tampil", body.includes("kembali") || body.includes("Nota"));

  // Kas fisik = 30rb (lebih 5rb) -> selisih +5rb
  await typeInto(page, 'input[type="number"]', "30000");
  await sleep(300);
  body = await text(page);
  log("Selisih lebih terdeteksi (+5.000)", body.includes("Selisih:") && body.includes("Rp 5.000") && body.includes("lebih"));

  // Catatan + simpan
  await typeInto(page, 'input[type="text"]', "ada nota mundul 5rb");
  await clickButton(page, "Simpan Tutup Kas");
  await sleep(800);
  body = await text(page);
  log("Tutup kas tersimpan", body.includes("Tutup kas tersimpan") || body.includes("Tersimpan ke riwayat"));
  log("Riwayat tampil dengan selisih +Rp 5.000", body.includes("Riwayat Tutup Kas") && body.includes("+Rp 5.000"));

  // Uji kas kurang: transaksi lagi 25rb (uang pas) -> laci 50rb, isi 45rb
  await page.goto(BASE + "/kasir", { waitUntil: "networkidle0", timeout: 30000 });
  await sleep(800);
  await clickProductCard(page, "Kopi Arabica");
  await sleep(400);
  await clickButton(page, "Cash");
  await sleep(400);
  await clickButton(page, "Uang pas");
  await sleep(300);
  await clickButton(page, "Selesaikan Transaksi");
  await sleep(2000);

  await page.goto(BASE + "/dashboard", { waitUntil: "networkidle0", timeout: 30000 });
  await sleep(1000);
  await clickButton(page, "Tutup Kas");
  await sleep(600);
  await typeInto(page, 'input[type="number"]', "45000");
  await sleep(300);
  body = await text(page);
  log("Selisih kurang terdeteksi (-5.000)", body.includes("kurang") && body.includes("Rp 5.000"));

  await clickButton(page, "Simpan Tutup Kas");
  await sleep(800);
  body = await text(page);
  log("Sesi kedua tersimpan", body.includes("Tersimpan ke riwayat") || body.includes("tutup kas tersimpan"));

  log("Tidak ada dialog error tak terduga", dialogs.length === 0, dialogs.join("; "));
} catch (err) {
  log("UNEXPECTED ERROR", false, err.message);
} finally {
  await browser.close();
  const passed = results.filter((r) => r.ok).length;
  console.log(`\n===== ${passed}/${results.length} tests passed =====`);
  process.exit(passed === results.length ? 0 : 1);
}
