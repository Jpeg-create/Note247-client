import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

/**
 * useSocket — manages the Socket.io connection for real-time collaboration.
 *
 * Key design decisions:
 * - Callbacks (onDocChange etc.) are stored in refs so socket event handlers
 *   always call the LATEST version without causing reconnects.
 * - Transport order: polling first, then upgrade to websocket. This is the
 *   recommended order for Railway/Render where WebSocket upgrades can fail
 *   if the HTTP handshake hasn't completed.
 * - The socket URL falls back to the current page origin (same host) if
 *   VITE_SOCKET_URL is not set — works for monorepo deploys.
 * - Guests (no token) connect without auth — the server allows them.
 */
export const useSocket = ({
  shortId,
  token,
  password,
  onDocChange,
  onCollaboratorsUpdate,
  onSaveSuccess,
}) => {
  const socketRef       = useRef(null);
  const [connected, setConnected] = useState(false);

  // ── Callback refs — always current, never cause reconnects ───────────────
  const onDocChangeRef          = useRef(onDocChange);
  const onCollaboratorsUpdateRef = useRef(onCollaboratorsUpdate);
  const onSaveSuccessRef         = useRef(onSaveSuccess);

  // Keep refs in sync every render (cheap, no effect needed)
  onDocChangeRef.current          = onDocChange;
  onCollaboratorsUpdateRef.current = onCollaboratorsUpdate;
  onSaveSuccessRef.current         = onSaveSuccess;

  // shortId ref for emitters that need the current value
  const shortIdRef = useRef(shortId);
  shortIdRef.current = shortId;

  // ── Connection — only reconnect when shortId / token / password change ────
  useEffect(() => {
    if (!shortId) return;

    // Resolve socket URL: env var → current origin (works for same-host deploys)
    const socketUrl = import.meta.env.VITE_SOCKET_URL || window.location.origin;

    const socket = io(socketUrl, {
      auth: token ? { token } : {},           // guests connect without token
      transports: ['polling', 'websocket'],   // polling first → reliable upgrade
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    socketRef.current = socket;

    // ── Connect ─────────────────────────────────────────────────────────────
    socket.on('connect', () => {
      setConnected(true);
      // Join the document room; password is optional (for password-protected docs)
      socket.emit('join-doc', { shortId, password: password || undefined });
    });

    socket.on('disconnect', (reason) => {
      setConnected(false);
      // 'io server disconnect' = server explicitly disconnected us → don't auto-reconnect
      if (reason === 'io server disconnect') socket.connect();
    });

    socket.on('connect_error', (err) => {
      console.warn('[socket] connect_error:', err.message);
    });

    // ── Incoming events — use refs so callbacks are always fresh ─────────────
    socket.on('doc-change', (data) => {
      onDocChangeRef.current?.(data);
    });

    socket.on('doc-state', (state) => {
      // Server can push the full doc state on join
      onDocChangeRef.current?.(state);
    });

    socket.on('collaborators-update', (collaborators) => {
      onCollaboratorsUpdateRef.current?.(collaborators);
    });

    socket.on('save-success', (data) => {
      onSaveSuccessRef.current?.(data);
    });

    socket.on('write-denied', () => {
      // Server dropped our change — we're in read-only mode for this doc
      console.warn('[socket] write-denied: this socket is in read-only mode');
    });

    return () => {
      socket.off();          // remove all listeners before disconnect
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [shortId, token, password]); // eslint-disable-line react-hooks/exhaustive-deps
  // Note: callbacks intentionally excluded — they're accessed via refs above

  // ── Emitters — stable references, always send to current shortId ──────────
  const emitChange = useCallback((data) => {
    const sid = shortIdRef.current;
    if (!sid || !socketRef.current?.connected) return;
    socketRef.current.emit('doc-change', { shortId: sid, ...data });
  }, []); // no deps — uses refs

  const emitCursor = useCallback((line, col) => {
    const sid = shortIdRef.current;
    if (!sid || !socketRef.current?.connected) return;
    socketRef.current.emit('cursor', { shortId: sid, line, col });
  }, []);

  const emitSave = useCallback((saveVersion = false) => {
    const sid = shortIdRef.current;
    if (!sid || !socketRef.current?.connected) return;
    socketRef.current.emit('save-doc', { shortId: sid, saveVersion });
  }, []);

  return { connected, emitChange, emitCursor, emitSave };
};
