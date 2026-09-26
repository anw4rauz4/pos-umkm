/**
 * Uji kunci: sesi bertahan setelah browser DITUTUP.
 * Login di browser A → tutup → buka browser B (profile sama) →
 * langsung buka /kasir → HARUS tidak dilempar ke login.
 */
import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";
import os from "os";

const BASE = "http://localhost:3000";
const CHROME =
  process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

// Profile Chrome sementara yang dipakai kedua browser
const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "kasirku-profile-"));

const opts = {
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- Browser A: register ----------
const A = await puppeteer.launch({ ...opts, userDataDir });
const pa = await A.newPage();
await pa.setViewport({ width: 1280, height: 900 });

await pa.goto(BASE + "/login", { waitUntil: "networkidle0", timeout: 30000 });
await sleep(800);
await pa.evaluate(() => {
  const b = [...document.querySelectorAll("button")].find((x) => x.innerText.includes("Daftar"));
  b.click();
});
await sleep(300);
await pa.type('input[type="text"]', "Persist Uji", { delay: 5 });
const inputs = await pa.$$("input[type='text']");
if (inputs.length >= 2) await inputs[1].type("Toko Persist", { delay: 5 });
await pa.type('input[type="email"]', `persist${Date.now()}@test.com`, { delay: 5 });
await pa.type('input[type="password"]', "rahasia123", { delay: 5 });
await pa.evaluate(() => document.querySelector('button[type="submit"]').click());
await sleep(2500);
console.log("A: login →", pa.url());
await A.close(); // browser DITUTUP — sessionStorage akan hilang, localStorage tidak

// ---------- Browser B: buka ulang, langsung klik menu ----------
const B = await puppeteer.launch({ ...opts, userDataDir });
const pb = await B.newPage();
await pb.setViewport({ width: 1280, height: 900 });

await pb.goto(BASE + "/kasir", { waitUntil: "networkidle0", timeout: 30000 });
await sleep(1500);
const url1 = pb.url();
const body1 = await pb.evaluate(() => document.body.innerText);
const okKasir = !url1.includes("/login") && body1.includes("Pilih Produk");
console.log(`${okKasir ? "✅" : "❌"} B: buka /kasir langsung → ${url1}`);

// Klik menu lain
for (const m of ["Dashboard", "Produk"]) {
  await pb.evaluate((label) => {
    const a = [...document.querySelectorAll("nav a")].find((x) => x.innerText.trim() === label);
    a.click();
  }, m);
  await sleep(1200);
  const ok = !pb.url().includes("/login");
  console.log(`${ok ? "✅" : "❌"} B: klik "${m}" → ${pb.url()}`);
}

await B.close();
fs.rmSync(userDataDir, { recursive: true, force: true });
process.exit(okKasir ? 0 : 1);
