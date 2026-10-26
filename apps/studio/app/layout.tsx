import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/plus-jakarta-sans";
import "./globals.css";
import type { Metadata, Viewport } from "next";
import { StudioProvider } from "@/lib/admin";
import { Shell } from "@/components/Shell";

export const metadata: Metadata = {
  title: "Tikit Studio",
  description: "Developer-only white-label customizer",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#06060b", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-dvh">
        <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-ink-950">
          <div className="absolute -left-40 -top-40 h-[34rem] w-[34rem] rounded-full bg-brand-600/20 blur-[130px]" />
          <div className="absolute -bottom-40 -right-32 h-[30rem] w-[30rem] rounded-full bg-hot-500/10 blur-[130px]" />
        </div>
        <StudioProvider>
          <Shell>{children}</Shell>
        </StudioProvider>
      </body>
    </html>
  );
}
