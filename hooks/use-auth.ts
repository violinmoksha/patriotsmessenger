"use client"

import { useSyncExternalStore } from "react"

import { getAuthState, getServerAuthState, subscribeToAuth } from "@/lib/auth"

export function useAuth() {
  return useSyncExternalStore(subscribeToAuth, getAuthState, getServerAuthState)
}
