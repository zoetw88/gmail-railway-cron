import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";
  const image = host ? `${protocol}://${host}/og.png` : undefined;
  return {
    title: "Zoe Inbox｜緊急信件通知",
    description: "四個 Gmail 帳號的私人每日整理摘要。",
    manifest: "/manifest.webmanifest",
    themeColor: "#174c3a",
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: "Zoe Inbox",
    },
    icons: {
      icon: "/icon-192.png",
      apple: "/icon-192.png",
    },
    openGraph: image ? { images: [{ url: image }] } : undefined,
    twitter: image ? { card: "summary_large_image", images: [image] } : undefined,
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
