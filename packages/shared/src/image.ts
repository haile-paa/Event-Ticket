/**
 * Shrinks a photo in the browser before it is uploaded: phone photos (4-12 MB) become
 * ~200-500 KB, which keeps uploads fast and the database small. SVG, GIF and files that are
 * already small are left untouched; if anything goes wrong the original file is used.
 */
export async function shrinkImage(file: File, maxSide = 1920, quality = 0.82): Promise<File> {
  try {
    if (typeof document === "undefined") return file;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file; // keep svg / gif as they are
    if (file.size < 250 * 1024) return file;

    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const g = canvas.getContext("2d");
    if (!g) return file;
    const keepAlpha = file.type === "image/png";
    if (!keepAlpha) {
      g.fillStyle = "#fff"; // JPEG has no transparency
      g.fillRect(0, 0, w, h);
    }
    g.drawImage(bmp, 0, 0, w, h);
    bmp.close?.();

    const type = keepAlpha ? "image/png" : "image/jpeg";
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, type, quality));
    if (!blob || blob.size >= file.size) return file; // never make it bigger

    const base = file.name.replace(/\.[^.]+$/, "") || "image";
    return new File([blob], `${base}.${keepAlpha ? "png" : "jpg"}`, { type, lastModified: Date.now() });
  } catch {
    return file;
  }
}
