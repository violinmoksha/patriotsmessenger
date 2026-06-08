"use client"

import { FormEvent, useEffect, useMemo, useRef, useState } from "react"

import { useAuth } from "@/hooks/use-auth"
import { signOut } from "@/lib/auth"
import { addMessengerContact, getMessengerContacts, getMessengerKey, getMessengerMessages, publishMessengerKey, sendEncryptedMessengerMessage, syncUser } from "@/lib/tpv-api"
import { decryptFromEnvelope, encryptForRecipient, getOrCreateMessengerIdentity } from "@/lib/messenger-crypto"
import { connectPatriotsMessengerSocket } from "@/lib/messenger-socket"
import type { MessengerEnvelope, PublicUser } from "@/lib/types"

type DisplayMessage = MessengerEnvelope & { plaintext: string }

async function decryptMessage(message: MessengerEnvelope, privateKeyJwk: JsonWebKey): Promise<DisplayMessage> {
  const ciphertext = message.is_mine ? message.sender_ciphertext : message.recipient_ciphertext
  return { ...message, plaintext: await decryptFromEnvelope(privateKeyJwk, ciphertext) }
}

export function PatriotsMessenger({ standalone = false }: { standalone?: boolean }) {
  const { user, isAuthenticated } = useAuth()
  const [users, setUsers] = useState<PublicUser[]>([])
  const [ownPublicId, setOwnPublicId] = useState("")
  const [recipientId, setRecipientId] = useState("")
  const [ownHandle, setOwnHandle] = useState("")
  const [contactHandle, setContactHandle] = useState("")
  const [contactStatus, setContactStatus] = useState("")
  const [draft, setDraft] = useState("")
  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [status, setStatus] = useState("Preparing encrypted messenger...")
  const [error, setError] = useState<string | null>(null)
  const identityRef = useRef<{ publicKeyJwk: JsonWebKey; privateKeyJwk: JsonWebKey } | null>(null)
  const socketRef = useRef<ReturnType<typeof connectPatriotsMessengerSocket> | null>(null)
  const threadRef = useRef<HTMLDivElement | null>(null)

  const visibleMessages = useMemo(
    () => recipientId ? messages.filter((message) => message.sender_id === recipientId || message.recipient_id === recipientId) : [],
    [messages, recipientId],
  )

  useEffect(() => {
    if (!user) return
    const authUser = user
    let cancelled = false

    async function load() {
      try {
        setError(null)
        const profile = await syncUser(authUser.email, authUser.fullname || authUser.email, authUser.username)
        const [contacts, encryptedMessages] = await Promise.all([
          getMessengerContacts(profile.id),
          getMessengerMessages(authUser.email),
        ])
        if (cancelled) return

        const identity = await getOrCreateMessengerIdentity(authUser.email)
        identityRef.current = identity
        await publishMessengerKey(authUser.email, identity.publicKeyJwk)
        const decryptedMessages = await Promise.all(encryptedMessages.map((message) => decryptMessage(message, identity.privateKeyJwk)))

        setOwnPublicId(profile.id)
        setOwnHandle(profile.handle || "")
        setUsers(contacts.filter((entry) => entry.id !== profile.id))
        setMessages(decryptedMessages)
        setStatus("End-to-end encryption ready.")
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to prepare PatriotsMessenger.")
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [user])

  useEffect(() => {
    document.body.classList.toggle("messenger-active", isAuthenticated)

    return () => {
      document.body.classList.remove("messenger-active")
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (!ownPublicId || !identityRef.current) return
    socketRef.current?.close()
    socketRef.current = connectPatriotsMessengerSocket(ownPublicId, (rawMessage) => {
      const socketEnvelope = rawMessage as MessengerEnvelope
      const envelope = { ...socketEnvelope, is_mine: socketEnvelope.sender_id === ownPublicId }
      void decryptMessage(envelope, identityRef.current?.privateKeyJwk || {}).then((message) => {
        setMessages((current) => current.some((entry) => entry.id === message.id) ? current : [...current, message])
      }).catch(() => undefined)
    })

    return () => {
      socketRef.current?.close()
      socketRef.current = null
    }
  }, [ownPublicId])

  useEffect(() => {
    if (!threadRef.current) return
    threadRef.current.scrollTop = threadRef.current.scrollHeight
  }, [visibleMessages.length, recipientId])

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user || !recipientId || !draft.trim() || !identityRef.current) return

    try {
      setError(null)
      const recipientKey = await getMessengerKey(recipientId)
      const text = draft.trim()
      const [senderCiphertext, recipientCiphertext] = await Promise.all([
        encryptForRecipient(identityRef.current.publicKeyJwk, text),
        encryptForRecipient(recipientKey.public_key_jwk, text),
      ])
      const message = await sendEncryptedMessengerMessage(user.email, recipientId, senderCiphertext, recipientCiphertext)
      setMessages((current) => [...current, { ...message, plaintext: text }])
      socketRef.current?.send(message)
      setDraft("")
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Unable to send encrypted message.")
    }
  }

  async function addContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!ownPublicId || !contactHandle.trim()) return

    try {
      setError(null)
      setContactStatus("")
      const contact = await addMessengerContact(ownPublicId, contactHandle)
      setUsers((current) => current.some((entry) => entry.id === contact.id) ? current : [...current, contact])
      setRecipientId(contact.id)
      setContactHandle("")
      setContactStatus(`${contact.handle || contact.fullname} added.`)
    } catch (contactError) {
      setError(contactError instanceof Error ? contactError.message : "Unable to add contact.")
    }
  }

  return (
    <main className={standalone ? "messenger-shell" : "app-main"}>
      {!isAuthenticated ? (
        <p className="content-card messenger-signin-notice">Sign in to use PatriotsMessenger.</p>
      ) : (
        <section className="messenger-panel">
          <header className="messenger-header">
            <div>
              <p className="messenger-kicker">End-to-end encrypted</p>
              <h1>PatriotsMessenger<sup>TM</sup></h1>
              {ownHandle ? <p className="messenger-handle">{ownHandle}</p> : null}
              <button className="messenger-signout" type="button" onClick={() => void signOut()}>Sign out</button>
            </div>
            <div className="messenger-header-tools">
              {error ? <p className="form-error">{error}</p> : <p className="form-status">{contactStatus || status}</p>}
              <form className="contact-add" onSubmit={addContact}>
                <input aria-label="Add contact by username" onChange={(event) => setContactHandle(event.target.value)} placeholder="@someid" type="text" value={contactHandle} />
                <button className="button button-secondary" type="submit">Add</button>
              </form>
            </div>
          </header>

          <div className="messenger-thread" aria-live="polite" ref={threadRef}>
            {visibleMessages.length ? visibleMessages.map((message) => (
              <article className={`message-bubble ${message.is_mine ? "message-mine" : "message-theirs"}`} key={message.id}>
                <strong>{message.sender_name}</strong>
                <p>{message.plaintext}</p>
                <small>{new Date(message.created_at).toLocaleString()}</small>
              </article>
            )) : (
              <div className="messenger-empty">
                <strong>No messages yet</strong>
                <p>Choose someone and start a private conversation.</p>
              </div>
            )}
          </div>

          <form className="messenger-compose" onSubmit={send}>
            <select aria-label="Recipient" value={recipientId} onChange={(event) => setRecipientId(event.target.value)} required>
              <option value="">Choose a recipient</option>
              {users.map((entry) => <option key={entry.id} value={entry.id}>{entry.handle || entry.fullname}</option>)}
            </select>
            <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Message" required type="text" />
            <button className="button button-primary" type="submit">Send</button>
          </form>
        </section>
      )}
    </main>
  )
}
