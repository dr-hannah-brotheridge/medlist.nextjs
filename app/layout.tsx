import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";

export const metadata: Metadata = {
  title: "MedList",
  description:
    "Track your medications and generate a clear summary for your doctor.",
  manifest: "/manifest.webmanifest",
  applicationName: "MedList",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "MedList",
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icon-192.png", sizes: "192x192" }],
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
      </body>
    </html>
  );
}