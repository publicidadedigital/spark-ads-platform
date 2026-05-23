import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Session, User, SupabaseClient } from "@supabase/supabase-js";
import { getSupabase } from "./client";

type AuthCtx = {
  supabase: SupabaseClient | null;
  session: Session | null;
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({
  supabase: null,
  session: null,
  user: null,
  loading: true,
  isAdmin: false,
  signOut: async () => {},
  refresh: async () => {},
});

async function checkAdmin(sb: SupabaseClient, userId: string) {
  const { data } = await sb
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return !!data;
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string) {
  return new Promise<T>((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        window.clearTimeout(timeout);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

function clearStoredAuth() {
  try {
    Object.keys(window.localStorage)
      .filter((key) => key === "supabase.auth.token" || key.startsWith("sb-"))
      .forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // Browsers can block localStorage access in some privacy modes.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const lastCheckedUserId = useRef<string | null>(null);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    let mounted = true;
    const failsafe = window.setTimeout(() => {
      if (!mounted) return;
      console.warn("Supabase auth init timed out; clearing stored auth");
      clearStoredAuth();
      setSession(null);
      setIsAdmin(false);
      setLoading(false);
    }, 10000);

    withTimeout(getSupabase(), 8000, "Tempo esgotado ao carregar a configuração")
      .then(async (sb) => {
        if (!mounted) return;
        setSupabase(sb);

        const sub = sb.auth.onAuthStateChange((_evt, s) => {
          setSession(s);
          const uid = s?.user?.id ?? null;
          // Só re-checa admin quando o user id muda de fato
          if (uid && uid !== lastCheckedUserId.current) {
            lastCheckedUserId.current = uid;
            checkAdmin(sb, uid).then(setIsAdmin);
          } else if (!uid) {
            lastCheckedUserId.current = null;
            setIsAdmin(false);
          }
        });
        unsub = () => sub.data.subscription.unsubscribe();

        const { data } = await withTimeout(
          sb.auth.getSession(),
          8000,
          "Tempo esgotado ao recuperar a sessão",
        );
        if (!mounted) return;
        setSession(data.session);
        const uid = data.session?.user?.id ?? null;
        if (uid && uid !== lastCheckedUserId.current) {
          lastCheckedUserId.current = uid;
          setIsAdmin(await withTimeout(checkAdmin(sb, uid), 8000, "Tempo esgotado ao validar permissões"));
        }
        window.clearTimeout(failsafe);
        setLoading(false);
      }).catch((e) => {
        console.error("Supabase init failed", e);
        clearStoredAuth();
        window.clearTimeout(failsafe);
        setLoading(false);
      });

    return () => {
      mounted = false;
      window.clearTimeout(failsafe);
      unsub?.();
    };
  }, []);

  const value = useMemo<AuthCtx>(() => ({
    supabase,
    session,
    user: session?.user ?? null,
    loading,
    isAdmin,
    signOut: async () => { if (supabase) await supabase.auth.signOut(); },
    refresh: async () => {
      if (!supabase) return;
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      const uid = data.session?.user?.id ?? null;
      if (uid) {
        lastCheckedUserId.current = uid;
        setIsAdmin(await checkAdmin(supabase, uid));
      }
    },
  }), [supabase, session, loading, isAdmin]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
