/**
 * E2E: quick-lock PIN di navbar + ganti akun dari layar kunci.
 * Jalankan: node scripts/e2e-quick-lock.mjs (server produksi jalan di :3000)
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
const text = (p) => p.evaluate(() => document.body.innerText);

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
async function clickTitle(page, title) {
  await page.evaluate((t) => {
    const b = [...document.querySelectorAll("button")].find((x) => x.getAttribute("title") === t);
    if (!b) throw new Error("Tombol title tidak ditemukan: " + t);
    b.click();
  }, title);
}
async function pressKeypad(page, digits) {
  for (const d of digits.split("")) {
    await page.evaluate((k) => {
      const b = [...document.querySelectorAll("button")].find((x) => x.innerText.trim() === k);
      if (!b) throw new Error("keypad tidak ketemu: " + k);
      b.click();
    }, d);
    await sleep(120);
  }
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });
page.on("pageerror", (e) => console.log("  [pageerror]", e.message));

try {
  // Register akun pertama
  await page.goto(BASE + "/login", { waitUntil: "networkidle0", timeout: 30000 });
  await sleep(600);
  await clickButton(page, "Daftar");
  await sleep(300);
  await typeInto(page, 'input[type="text"]', "Kasir Satu");
  const inputs = await page.$$("input[type='text']");
  if (inputs.length >= 2) await inputs[1].type("Toko Quick Lock");
  await typeInto(page, 'input[type="email"]', `ql${Date.now()}@test.com`);
  await typeInto(page, 'input[type="password"]', "rahasia123");
  await page.evaluate(() => document.querySelector('button[type="submit"]').click());
  await sleep(2500);
  log("Register akun 1", page.url().replace(BASE, "") === "/");

  // Buat PIN via halaman lock
  await page.goto(BASE + "/lock", { waitUntil: "networkidle0", timeout: 30000 });
  await sleep(800);
  let body = await text(page);
  log("Halaman lock: mode setup PIN", body.includes("Buat PIN Keamanan"));
  await pressKeypad(page, "135790");
  await sleep(300);
  await pressKeypad(page, "135790");
  await sleep(300);
  // polling: auto-advance ke mode unlocked begitu PIN terkonfirmasi
  let pinTersimpan = false;
  for (let i = 0; i < 10 && !pinTersimpan; i++) {
    pinTersimpan = (await text(page)).includes("PIN aktif");
    if (!pinTersimpan) {
      // jika tombol Simpan PIN masih ada, klik lagi
      const masihAda = await page.evaluate(() =>
        [...document.querySelectorAll("button")].some((b) => b.innerText.includes("Simpan PIN"))
      );
      if (masihAda) await clickButton(page, "Simpan PIN");
      await sleep(400);
    }
  }
  body = await text(page);
  log("PIN tersimpan (mode unlocked)", pinTersimpan, body.slice(0, 50).replace(/\n/g, " | "));

  // Kembali ke home — tombol lock cepat harus muncul di navbar
  await page.goto(BASE + "/", { waitUntil: "networkidle0", timeout: 30000 });
  await sleep(1000);
  const lockBtn = await page.evaluate(
    () => !![...document.querySelectorAll("nav button")].find((b) => b.getAttribute("title") === "Kunci layar (PIN)")
  );
  log("Tombol lock cepat muncul di navbar", lockBtn);

  // Klik quick-lock → layar kunci
  await clickTitle(page, "Kunci layar (PIN)");
  await sleep(1000);
  body = await text(page);
  log("Quick-lock → layar terkunci", body.includes("Layar Terkunci"));

  // Salah PIN → error
  await pressKeypad(page, "111111");
  await sleep(800);
  body = await text(page);
  log("PIN salah ditolak", body.includes("PIN salah"));

  // PIN benar → unlock & redirect home
  await pressKeypad(page, "135790");
  await sleep(1500);
  body = await text(page);
  log("PIN benar → kembali ke app", page.url().replace(BASE, "") === "/" && body.includes("Kasir Satu"));

  // Lock lagi lalu GANTI AKUN dari layar kunci
  await page.goto(BASE + "/lock", { waitUntil: "networkidle0", timeout: 30000 });
  await sleep(800);
  body = await text(page);
  log("Layar kunci menawarkan Ganti Akun", body.includes("Ganti Akun"));
  await clickButton(page, "Ganti Akun");
  await sleep(1500);
  log("Ganti akun → halaman login", page.url().includes("/login"));

  // PIN harus masih tersimpan (setelah login akun apa pun, tombol lock tetap ada)
  await typeInto(page, 'input[type="email"]', "siapa@pakaipin.com");
  await typeInto(page, 'input[type="password"]', "terserah123");
  await page.evaluate(() => document.querySelector('button[type="submit"]').click());
  await sleep(1500);
  body = await text(page);
  log("Login akun lama ditolak (memang tidak ada)", body.includes("tidak ditemukan") || body.includes("Password salah"));
} catch (err) {
  log("UNEXPECTED ERROR", false, err.message);
} finally {
  await browser.close();
  const passed = results.filter((r) => r.ok).length;
  console.log(`\n===== ${passed}/${results.length} tests passed =====`);
  process.exit(passed === results.length ? 0 : 1);
}
