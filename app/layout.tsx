import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MedList",
  description:
    "Track your medications and generate a clear summary for your doctor.",
};

export const viewport: Viewport = {
  themeColor: "#237867",
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
    <html lang="en-NZ">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
