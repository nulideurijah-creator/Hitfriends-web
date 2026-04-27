import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User as SupabaseUser } from "@supabase/supabase-js";
import { getSupabaseClient, isSupabaseConfigured } from "../../lib/supabase";

export type UserProfile = {
  id: string;
  email: string;
  nickname: string;
  avatar: string;
  avatarPath: string | null;
  score: number;
  gamesPlayed: number;
  wins: number;
  bestSingleScore: number;
  createdAt: string;
};

type AuthContextType = {
  user: UserProfile | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, nickname: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateNickname: (nickname: string) => Promise<void>;
  updateAvatar: (file: File) => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function fallbackAvatar(seed: string) {
  return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(seed)}`;
}

function profileFromSupabase(user: SupabaseUser, row?: Record<string, unknown> | null): UserProfile {
  const nickname =
    String(row?.nickname ?? user.user_metadata?.nickname ?? user.email?.split("@")[0] ?? "玩家").slice(0, 18);

  return {
    id: user.id,
    email: user.email ?? "",
    nickname,
    avatar: String(row?.avatar_url ?? fallbackAvatar(nickname)),
    avatarPath: typeof row?.avatar_path === "string" ? String(row.avatar_path) : null,
    score: Number(row?.score ?? 0),
    gamesPlayed: Number(row?.games_played ?? 0),
    wins: Number(row?.wins ?? 0),
    bestSingleScore: Number(row?.best_single_score ?? 0),
    createdAt: String(row?.created_at ?? user.created_at ?? new Date().toISOString()),
  };
}

async function loadOrCreateProfile(user: SupabaseUser, nickname?: string) {
  if (!isSupabaseConfigured) return profileFromSupabase(user);

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();

  if (error) {
    return profileFromSupabase(user);
  }

  if (data) return profileFromSupabase(user, data);

  const normalizedNickname =
    nickname?.trim().slice(0, 18) || user.user_metadata?.nickname || user.email?.split("@")[0] || "玩家";

  const { data: inserted } = await supabase
    .from("profiles")
    .insert({
      id: user.id,
      email: user.email,
        nickname: normalizedNickname,
        avatar_url: fallbackAvatar(normalizedNickname),
        avatar_path: null,
        score: 0,
      games_played: 0,
      wins: 0,
      best_single_score: 0,
    })
    .select("*")
    .maybeSingle();

  return profileFromSupabase(user, inserted);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const syncSession = useCallback(async (nextSession: Session | null, nickname?: string) => {
    setSession(nextSession);
    if (!nextSession?.user) {
      setUser(null);
      return;
    }

    const profile = await loadOrCreateProfile(nextSession.user, nickname);
    setUser(profile);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      if (!isSupabaseConfigured) {
        setLoading(false);
        return;
      }

      const supabase = getSupabaseClient();
      const { data } = await supabase.auth.getSession();
      if (!cancelled) {
        await syncSession(data.session);
        setLoading(false);
      }
    }

    boot();

    if (!isSupabaseConfigured) {
      return () => {
        cancelled = true;
      };
    }

    const supabase = getSupabaseClient();
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      syncSession(nextSession).catch(() => undefined);
    });

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, [syncSession]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      await syncSession(data.session);
    },
    [syncSession],
  );

  const signUp = useCallback(
    async (email: string, password: string, nickname: string) => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { nickname },
        },
      });
      if (error) throw error;
      if (data.session) {
        await syncSession(data.session, nickname);
      }
    },
    [syncSession],
  );

  const signOut = useCallback(async () => {
    if (isSupabaseConfigured) {
      await getSupabaseClient().auth.signOut();
    }
    setSession(null);
    setUser(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!session?.user) return;
    setUser(await loadOrCreateProfile(session.user));
  }, [session]);

  const updateNickname = useCallback(
    async (nickname: string) => {
      if (!session?.user) return;
      const normalized = nickname.trim().slice(0, 18);
      if (!normalized) return;

      const supabase = getSupabaseClient();
      await supabase.from("profiles").upsert({
        id: session.user.id,
        email: session.user.email,
        nickname: normalized,
        avatar_url: user?.avatar ?? fallbackAvatar(normalized),
      });
      await refreshProfile();
    },
    [refreshProfile, session, user?.avatar],
  );

  const updateAvatar = useCallback(
    async (file: File) => {
      if (!session?.user) return;
      const extension = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${session.user.id}/avatar-${Date.now()}.${extension}`;
      const supabase = getSupabaseClient();
      const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, {
        cacheControl: "3600",
        upsert: true,
      });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          avatar_url: data.publicUrl,
          avatar_path: path,
        })
        .eq("id", session.user.id);
      if (profileError && profileError.code === "42703") {
        const { error: fallbackError } = await supabase
          .from("profiles")
          .update({
            avatar_url: data.publicUrl,
          })
          .eq("id", session.user.id);
        if (fallbackError) throw fallbackError;
      } else if (profileError) {
        throw profileError;
      }
      await refreshProfile();
    },
    [refreshProfile, session],
  );

  const value = useMemo(
    () => ({
      user,
      session,
      loading,
      signIn,
      signUp,
      signOut,
      updateNickname,
      updateAvatar,
      refreshProfile,
    }),
    [loading, refreshProfile, session, signIn, signOut, signUp, updateAvatar, updateNickname, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
