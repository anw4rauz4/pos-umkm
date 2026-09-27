/**
 * Test runner E2E terpadu — menjalankan semua suite E2E secara berurutan.
 *
 * Syarat: server produksi sudah jalan (npm run build && npm run start).
 * Jalankan:
 *   npm test                          → semua suite
 *   npm test -- kasir                 → hanya suite yang cocok "kasir"
 *   node scripts/e2e-all.mjs --list   → daftar suite
 */
import { spawn } from "node:child_process";
import process from "node:process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SUITES = [
  { file: "e2e-cash-checkout.mjs", name: "Checkout tunai (17 tes)" },
  { file: "e2e-tutup-kas.mjs", name: "Tutup kas (11 tes)" },
  { file: "e2e-pwa.mjs", name: "PWA & service worker (11 tes)" },
  { file: "e2e-installability.mjs", name: "Installability & offline (15 tes)" },
  { file: "e2e-quick-lock.mjs", name: "Quick-lock PIN (10 tes)" },
  { file: "e2e-bt-printer.mjs", name: "Perangkat plug-n-play (10 tes)" },
];

const args = process.argv.slice(2);
if (args.includes("--list")) {
  console.log("Suite tersedia:");
  for (const s of SUITES) console.log("  -", s.file, "→", s.name);
  process.exit(0);
}

const filter = args.filter((a) => !a.startsWith("--"));
const selected = filter.length
  ? SUITES.filter((s) => filter.some((f) => s.file.toLowerCase().includes(f.toLowerCase())))
  : SUITES;

if (selected.length === 0) {
  console.error("Tidak ada suite yang cocok dengan filter:", filter.join(", "));
  process.exit(1);
}

console.log("=".repeat(60));
console.log(`KasirKu AI — E2E runner (${selected.length} suite)`);
console.log("=".repeat(60));

const results = [];
let failed = false;

for (const suite of selected) {
  console.log(`\n▶ ${suite.file} — ${suite.name}`);
  console.log("-".repeat(60));

  const ok = await new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(__dirname, suite.file)], {
      stdio: "inherit",
      env: process.env,
    });
    child.on("exit", (code) => resolve(code === 0));
    child.on("error", (err) => {
      console.error("Gagal menjalankan suite:", err.message);
      resolve(false);
    });
  });

  results.push({ suite, ok });
  if (!ok) failed = true;
}

console.log("\n" + "=".repeat(60));
console.log("RINGKASAN");
console.log("=".repeat(60));
for (const r of results) {
  console.log(`${r.ok ? "✅ PASS" : "❌ FAIL"}  ${r.suite.file} — ${r.suite.name}`);
}
const passed = results.filter((r) => r.ok).length;
console.log(`\nTotal: ${passed}/${results.length} suite lulus`);
process.exit(failed ? 1 : 0);
