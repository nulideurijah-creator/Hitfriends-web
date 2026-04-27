import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GameAction } from "../../lib/ruleEngine";
import { isEngineError, nextState } from "../../lib/ruleEngine";
import { getSupabaseClient, isSupabaseConfigured } from "../../lib/supabase";
import type { GameRoom, RoomMessage } from "../../lib/gameRoomService";
import {
  applyRoomAction,
  deleteRoomAsHost,
  fetchRoom,
  fetchRoomMessages,
  fetchRoomSpectators,
  joinRoom,
  leaveRoomSeat,
  leaveRoomSpectator,
  resetRoomForNextRound,
  sendRoomMessage,
  setRoomSpectatorWatching,
  setPlayerReady,
  startRoomGame,
  settleAndLeaveRoom,
  submitBombConflictVote,
  submitBombVote,
  submitSwapSelection,
  submitSwapVote,
  syncRoomPlayerIdentity,
  touchRoomSpectator,
  type RoomSpectator,
  type SettlementSnapshot,
} from "../../lib/gameRoomService";
import { usePlayerIdentity } from "./usePlayerIdentity";

type UseGameRoomOptions = {
  spectate?: boolean;
};

const roomCache = new Map<string, GameRoom | null>();
const messageCache = new Map<string, RoomMessage[]>();
const spectatorCache = new Map<string, RoomSpectator[]>();

function updateReadyOptimistically(room: GameRoom, playerId: string, ready: boolean): GameRoom {
  if (room.phase !== "waiting_ready" && room.phase !== "finished") return room;

  const players = room.players.map((roomPlayer) => (roomPlayer.id === playerId ? { ...roomPlayer, ready } : roomPlayer));
  const readyAtByPlayer = { ...(room.phaseData.readyAtByPlayer ?? {}) };
  if (ready) readyAtByPlayer[playerId] = new Date().toISOString();
  else delete readyAtByPlayer[playerId];

  const allReady = players.length >= 2 && players.every((roomPlayer) => roomPlayer.ready);
  return {
    ...room,
    players,
    state: room.phase === "finished" ? null : room.state,
    phase: "waiting_ready",
    phaseData: {
      ...room.phaseData,
      readyAtByPlayer,
      notice: allReady ? "所有玩家已准备，等待房主开始游戏。" : "等待玩家准备。",
    },
  };
}

function updateSwapVoteOptimistically(room: GameRoom, playerId: string, wantsSwap: boolean): GameRoom {
  if (room.phase !== "swap_vote") return room;

  const swapVotes = { ...(room.phaseData.swapVotes ?? {}), [playerId]: wantsSwap };
  const playerIds = room.players.map((roomPlayer) => roomPlayer.id);
  const declinedPlayerId = playerIds.find((id) => swapVotes[id] === false);
  if (declinedPlayerId) {
    const declinedName = room.players.find((roomPlayer) => roomPlayer.id === declinedPlayerId)?.name ?? "有玩家";
    return {
      ...room,
      phase: "bomb_vote",
      phaseData: {
        ...room.phaseData,
        swapVotes,
        bombVotes: {},
        notice: `${declinedName} 选择不换牌，跳过换牌，进入拍炸投票。`,
      },
    };
  }

  const allVoted = playerIds.length > 0 && playerIds.every((id) => id in swapVotes);
  return {
    ...room,
    phase: allVoted ? "swap_select" : room.phase,
    phaseData: {
      ...room.phaseData,
      swapVotes,
      ...(allVoted ? { swapSelections: {}, notice: "全员同意换牌，请每人选择 1 张牌。" } : {}),
    },
  };
}

function updatePhaseVoteOptimistically(
  room: GameRoom,
  phase: "bomb_vote" | "bomb_conflict",
  key: "bombVotes" | "bombConflictVotes",
  playerId: string,
  value: boolean,
): GameRoom {
  if (room.phase !== phase) return room;
  return {
    ...room,
    phaseData: {
      ...room.phaseData,
      [key]: { ...((room.phaseData[key] as Record<string, boolean> | undefined) ?? {}), [playerId]: value },
    },
  };
}

