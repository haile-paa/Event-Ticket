"use client";

import { img } from "@tikit/shared";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect } from "react";

export function Lightbox({ images, index, onChange, onClose }: { images: string[]; index: number | null; onChange: (i: number) => void; onClose: () => void }) {
  const open = index !== null;
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onChange((index! + 1) % images.length);
      if (e.key === "ArrowLeft") onChange((index! - 1 + images.length) % images.length);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, index, images.length, onChange, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] grid place-items-center bg-black/90 p-4 backdrop-blur-md"
          onClick={onClose}
        >
          <button aria-label="Close" className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-white/10 hover:bg-white/20" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
          {images.length > 1 && (
            <>
              <button
                aria-label="Previous"
                className="absolute left-3 grid h-12 w-12 place-items-center rounded-full bg-white/10 hover:bg-white/20 sm:left-6"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange((index! - 1 + images.length) % images.length);
                }}
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                aria-label="Next"
                className="absolute right-3 grid h-12 w-12 place-items-center rounded-full bg-white/10 hover:bg-white/20 sm:right-6"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange((index! + 1) % images.length);
                }}
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}
          <AnimatePresence mode="wait">
            <motion.img
              key={index}
              src={img(images[index!])}
              alt=""
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.22 }}
              className="max-h-[85vh] max-w-full rounded-2xl object-contain shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </AnimatePresence>
          <p className="absolute bottom-5 text-sm text-fog-400">{index! + 1} / {images.length}</p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
