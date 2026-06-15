import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bu Ne Kadar Eder? — AI ile saniyede fiyatla & ilan yaz",
  description:
    "Eşyanın fotoğrafını çek, yapay zeka saniyeler içinde fiyatını belirlesin ve kopyalanmaya hazır ilanını yazsın.",
};

export const viewport: Viewport = {
  themeColor: "#0ea5e9",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <body className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
