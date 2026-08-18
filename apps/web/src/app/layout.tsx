import type { Metadata } from "next";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import "./globals.css";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { AuthHashHandler } from "@/components/auth/AuthHashHandler";
import { AuthErrorBanner } from "@/components/auth/AuthErrorBanner";
import { ChatWidget } from "@/components/assistant/ChatWidget";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600"],
});

export const metadata: Metadata = {
  title: "Jua Institute",
  description: "Practical, project-based programs — taught live by an AI tutor that remembers you.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AuthErrorBanner />
        <AuthHashHandler />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
