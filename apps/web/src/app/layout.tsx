import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { DegradedModeBanner } from "@/components/DegradedModeBanner";
import "@/lib/dev-guard"; // Development guard for apiFetch() warnings
import { apiFetch } from '@/lib/apiFetch';


const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Shomer - Community Safety Platform",
  description: "Advanced threat detection and community safety monitoring",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <DegradedModeBanner />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
