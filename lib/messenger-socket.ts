"use client"

function configuredSocketUrl() {
  const configured = process.env.NEXT_PUBLIC_PATRIOTS_MESSENGER_SOCKET_URL
  if (configured) return configured
  if (window.location.protocol === "http:" && window.location.hostname === "localhost") return "ws://localhost:4001/patriots-messenger/ws"
  if (window.location.protocol === "http:" && window.location.hostname === "127.0.0.1") return "ws://127.0.0.1:4001/patriots-messenger/ws"
  return "wss://chat.authflow.net/patriots-messenger/ws"
}

type SocketStatus = {
  status: "connecting" | "open" | "closed" | "error" | "message"
  detail?: string
}

export function connectPatriotsMessengerSocket(
  userId: string,
  onMessage: (message: unknown) => void,
  onStatus?: (status: SocketStatus) => void,
) {
  const url = configuredSocketUrl()
  onStatus?.({ status: "connecting", detail: url })

  let socket: WebSocket
  try {
    socket = new WebSocket(url)
  } catch (error) {
    onStatus?.({ status: "error", detail: error instanceof Error ? error.message : "Unable to create WebSocket." })
    return {
      send() {},
      close() {},
    }
  }

  const pendingMessages: unknown[] = []

  function sendEnvelope(message: unknown) {
    socket.send(JSON.stringify({ type: "messenger_message", message }))
  }

  socket.addEventListener("open", () => {
    onStatus?.({ status: "open", detail: url })
    socket.send(JSON.stringify({ type: "init", userId }))
    while (pendingMessages.length && socket.readyState === WebSocket.OPEN) {
      sendEnvelope(pendingMessages.shift())
    }
  })

  socket.addEventListener("message", (event) => {
    let payload: { type?: string; message?: unknown; messages?: unknown[] }
    try {
      payload = JSON.parse(event.data as string)
    } catch {
      return
    }

    if (payload.type === "messenger_message" && payload.message) onMessage(payload.message)
    if (payload.type === "messenger_history" && Array.isArray(payload.messages)) payload.messages.forEach(onMessage)
    if (payload.type === "info" && typeof payload.message === "string") onStatus?.({ status: "message", detail: payload.message })
    if (payload.type === "error" && typeof payload.message === "string") onStatus?.({ status: "error", detail: payload.message })
  })

  socket.addEventListener("error", () => {
    onStatus?.({ status: "error", detail: url })
  })

  socket.addEventListener("close", (event) => {
    pendingMessages.length = 0
    onStatus?.({ status: "closed", detail: `${event.code}${event.reason ? ` ${event.reason}` : ""}` })
  })

  return {
    send(message: unknown) {
      if (socket.readyState === WebSocket.OPEN) {
        sendEnvelope(message)
      } else if (socket.readyState === WebSocket.CONNECTING) {
        pendingMessages.push(message)
      }
    },
    close() {
      socket.close()
    },
  }
}
