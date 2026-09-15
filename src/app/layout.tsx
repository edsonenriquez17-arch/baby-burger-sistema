import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Baby Burger", template: "%s · Baby Burger" },
  description: "Sistema de gestión de Baby Burger",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Baby Burger", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#1f3fd8",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1, // evita zoom accidental en mostrador
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
