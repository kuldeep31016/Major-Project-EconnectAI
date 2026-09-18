"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { fetchMe, getToken, login as apiLogin, setToken, type SessionUser } from "@/lib/api";

interface AuthState {
  user: SessionUser | null;
  /** null while the stored token is being checked */
  ready: boolean;
  signIn: (username: string, password: string) => Promise<SessionUser>;
  signOut: () => void;
  can: (capability: string) => boolean;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // resolve the stored session token (if any) into a user; always ends in `ready`
    (getToken() ? fetchMe().then((u) => { if (!cancelled) setUser(u); }).catch(() => setToken(null)) : Promise.resolve())
      .finally(() => { if (!cancelled) setReady(true); });
    return () => { cancelled = true; };
  }, []);

  const signIn = useCallback(async (username: string, password: string) => {
    const r = await apiLogin(username, password);
    setToken(r.token);
    setUser(r.user);
    return r.user;
  }, []);
  const signOut = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);
  const can = useCallback((cap: string) => !!user?.capabilities.includes(cap), [user]);

  const value = useMemo(() => ({ user, ready, signIn, signOut, can }), [user, ready, signIn, signOut, can]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used within <AuthProvider>");
  return c;
}
