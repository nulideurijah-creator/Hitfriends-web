import type { GameAction, GameState, PlayerInput, EngineError } from "./ruleEngine";
import { isEngineError, nextState } from "./ruleEngine";
import { getSupabaseClient } from "./supabase";
import type { LocalPlayerIdentity } from "./playerIdentity";

const TABLE = "game_rooms";
const ROOM_SELECT = "id, players, state, version, created_at, updated_at";

export type RoomPlayer = {
  id: string;
  name: string;
  joinedAt: string;
};

export type GameRoom = {
  id: string;
  players: RoomPlayer[];
  state: GameState | null;
  version: number;
  created_at: string;
  updated_at?: string;
};

export type ActionResult =
  | { ok: true; room: GameRoom }
  | { ok: false; room?: GameRoom | null; error?: EngineError; message: string; conflict?: boolean };

export function createRoomId() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export function createActionId(playerId: string, type: string) {
  return `${playerId}:${type}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
}

function toRoomPlayer(player: LocalPlayerIdentity): RoomPlayer {
  return {
    id: player.id,
    name: player.name,
    joinedAt: new Date().toISOString(),
  };
}

function playerInputs(players: RoomPlayer[]): PlayerInput[] {
  return players.map((player) => ({
    id: player.id,
    name: player.name,
  }));
}

function createStateFromPlayers(players: RoomPlayer[]): GameState | null {
  if (players.length < 2) return null;

  const result = nextState(null, {
    type: "INIT_GAME",
    players: playerInputs(players),
  });

  if (isEngineError(result)) {
    throw new Error(result.message);
  }

  return result;
}

function normalizeRoom(raw: GameRoom): GameRoom {
  return {
    ...raw,
    players: Array.isArray(raw.players) ? raw.players : [],
    state: raw.state ?? null,
  };
}

async function updateRoomWithVersion(
  roomId: string,
  oldVersion: number,
  patch: Pick<GameRoom, "players" | "state"> | Pick<GameRoom, "state">,
) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE)
    .update({
      ...patch,
      version: oldVersion + 1,
    })
    .eq("id", roomId)
    .eq("version", oldVersion)
    .select(ROOM_SELECT)
    .maybeSingle();

  if (error) throw error;
  return data ? normalizeRoom(data as GameRoom) : null;
}

export async function fetchRoom(roomId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select(ROOM_SELECT)
    .eq("id", roomId)
    .maybeSingle();

  if (error) throw error;
  return data ? normalizeRoom(data as GameRoom) : null;
}

export async function listRooms() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select(ROOM_SELECT)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) throw error;
  return (data ?? []).map((room) => normalizeRoom(room as GameRoom));
}

export async function createRoom(player: LocalPlayerIdentity, preferredRoomId = createRoomId()) {
  const supabase = getSupabaseClient();
  const room: Omit<GameRoom, "created_at" | "updated_at"> = {
    id: preferredRoomId,
    players: [toRoomPlayer(player)],
    state: null,
    version: 0,
  };

  const { data, error } = await supabase
    .from(TABLE)
    .insert(room)
    .select(ROOM_SELECT)
    .single();

  if (error) throw error;
  return normalizeRoom(data as GameRoom);
}

export async function joinRoom(roomId: string, player: LocalPlayerIdentity) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const room = await fetchRoom(roomId);

    if (!room) {
      try {
        return await createRoom(player, roomId);
      } catch (error) {
        if (attempt < 2) continue;
        throw error;
      }
    }

    const alreadySeated = room.players.some((candidate) => candidate.id === player.id);
    const gameAlreadyStarted = room.state?.gameStatus === "playing" || room.state?.gameStatus === "finished";

    if (alreadySeated) {
      if (!room.state && room.players.length >= 2) {
        const initializedState = createStateFromPlayers(room.players);
        const saved = await updateRoomWithVersion(room.id, room.version, { state: initializedState });
        if (saved) return saved;
        continue;
      }

      return room;
    }

    if (gameAlreadyStarted || room.players.length >= 4) {
      return room;
    }

    const players = [...room.players, toRoomPlayer(player)];
    const state = createStateFromPlayers(players);
    const saved = await updateRoomWithVersion(room.id, room.version, { players, state });

    if (saved) return saved;
  }

  throw new Error("房间正在被其他玩家更新，请稍后重试。");
}

export async function applyRoomAction(roomId: string, action: GameAction): Promise<ActionResult> {
  const room = await fetchRoom(roomId);
  if (!room) {
    return { ok: false, message: "房间不存在。", room: null };
  }

  if (!room.state) {
    return { ok: false, message: "至少 2 名玩家入座后才能初始化游戏。", room };
  }

  const actionPlayerId = "playerId" in action ? action.playerId ?? "system" : "system";
  const lockedAction = {
    ...action,
    expectedRevision: room.state.revision,
    actionId: action.actionId ?? createActionId(actionPlayerId, action.type),
  } as GameAction;

  const result = nextState(room.state, lockedAction);

  if (isEngineError(result)) {
    return {
      ok: false,
      room,
      error: result,
      message: result.message,
    };
  }

  const saved = await updateRoomWithVersion(room.id, room.version, { state: result });

  if (!saved) {
    return {
      ok: false,
      room: await fetchRoom(roomId),
      conflict: true,
      message: "状态已经被其他玩家更新，请根据最新牌局重试。",
    };
  }

  return { ok: true, room: saved };
}
