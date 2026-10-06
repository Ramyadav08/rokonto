import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";

// Plain system font stacks, not next/font/google -- that fetches font files
// from Google Fonts at *build time*, which fails the whole build on any
// network that can't reach fonts.gstatic.com (seen on a cloud VM with a
// restrictive/broken egress path). System fonts render instantly with zero
// network dependency anywhere this gets built or deployed.
const fontVariables = {
  "--font-sans":
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  "--font-mono":
    'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
} as React.CSSProperties;

export const metadata: Metadata = {
  title: "Observex",
  description: "Kubernetes & cloud observability platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" style={fontVariables}>
      <body className="font-sans antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
