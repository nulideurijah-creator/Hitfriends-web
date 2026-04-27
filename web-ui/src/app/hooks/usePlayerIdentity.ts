import { useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import type { PlayerIdentity } from "../../lib/gameRoomService";

export function usePlayerIdentity() {
  const { user, loading } = useAuth();

  const player = useMemo<PlayerIdentity | null>(() => {
    if (!user) return null;
    return {
      id: user.id,
      name: user.nickname,
      createdAt: user.createdAt,
      score: user.score,
      avatarUrl: user.avatar,
    };
  }, [user]);

  return { player, loading };
}
