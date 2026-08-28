import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Exp. Recorder · Lab Console",
  description: "Experimental recording and stimulation control console",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
