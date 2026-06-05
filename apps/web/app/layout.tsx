import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import GlobalUtcClock from "@/components/GlobalUtcClock";
import NotificationInboxLink from "@/components/NotificationInboxLink";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ShowRing Game",
  description: "Build your kennel, buy dogs, breed litters, and compete in a living dog show simulation.",
  icons: {
    icon: "/icon.png",
    shortcut: "/icon.png",
    apple: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <GlobalUtcClock />
        <Suspense fallback={null}>
          <NotificationInboxLink />
        </Suspense>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
