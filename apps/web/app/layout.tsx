import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
// import { SpeedInsights } from "@vercel/speed-insights/next"; // Disabled to avoid ongoing Vercel usage costs; may be re-enabled later.
import GameHeader from "@/components/layout/GameHeader";
import GameHeaderVisibility from "@/components/layout/GameHeaderVisibility";
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
        <GameHeaderVisibility>
          <GameHeader />
        </GameHeaderVisibility>
        {children}
        <ReturnToTopButton />
        <Analytics />
        {/* <SpeedInsights /> */}
      </body>
    </html>
  );
}
