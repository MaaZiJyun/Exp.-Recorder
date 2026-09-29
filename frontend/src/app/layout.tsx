import type { Metadata } from "next";
import { appConfig } from "@/config/app-config";
import "./globals.css";

export const metadata: Metadata = {
  title: appConfig.metadata.title,
  description: appConfig.description,
  icons: {
    icon: appConfig.icon,
    shortcut: appConfig.icon,
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
