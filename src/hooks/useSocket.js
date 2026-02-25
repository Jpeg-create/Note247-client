import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

export const useSocket = ({ shortId, token, password, onDocChange, onCollaboratorsUpdate, onSaveSuccess }) => {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!shortId) return;

    const socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:4000', {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      setError(null);
      socket.emit('join-doc', { shortId, password });
    });

    socket.on('disconnect', () => setConnected(false));

    socket.on('doc-state', (state) => {
      onDocChange?.(state);
    });

    socket.on('doc-change', (data) => {
      onDocChange?.(data);
    });

    socket.on('collaborators-update', (collaborators) => {
      onCollaboratorsUpdate?.(collaborators);
    });

    socket.on('save-success', (data) => {
      onSaveSuccess?.(data);
    });

    socket.on('error', (err) => {
      setError(err.message);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [shortId, token]);

  const emitChange = useCallback((data) => {
    socketRef.current?.emit('doc-change', { shortId, ...data });
  }, [shortId]);

  const emitCursor = useCallback((line, col) => {
    socketRef.current?.emit('cursor', { shortId, line, col });
  }, [shortId]);

  const emitSave = useCallback((saveVersion = false) => {
    socketRef.current?.emit('save-doc', { shortId, saveVersion });
  }, [shortId]);

  return { connected, error, emitChange, emitCursor, emitSave };
};
