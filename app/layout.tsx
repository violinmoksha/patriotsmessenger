import type { Metadata, Viewport } from "next"

import "./globals.css"

export const metadata: Metadata = {
  title: "PatriotsMessenger",
  description: "End-to-end encrypted messaging powered by AuthFlow.",
  applicationName: "PatriotsMessenger",
}

export const viewport: Viewport = {
  themeColor: "#0a3161",
  viewportFit: "cover",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
