import type { Metadata } from "next";
import { Geist, Geist_Mono, Red_Rose, Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const inter = Inter({subsets:['latin'],variable:'--font-sans'});


// Keep Geist (optional usage later)
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// ✅ Add Red Rose as primary font
const redRose = Red_Rose({
  subsets: ["latin"],
  variable: "--font-red-rose",
});

export const metadata: Metadata = {
  title: "Webbriks | Global Creative Agency",
  description:
    "Webbriks is a global creative agency that specializes in crafting innovative and impactful solutions for brands worldwide.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={cn("h-full", "antialiased", geistSans.variable, geistMono.variable, redRose.variable, "font-sans", inter.variable)} 
      suppressHydrationWarning={true}
    >
      <body className={`${redRose.className}  flex flex-col`}>
        {children}
      </body>
    </html>
  );
}
