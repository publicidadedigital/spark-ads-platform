import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    let mounted = true;

    getSupabase().then(async (sb) => {
      if (!mounted) return;
      setSupabase(sb);

      const sub = sb.auth.onAuthStateChange((_evt, s) => {
        setSession(s);
        if (s?.user) checkAdmin(sb, s.user.id).then(setIsAdmin);
        else setIsAdmin(false);
      });
      unsub = () => sub.data.subscription.unsubscribe();

      const { data } = await sb.auth.getSession();
      setSession(data.session);
      if (data.session?.user) {
        setIsAdmin(await checkAdmin(sb, data.session.user.id));
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

  async function checkAdmin(sb: SupabaseClient, userId: string) {
    const { data } = await sb
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    return !!data;
  }

  async function signOut() {
    if (supabase) await supabase.auth.signOut();
  }

  async function refresh() {
    if (!supabase) return;
    const { data } = await supabase.auth.getSession();
    setSession(data.session);
    if (data.session?.user) setIsAdmin(await checkAdmin(supabase, data.session.user.id));
  }

  return (
    <Ctx.Provider
      value={{ supabase, session, user: session?.user ?? null, loading, isAdmin, signOut, refresh }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
