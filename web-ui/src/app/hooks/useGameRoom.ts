import { useCallback, useEffect, useMemo, useState } from "react";
import type { GameAction } from "../../lib/ruleEngine";
import { getSupabaseClient, isSupabaseConfigured } from "../../lib/supabase";
import { getLocalPlayerIdentity } from "../../lib/playerIdentity";
import type { GameRoom } from "../../lib/gameRoomService";
import { applyRoomAction, fetchRoom, joinRoom } from "../../lib/gameRoomService";

type UseGameRoomOptions = {
  spectate?: boolean;
};

export function useGameRoom(roomId: string | undefined, options: UseGameRoomOptions = {}) {
  const [room, setRoom] = useState<GameRoom | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const player = useMemo(() => getLocalPlayerIdentity(), []);

  const refresh = useCallback(async () => {
    if (!roomId || !isSupabaseConfigured) return null;
    const latest = await fetchRoom(roomId);
    setRoom(latest);
    return latest;
  }, [roomId]);

  const joinAsPlayer = useCallback(async () => {
    if (!roomId) return null;
    setBusy(true);
    setMessage(null);
    try {
      const joined = await joinRoom(roomId, player);
      setRoom(joined);
      return joined;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "加入房间失败。");
      return null;
    } finally {
      setBusy(false);
    }
  }, [player, roomId]);

  const dispatchAction = useCallback(
    async (action: GameAction) => {
      if (!roomId) return false;
      setBusy(true);
      setMessage(null);

      try {
        const result = await applyRoomAction(roomId, action);
        if (result.room) setRoom(result.room);

        if (!result.ok) {
          setMessage(result.message);
          return false;
        }

        return true;
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "操作失败。");
        await refresh();
        return false;
      } finally {
        setBusy(false);
      }
    },
    [refresh, roomId],
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!roomId) return;
      setLoading(true);
      setMessage(null);

      if (!isSupabaseConfigured) {
        setMessage("请先配置 .env.local 中的 Supabase URL 和 anon key。");
        setLoading(false);
        return;
      }

      try {
        const loaded = options.spectate ? await fetchRoom(roomId) : await joinRoom(roomId, player);
        if (!cancelled) setRoom(loaded);
      } catch (error) {
        if (!cancelled) setMessage(error instanceof Error ? error.message : "加载房间失败。");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [options.spectate, player, roomId]);

  useEffect(() => {
    if (!roomId || !isSupabaseConfigured) return undefined;

    const interval = window.setInterval(() => {
      refresh().catch((error) => {
        setMessage(error instanceof Error ? error.message : "同步房间状态失败。");
      });
    }, 1000);

    const channel = getSupabaseClient()
      .channel(`game-room-${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_rooms",
          filter: `id=eq.${roomId}`,
        },
        (payload) => {
          if (payload.new) setRoom(payload.new as GameRoom);
        },
      )
      .subscribe();

    return () => {
      window.clearInterval(interval);
      getSupabaseClient().removeChannel(channel);
    };
  }, [refresh, roomId]);

  const state = room?.state ?? null;
  const isSeated = Boolean(room?.players.some((candidate) => candidate.id === player.id));
  const isMyTurn = Boolean(state?.currentTurn === player.id && state.gameStatus === "playing");

  return {
    busy,
    dispatchAction,
    isConfigured: isSupabaseConfigured,
    isMyTurn,
    isSeated,
    joinAsPlayer,
    loading,
    message,
    player,
    refresh,
    room,
    setMessage,
    state,
  };
}
