import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lexica — An Autonomous AI Research Assistant",
  description: "Search arXiv, summarize literature, and chat with your documents.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&amp;family=Instrument+Serif:ital@0;1&amp;family=JetBrains+Mono:wght@400;500&amp;family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&amp;display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-full flex flex-col m-0 p-0" style={{ fontFamily: "var(--font-sans)" }}>
        {children}
      </body>
    </html>
  );
}
