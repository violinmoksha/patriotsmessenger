export interface PublicUser {
  id: string
  fullname: string
  username?: string | null
  handle?: string | null
}

export interface FeedPost {
  id: string
  author_id: string
  author_name: string
  content: string
  created_at: string
}

export interface DirectMessage {
  id: string
  sender_id: string
  sender_name: string
  recipient_id: string
  recipient_name: string
  content: string
  created_at: string
  is_mine: boolean
}

export interface MessengerCiphertext {
  algorithm: "ECDH-P256-AES-GCM"
  iv: string
  ephemeral_public_key_jwk: JsonWebKey
  ciphertext: string
}

export interface MessengerEnvelope {
  id: string
  sender_id: string
  sender_name: string
  recipient_id: string
  recipient_name: string
  sender_ciphertext: MessengerCiphertext
  recipient_ciphertext: MessengerCiphertext
  created_at: string
  is_mine: boolean
}

export interface MessengerKey {
  user_id: string
  public_key_jwk: JsonWebKey
}

export interface Forum {
  id: string
  title: string
  description: string
  moderator_id: string
  moderator_name: string
  post_count: number
  created_at: string
}

export interface ForumPost {
  id: string
  forum_id: string
  author_id: string
  author_name: string
  content: string
  created_at: string
}
