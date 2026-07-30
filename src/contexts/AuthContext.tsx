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
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  setup: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [setupRequired, setSetupRequired] = useState(false);

  const bootstrap = useCallback(async () => {
    setIsLoading(true);
    try {
      const statusRes = await fetch("/api/auth/status");
      const statusData = await statusRes.json();
      setSetupRequired(!!statusData.setupRequired);

      const currentToken = localStorage.getItem(TOKEN_KEY);
      if (currentToken) {
        const meRes = await fetch("/api/auth/me", {
          headers: { Authorization: `Bearer ${currentToken}` },
        });
        if (meRes.ok) {
          const meData = await meRes.json();
          setUser(meData);
          setToken(currentToken);
        } else {
          localStorage.removeItem(TOKEN_KEY);
          setToken(null);
          setUser(null);
        }
      }
    } catch (e) {
      console.error("Auth bootstrap failed", e);
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
    <AuthContext.Provider value={{ token, user, isLoading, setupRequired, login, setup, logout }}>
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
