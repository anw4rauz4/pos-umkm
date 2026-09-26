import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Optimasi bundle produksi: paket besar yang tidak dibutuhkan saat first paint
  // dipecah ke chunk terpisah (dimuat on-demand oleh dynamic import).
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
};

export default nextConfig;
