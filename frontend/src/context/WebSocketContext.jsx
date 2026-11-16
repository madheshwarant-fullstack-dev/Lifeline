import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { FaBell, FaCheckCircle, FaExclamationCircle, FaTimes } from 'react-icons/fa';
import { useAuth } from './AuthContext';

const WebSocketContext = createContext(null);

const resolveWsUrl = (token) => {
  const rawApi =
    import.meta.env.VITE_API_BASE_URL ||
    import.meta.env.VITE_API_URL ||
    'http://localhost:8000/api';
  const normalized = rawApi.trim().replace(/\/+$/, '').replace(/\/api$/, '');
  const wsOrigin = normalized.replace(/^https:\/\//i, 'wss://').replace(/^http:\/\//i, 'ws://');
  return `${wsOrigin}/ws?token=${encodeURIComponent(token)}`;
};

export const WebSocketProvider = ({ children }) => {
  const { user } = useAuth();
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [liveStatusAnnouncement, setLiveStatusAnnouncement] = useState('');

  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const pingTimerRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const listenersRef = useRef(new Map());
  const toastPopoverRef = useRef(null);

  const subscribe = useCallback((eventType, handler) => {
    if (!listenersRef.current.has(eventType)) {
      listenersRef.current.set(eventType, new Set());
    }
    const set = listenersRef.current.get(eventType);
    set.add(handler);
    return () => {
      set.delete(handler);
      if (set.size === 0) {
        listenersRef.current.delete(eventType);
      }
    };
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const pushToast = useCallback((toast) => {
    // Do not interrupt user while a modal <dialog> owns the top layer
    if (typeof document !== 'undefined' && document.querySelector('dialog[open]')) {
      return;
    }
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const entry = {
      id,
      title: toast.title || 'Lifeline Alert',
      message: toast.message || '',
      tone: toast.tone || 'info',
    };
    setToasts((prev) => [entry, ...prev].slice(0, 4));
    setLiveStatusAnnouncement(`${entry.title}: ${entry.message}`);
  }, []);

  // Manage popover="manual" visibility for top-layer toasts cleanly
  useEffect(() => {
    const el = toastPopoverRef.current;
    if (!el || typeof el.showPopover !== 'function') return;
    const modalOpen = Boolean(document.querySelector('dialog[open]'));
    try {
      if (toasts.length > 0 && !modalOpen) {
        if (!el.matches(':popover-open')) {
          el.showPopover();
        }
      } else if (el.matches(':popover-open')) {
        el.hidePopover();
      }
    } catch {
      // Fallback safely if browser lacks :popover-open support
    }
  }, [toasts]);

  const dispatchEvent = useCallback(
    (payload) => {
      if (!payload || !payload.event) return;
      setLastEvent(payload);

      const specific = listenersRef.current.get(payload.event);
      if (specific) {
        specific.forEach((fn) => {
          try {
            fn(payload);
          } catch (err) {
            console.error('WebSocket listener error:', err);
          }
        });
      }
      const wildcard = listenersRef.current.get('*');
      if (wildcard) {
        wildcard.forEach((fn) => {
          try {
            fn(payload);
          } catch (err) {
            console.error('WebSocket wildcard error:', err);
          }
        });
      }

      // Trigger high-signal accessible toast on relevant real-time alerts
      if (payload.event === 'notification' && payload.data?.message) {
        pushToast({
          title: payload.data.title || 'New Notification',
          message: payload.data.message,
          tone: payload.data.type === 'EMERGENCY' ? 'danger' : 'info',
        });
      } else if (payload.event === 'donor_responded' && payload.data) {
        pushToast({
          title:
            payload.data.action === 'ACCEPTED'
              ? 'Donor Accepted Request'
              : 'Donor Response Update',
          message: `${payload.data.donorName || 'A donor'} ${
            payload.data.action === 'ACCEPTED' ? 'accepted' : 'declined'
          } your emergency request.`,
          tone: payload.data.action === 'ACCEPTED' ? 'success' : 'info',
        });
      } else if (payload.event === 'request_invitation' && payload.data) {
        pushToast({
          title: 'Emergency Blood Request',
          message: `${payload.data.hospitalName || 'A nearby hospital'} needs ${
            payload.data.bloodGroup || ''
          } blood (~${payload.data.distanceKm ?? '?'} km away).`,
          tone: 'danger',
        });
      }
    },
    [pushToast]
  );

  useEffect(() => {
    const token = localStorage.getItem('bloodconnect_token');
    if (!user || !token) {
      setConnected(false);
      if (wsRef.current) {
        wsRef.current.close(1000, 'Signed out');
        wsRef.current = null;
      }
      return undefined;
    }

    let cancelled = false;

    const cleanupTimers = () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (pingTimerRef.current) {
        clearInterval(pingTimerRef.current);
        pingTimerRef.current = null;
      }
    };

    const connect = () => {
      if (cancelled) return;
      const latestToken = localStorage.getItem('bloodconnect_token');
      if (!latestToken) return;

      try {
        const ws = new WebSocket(resolveWsUrl(latestToken));
        wsRef.current = ws;

        ws.onopen = () => {
          if (cancelled) {
            ws.close(1000, 'Unmounted');
            return;
          }
          reconnectAttemptsRef.current = 0;
          setConnected(true);
          pingTimerRef.current = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ event: 'ping', type: 'ping' }));
            }
          }, 25000);
        };

        ws.onmessage = (evt) => {
          try {
            const parsed = JSON.parse(evt.data);
            if (parsed.event === 'pong') return;
            dispatchEvent(parsed);
          } catch {
            // Ignore malformed message
          }
        };

        ws.onclose = () => {
          setConnected(false);
          cleanupTimers();
          if (cancelled) return;
          const attempt = reconnectAttemptsRef.current;
          reconnectAttemptsRef.current += 1;
          const delayMs = Math.min(15000, 1000 * Math.pow(2, attempt));
          reconnectTimerRef.current = setTimeout(connect, delayMs);
        };

        ws.onerror = () => {
          // Wait for onclose to schedule reconnect
        };
      } catch {
        setConnected(false);
      }
    };

    connect();

    return () => {
      cancelled = true;
      cleanupTimers();
      setConnected(false);
      if (wsRef.current) {
        wsRef.current.close(1000, 'Cleanup');
        wsRef.current = null;
      }
    };
  }, [user, dispatchEvent]);

  const value = useMemo(
    () => ({
      connected,
      lastEvent,
      subscribe,
      pushToast,
    }),
    [connected, lastEvent, subscribe, pushToast]
  );

  return (
    <WebSocketContext.Provider value={value}>
      {children}

      {/* Centralized accessible live status region */}
      <div className="visually-hidden" aria-live="polite" aria-atomic="true">
        {liveStatusAnnouncement}
      </div>

      {/* Persistent non-auto-dismissing toast notifications via Top-Layer Popover API */}
      <div
        ref={toastPopoverRef}
        popover="manual"
        role="region"
        aria-label="Real-time notifications"
        className="lifeline-toast-region"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`lifeline-toast-card shadow-lg border-start border-4 ${
              toast.tone === 'danger'
                ? 'border-danger'
                : toast.tone === 'success'
                ? 'border-success'
                : 'border-primary'
            }`}
          >
            <div className="d-flex align-items-start gap-2">
              <div className="pt-1 flex-shrink-0">
                {toast.tone === 'danger' ? (
                  <FaExclamationCircle className="text-danger" />
                ) : toast.tone === 'success' ? (
                  <FaCheckCircle className="text-success" />
                ) : (
                  <FaBell className="text-primary" />
                )}
              </div>
              <div className="flex-grow-1 min-w-0">
                <div className="fw-bold small text-dark">{toast.title}</div>
                <div className="small text-muted">{toast.message}</div>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-link text-muted p-0 ms-2"
                aria-label={`Dismiss ${toast.title}`}
                onClick={() => dismissToast(toast.id)}
              >
                <FaTimes size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => {
  const ctx = useContext(WebSocketContext);
  if (!ctx) {
    return {
      connected: false,
      lastEvent: null,
      subscribe: () => () => {},
      pushToast: () => {},
    };
  }
  return ctx;
};

