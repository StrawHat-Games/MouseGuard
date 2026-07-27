import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mossguard: The Acorn Crown",
  description: "A two-player couch co-op woodland brawler starring medieval mice.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
