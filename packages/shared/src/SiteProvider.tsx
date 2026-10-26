"use client";

import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { API_URL, img } from "./api";
import { applyRuntime } from "./format";
import { DEFAULT_SITE, copyText, fontByKey, mergeSite, themeVars, type SiteConfig } from "./site";

interface SiteCtx {
  site: SiteConfig;
  t: (key: string, vars?: Record<string, string | number>) => string;
  reload: () => Promise<void>;
}

const Ctx = createContext<SiteCtx>({
  site: DEFAULT_SITE,
  t: (k, v) => copyText(DEFAULT_SITE, k, v),
  reload: async () => {},
});

export const useSite = () => useContext(Ctx);
/** Shortcut for translated / customised text. */
export const useT = () => useContext(Ctx).t;

const CACHE_KEY = "tikit.site.v1";

function loadFont(key: string) {
  const f = fontByKey(key);
  const id = "tikit-font-" + f.key;
  if (document.getElementById(id)) return;
  const l = document.createElement("link");
  l.id = id;
  l.rel = "stylesheet";
  // lets html-to-image read the rules when the ticket is saved as a picture
  l.crossOrigin = "anonymous";
  // Noto Sans Ethiopic is always added as a fallback so Amharic text renders on any font choice
  l.href = `https://fonts.googleapis.com/css2?${f.google ? `family=${f.google}&` : ""}family=Noto+Sans+Ethiopic:wght@400;600;800&display=swap`;
  document.head.appendChild(l);
}

function setFavicon(href: string) {
  if (!href) return;
  let l = document.querySelector<HTMLLinkElement>('link[rel="icon"][data-tikit]');
  if (!l) {
    l = document.createElement("link");
    l.rel = "icon";
    l.dataset.tikit = "1";
    document.head.appendChild(l);
  }
  l.href = href;
}

function build(site: SiteConfig, reload: () => Promise<void>): SiteCtx {
  return { site, reload, t: (k, v) => copyText(site, k, v) };
}

/**
 * Loads the white-label settings from the API, applies the colours / font / title to the page
 * and provides them to every component. The last settings are cached in the browser so repeat
 * visits paint with the right branding instantly.
 */
export function SiteProvider({ children, admin = false }: { children: React.ReactNode; admin?: boolean }) {
  const [site, setSite] = useState<SiteConfig>(DEFAULT_SITE);
  const [ready, setReady] = useState(false);
  const [version, setVersion] = useState(0);
  const last = useRef("");

  const apply = (saved: unknown) => {
    const next = mergeSite(saved);
    const sig = JSON.stringify(next);
    if (sig === last.current) return;
    last.current = sig;
    setSite(next);
    setVersion((v) => v + 1);
  };

  const reload = async () => {
    try {
      const res = await fetch(API_URL + "/api/site", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(data));
      } catch {
        /* ignore */
      }
      apply(data);
    } catch {
      /* offline: keep what we have */
    }
  };

  useEffect(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) apply(JSON.parse(cached));
    } catch {
      /* ignore */
    }
    let done = false;
    const finish = () => {
      if (!done) {
        done = true;
        setReady(true);
      }
    };
    // never block the page for more than 1.5s if the API is slow
    const timer = setTimeout(finish, 1500);
    reload().finally(() => {
      clearTimeout(timer);
      finish();
    });
    const poll = setInterval(() => !document.hidden && reload(), 60000);
    return () => {
      clearTimeout(timer);
      clearInterval(poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // colours, font, runtime formatting, title and icon
  useLayoutEffect(() => {
    applyRuntime(site);
    const root = document.documentElement;
    Object.entries(themeVars(site.theme)).forEach(([k, v]) => root.style.setProperty(k, v));
    loadFont(site.theme.font);
    const fallbackTitle = site.seo.title || `${site.brand.name}${site.brand.tagline ? " — " + site.brand.tagline : ""}`;
    const wanted = admin ? `${site.brand.name} ${site.brand.adminSubtitle}` : fallbackTitle;
    document.title = wanted;
    // Next re-applies its own <title> on navigation, so keep ours
    const titleEl = document.querySelector("title");
    const obs = titleEl ? new MutationObserver(() => { if (document.title !== wanted) document.title = wanted; }) : null;
    if (titleEl && obs) obs.observe(titleEl, { childList: true, characterData: true, subtree: true });
    const desc = document.querySelector('meta[name="description"]');
    if (desc && site.seo.description) desc.setAttribute("content", site.seo.description);
    setFavicon(img(site.brand.faviconUrl || site.brand.logoUrl));
    return () => obs?.disconnect();
  }, [site, admin]);

  const value = useMemo(() => build(site, reload), [site]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Ctx.Provider value={value}>
      {ready ? (
        // remount once when the saved settings arrive so every component re-reads them
        <div key={version} className="contents">{children}</div>
      ) : (
        <div className="fixed inset-0 grid place-items-center bg-ink-950">
          <span className="h-9 w-9 animate-spin rounded-full border-2 border-white/15 border-t-brand-400" />
        </div>
      )}
    </Ctx.Provider>
  );
}

/** Renders children with a draft config, scoped to a wrapper (used by the live preview). */
export function SitePreview({ config, children, className }: { config: SiteConfig; children: React.ReactNode; className?: string }) {
  const parent = useContext(Ctx);
  const merged = useMemo(() => mergeSite(config), [config]);
  const vars = useMemo(() => themeVars(merged.theme), [merged.theme]);
  const value = useMemo(() => build(merged, parent.reload), [merged, parent.reload]);

  useLayoutEffect(() => {
    applyRuntime(merged);
    loadFont(merged.theme.font);
    return () => applyRuntime(parent.site);
  }, [merged, parent.site]);

  return (
    <Ctx.Provider value={value}>
      <div className={className} style={vars as React.CSSProperties}>
        {children}
      </div>
    </Ctx.Provider>
  );
}
