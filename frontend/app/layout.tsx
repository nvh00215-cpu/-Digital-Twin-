import type { Metadata } from "next";
import { JetBrains_Mono, Urbanist } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const sans = Urbanist({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "GlycoTwin",
  description: "Doctor view of a synthetic type 2 diabetes twin.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${sans.variable} ${mono.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
