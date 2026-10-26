"use client";

import { toPng } from "html-to-image";

const BG = "#06060b";

/** Renders a DOM node (the ticket) to a PNG file and downloads it. */
export async function downloadNodeAsPng(node: HTMLElement, filename: string) {
  const skipPhoto = (el: Node) => !(el instanceof HTMLElement && el.dataset.exportSkip === "true");
  let dataUrl: string | undefined;
  // 1) full quality, 2) without embedding web fonts (a font stylesheet the browser won't let us read),
  // 3) also without the event photo (cross-origin).
  const attempts = [
    { pixelRatio: 2.5, backgroundColor: BG, cacheBust: true },
    { pixelRatio: 2.5, backgroundColor: BG, skipFonts: true },
    { pixelRatio: 2.5, backgroundColor: BG, skipFonts: true, filter: skipPhoto },
  ];
  let lastError: unknown;
  for (const opts of attempts) {
    try {
      dataUrl = await toPng(node, opts);
      break;
    } catch (e) {
      lastError = e;
    }
  }
  if (!dataUrl) throw lastError instanceof Error ? lastError : new Error("Could not create the image");
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
