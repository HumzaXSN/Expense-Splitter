import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ServiceWorkerRegistration } from "@/components/service-worker-registration";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Expense Splitter - Split Group Expenses Easily",
  description: "Split group expenses with friends and roommates. Track who owes whom, simplify debts, and settle up easily. Works offline!",
  keywords: ["expense", "split", "splitwise", "money", "bills", "roommates", "friends", "groups"],
  authors: [{ name: "Expense Splitter" }],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Expense Splitter",
  },
  openGraph: {
    title: "Expense Splitter",
    description: "Split group expenses easily with friends and roommates",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Expense Splitter",
    description: "Split group expenses easily with friends and roommates",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/icon-192x192.png" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ServiceWorkerRegistration />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
