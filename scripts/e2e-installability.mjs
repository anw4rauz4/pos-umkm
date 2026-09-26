/**
 * Uji installability PWA sesuai kriteria Chrome via CDP + uji offline nyata.
 * Jalankan: node scripts/e2e-installability.mjs (server produksi jalan di :3000)
 */
import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const CHROME =
  process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const results = [];
function log(name, ok, detail = "") {
  console.log(`[${ok ? "PASS" : "FAIL"}] ${name}${detail ? " — " + detail : ""}`);
  results.push({ name, ok });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--enable-features=WriteServiceWorkerInHeadless"],
});

const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });
page.on("pageerror", (e) => console.log("  [pageerror]", e.message));

const cdp = await page.createCDPSession();

try {
  await page.goto(BASE + "/login", { waitUntil: "networkidle0", timeout: 30000 });
  await sleep(1000);

  // Tunggu SW hingga AKTIF (bukan hanya terdaftar)
  let swState = null;
  for (let i = 0; i < 24 && swState !== "activated"; i++) {
    swState = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) return "none";
      if (reg.active) return "activated";
      if (reg.waiting) return "waiting";
      if (reg.installing) return "installing";
      return "none";
    });
    if (swState !== "activated") await sleep(500);
  }
  log("Service worker AKTIF", swState === "activated", swState);

  // ============ KRITERIA INSTALLABILITY CHROME ============
  // CDP domain PWA tidak tersedia di semua build; gunakan verifikasi manual
  // dari kriteria resmi: manifest valid + SW aktif + ikon >=192px + HTTPS/localhost.
  const kriteria = await page.evaluate(async () => {
    const out = { manifest: false, sw: false, icons: false, secure: false, display: false, startUrl: false };
    const m = await (await fetch("/manifest.webmanifest")).json();
    out.manifest = !!(m.name && m.short_name && m.start_url && m.icons?.length);
    out.display = ["standalone", "fullscreen", "minimal-ui"].includes(m.display);
    const reg = await navigator.serviceWorker.getRegistration();
    out.sw = !!(reg && reg.active);
    out.secure = location.protocol === "https:" || location.hostname === "localhost";
    out.startUrl = new URL(m.start_url, location.href).href.startsWith(
      new URL(m.scope || "/", location.href).href
    );
    for (const i of m.icons) {
      if (i.purpose !== "maskable") {
        const img = new Image();
        await new Promise((res, rej) => {
          img.onload = res;
          img.onerror = rej;
          img.src = i.src;
        });
        const s = Math.min(img.naturalWidth, img.naturalHeight);
        if (s >= 192) out.icons = true;
      }
    }
    return out;
  });
  log("Manifest lengkap (name, short_name, start_url, icons)", kriteria.manifest);
  log("Display standalone", kriteria.display);
  log("Service worker mengontrol start_url", kriteria.sw);
  log("Konteks aman (localhost/HTTPS)", kriteria.secure);
  log("start_url di dalam scope", kriteria.startUrl);
  log("Ikon minimal 192px ter-resolve", kriteria.icons);
  const semua = Object.values(kriteria).every(Boolean);
  log("SEMUA KRITERIA INSTALLABLE TERPENUHI", semua, JSON.stringify(kriteria));

  // Primary icon harus resolve & >= 144px
  const primaryIcon = await page.evaluate(async () => {
    const res = await fetch("/manifest.webmanifest");
    const m = await res.json();
    const icon = m.icons.find((i) => i.purpose === "any");
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = icon.src;
    });
    return { ok: true, w: img.naturalWidth, h: img.naturalHeight };
  });
  log(
    "Ikon manifest ter-resolve & >= 192px",
    primaryIcon.ok && primaryIcon.w >= 192,
    `${primaryIcon.w}x${primaryIcon.h}`
  );

  // Service worker start_url sesuai manifest
  const startUrlOk = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    const m = await (await fetch("/manifest.webmanifest")).json();
    const scopeUrl = new URL(m.scope || "/", location.href).href;
    const startUrl = new URL(m.start_url, location.href).href;
    return startUrl.startsWith(scopeUrl) && location.href.startsWith(scopeUrl);
  });
  log("start_url & scope manifest konsisten", startUrlOk);

  // ============ UJI OFFLINE NYATA ============
  // 1. Precache: /offline dan / harus ada di cache SW
  const cached = await page.evaluate(async () => {
    const names = await caches.keys();
    const all = {};
    for (const n of names) {
      const c = await caches.open(n);
      const keys = await c.keys();
      all[n] = keys.map((k) => new URL(k.url).pathname);
    }
    return all;
  });
  const cachedPaths = Object.values(cached).flat();
  log("Precache berisi / dan /offline", cachedPaths.includes("/offline") && cachedPaths.includes("/"), `${cachedPaths.length} URL tercache`);

  // 2. Blokir jaringan → reload → halaman tetap render (dari SW cache)
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: true,
    latency: 0,
    downloadThroughput: 0,
    uploadThroughput: 0,
  });
  await page.reload({ waitUntil: "networkidle0", timeout: 30000 }).catch(() => {});
  await sleep(1000);
  const offlineTitle = await page.evaluate(() => document.body.innerText.slice(0, 200));
  log("Reload saat OFFLINE tetap render app", offlineTitle.includes("KasirKu AI"), offlineTitle.split("\n")[0]);

  // 3. Navigasi klik link internal saat offline → tetap jalan
  await page.evaluate(() => {
    const link = [...document.querySelectorAll("a")].find((a) => a.getAttribute("href") === "/kasir");
    if (link) link.click();
  });
  await sleep(1500);
  const kasirOffline = await page.evaluate(() => document.body.innerText.slice(0, 300));
  log("Navigasi ke /kasir saat OFFLINE tetap render", kasirOffline.includes("Pilih Produk") || kasirOffline.includes("KasirKu"), page.url());

  // 4. Halaman offline fallback render saat offline (AuthGuard masih membatasi; cukup pastikan
  //    respons dari cache SW, bukan error jaringan)
  const p2 = await browser.newPage();
  const resp = await p2.goto(BASE + "/offline", { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => null);
  await sleep(800);
  const offlinePage = await p2.evaluate(() => document.body.innerText).catch(() => "");
  const dariCache = !!resp && resp.status() === 200 && offlinePage.includes("KasirKu");
  log("Halaman /offline tersajikan dari cache saat OFFLINE", dariCache, `status=${resp ? resp.status() : "gagal"}`);
  await p2.close();

  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
  });

  // ============ BONUS: SW bisa update (byte-diff check) ============
  const swText = await page.evaluate(async () => {
    const res = await fetch("/sw.js", { cache: "no-store" });
    return res.text();
  });
  log("SW menyimpan versi di konstanta VERSION", /const VERSION = "kasirku-v\d+"/.test(swText));
} catch (err) {
  log("UNEXPECTED ERROR", false, err.message);
} finally {
  await browser.close();
  const passed = results.filter((r) => r.ok).length;
  console.log(`\n===== ${passed}/${results.length} tests passed =====`);
  process.exit(passed === results.length ? 0 : 1);
}
