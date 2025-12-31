import type { Metadata } from "next";
import "./globals.css";
import "katex/dist/katex.min.css";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  title: "ClassroomCogni - Privacy-First Classroom Collaboration",
  description: "A Slack-inspired collaborative classroom platform with AI-powered learning assistance",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
