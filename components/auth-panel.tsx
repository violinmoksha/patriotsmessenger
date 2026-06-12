"use client"

import { FormEvent, useEffect, useState } from "react"

import { initializeAuth, signIn, signOut, signUp } from "@/lib/auth"
import { useAuth } from "@/hooks/use-auth"

type AuthMode = "signin" | "signup"

export function AuthPanel() {
  const auth = useAuth()
  const [mode, setMode] = useState<AuthMode>("signin")
  const [fullname, setFullname] = useState("")
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void initializeAuth()
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    try {
      if (mode === "signup") await signUp(email, password, fullname, username)
      else await signIn(email, password)
      setPassword("")
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Authentication failed.")
    }
  }

  if (auth.isAuthenticated && auth.user) {
    return (
      <section className="auth-card">
        <span>Signed in as {auth.user.fullname || auth.user.email}</span>
        <button className="button button-secondary" type="button" onClick={() => void signOut()}>Sign out</button>
      </section>
    )
  }

  return (
    <section className="auth-card">
      <div className="mode-switch" role="tablist" aria-label="Authentication mode">
        <button className={mode === "signin" ? "active" : ""} onClick={() => setMode("signin")} type="button">Sign in</button>
        <button className={mode === "signup" ? "active" : ""} onClick={() => setMode("signup")} type="button">Sign up</button>
      </div>

      <form onSubmit={handleSubmit}>
        {mode === "signup" ? (
          <>
            <label>
              Full name
              <input autoComplete="name" onChange={(event) => setFullname(event.target.value)} required type="text" value={fullname} />
            </label>
            <label>
              Username
              <input autoComplete="username" onChange={(event) => setUsername(event.target.value.replace(/^@+/, ""))} pattern="[A-Za-z0-9_][A-Za-z0-9_.\-]{2,29}" placeholder="@someid" required type="text" value={username} />
            </label>
          </>
        ) : null}
        <label>
          {mode === "signup" ? "Email" : "Email or username"}
          <input autoComplete={mode === "signup" ? "email" : "username"} onChange={(event) => setEmail(event.target.value)} placeholder={mode === "signup" ? undefined : "email@example.com or @someid"} required type={mode === "signup" ? "email" : "text"} value={email} />
        </label>
        <label>
          Password
          <input autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={8} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} />
        </label>
        <button className="button button-primary" disabled={auth.isLoading} type="submit">
          {auth.isLoading ? "Connecting..." : mode === "signup" ? "Create account" : "Sign in"}
        </button>
      </form>

      {error ? <p className="form-error">{error}</p> : null}
    </section>
  )
}
