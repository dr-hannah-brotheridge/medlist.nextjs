import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { InstallPrompt } from "@/components/InstallPrompt";

export const metadata: Metadata = {
  title: "ScriptPal NZ",
  description:
    "Understand your scripts and generate a clear summary for your doctor.",
  manifest: "/manifest.webmanifest",
  applicationName: "ScriptPal NZ",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ScriptPal NZ",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { url: "/icon-maskable-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icon-192.png", sizes: "192x192" },
      { url: "/icon-512.png", sizes: "512x512" },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#237867",
  width: "device-width",
  initialScale: 1,
  // Note: maximumScale intentionally omitted so users can pinch-zoom
  // (an accessibility anti-pattern to disable native zoom).
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-NZ">
      <body className="font-sans antialiased">
        {children}
        <ServiceWorkerRegister />
        <InstallPrompt />
      </body>
    </html>
  );
}