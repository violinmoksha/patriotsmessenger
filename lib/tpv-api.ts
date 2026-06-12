import type { DirectMessage, FeedPost, Forum, ForumPost, MessengerCiphertext, MessengerEnvelope, MessengerKey, PublicUser } from "@/lib/types"

const REQUEST_TIMEOUT_MS = 15000

function getApiBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_THEPATRIOTSVOICE_API_URL
  if (configured) return configured.replace(/\/+$/, "")
  if (typeof window !== "undefined" && window.location.hostname === "localhost") {
    return "http://127.0.0.1:5001/the-patriots-voice/us-central1/api"
  }
  return "https://us-central1-the-patriots-voice.cloudfunctions.net/api"
}

async function request<T>(path: string, init: RequestInit = {}) {
  const url = `${getApiBaseUrl()}${path}`
  let response: Response
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    response = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init.headers || {}) },
      cache: "no-store",
      signal: controller.signal,
    })
  } catch (error) {
    const message = error instanceof Error && error.name === "AbortError"
      ? `Request timed out after ${REQUEST_TIMEOUT_MS / 1000}s`
      : error instanceof Error ? error.message : "Unknown network error."
    throw new Error(`Unable to reach The Patriots Voice API at ${url}: ${message}`)
  } finally {
    window.clearTimeout(timeout)
  }

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = typeof payload.message === "string" ? payload.message : "The Patriots Voice API request failed."
    throw new Error(`The Patriots Voice API request failed (${response.status} ${response.statusText}): ${message}`)
  }
  return payload as T
}

const encodeId = (value: string) => encodeURIComponent(value.trim())

export async function syncUser(email: string, fullname: string, username?: string) {
  return (await request<{ user: PublicUser }>("/users/sync", { method: "POST", body: JSON.stringify({ email, fullname, username }) })).user
}

export async function resolveLoginIdentifier(identifier: string) {
  return (await request<{ email: string; username?: string }>("/users/resolve-login", {
    method: "POST",
    body: JSON.stringify({ identifier }),
  }))
}

export async function getUsers() {
  return (await request<{ users: PublicUser[] }>("/users")).users
}

export async function getFeedPosts() {
  return (await request<{ posts: FeedPost[] }>("/posts")).posts
}

export async function createFeedPost(authorId: string, content: string) {
  return (await request<{ post: FeedPost }>("/posts", { method: "POST", body: JSON.stringify({ author_id: authorId, content }) })).post
}

export async function getMessages(userId: string) {
  return (await request<{ messages: DirectMessage[] }>(`/messages?userId=${encodeId(userId)}`)).messages
}

export async function sendMessage(senderId: string, recipientId: string, content: string) {
  return (await request<{ message: DirectMessage }>("/messages", {
    method: "POST",
    body: JSON.stringify({ sender_id: senderId, recipient_id: recipientId, content }),
  })).message
}

export async function publishMessengerKey(userId: string, publicKeyJwk: JsonWebKey) {
  return (await request<{ key: MessengerKey }>("/messenger/keys", {
    method: "POST",
    body: JSON.stringify({ user_id: userId, public_key_jwk: publicKeyJwk }),
  })).key
}

export async function getMessengerKey(userId: string) {
  return (await request<{ key: MessengerKey }>(`/messenger/users/${encodeId(userId)}/key`)).key
}

export async function getMessengerMessages(userId: string) {
  return (await request<{ messages: MessengerEnvelope[] }>(`/messenger/messages?userId=${encodeId(userId)}`)).messages
}

export async function getMessengerContacts(userId: string) {
  return (await request<{ contacts: PublicUser[] }>(`/messenger/contacts?userId=${encodeId(userId)}`)).contacts
}

export async function addMessengerContact(userId: string, handle: string) {
  return (await request<{ contact: PublicUser }>("/messenger/contacts", {
    method: "POST",
    body: JSON.stringify({ user_id: userId, handle }),
  })).contact
}

export async function sendEncryptedMessengerMessage(
  senderId: string,
  recipientId: string,
  senderCiphertext: MessengerCiphertext,
  recipientCiphertext: MessengerCiphertext,
) {
  return (await request<{ message: MessengerEnvelope }>("/messenger/messages", {
    method: "POST",
    body: JSON.stringify({
      sender_id: senderId,
      recipient_id: recipientId,
      sender_ciphertext: senderCiphertext,
      recipient_ciphertext: recipientCiphertext,
    }),
  })).message
}

export async function getForums() {
  return (await request<{ forums: Forum[] }>("/forums")).forums
}

export async function createForum(moderatorId: string, title: string, description: string) {
  return (await request<{ forum: Forum }>("/forums", {
    method: "POST",
    body: JSON.stringify({ moderator_id: moderatorId, title, description }),
  })).forum
}

export async function getForum(forumId: string) {
  return request<{ forum: Forum; posts: ForumPost[] }>(`/forums/${encodeId(forumId)}`)
}

export async function createForumPost(forumId: string, authorId: string, content: string) {
  return (await request<{ post: ForumPost }>(`/forums/${encodeId(forumId)}/posts`, {
    method: "POST",
    body: JSON.stringify({ author_id: authorId, content }),
  })).post
}
