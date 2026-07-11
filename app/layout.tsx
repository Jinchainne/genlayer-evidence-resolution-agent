import type { Metadata } from "next";

import "@/app/globals.css";

export const metadata: Metadata = {
  title: "GenLayer Evidence Resolution Agent",
  description: "GenLayer-native adjudication dashboard for evidence-based, non-deterministic claim resolution."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
