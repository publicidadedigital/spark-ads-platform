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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const lastCheckedUserId = useRef<string | null>(null);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    let mounted = true;

    getSupabase().then(async (sb) => {
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

      const { data } = await sb.auth.getSession();
      if (!mounted) return;
      setSession(data.session);
      const uid = data.session?.user?.id ?? null;
      if (uid && uid !== lastCheckedUserId.current) {
        lastCheckedUserId.current = uid;
        setIsAdmin(await checkAdmin(sb, uid));
      }
      setLoading(false);
    }).catch((e) => {
      console.error("Supabase init failed", e);
      setLoading(false);
    });

    return () => {
      mounted = false;
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
