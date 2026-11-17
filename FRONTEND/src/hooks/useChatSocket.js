import { useCallback, useEffect, useRef, useState } from 'react';
import { WS_BASE_URL, REALTIME_ENABLED } from '../config';

const MAX_RETRY_DELAY = 15000;

/**
 * Owns the lifecycle of the Django Channels chat WebSocket.
 *
 * - One socket per signed-in user; it is NOT recreated when the caller re-renders,
 *   because the latest `onEvent` handler is read through a ref.
 * - Reconnects with exponential backoff (1s, 2s, 4s ... 15s) and immediately when
 *   the browser comes back online.
 * - `status` is one of: 'disabled' (host has no WebSocket support), 'connecting',
 *   'open', 'reconnecting', 'disconnected' (no auth token).
 * - `onEvent` also receives a synthetic `{ type: 'socket_open', reconnected }` event
 *   so the caller can refetch anything missed while the socket was down.
 */
export const useChatSocket = ({ userId, onEvent }) => {
  const [status, setStatus] = useState(REALTIME_ENABLED ? 'connecting' : 'disabled');
  const socketRef = useRef(null);
  const onEventRef = useRef(onEvent);

  useEffect(() => {
    onEventRef.current = onEvent;
  });

  useEffect(() => {
    if (!REALTIME_ENABLED || !userId) return undefined;

    let disposed = false;
    let attempt = 0;
    let timer = null;
    let hasConnected = false;

    const connect = () => {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        setStatus('disconnected');
        return;
      }

      setStatus(attempt === 0 && !hasConnected ? 'connecting' : 'reconnecting');
      const socket = new WebSocket(`${WS_BASE_URL}/ws/chat/?token=${encodeURIComponent(token)}`);
      socketRef.current = socket;

      socket.onopen = () => {
        attempt = 0;
        setStatus('open');
        onEventRef.current?.({ type: 'socket_open', reconnected: hasConnected });
        hasConnected = true;
      };

      socket.onmessage = (event) => {
        let data;
        try {
          data = JSON.parse(event.data);
        } catch {
          return;
        }
        onEventRef.current?.(data);
      };

      socket.onerror = () => {
        // The close handler below drives reconnection.
      };

      socket.onclose = () => {
        if (disposed || socketRef.current !== socket) return;
        socketRef.current = null;
        setStatus('reconnecting');
        const delay = Math.min(1000 * 2 ** attempt, MAX_RETRY_DELAY);
        attempt += 1;
        timer = setTimeout(connect, delay);
      };
    };

    const retryNow = () => {
      if (disposed || socketRef.current) return;
      clearTimeout(timer);
      attempt = 0;
      connect();
    };

    window.addEventListener('online', retryNow);
    connect();

    return () => {
      disposed = true;
      clearTimeout(timer);
      window.removeEventListener('online', retryNow);
      const socket = socketRef.current;
      socketRef.current = null;
      if (socket && socket.readyState < WebSocket.CLOSING) {
        socket.close();
      }
    };
  }, [userId]);

  /** Returns true when the payload went out over the live socket. */
  const send = useCallback((payload) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify(payload));
    return true;
  }, []);

  return { status, send };
};
