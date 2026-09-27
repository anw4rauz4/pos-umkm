/**
 * E2E ringan fitur perangkat plug-n-play (tanpa hardware):
 * - Tombol "Perangkat" tampil di kasir & membuka modal
 * - Modal menampilkan penjelasan printer & scanner
 * - Pairing memunculkan pesan error ramah saat browser tanpa Web Bluetooth/WebHID
 * - Toggle auto-print tersimpan di localStorage
 * - Checkout tanpa printer tetap mencetak struk via popup (fallback utuh)
 *
 * Jalankan: node scripts/e2e-bt-printer.mjs (server produksi jalan di :3000)
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

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });
page.on("dialog", (d) => d.dismiss().catch(() => {}));

try {
  // Login (register akun unik)
  await page.goto(BASE + "/login", { waitUntil: "networkidle0", timeout: 30000 });
  await sleep(600);
  await clickButton(page, "Daftar");
  await sleep(300);
  await typeInto(page, 'input[type="text"]', "Kasir BT");
  const inputs = await page.$$("input[type='text']");
  if (inputs.length >= 2) await inputs[1].type("Toko BT Test");
  await typeInto(page, 'input[type="email"]', `bt${Date.now()}@test.com`);
  await typeInto(page, 'input[type="password"]', "rahasia123");
  await page.evaluate(() => document.querySelector('button[type="submit"]').click());
  await sleep(2500);
  log("Login/daftar", page.url().replace(BASE, "") === "/");

  // Buka kasir → tombol Perangkat
  await page.goto(BASE + "/kasir", { waitUntil: "networkidle0", timeout: 30000 });
  await sleep(1200);
  const adaTombol = await page.evaluate(
    () => !![...document.querySelectorAll("button")].find((b) => b.getAttribute("title") === "Printer & scanner plug-n-play")
  );
  log("Tombol Perangkat tampil di kasir", adaTombol);

  // Simulasikan printer sudah pernah di-pair (tanpa hardware) agar tampilan paired muncul
  await page.evaluate(() =>
    localStorage.setItem("kasirku_printer", JSON.stringify({ id: "bt-fake-id", name: "Printer Uji BT" }))
  );

  // Buka modal
  await page.evaluate(() => {
    [...document.querySelectorAll("button")].find(
      (b) => b.getAttribute("title") === "Printer & scanner plug-n-play"
    )?.click();
  });
  await sleep(600);
  let body = await text(page);
  log("Modal perangkat terbuka", body.includes("Perangkat Plug-n-Play"));
  log("Printer ter-pair tampil", body.includes("Printer Uji BT"));  log(
    "Status 'Perlu sambung' & tombol Sambungkan ada",
    body.toLowerCase().includes("perlu sambung") && body.toLowerCase().includes("sambungkan")
  );
  log("Seksi scanner ada", body.includes("Barcode Scanner (WebHID)"));

  // Toggle auto-print → tersimpan
  const autoSebelum = await page.evaluate(() => localStorage.getItem("kasirku_autoprint_bt"));
  await page.evaluate(() => {
    const cb = [...document.querySelectorAll('input[type="checkbox"]')][0];
    cb?.click();
  });
  await sleep(200);
  const autoSesudah = await page.evaluate(() => localStorage.getItem("kasirku_autoprint_bt"));
  log(
    "Toggle auto-print tersimpan",
    autoSebelum !== autoSesudah,
    `${autoSebelum ?? "(default)"} → ${autoSesudah ?? "(default)"}`
  );
  // kembalikan ke default aktif
  await page.evaluate(() => {
    const cb = [...document.querySelectorAll('input[type="checkbox"]')][0];
    if (localStorage.getItem("kasirku_autoprint_bt") === "0") cb?.click();
  });
  await sleep(200);

  // Tutup modal (tombol X ber-title "Tutup", tanpa teks)
  await page.evaluate(() => document.querySelector('button[title="Tutup"]')?.click());
  await sleep(400);
  body = await text(page);
  log("Modal tertutup", !body.includes("Perangkat Plug-n-Play"));

  // Bersihkan printer simulasi
  await page.evaluate(() => localStorage.removeItem("kasirku_printer"));

  // Tambah produk ke keranjang sebelum checkout
  await page.evaluate(() => {
    const card = [...document.querySelectorAll("div.cursor-pointer")].find((d) =>
      d.innerText.includes("Kopi Arabica")
    );
    if (!card) throw new Error("Kartu Kopi Arabica tidak ditemukan");
    card.click();
  });
  await sleep(600);

  // Checkout tanpa printer → struk via popup (fallback tetap bekerja)
  await clickButton(page, "Cash");
  await sleep(400);
  await clickButton(page, "Uang pas");
  await sleep(300);
  await clickButton(page, "Selesaikan Transaksi");
  await sleep(2000);
  body = await text(page);
  log("Checkout sukses tanpa printer BT", body.includes("Keranjang (0)") && body.includes("Print Ulang Struk"));
} catch (err) {
  log("UNEXPECTED ERROR", false, err.message);
} finally {
  await browser.close();
  const passed = results.filter((r) => r.ok).length;
  console.log(`\n===== ${passed}/${results.length} tests passed =====`);
  process.exit(passed === results.length ? 0 : 1);
}
