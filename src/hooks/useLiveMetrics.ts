import { useEffect, useRef, useState } from "react";
import { SSHConfig, SystemMetrics } from "../types";
import { getStoredToken } from "../contexts/AuthContext";
import { fetchMetrics } from "../services/api";

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 15000;

/**
 * Live metrics over a WebSocket connection instead of polling /api/ssh/metrics every 4s.
 * The backend pushes a fresh snapshot every 4s using one pooled SSH connection per server
 * (see server/services/wsMetrics.ts + sshPool.ts), so this is strictly less overhead than
 * the previous fetch-based polling while staying on the same refresh cadence.
 *
 * Falls back to a single one-off HTTP fetch immediately on mount/server-change so the UI
 * has something to show before the socket handshake completes, and auto-reconnects with
 * backoff if the connection drops (e.g. Render cold start, network blip).
 */
export function useLiveMetrics(server: SSHConfig) {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [connected, setConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | undefined>(undefined);
  const [latencyMs, setLatencyMs] = useState(14);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempt = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSentAt = useRef(0);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    reconnectAttempt.current = 0;

    // Immediate one-off fetch so the view isn't empty while the WS handshake completes.
    (async () => {
      const initial = await fetchMetrics(server);
      if (!cancelledRef.current) {
        setMetrics(initial);
        if (initial.connectionError) setConnectionError(initial.connectionError);
      }
    })();

    function connect() {
      if (cancelledRef.current) return;

      const token = getStoredToken() || "";
      const scheme = window.location.protocol === "https:" ? "wss:" : "ws:";
      const url = `${scheme}//${window.location.host}/ws/metrics/${encodeURIComponent(server.id)}?token=${encodeURIComponent(token)}`;

      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (cancelledRef.current) return;
        setConnected(true);
        reconnectAttempt.current = 0;
        lastSentAt.current = Date.now();
      };

      ws.onmessage = (event) => {
        if (cancelledRef.current) return;
        try {
          const data = JSON.parse(event.data);
          if (data.error) {
            setConnectionError(data.error);
            return;
          }
          setMetrics(data);
          setConnectionError(undefined);
          setLatencyMs(Date.now() - lastSentAt.current + 10);
          lastSentAt.current = Date.now();
        } catch {
          // ignore malformed frame
        }
      };

      const scheduleReconnect = () => {
        if (cancelledRef.current) return;
        setConnected(false);
        const delay = Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * Math.pow(2, reconnectAttempt.current));
        reconnectAttempt.current += 1;
        reconnectTimer.current = setTimeout(connect, delay);
      };

      ws.onclose = scheduleReconnect;
      ws.onerror = () => {
        try {
          ws.close();
        } catch {
          // ignore
        }
      };
    }

    connect();

    return () => {
      cancelledRef.current = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.onerror = null;
        wsRef.current.close();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [server.id]);

  return { metrics, connected, connectionError, latencyMs };
}
