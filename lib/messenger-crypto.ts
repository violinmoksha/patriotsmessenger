"use client"

import type { MessengerCiphertext } from "@/lib/types"

const ALGORITHM = "ECDH-P256-AES-GCM"
const KEY_PREFIX = "patriots_messenger_identity_key"
const encoder = new TextEncoder()
const decoder = new TextDecoder()

function toBase64(bytes: Uint8Array) {
  let binary = ""
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary)
}

function fromBase64(value: string) {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

function storageKey(userId: string) {
  return `${KEY_PREFIX}:${userId.toLowerCase()}`
}

async function importPrivateKey(jwk: JsonWebKey) {
  return crypto.subtle.importKey("jwk", jwk, { name: "ECDH", namedCurve: "P-256" }, true, ["deriveKey"])
}

async function importPublicKey(jwk: JsonWebKey) {
  return crypto.subtle.importKey("jwk", jwk, { name: "ECDH", namedCurve: "P-256" }, true, [])
}

async function deriveAesKey(privateKey: CryptoKey, publicKey: CryptoKey) {
  return crypto.subtle.deriveKey(
    { name: "ECDH", public: publicKey },
    privateKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  )
}

export async function getOrCreateMessengerIdentity(userId: string) {
  const stored = localStorage.getItem(storageKey(userId))
  if (stored) {
    const parsed = JSON.parse(stored) as { publicKeyJwk: JsonWebKey; privateKeyJwk: JsonWebKey }
    return parsed
  }

  const keyPair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveKey"])
  const publicKeyJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey)
  const privateKeyJwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey)
  const identity = { publicKeyJwk, privateKeyJwk }
  localStorage.setItem(storageKey(userId), JSON.stringify(identity))
  return identity
}

export async function encryptForRecipient(publicKeyJwk: JsonWebKey, plaintext: string): Promise<MessengerCiphertext> {
  const recipientPublicKey = await importPublicKey(publicKeyJwk)
  const ephemeral = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveKey"])
  const aesKey = await deriveAesKey(ephemeral.privateKey, recipientPublicKey)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aesKey, encoder.encode(plaintext))
  const ephemeralPublicKeyJwk = await crypto.subtle.exportKey("jwk", ephemeral.publicKey)

  return {
    algorithm: ALGORITHM,
    iv: toBase64(iv),
    ephemeral_public_key_jwk: ephemeralPublicKeyJwk,
    ciphertext: toBase64(new Uint8Array(encrypted)),
  }
}

export async function decryptFromEnvelope(privateKeyJwk: JsonWebKey, envelope: MessengerCiphertext) {
  const privateKey = await importPrivateKey(privateKeyJwk)
  const ephemeralPublicKey = await importPublicKey(envelope.ephemeral_public_key_jwk)
  const aesKey = await deriveAesKey(privateKey, ephemeralPublicKey)
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(envelope.iv) },
    aesKey,
    fromBase64(envelope.ciphertext),
  )
  return decoder.decode(decrypted)
}
