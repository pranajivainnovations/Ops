import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CrossFriend Ops",
  description: "Internal operations tool — baker network management.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/*
        suppressHydrationWarning covers attributes that browser extensions add to <body> before
        React hydrates — password managers, grammar checkers and AI assistants all do this, and the
        one seen here was `data-gptw`. The server cannot know about them, so React reports a mismatch
        it can never resolve, and the warning fires on every page for anyone with the extension
        installed while saying nothing about this application.

        Scoped to this one element deliberately: the flag applies only to <body>'s own attributes,
        not to anything inside it, so a genuine hydration mismatch in the app still surfaces.
      */}
      <body suppressHydrationWarning className="min-h-full flex flex-col">
        {children}
      </body>
    </html>
  );
}
