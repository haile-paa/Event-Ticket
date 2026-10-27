"use client";

import { ApiError, Spinner, cn, img, shrinkImage } from "@tikit/shared";
import { ImagePlus, Trash2, X } from "lucide-react";
import { useRef, useState } from "react";
import { useAdmin } from "@/lib/admin";

export function useUpload() {
  const { call, toast } = useAdmin();
  return async (original: File): Promise<string | null> => {
    const file = await shrinkImage(original);
    if (file.size > 10 * 1024 * 1024) {
      toast("That image is bigger than 10 MB", "err");
      return null;
    }
    const fd = new FormData();
    fd.set("file", file);
    try {
      const r = await call<{ url: string }>("/api/studio/upload", { method: "POST", body: fd });
      return r.url;
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Upload failed", "err");
      return null;
    }
  };
}

/** One image: shows a preview with change / remove buttons. */
export function ImageField({
  value,
  onChange,
  label,
  hint,
  aspect = "aspect-[16/9]",
  contain = false,
}: {
  value: string;
  onChange: (url: string) => void;
  label: string;
  hint?: string;
  aspect?: string;
  contain?: boolean;
}) {
  const upload = useUpload();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const pick = async (f?: File) => {
    if (!f) return;
    setBusy(true);
    const url = await upload(f);
    setBusy(false);
    if (url) onChange(url);
  };

  return (
    <div>
      <span className="label">{label}</span>
      <input ref={input} type="file" accept="image/*,.svg" className="hidden" onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
      <div className={cn("relative overflow-hidden rounded-2xl border border-dashed border-white/20 bg-white/[0.03]", aspect)}>
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img(value)} alt="" className={cn("h-full w-full", contain ? "object-contain p-3" : "object-cover")} />
        ) : (
          <button type="button" onClick={() => input.current?.click()} className="grid h-full w-full place-items-center text-fog-400 transition hover:bg-white/[0.05] hover:text-white">
            <span className="flex flex-col items-center gap-2 text-sm font-semibold"><ImagePlus className="h-6 w-6" />Upload image</span>
          </button>
        )}
        {busy && <div className="absolute inset-0 grid place-items-center bg-black/60"><Spinner /></div>}
        {value && !busy && (
          <div className="absolute right-2 top-2 flex gap-2">
            <button type="button" onClick={() => input.current?.click()} className="rounded-full bg-black/70 px-3 py-1.5 text-xs font-bold hover:bg-black">Change</button>
            <button type="button" onClick={() => onChange("")} aria-label="Remove image" className="grid h-8 w-8 place-items-center rounded-full bg-black/70 hover:bg-rose-600"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        )}
      </div>
      {hint && <p className="mt-1.5 text-xs text-fog-500">{hint}</p>}
    </div>
  );
}

/** A list of images with add / remove. */
export function GalleryField({ value, onChange, label }: { value: string[]; onChange: (urls: string[]) => void; label: string }) {
  const upload = useUpload();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    const urls: string[] = [];
    for (const f of Array.from(files).slice(0, 10)) {
      const u = await upload(f);
      if (u) urls.push(u);
    }
    setBusy(false);
    if (urls.length) onChange([...value, ...urls]);
  };

  return (
    <div>
      <span className="label">{label}</span>
      <input ref={input} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { void add(e.target.files); e.target.value = ""; }} />
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {value.map((u, i) => (
          <div key={u + i} className="group relative aspect-square overflow-hidden rounded-2xl ring-1 ring-white/15">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img(u)} alt="" className="h-full w-full object-cover" />
            <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label="Remove photo" className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-black/70 opacity-100 transition hover:bg-rose-600 sm:opacity-0 sm:group-hover:opacity-100"><X className="h-3.5 w-3.5" /></button>
          </div>
        ))}
        <button type="button" onClick={() => input.current?.click()} disabled={busy} className="grid aspect-square place-items-center rounded-2xl border border-dashed border-white/20 text-fog-400 transition hover:bg-white/[0.05] hover:text-white">
          {busy ? <Spinner /> : <span className="flex flex-col items-center gap-1 text-xs font-bold"><ImagePlus className="h-5 w-5" />Add photos</span>}
        </button>
      </div>
    </div>
  );
}
