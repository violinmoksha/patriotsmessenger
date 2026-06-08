"use client"

import { resolveLoginIdentifier, syncUser } from "@/lib/tpv-api"

export type AuthUser = {
  email: string
  fullname?: string
  username?: string
  role: "user" | "admin"
  token: string
}

export type AuthState = {
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean
}

type AuthFlowResponse = {
  statusCode?: number
  message?: string
  token?: string
  email?: string
  fullname?: string
  role?: string
}

const COOKIE_NAME = "patriots_messenger_auth_user"

function normalizeBaseUrl(value: string) {
  return value.replace(/\/$/, "")
}

function getApiBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_AUTHFLOW_API_URL || "https://api.authflow.net"

  if (typeof window !== "undefined" && window.location.hostname === "localhost" && !process.env.NEXT_PUBLIC_AUTHFLOW_API_URL) {
    return "http://localhost:3001"
  }

  return normalizeBaseUrl(configured)
}

function setCookie(name: string, value: string, days = 7): void {
  if (typeof document === "undefined") return

  const expires = new Date(Date.now() + days * 864e5).toUTCString()
  const secure = window.location.protocol === "https:" ? "; Secure" : ""

  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Strict${secure}`
}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null

  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

function deleteCookie(name: string): void {
  if (typeof document === "undefined") return

  const secure = window.location.protocol === "https:" ? "; Secure" : ""

  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Strict${secure}`
}

class AuthFlowClient {
  private baseUrl = getApiBaseUrl()
  private apiKey = process.env.NEXT_PUBLIC_AUTHFLOW_API_KEY || ""

  private async request(endpoint: string, params: Record<string, string>, method: "GET" | "POST" = "GET") {
    const response = method === "POST"
      ? await fetch(`${this.baseUrl}${endpoint}`, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
        })
      : await this.get(endpoint, params)

    const contentType = response.headers.get("content-type") || ""
    const data = contentType.includes("application/json")
      ? await response.json() as AuthFlowResponse
      : { message: await response.text() }

    return {
      data,
      status: typeof data.statusCode === "number" ? data.statusCode : response.status,
    }
  }

  private get(endpoint: string, params: Record<string, string>) {
    const url = new URL(`${this.baseUrl}${endpoint}`)

    Object.entries(params).forEach(([key, value]) => {
      if (value) url.searchParams.set(key, value)
    })

    return fetch(url.toString())
  }

  private async createFooBarToken(email: string) {
    if (!this.apiKey) {
      throw new Error("Missing NEXT_PUBLIC_AUTHFLOW_API_KEY.")
    }

    const { data, status } = await this.request("/auth/fooBar", {
      identity: email,
      api_key: this.apiKey,
      role: "user",
    })

    if (status !== 200 || !data.token) {
      throw new Error(data.message || "Unable to create AuthFlow pre-auth token.")
    }

    return data.token
  }

  async signUp(email: string, password: string, fullname: string, username: string) {
    const foobar = await this.createFooBarToken(email)

    const { data, status } = await this.request("/auth/signUp", {
      foobar,
      email,
      password,
      fullname,
      role: "user",
      api_key: this.apiKey,
      disclaimed: "true",
    }, "POST")

    if (status !== 200) {
      throw new Error(data.message || "Unable to create your account.")
    }

    return { ...(await this.signIn(email, password)), username }
  }

  async signIn(identifier: string, password: string): Promise<AuthUser> {
    const cleanIdentifier = identifier.trim()
    const resolved = cleanIdentifier.startsWith("@") ? await resolveLoginIdentifier(cleanIdentifier) : null
    const email = resolved?.email || cleanIdentifier
    const foobar = await this.createFooBarToken(email)

    const login = await this.request("/auth/login", {
      foobar,
      email,
      password,
      role: "user",
      api_key: this.apiKey,
    }, "POST")

    if (login.status !== 200 || !login.data.token) {
      throw new Error(login.data.message || "Unable to sign in.")
    }

    const me = await this.request("/auth/me", {
      sessionToken: login.data.token,
    })

    if (me.status !== 200 || !me.data.email) {
      throw new Error(me.data.message || "Unable to resolve your profile.")
    }

    return {
      email: me.data.email,
      fullname: me.data.fullname,
      username: resolved?.username,
      role: me.data.role === "admin" ? "admin" : "user",
      token: login.data.token,
    }
  }

  async validate(token: string, email: string) {
    const { status } = await this.request("/auth/validate", {
      sessionToken: token,
      email,
    })

    return status === 200
  }

  async signOut(token: string, email: string) {
    await this.request("/auth/logout", {
      sessionToken: token,
      email,
    })
  }
}

const authFlowClient = new AuthFlowClient()
const emptyAuthState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
}

let authState = emptyAuthState
const listeners = new Set<() => void>()

function notifyListeners() {
  listeners.forEach((listener) => listener())
}

export function subscribeToAuth(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getAuthState() {
  return authState
}

export function getServerAuthState() {
  return emptyAuthState
}

export async function initializeAuth() {
  const stored = getCookie(COOKIE_NAME)

  if (!stored) {
    authState = emptyAuthState
    notifyListeners()
    return
  }

  try {
    const parsed = JSON.parse(stored) as AuthUser
    const isValid = await authFlowClient.validate(parsed.token, parsed.email)

    authState = isValid
      ? { user: parsed, isAuthenticated: true, isLoading: false }
      : emptyAuthState

    if (!isValid) deleteCookie(COOKIE_NAME)
    notifyListeners()
  } catch {
    deleteCookie(COOKIE_NAME)
    authState = emptyAuthState
    notifyListeners()
  }
}

export async function signIn(email: string, password: string) {
  authState = { ...authState, isLoading: true }
  notifyListeners()

  try {
    const user = await authFlowClient.signIn(email, password)

    authState = { user, isAuthenticated: true, isLoading: false }
    setCookie(COOKIE_NAME, JSON.stringify(user))
    notifyListeners()

    return user
  } catch (error) {
    authState = { ...authState, isLoading: false }
    notifyListeners()
    throw error
  }
}

export async function signUp(email: string, password: string, fullname: string, username: string) {
  authState = { ...authState, isLoading: true }
  notifyListeners()

  try {
    const user = await authFlowClient.signUp(email, password, fullname, username)
    await syncUser(user.email, user.fullname || user.email, username)

    authState = { user, isAuthenticated: true, isLoading: false }
    setCookie(COOKIE_NAME, JSON.stringify(user))
    notifyListeners()

    return user
  } catch (error) {
    authState = { ...authState, isLoading: false }
    notifyListeners()
    throw error
  }
}

export async function signOut() {
  if (authState.user) {
    try {
      await authFlowClient.signOut(authState.user.token, authState.user.email)
    } catch {
      // Local sign-out should still succeed if the network is unavailable.
    }
  }

  deleteCookie(COOKIE_NAME)
  authState = emptyAuthState
  notifyListeners()
}
