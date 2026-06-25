import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import GlobalUtcClock from "@/components/GlobalUtcClock";
import EmergencyCareLink from "@/components/EmergencyCareLink";
import NotificationInboxLink from "@/components/NotificationInboxLink";
import ReturnToTopButton from "@/components/ReturnToTopButton";
import ThemeToggle from "@/components/ThemeToggle";

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
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("showring-theme");if(t==="dark")document.documentElement.dataset.theme="dark"}catch(e){}`,
          }}
        />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <ThemeToggle />
        <GlobalUtcClock />
        <Suspense fallback={null}>
          <NotificationInboxLink />
          <EmergencyCareLink />
        </Suspense>
        {children}
        <ReturnToTopButton />
        <Analytics />
      </body>
    </html>
  );
}
