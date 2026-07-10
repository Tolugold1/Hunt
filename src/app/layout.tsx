import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import SessionProvider from "@/components/SessionProvider";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Hunt — Job & Social Autopilot",
  description: "Automate your job search and social media presence.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased bg-gray-950`}>
      <body className="min-h-full bg-gray-950 text-gray-100">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
