/**
 * Retheme: ganti kelas warna Tailwind lama → tema "Frost Berries".
 * Pemetaan semantik (bukan 1:1 hue):
 *  - blue (primer)      → navy        #1D2733
 *  - indigo (aksen)     → sage        #5C6F67
 *  - emerald/teal/cyan  → sage        #5C6F67  (info/harga grosir)
 *  - green (sukses)     → olive       #5B7337
 *  - purple/fuchsia     → powder      #A9BFC9
 *  - amber/orange/yellow→ cream-deep  #B9A88A (peringatan hangat)
 *  - gray (netral)      → tetap (abu netral cocok dengan tema)
 * Jalankan: node scripts/retheme.mjs
 */
import fs from "fs";
import path from "path";

const DIRS = ["app", "lib"];
const EXT = [".tsx", ".ts"];

// Urutan penting: shade spesifik dulu (600 sebelum 700 hover dsb.)
const MAP = [
  // ---- BLUE → NAVY ----
  ["bg-blue-50", "bg-navy/5"],
  ["bg-blue-100", "bg-navy/10"],
  ["bg-blue-200", "bg-navy/15"],
  ["bg-blue-400", "bg-navy/40"],
  ["bg-blue-500", "bg-navy"],
  ["bg-blue-600", "bg-navy"],
  ["hover:bg-blue-700", "hover:bg-navy-deep"],
  ["border-blue-500", "border-navy"],
  ["ring-blue-500", "ring-navy"],
  ["text-blue-800", "text-navy"],
  ["text-blue-700", "text-navy"],
  ["text-blue-600", "text-navy"],
  ["text-blue-500", "text-navy"],
  ["focus:border-blue-500", "focus:border-navy"],
  ["focus:ring-blue-500", "focus:ring-navy"],
  ["hover:border-blue-400", "hover:border-navy/50"],
  ["hover:border-blue-300", "hover:border-navy/40"],

  // ---- INDIGO → SAGE ----
  ["bg-indigo-50", "bg-sage/10"],
  ["bg-indigo-100", "bg-sage/15"],
  ["bg-indigo-200", "bg-sage/25"],
  ["bg-indigo-600", "bg-sage"],
  ["hover:bg-indigo-700", "hover:bg-sage-deep"],
  ["hover:bg-indigo-800", "hover:bg-sage-deep"],
  ["border-indigo-600", "border-sage"],
  ["border-indigo-500", "border-sage"],
  ["text-indigo-900", "text-sage-deep"],
  ["text-indigo-800", "text-sage-deep"],
  ["text-indigo-600", "text-sage"],
  ["text-indigo-500", "text-sage"],
  ["text-indigo-400", "text-sage/70"],
  ["border-indigo-300", "border-sage/40"],
  ["border-indigo-200", "border-sage/30"],
  ["hover:border-indigo-300", "hover:border-sage/50"],
  ["hover:border-indigo-400", "hover:border-sage/60"],
  ["focus:ring-indigo-500", "focus:ring-sage"],
  ["focus:border-indigo-500", "focus:border-sage"],

  // ---- EMERALD/TEAL/CYAN → SAGE ----
  ["bg-emerald-50", "bg-sage/10"],
  ["bg-emerald-200", "bg-sage/25"],
  ["hover:border-emerald-400", "hover:border-sage/60"],
  ["bg-emerald-600", "bg-sage"],
  ["hover:bg-emerald-700", "hover:bg-sage-deep"],
  ["border-emerald-600", "border-sage"],
  ["text-emerald-700", "text-sage-deep"],
  ["text-emerald-600", "text-sage"],
  ["bg-cyan-500", "bg-sage"],
  ["hover:bg-cyan-600", "hover:bg-sage-deep"],
  ["text-cyan-500", "text-sage"],

  // ---- GREEN → OLIVE ----
  ["bg-green-50", "bg-olive/10"],
  ["bg-green-100", "bg-olive/15"],
  ["bg-green-500", "bg-olive"],
  ["bg-green-600", "bg-olive"],
  ["hover:bg-green-700", "hover:bg-olive-deep"],
  ["hover:bg-green-600", "hover:bg-olive-deep"],
  ["border-green-500", "border-olive"],
  ["border-green-100", "border-olive/20"],
  ["text-green-700", "text-olive-deep"],
  ["text-green-600", "text-olive"],
  ["text-green-500", "text-olive"],
  ["focus:ring-green-500", "focus:ring-olive"],
  ["focus:border-green-500", "focus:border-olive"],

  // ---- PURPLE/FUCHSIA → POWDER ----
  ["bg-purple-50", "bg-powder-soft"],
  ["bg-purple-500", "bg-powder"],
  ["bg-purple-600", "bg-powder"],
  ["hover:bg-purple-700", "hover:bg-powder/80"],
  ["text-purple-600", "text-sage-deep"],
  ["bg-fuchsia-50", "bg-powder-soft"],
  ["bg-fuchsia-200", "bg-powder/40"],
  ["bg-fuchsia-300", "bg-powder/50"],
  ["bg-fuchsia-400", "bg-powder"],
  ["bg-fuchsia-600", "bg-powder"],
  ["hover:bg-fuchsia-700", "hover:bg-powder/80"],
  ["text-fuchsia-900", "text-navy"],
  ["text-fuchsia-700", "text-sage-deep"],
  ["text-fuchsia-600", "text-sage-deep"],
  ["border-fuchsia-200", "border-powder/40"],

  // ---- AMBER/ORANGE/YELLOW → CREAM-DEEP (peringatan hangat) ----
  ["bg-amber-50", "bg-cream-soft"],
  ["bg-amber-500", "bg-[#B9A88A]"],
  ["hover:bg-amber-600", "hover:bg-[#A6956F]"],
  ["text-amber-600", "text-[#8A795C]"],
  ["bg-orange-50", "bg-cream-soft"],
  ["text-orange-500", "text-[#8A795C]"],
  ["text-orange-600", "text-[#8A795C]"],
  ["bg-yellow-50", "bg-cream-soft"],
  ["text-yellow-800", "text-[#8A795C]"],
  ["text-yellow-700", "text-[#8A795C]"],
  ["border-yellow-400", "border-[#B9A88A]"],
];

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (EXT.includes(path.extname(entry.name))) files.push(full);
  }
  return files;
}

let totalChanges = 0;
let filesChanged = 0;
for (const dir of DIRS) {
  for (const file of walk(dir)) {
    let content = fs.readFileSync(file, "utf8");
    const before = content;
    for (const [from, to] of MAP) {
      // Ganti semua kemunculan utuh (batas kelas)
      content = content.split(from).join(to);
    }
    if (content !== before) {
      fs.writeFileSync(file, content);
      const n = MAP.reduce((acc, [f]) => acc + (before.split(f).length - 1), 0);
      totalChanges += n;
      filesChanged++;
      console.log(`✓ ${file}`);
    }
  }
}
console.log(`\nSelesai: ${totalChanges} penggantian di ${filesChanged} file.`);
