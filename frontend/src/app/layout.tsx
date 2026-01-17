import type { Metadata } from "next";
import "./globals.css";
import "katex/dist/katex.min.css";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  title: "Classly - Privacy-First Classroom Collaboration",
  description: "A collaborative classroom platform with AI-powered learning assistance",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="antialiased h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
