import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/plus-jakarta-sans";
import "./globals.css";
import type { Metadata, Viewport } from "next";
import { SiteProvider } from "@tikit/shared";
import { Backdrop, Footer, Navbar } from "@/components/Chrome";

// Real title, description and icon come from the Customizer (applied by SiteProvider).
export const metadata: Metadata = {
  title: "Tickets",
  description: "Discover events and get your QR ticket in minutes.",
};

export const viewport: Viewport = {
  themeColor: "#06060b",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-dvh">
        <SiteProvider>
          <Backdrop />
          <Navbar />
          <main>{children}</main>
          <Footer />
        </SiteProvider>
      </body>
    </html>
  );
}
