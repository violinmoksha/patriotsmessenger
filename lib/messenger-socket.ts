"use client"

function configuredSocketUrl() {
  const configured = process.env.NEXT_PUBLIC_PATRIOTS_MESSENGER_SOCKET_URL
  if (configured) return configured
  if (window.location.hostname === "localhost") return "ws://localhost:4001/patriots-messenger/ws"
  if (window.location.hostname === "127.0.0.1") return "ws://127.0.0.1:4001/patriots-messenger/ws"
  return "wss://chat.authflow.net/patriots-messenger/ws"
}

export function connectPatriotsMessengerSocket(userId: string, onMessage: (message: unknown) => void) {
  const socket = new WebSocket(configuredSocketUrl())
  const pendingMessages: unknown[] = []

  function sendEnvelope(message: unknown) {
    socket.send(JSON.stringify({ type: "messenger_message", message }))
  }

  socket.addEventListener("open", () => {
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
  })

  socket.addEventListener("close", () => {
    pendingMessages.length = 0
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
