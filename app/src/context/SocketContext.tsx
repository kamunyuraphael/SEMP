// context/SocketContext.tsx
// Manages a single Socket.io connection for the authenticated user,
// subscribing them to their personal alert room on login and
// surfacing real-time anomaly/threshold/info alerts to the rest
// of the app via context state.

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import type { AlertEventPayload } from '../types/index';

// ─────────────────────────────────────────────────────────────
// Context Shape
// ─────────────────────────────────────────────────────────────

interface SocketContextType {
  isConnected: boolean;
  liveAlerts: AlertEventPayload[];
  clearLiveAlerts: () => void;
  dismissAlert: (index: number) => void;
}

const SocketContext = createContext<SocketContextType | null>(null);

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

// Cap how many live alerts we keep in memory — older ones are
// already persisted in MongoDB and viewable on the Notifications page.
const MAX_LIVE_ALERTS = 20;

// ─────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────

export function SocketProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const socketRef = useRef<Socket | null>(null);

  const [isConnected, setIsConnected] = useState(false);
  const [liveAlerts, setLiveAlerts] = useState<AlertEventPayload[]>([]);

  useEffect(() => {
    // Only connect once we have an authenticated user with an id
    if (!isAuthenticated || !user?._id) {
      // If the user logs out, tear down any existing connection
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
      }
      return;
    }

    const socket = io(SOCKET_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      // Join the personal alert room matching the user's MongoDB _id,
      // mirroring how the Node server emits via io.to(userId)
      socket.emit('subscribeAlerts', user._id);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('connect_error', () => {
      setIsConnected(false);
    });

    socket.on('alert', (payload: AlertEventPayload) => {
      setLiveAlerts((prev) => [payload, ...prev].slice(0, MAX_LIVE_ALERTS));
    });

    return () => {
      socket.emit('unsubscribeAlerts', user._id);
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [isAuthenticated, user?._id]);

  const clearLiveAlerts = () => setLiveAlerts([]);

  const dismissAlert = (index: number) => {
    setLiveAlerts((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <SocketContext.Provider
      value={{ isConnected, liveAlerts, clearLiveAlerts, dismissAlert }}
    >
      {children}
    </SocketContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────

export function useSocket(): SocketContextType {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used inside <SocketProvider>');
  }
  return context;
}
