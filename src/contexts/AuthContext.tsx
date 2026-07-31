import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

const TOKEN_KEY = "panelvpn_auth_token";

interface AuthUser {
  id: string;
  email: string;
  role: "admin" | "operator" | "viewer";
}

interface AuthContextValue {
  token: string | null;
  user: AuthUser | null;
  isLoading: boolean;
  setupRequired: boolean;
  bootError: string | null;
  retryBootstrap: () => void;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  setup: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Fetches JSON with retries + backoff. Cold-starting free-tier hosts (Render, etc.) can
// intermittently fail the very first request(s) after a deploy/wake-up, so a single failed
// fetch must NOT be treated as "no setup needed" -- that silently hides the admin setup screen.
async function fetchJsonWithRetry(url: string, options: RequestInit = {}, attempts = 4, delayMs = 800): Promise<any> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, options);
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        throw new Error(`Unexpected response (HTTP ${res.status})`);
      }
      const data = await res.json();
      if (!res.ok) {
        const err: any = new Error(data.error || `HTTP ${res.status}`);
        err.status = res.status;
        err.data = data;
        throw err;
      }
      return data;
    } catch (e) {
      lastErr = e;
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
      }
    }
  }
  throw lastErr;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [setupRequired, setSetupRequired] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);

  const bootstrap = useCallback(async () => {
    setIsLoading(true);
    setBootError(null);
    try {
      const statusData = await fetchJsonWithRetry("/api/auth/status");
      setSetupRequired(!!statusData.setupRequired);

      const currentToken = localStorage.getItem(TOKEN_KEY);
      if (currentToken) {
        try {
          const meData = await fetchJsonWithRetry("/api/auth/me", {
            headers: { Authorization: `Bearer ${currentToken}` },
          });
          setUser(meData);
          setToken(currentToken);
        } catch (e: any) {
          // Only drop the session on an actual auth rejection, not a transient network blip.
          if (e?.status === 401 || e?.status === 403 || e?.status === 404) {
            localStorage.removeItem(TOKEN_KEY);
            setToken(null);
            setUser(null);
          }
        }
      }
    } catch (e: any) {
      console.error("Auth bootstrap failed", e);
      setBootError(e?.message || "Не удалось подключиться к серверу");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error || "Не удалось войти" };
      localStorage.setItem(TOKEN_KEY, data.token);
      setToken(data.token);
      setUser(data.user);
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message || "Ошибка сети" };
    }
  }, []);

  const setup = useCallback(async (email: string, password: string) => {
    try {
      const res = await fetch("/api/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error || "Не удалось создать аккаунт" };
      localStorage.setItem(TOKEN_KEY, data.token);
      setToken(data.token);
      setUser(data.user);
      setSetupRequired(false);
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message || "Ошибка сети" };
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ token, user, isLoading, setupRequired, bootError, retryBootstrap: bootstrap, login, setup, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

/** Returns the current bearer token synchronously, for use in fetch calls outside React state. */
export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