function updateSwapSelectionOptimistically(room: GameRoom, playerId: string, cardId: string): GameRoom {
  if (room.phase !== "swap_select") return room;
  return {
    ...room,
    phaseData: {
      ...room.phaseData,
      swapSelections: { ...(room.phaseData.swapSelections ?? {}), [playerId]: cardId },
    },
  };
}

function updateActionOptimistically(room: GameRoom, action: GameAction): GameRoom {
  if (!room.state) return room;
  const result = nextState(room.state, action);
  if (isEngineError(result)) return room;
  return {
    ...room,
    state: result,
    phase: result.gameStatus === "finished" ? "finished" : room.phase,
  };
}

export function useGameRoom(roomId: string | undefined, options: UseGameRoomOptions = {}) {
  const [room, setRoomState] = useState<GameRoom | null>(() => (roomId ? roomCache.get(roomId) ?? null : null));
  const [messages, setMessagesState] = useState<RoomMessage[]>(() => (roomId ? messageCache.get(roomId) ?? [] : []));
  const [spectators, setSpectatorsState] = useState<RoomSpectator[]>(() => (roomId ? spectatorCache.get(roomId) ?? [] : []));
  const [watchingPlayerId, setWatchingPlayerIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(() => !roomId || !roomCache.has(roomId));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const { player, loading: playerLoading } = usePlayerIdentity();
  const playerId = player?.id ?? null;
  const optimisticBaseVersionRef = useRef<number | null>(null);

  const setRoom = useCallback(
    (nextRoom: GameRoom | null) => {
      if (roomId) roomCache.set(roomId, nextRoom);
      setRoomState(nextRoom);
    },
    [roomId],
  );

  const setMessages = useCallback(
    (nextMessages: RoomMessage[]) => {
      if (roomId) messageCache.set(roomId, nextMessages);
      setMessagesState(nextMessages);
    },
    [roomId],
  );

  const setSpectators = useCallback(
    (nextSpectators: RoomSpectator[]) => {
      if (roomId) spectatorCache.set(roomId, nextSpectators);
      setSpectatorsState(nextSpectators);
    },
    [roomId],
  );

  const setRemoteRoom = useCallback(
    (nextRoom: GameRoom | null) => {
      const optimisticBaseVersion = optimisticBaseVersionRef.current;
      if (nextRoom && optimisticBaseVersion !== null && nextRoom.version <= optimisticBaseVersion) {
        return;
      }
      optimisticBaseVersionRef.current = null;
      setRoom(nextRoom);
    },
    [setRoom],
  );

  const refreshMessages = useCallback(async () => {
    if (!roomId || !isSupabaseConfigured) return [];
    const nextMessages = await fetchRoomMessages(roomId);
    setMessages(nextMessages);
    return nextMessages;
  }, [roomId]);

  const refreshSpectators = useCallback(async () => {
    if (!roomId || !isSupabaseConfigured) return [];
    const nextSpectators = await fetchRoomSpectators(roomId);
    setSpectators(nextSpectators);
    return nextSpectators;
  }, [roomId, setSpectators]);

  const refresh = useCallback(async () => {
    if (!roomId || !isSupabaseConfigured) return null;
    const latest = await fetchRoom(roomId);
    setRemoteRoom(latest);
    return latest;
  }, [roomId, setRemoteRoom]);

  const runRoomMutation = useCallback(
    async (mutation: () => Promise<GameRoom | null>, successMessage?: string, optimisticUpdate?: (room: GameRoom) => GameRoom) => {
      const previousRoom = roomId ? roomCache.get(roomId) ?? room : room;
      if (optimisticUpdate && previousRoom) {
        optimisticBaseVersionRef.current = previousRoom.version;
        setRoom(optimisticUpdate(previousRoom));
      }
      setBusy(true);
      setMessage(null);
      try {
        const updated = await mutation();
        optimisticBaseVersionRef.current = null;
        if (updated) setRoom(updated);
        if (successMessage) setMessage(successMessage);
        await refreshMessages();
        return updated;
      } catch (error) {
        optimisticBaseVersionRef.current = null;
        if (previousRoom) setRoom(previousRoom);
        setMessage(error instanceof Error ? error.message : "操作失败。");
        await refresh();
        return null;
      } finally {
        setBusy(false);
      }
    },
    [refresh, refreshMessages, room, roomId, setRoom],
  );

  const setWatchingPlayerId = useCallback(
    async (nextWatchingPlayerId: string | null) => {
      setWatchingPlayerIdState(nextWatchingPlayerId);
      if (!roomId || !player || !options.spectate) return;
      try {
        await setRoomSpectatorWatching(roomId, player, nextWatchingPlayerId);
        await refreshSpectators();
      } catch {
        // Spectator presence is non-critical; keep the local selection responsive.
      }
    },
    [options.spectate, player, refreshSpectators, roomId],
  );

  const joinAsPlayer = useCallback(async () => {
    if (!roomId) return null;
    if (!player) {
      setMessage("请先登录后再入座。");
      return null;
    }
    const updated = await runRoomMutation(() => joinRoom(roomId, player));
    if (updated && options.spectate) {
      await leaveRoomSpectator(roomId, player.id);
      await refreshSpectators();
    }
    return updated;
  }, [options.spectate, player, refreshSpectators, roomId, runRoomMutation]);

  const toggleReady = useCallback(
    async (ready: boolean) => {
      if (!roomId || !player) {
        setMessage("请先登录后再准备。");
        return null;
      }
      if (options.spectate) {
        setMessage("观战中不能操作牌局。");
        return null;
      }
      return runRoomMutation(() => setPlayerReady(roomId, player.id, ready), undefined, (room) => updateReadyOptimistically(room, player.id, ready));
    },
    [options.spectate, player, roomId, runRoomMutation],
  );

  const voteSwap = useCallback(
    async (wantsSwap: boolean) => {
      if (!roomId || !player) return null;
      if (options.spectate) return null;
      return runRoomMutation(() => submitSwapVote(roomId, player.id, wantsSwap), undefined, (room) => updateSwapVoteOptimistically(room, player.id, wantsSwap));
    },
    [options.spectate, player, roomId, runRoomMutation],
  );

  const selectSwapCard = useCallback(
    async (cardId: string) => {
      if (!roomId || !player) return null;
      if (options.spectate) return null;
      return runRoomMutation(() => submitSwapSelection(roomId, player.id, cardId), undefined, (room) => updateSwapSelectionOptimistically(room, player.id, cardId));
    },
    [options.spectate, player, roomId, runRoomMutation],
  );

  const voteBomb = useCallback(
    async (wantsBomb: boolean) => {
      if (!roomId || !player) return null;
      if (options.spectate) return null;
      return runRoomMutation(() => submitBombVote(roomId, player.id, wantsBomb), undefined, (room) =>
        updatePhaseVoteOptimistically(room, "bomb_vote", "bombVotes", player.id, wantsBomb),
      );
    },
    [options.spectate, player, roomId, runRoomMutation],
  );

  const voteBombConflict = useCallback(
    async (continueBomb: boolean) => {
      if (!roomId || !player) return null;
      if (options.spectate) return null;
      return runRoomMutation(() => submitBombConflictVote(roomId, player.id, continueBomb), undefined, (room) =>
        updatePhaseVoteOptimistically(room, "bomb_conflict", "bombConflictVotes", player.id, continueBomb),
      );
    },
    [options.spectate, player, roomId, runRoomMutation],
  );

  const nextRound = useCallback(async () => {
    if (!roomId || !player) return null;
    if (options.spectate) return null;
    return runRoomMutation(() => resetRoomForNextRound(roomId, player.id));
  }, [options.spectate, player, roomId, runRoomMutation]);

  const startGame = useCallback(async () => {
    if (!roomId || !player) return null;
    if (options.spectate) return null;
    return runRoomMutation(() => startRoomGame(roomId, player.id));
  }, [options.spectate, player, roomId, runRoomMutation]);

  const leaveSeat = useCallback(async () => {
    if (!roomId || !player) return null;
    if (options.spectate) {
      await leaveRoomSpectator(roomId, player.id);
      return null;
    }

    setBusy(true);
    setMessage(null);
    try {
      const updated = await leaveRoomSeat(roomId, player.id);
      setRoom(updated);
      await refreshMessages();
      await refreshSpectators();
      return updated;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "离开房间失败。");
      await refresh();
      return room;
    } finally {
      setBusy(false);
    }
  }, [options.spectate, player, refresh, refreshMessages, refreshSpectators, room, roomId, setRoom]);

  const settleRoom = useCallback(async (): Promise<SettlementSnapshot | null> => {
    if (!roomId || !player) return null;
    if (options.spectate) {
      setMessage("观战中不能结算牌局。");
      return null;
    }

    setBusy(true);
    setMessage(null);
    try {
      const result = await settleAndLeaveRoom(roomId, player.id);
      setRoom(result.room);
      if (!result.room) {
        messageCache.set(roomId, []);
        spectatorCache.set(roomId, []);
        setMessagesState([]);
        setSpectatorsState([]);
      } else {
        await refreshMessages();
        await refreshSpectators();
      }
      return result.snapshot;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "结算牌局失败。");
      await refresh();
      return null;
    } finally {
      setBusy(false);
    }
  }, [options.spectate, player, refresh, refreshMessages, refreshSpectators, roomId, setRoom]);

  const dismissRoom = useCallback(async () => {
    if (!roomId || !player) return false;
    if (options.spectate) {
      setMessage("观战中不能解散房间。");
      return false;
    }

    setBusy(true);
    setMessage(null);
    try {
      await deleteRoomAsHost(roomId, player.id);
      setRoom(null);
      messageCache.set(roomId, []);
      spectatorCache.set(roomId, []);
      setMessagesState([]);
      setSpectatorsState([]);
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "解散房间失败。");
      await refresh();
      return false;
    } finally {
      setBusy(false);
    }
  }, [options.spectate, player, refresh, roomId, setRoom]);

  const dispatchAction = useCallback(
    async (action: GameAction) => {
      if (!roomId) return false;
      if (options.spectate) {
        setMessage("观战中不能操作牌局。");
        return false;
      }
      setBusy(true);
      setMessage(null);

      try {
        const currentRoom = roomId ? roomCache.get(roomId) ?? room : room;
        if (currentRoom) {
          optimisticBaseVersionRef.current = currentRoom.version;
          setRoom(updateActionOptimistically(currentRoom, action));
        }
        const result = await applyRoomAction(roomId, action);
        optimisticBaseVersionRef.current = null;
        if (result.room) setRoom(result.room);

        if (!result.ok) {
          setMessage(result.message);
          return false;
        }

        await refreshMessages();
        return true;
      } catch (error) {
        optimisticBaseVersionRef.current = null;
        setMessage(error instanceof Error ? error.message : "操作失败。");
        await refresh();
        return false;
      } finally {
        setBusy(false);
      }
    },
    [options.spectate, refresh, refreshMessages, room, roomId, setRoom],
  );

  const sendChat = useCallback(
    async (content: string) => {
      if (!roomId || !player) {
        setMessage("请先登录后再发言。");
        return false;
      }

      try {
        const role = room?.players.some((candidate) => candidate.id === player.id) ? "player" : "spectator";
        await sendRoomMessage(roomId, player, content, role);
        await refreshMessages();
        return true;
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "发送消息失败。");
        return false;
      }
    },
    [player, refreshMessages, room?.players, roomId],
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!roomId || playerLoading) return;
      const cachedRoom = roomCache.get(roomId);
      const cachedMessages = messageCache.get(roomId);
      const cachedSpectators = spectatorCache.get(roomId);
      if (cachedRoom !== undefined) setRoomState(cachedRoom);
      if (cachedMessages) setMessagesState(cachedMessages);
      if (cachedSpectators) setSpectatorsState(cachedSpectators);
      setLoading(cachedRoom === undefined);
      setMessage(null);

      if (!isSupabaseConfigured) {
        setMessage("请先配置 .env.local 中的 Supabase URL 和 anon key。");
        setLoading(false);
        return;
      }

      try {
        const loaded = await fetchRoom(roomId);
        const loadedMessages = await fetchRoomMessages(roomId);
        if (options.spectate && player) {
          await touchRoomSpectator(roomId, player, null).catch(() => undefined);
        }
        const loadedSpectators = await fetchRoomSpectators(roomId);
        if (!cancelled) {
          setRoom(loaded);
          setMessages(loadedMessages);
          setSpectators(loadedSpectators);
        }
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
  }, [options.spectate, playerId, playerLoading, roomId, setMessages, setRoom, setSpectators]);

  useEffect(() => {
    if (!roomId || !isSupabaseConfigured) return undefined;

    const interval = window.setInterval(() => {
      refresh().catch((error) => {
        setMessage(error instanceof Error ? error.message : "同步房间状态失败。");
      });
      refreshMessages().catch(() => undefined);
      refreshSpectators().catch(() => undefined);
    }, 1000);

    const supabase = getSupabaseClient();
    const roomChannel = supabase
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
          if (payload.new) {
            const raw = payload.new as GameRoom & { phase_data?: GameRoom["phaseData"] };
            setRemoteRoom({
              ...raw,
              mode: raw.mode === "ladder" ? "ladder" : "casual",
              phaseData: raw.phaseData ?? raw.phase_data ?? {},
              scoreHistory: raw.scoreHistory ?? raw.phaseData?.scoreHistory ?? raw.phase_data?.scoreHistory ?? [],
            });
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_messages",
          filter: `room_id=eq.${roomId}`,
        },
        () => {
          refreshMessages().catch(() => undefined);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_spectators",
          filter: `room_id=eq.${roomId}`,
        },
        () => {
          refreshSpectators().catch(() => undefined);
        },
      )
      .subscribe();

    return () => {
      window.clearInterval(interval);
      supabase.removeChannel(roomChannel);
    };
  }, [refresh, refreshMessages, refreshSpectators, roomId, setRemoteRoom]);

  useEffect(() => {
    if (!options.spectate || !roomId || !player || !isSupabaseConfigured) return undefined;

    touchRoomSpectator(roomId, player, null).catch(() => undefined);
    const interval = window.setInterval(() => {
      touchRoomSpectator(roomId, player, null).catch(() => undefined);
    }, 5000);

    return () => {
      window.clearInterval(interval);
      leaveRoomSpectator(roomId, player.id);
    };
  }, [options.spectate, player, roomId]);

  const state = room?.state ?? null;
  const isSeated = Boolean(player && room?.players.some((candidate) => candidate.id === player.id));
  const isMyTurn = Boolean(player && room?.phase === "playing" && state?.currentTurn === player.id && state.gameStatus === "playing");
  const myRoomPlayer = useMemo(
    () => (player ? room?.players.find((candidate) => candidate.id === player.id) ?? null : null),
    [player, room?.players],
  );

  useEffect(() => {
    if (!roomId || !player || !myRoomPlayer || options.spectate || !isSupabaseConfigured) return undefined;
    if (myRoomPlayer.name === player.name && myRoomPlayer.avatarUrl === player.avatarUrl) return undefined;

    let cancelled = false;
    syncRoomPlayerIdentity(roomId, player)
      .then((updated) => {
        if (!cancelled && updated) setRoom(updated);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [myRoomPlayer?.avatarUrl, myRoomPlayer?.name, options.spectate, player, roomId, setRoom]);

  return {
    busy,
    dismissRoom,
    dispatchAction,
    isConfigured: isSupabaseConfigured,
    isMyTurn,
    isSeated,
    joinAsPlayer,
    leaveSeat,
    loading: loading || playerLoading,
    message,
    messages,
    myRoomPlayer,
    nextRound,
    player,
    refresh,
    room,
    selectSwapCard,
    sendChat,
    setMessage,
    setWatchingPlayerId,
    settleRoom,
    spectators,
    state,
    startGame,
    toggleReady,
    voteBomb,
    voteBombConflict,
    voteSwap,
    watchingPlayerId,
  };
}
