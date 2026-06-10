"use client"

import { useEffect } from "react"

import { Capacitor } from "@capacitor/core"
import { StatusBar, Style } from "@capacitor/status-bar"

export function StatusBarSetup() {
  useEffect(() => {
    if (Capacitor.getPlatform() !== "android") return

    void (async () => {
      try {
        await StatusBar.setOverlaysWebView({ overlay: false })
        await StatusBar.setStyle({ style: Style.Dark })
        await StatusBar.setBackgroundColor({ color: "#000000" })
        await StatusBar.show()
      } catch {
        // Native status bar styling is best-effort; the app should still render if unavailable.
      }
    })()
  }, [])

  return null
}
