import { io } from 'socket.io-client'

let socket = null

export const getSocket = () => {
  if (!socket) {
    const token = localStorage.getItem('nf_token')
    socket = io(import.meta.env.VITE_SOCKET_URL || '', {
      auth: { token },
      transports: ['websocket', 'polling'],
    })
  }
  return socket
}

export const disconnectSocket = () => {
  if (socket) { socket.disconnect(); socket = null }
}
