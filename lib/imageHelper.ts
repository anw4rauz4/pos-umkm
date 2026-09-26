// ============================================
// KOMPRES GAMBAR → BASE64 (Hemat Storage)
// ============================================
export async function compressImage(
  file: File,
  maxWidth = 400,
  quality = 0.7
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;

        // Scale down jika terlalu besar
        if (width > maxWidth) {
          height = (maxWidth / width) * height;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) return reject("Canvas not supported");

        ctx.drawImage(img, 0, 0, width, height);

        // Convert ke base64 JPEG (lebih kecil dari PNG)
        const base64 = canvas.toDataURL("image/jpeg", quality);
        resolve(base64);
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };

    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ============================================
// FORMAT UKURAN FILE
// ============================================
export function formatBytes(base64: string): string {
  const sizeInBytes = (base64.length * 3) / 4;
  if (sizeInBytes < 1024) return sizeInBytes.toFixed(0) + " B";
  if (sizeInBytes < 1024 * 1024) return (sizeInBytes / 1024).toFixed(1) + " KB";
  return (sizeInBytes / 1024 / 1024).toFixed(2) + " MB";
}