import { io } from 'socket.io-client';
import { SOCKET_URL } from './api';

let socket = null;
let currentToken = null;

/** One shared socket. Reconnects with the new token when the user logs in/out. */
export function getSocket(token) {
  if (socket && currentToken === (token || null)) return socket;
  if (socket) socket.disconnect();
  currentToken = token || null;
  socket = io(SOCKET_URL, { auth: { token }, transports: ['websocket', 'polling'] });
  return socket;
}
