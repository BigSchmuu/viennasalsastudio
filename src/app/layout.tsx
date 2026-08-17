import type { Metadata, Viewport } from "next";
import { Inter, Raleway } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const raleway = Raleway({ subsets: ["latin"], variable: "--font-raleway" });

export const metadata: Metadata = {
  title: "Vienna Salsa Studio",
  description: "Kurse buchen, Abo verwalten und Beispiel-Videos ansehen.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Vienna Salsa Studio",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b0b0b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body className={`${inter.variable} ${raleway.variable} font-sans antialiased`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
