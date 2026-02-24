import "~/styles/globals.css";

import { type Metadata } from "next";
import { DM_Sans, Geist_Mono, Playfair_Display } from "next/font/google";

import { AppNavbar } from "@/components/app-navbar";
import { TRPCReactProvider } from "~/trpc/react";

export const metadata: Metadata = {
  title: "Undiscovered Art",
  description: "Timed art auctions with live bidding",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${playfair.variable} ${geistMono.variable}`}
    >
      <body className="antialiased">
        <TRPCReactProvider>
          <div className="min-h-screen bg-background text-foreground">
            <AppNavbar />
            {children}
          </div>
        </TRPCReactProvider>
      </body>
    </html>
  );
}
