import type { Card, GameAction, GameState, PlayerInput, EngineError } from "./ruleEngine";
import { isEngineError, nextState } from "./ruleEngine";
import { getSupabaseClient } from "./supabase";

const ROOMS_TABLE = "game_rooms";
const MESSAGES_TABLE = "room_messages";
const SPECTATORS_TABLE = "room_spectators";
const SETTLEMENTS_TABLE = "room_settlement_records";
const ROOM_SELECT = "id, mode, players, state, phase, phase_data, version, created_at, updated_at";

export type RoomMode = "casual" | "ladder";

export type PlayerIdentity = {
  id: string;
  name: string;
  createdAt?: string;
  score?: number;
  gamesPlayed?: number;
  wins?: number;
  avatarUrl?: string;
};

export type RoomPhase =
  | "waiting_ready"
  | "swap_vote"
  | "swap_select"
  | "bomb_vote"
  | "bomb_conflict"
  | "playing"
  | "finished";

export type RoomPlayer = {
  id: string;
  name: string;
  avatarUrl?: string;
  joinedAt: string;
  ready: boolean;
  seatIndex: number;
  isHost: boolean;
  multiplier: number;
  score: number;
  gamesPlayed: number;
  wins: number;
};

export type RoomPhaseData = {
  phaseStartedAt?: string;
  roomSessionId?: string;
  settlementIndex?: number;
  readyAtByPlayer?: Record<string, string>;
  swapVotes?: Record<string, boolean>;
  swapSelections?: Record<string, string>;
  swappedCardIds?: string[];
  swappedInCardIdsByPlayer?: Record<string, string>;
  bombVotes?: Record<string, boolean>;
  bombOrder?: string[];
  bombConflictVotes?: Record<string, boolean>;
  notice?: string;
  scoreApplied?: boolean;
  scoreHistory?: RoomScoreEntry[];
};

export type RoomScoreEntry = {
  roundNo: number;
  winnerId: string | null;
  deltas: Record<string, number>;
  totals: Record<string, number>;
  finishedAt: string;
};

export type GameRoom = {
  id: string;
  mode: RoomMode;
  players: RoomPlayer[];
  state: GameState | null;
  phase: RoomPhase;
  phaseData: RoomPhaseData;
  scoreHistory: RoomScoreEntry[];
  version: number;
  created_at: string;
  updated_at?: string;
};

type GameRoomRow = Omit<GameRoom, "phaseData" | "scoreHistory"> & {
  phase_data?: RoomPhaseData | null;
  score_history?: RoomScoreEntry[] | null;
};

export type RoomMessage = {
  id: string;
  room_id: string;
  sender_id: string | null;
  sender_name: string;
  sender_role: "player" | "spectator" | "system";
  message_type: "chat" | "system";
  content: string;
  created_at: string;
};

export type RoomSpectator = {
  room_id: string;
  user_id: string;
  name: string;
  avatar_url?: string | null;
  watching_player_id?: string | null;
  last_seen_at: string;
};

export type SettlementSnapshot = {
  roomId: string;
  mode: RoomMode;
  roomSessionId: string;
  settledAt: string;
  settledBy: string;
  winnerId: string | null;
  roomDeleted: boolean;
  remainingPlayers: number;
  players: Array<{
    id: string;
    name: string;
    avatarUrl?: string;
    score: number;
    lastDelta: number;
  }>;
  scoreHistory: RoomScoreEntry[];
};

export type SettlementResult = {
  snapshot: SettlementSnapshot;
  room: GameRoom | null;
};

export type PlayerSettlementRecord = {
  id: string;
  room_id: string;
  mode: RoomMode;
  room_session_id: string;
  participant_signature: string;
  participant_ids: string[];
  participants: SettlementSnapshot["players"];
  score_history: RoomScoreEntry[];
  winner_id: string | null;
  settled_by: string;
  settled_at: string;
  created_at: string;
};

export type ActionResult =
  | { ok: true; room: GameRoom }
  | { ok: false; room?: GameRoom | null; error?: EngineError; message: string; conflict?: boolean };

export function createRoomId() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function createRoomSessionId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createActionId(playerId: string, type: string) {
  return `${playerId}:${type}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
}

function nowIso() {
  return new Date().toISOString();
}

let lastExpiredRoomCleanupAt = 0;

async function cleanupExpiredRooms() {
  const now = Date.now();
  if (now - lastExpiredRoomCleanupAt < 60_000) return;
  lastExpiredRoomCleanupAt = now;

  try {
    await getSupabaseClient().rpc("delete_expired_rooms");
  } catch {
    // The cleanup RPC is added by schema.sql. Ignore until the database is migrated.
  }
}

function normalizePhaseData(value: unknown): RoomPhaseData {
  if (value && typeof value === "object") return value as RoomPhaseData;
  return { phaseStartedAt: nowIso() };
}

function derivePhase(row: Partial<GameRoomRow>): RoomPhase {
  if (row.phase) return row.phase;
  if (row.state?.gameStatus === "finished") return "finished";
  if (row.state?.gameStatus === "playing") return "playing";
  return "waiting_ready";
}

function normalizeRoom(raw: GameRoomRow): GameRoom {
  const players = Array.isArray(raw.players) ? raw.players : [];
  const phaseData = normalizePhaseData(raw.phase_data);
  const scoreHistory = Array.isArray(raw.score_history)
    ? raw.score_history
    : Array.isArray(phaseData.scoreHistory)
      ? phaseData.scoreHistory
      : [];
  return {
    ...raw,
    mode: raw.mode === "ladder" ? "ladder" : "casual",
    players: players.map((player, index) => normalizeRoomPlayer(player, index)),
    state: raw.state ?? null,
    phase: derivePhase(raw),
    phaseData,
    scoreHistory,
  };
}

function normalizeRoomPlayer(raw: Partial<RoomPlayer>, index: number): RoomPlayer {
  return {
    id: String(raw.id),
    name: String(raw.name ?? `玩家${index + 1}`),
    avatarUrl: typeof raw.avatarUrl === "string" ? raw.avatarUrl : undefined,
    joinedAt: String(raw.joinedAt ?? nowIso()),
    ready: Boolean(raw.ready),
    seatIndex: Number.isFinite(raw.seatIndex) ? Number(raw.seatIndex) : index,
    isHost: Boolean(raw.isHost ?? index === 0),
    multiplier: Number(raw.multiplier ?? 1),
    score: Number(raw.score ?? 0),
    gamesPlayed: Number(raw.gamesPlayed ?? 0),
    wins: Number(raw.wins ?? 0),
  };
}

function toRoomPlayer(player: PlayerIdentity, index: number, isHost = false): RoomPlayer {
  return {
    id: player.id,
    name: player.name,
    avatarUrl: player.avatarUrl,
    joinedAt: nowIso(),
    ready: false,
    seatIndex: index,
    isHost,
    multiplier: 1,
    score: 0,
    gamesPlayed: Number(player.gamesPlayed ?? 0),
    wins: Number(player.wins ?? 0),
  };
}

function withLatestPlayerIdentity(roomPlayer: RoomPlayer, player: PlayerIdentity): RoomPlayer {
  return {
    ...roomPlayer,
    name: player.name,
    avatarUrl: player.avatarUrl,
    gamesPlayed: Number(player.gamesPlayed ?? roomPlayer.gamesPlayed ?? 0),
    wins: Number(player.wins ?? roomPlayer.wins ?? 0),
  };
}

function playerInputs(players: RoomPlayer[]): PlayerInput[] {
  return players.map((player) => ({
    id: player.id,
    name: player.name,
  }));
}

function createStateFromPlayers(players: RoomPlayer[]): GameState {
  const result = nextState(null, {
    type: "INIT_GAME",
    players: playerInputs(players),
  });

  if (isEngineError(result)) {
    throw new Error(result.message);
  }

  const scoreByPlayer = new Map(players.map((player) => [player.id, player.score]));
  return {
    ...result,
    players: result.players.map((player) => ({
      ...player,
      score: Number(scoreByPlayer.get(player.id) ?? player.score ?? 0),
    })),
  };
}

function syncPlayersWithState(players: RoomPlayer[], state: GameState | null) {
  if (!state) {
    return players.map((player) => ({ ...player, multiplier: 1 }));
  }

  return players.map((player) => {
    const gamePlayer = state.players.find((candidate) => candidate.id === player.id);
    return {
      ...player,
      multiplier: Number(gamePlayer?.multiplier ?? player.multiplier ?? 1),
      score: Number(gamePlayer?.score ?? player.score ?? 0),
    };
  });
}

function toDbPatch(patch: Partial<GameRoom>) {
  const dbPatch: Record<string, unknown> = {};
  if ("mode" in patch) dbPatch.mode = patch.mode;
  if ("players" in patch) dbPatch.players = patch.players;
  if ("state" in patch) dbPatch.state = patch.state;
  if ("phase" in patch) dbPatch.phase = patch.phase;
  if ("phaseData" in patch) dbPatch.phase_data = patch.phaseData;
  if ("scoreHistory" in patch) dbPatch.score_history = patch.scoreHistory;
  return dbPatch;
}

function appendScoreHistory(room: GameRoom, state: GameState, players: RoomPlayer[]): RoomScoreEntry[] {
  const deltas = state.lastScoreDelta ?? Object.fromEntries(players.map((player) => [player.id, 0]));
  const totals = Object.fromEntries(players.map((player) => [player.id, Number(player.score ?? 0)]));
  const nextEntry: RoomScoreEntry = {
    roundNo: room.scoreHistory.length + 1,
    winnerId: state.winner,
    deltas,
    totals,
    finishedAt: nowIso(),
  };

  return [...room.scoreHistory, nextEntry];
}

function remainingCardsForScore(player: { hand: Card[]; cardsPlayed?: number }, state: GameState) {
  if ((player.cardsPlayed ?? 0) === 0) return 15;
  if (player.hand.length === state.settings.cardsPerPlayer) return 15;
  return player.hand.length;
}

function getEffectiveBombers(room: GameRoom, state: GameState) {
  const bombers = room.phaseData.bombOrder ?? [];
  if (bombers.length === 0) return [];

  const multiplierByPlayer = new Map(state.players.map((player) => [player.id, Math.max(1, player.multiplier || 1)]));
  const hasActiveBombMultiplier = bombers.some((playerId) => (multiplierByPlayer.get(playerId) ?? 1) > 1);

  return hasActiveBombMultiplier ? bombers : [];
}

function getRoundWinnerIds(room: GameRoom, state: GameState) {
  if (!state.winner) return [];

  const bombers = getEffectiveBombers(room, state);
  if (bombers.length === 0) return [state.winner];

  const bomberIds = new Set(bombers);
  if (bomberIds.has(state.winner)) return [state.winner];

  return state.players.filter((player) => !bomberIds.has(player.id)).map((player) => player.id);
}

function calculateRoomScoreDelta(room: GameRoom, state: GameState, winnerId: string): Record<string, number> {
  const delta: Record<string, number> = {};
  for (const player of state.players) delta[player.id] = 0;

  const bombers = getEffectiveBombers(room, state);
  const bomberIds = new Set(bombers);

  if (bombers.length === 0 || bomberIds.has(winnerId)) {
    for (const player of state.players) {
      if (player.id === winnerId) continue;
      const remaining = remainingCardsForScore(player, state);
      const lost = remaining * Math.max(1, player.multiplier || 1);
      delta[player.id] -= lost;
      delta[winnerId] += lost;
    }
    return delta;
  }

  const winnerIds = state.players.filter((player) => !bomberIds.has(player.id)).map((player) => player.id);
  for (const bomberId of bombers) {
    const bomber = state.players.find((player) => player.id === bomberId);
    if (!bomber) continue;

    const remaining = remainingCardsForScore(bomber, state);
    const lostPerWinner = remaining * Math.max(1, bomber.multiplier || 1);
    const totalLost = lostPerWinner * winnerIds.length;
    delta[bomber.id] -= totalLost;
    for (const winnerPlayerId of winnerIds) {
      delta[winnerPlayerId] += lostPerWinner;
    }
  }

  return delta;
}

function applyRoomScoreDelta(room: GameRoom, state: GameState) {
  if (state.gameStatus !== "finished" || !state.winner) return state;

  const delta = calculateRoomScoreDelta(room, state, state.winner);
  const previousScoreByPlayer = new Map(room.state?.players.map((player) => [player.id, Number(player.score ?? 0)]) ?? []);

  return {
    ...state,
    lastScoreDelta: delta,
    players: state.players.map((player) => ({
      ...player,
      score: Number(previousScoreByPlayer.get(player.id) ?? player.score ?? 0) + Number(delta[player.id] ?? 0),
    })),
  };
}

function getRoomSessionId(room: GameRoom) {
  return room.phaseData.roomSessionId ?? `${room.id}-${room.created_at}`;
}

function participantSignature(players: Array<{ id: string }>) {
  return players.map((player) => player.id).sort().join(":");
}

function resetPlayersForNextBatch(players: RoomPlayer[]) {
  return players.map((player, index) => ({
    ...player,
    ready: false,
    seatIndex: index,
    isHost: index === 0,
    multiplier: 1,
    score: 0,
  }));
}

function createSettlementSnapshot(room: GameRoom, settledBy: string, remainingPlayers = room.players.length): SettlementSnapshot {
  const lastDelta = room.state?.lastScoreDelta ?? {};
  return {
    roomId: room.id,
    mode: room.mode,
    roomSessionId: getRoomSessionId(room),
    settledAt: nowIso(),
    settledBy,
    winnerId: room.state?.winner ?? null,
    roomDeleted: remainingPlayers === 0,
    remainingPlayers,
    players: syncPlayersWithState(room.players, room.state).map((player) => ({
      id: player.id,
      name: player.name,
      avatarUrl: player.avatarUrl,
      score: Number(player.score ?? 0),
      lastDelta: Number(lastDelta[player.id] ?? 0),
    })),
    scoreHistory: room.scoreHistory,
  };
}

function ensureFinishedRoundScored(room: GameRoom): GameRoom {
  const state = room.state;
  if (!state || state.gameStatus !== "finished" || !state.winner) return room;

  const playerIds = state.players.map((player) => player.id);
  const lastEntry = room.scoreHistory.at(-1);
  const entryMatchesCurrentState =
    Boolean(lastEntry) &&
    lastEntry?.winnerId === state.winner &&
    playerIds.every((playerId) => {
      const gamePlayer = state.players.find((player) => player.id === playerId);
      return Number(lastEntry?.totals?.[playerId] ?? Number.NaN) === Number(gamePlayer?.score ?? Number.NaN);
    });

  if (entryMatchesCurrentState && lastEntry) {
    const stateWithDelta = state.lastScoreDelta
      ? state
      : {
          ...state,
          lastScoreDelta: lastEntry.deltas,
        };

    return {
      ...room,
      state: stateWithDelta,
      players: syncPlayersWithState(room.players, stateWithDelta),
      phaseData: {
        ...room.phaseData,
        scoreHistory: room.scoreHistory,
      },
    };
  }

  const scoredState = state.lastScoreDelta ? state : applyRoomScoreDelta(room, state);
  const players = syncPlayersWithState(room.players, scoredState);
  const scoreHistory = appendScoreHistory(room, scoredState, players);

  return {
    ...room,
    state: scoredState,
    players,
    scoreHistory,
    phaseData: {
      ...room.phaseData,
      scoreHistory,
    },
  };
}

async function persistSettlementRecord(snapshot: SettlementSnapshot) {
  const supabase = getSupabaseClient();
  const participantIds = snapshot.players.map((player) => player.id);
  const payload = {
    room_id: snapshot.roomId,
    mode: snapshot.mode,
    room_session_id: snapshot.roomSessionId,
    participant_signature: participantSignature(snapshot.players),
    participant_ids: participantIds,
    participants: snapshot.players,
    score_history: snapshot.scoreHistory,
    winner_id: snapshot.winnerId,
    settled_by: snapshot.settledBy,
    settled_at: snapshot.settledAt,
  };

  const { error } = await supabase
    .from(SETTLEMENTS_TABLE)
    .insert(payload)
    .select("id")
    .maybeSingle();

  if (!error) return { created: true };
  if (error.code === "23505") return { created: false };
  throw error;
}

async function applySettlementToProfiles(snapshot: SettlementSnapshot) {
  const supabase = getSupabaseClient();

  await Promise.all(
    snapshot.players.map(async (player) => {
      const entries = snapshot.scoreHistory.filter(
        (entry) => player.id in (entry.deltas ?? {}) || player.id in (entry.totals ?? {}),
      );
      if (entries.length === 0) return;

      const gamesDelta = entries.length;
      const winsDelta = entries.filter((entry) => Number(entry.deltas?.[player.id] ?? 0) > 0 || entry.winnerId === player.id).length;
      const bestRoundDelta = Math.max(0, ...entries.map((entry) => Number(entry.deltas?.[player.id] ?? 0)));
      const { data } = await supabase.from("profiles").select("*").eq("id", player.id).maybeSingle();
      if (!data) return;

      const patch: Record<string, unknown> = {
        games_played: Number(data.games_played ?? 0) + gamesDelta,
        wins: Number(data.wins ?? 0) + winsDelta,
        updated_at: nowIso(),
      };

      if (snapshot.mode === "ladder") {
        patch.score = Number(data.score ?? 0) + Number(player.score ?? 0);
        patch.best_single_score = Math.max(Number(data.best_single_score ?? 0), bestRoundDelta);
      }

      await supabase.from("profiles").update(patch).eq("id", player.id);
    }),
  );
}

async function updateRoomWithVersion(roomId: string, oldVersion: number, patch: Partial<GameRoom>) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(ROOMS_TABLE)
    .update({
      ...toDbPatch(patch),
      version: oldVersion + 1,
    })
    .eq("id", roomId)
    .eq("version", oldVersion)
    .select(ROOM_SELECT)
    .maybeSingle();

  if (error) throw error;
  return data ? normalizeRoom(data as GameRoomRow) : null;
}

function activePlayerIds(room: GameRoom) {
  return room.players.map((player) => player.id);
}

function allPlayersResponded(room: GameRoom, values: Record<string, unknown> | undefined, ids = activePlayerIds(room)) {
  return ids.length > 0 && ids.every((playerId) => playerId in (values ?? {}));
}

function findMinCardOwner(state: GameState, ids?: string[]) {
  const allowed = new Set(ids ?? state.players.map((player) => player.id));
  let best: { playerId: string; card: Card } | null = null;
  const rankOrder = ["4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A", "2", "3"];
  const suitOrder = ["DIAMONDS", "CLUBS", "HEARTS", "SPADES"];

  for (const player of state.players) {
    if (!allowed.has(player.id)) continue;
    for (const card of player.hand) {
      if (!best) {
        best = { playerId: player.id, card };
        continue;
      }
      const rankDiff = rankOrder.indexOf(card.rank) - rankOrder.indexOf(best.card.rank);
      const suitDiff = suitOrder.indexOf(card.suit) - suitOrder.indexOf(best.card.suit);
      if (rankDiff < 0 || (rankDiff === 0 && suitDiff < 0)) {
        best = { playerId: player.id, card };
      }
    }
  }

  return best ? { ownerId: best.playerId, cardId: best.card.id } : null;
}

function preparePlayingState(state: GameState, multipliers: Record<string, number>, turnOwnerId?: string, keepFirstRequirement = false) {
  const owner = turnOwnerId ? state.players.find((player) => player.id === turnOwnerId) : null;
  const next: GameState = {
    ...state,
    players: state.players.map((player) => ({
      ...player,
      multiplier: multipliers[player.id] ?? 1,
    })),
  };

  if (owner) {
    next.currentTurn = owner.id;
    next.roundLeaderId = owner.id;
    next.turnLock = {
      ...next.turnLock,
      currentTurn: owner.id,
    };
    if (!keepFirstRequirement) {
      next.firstPlayRequirement = {
        kind: "NONE",
        ownerId: owner.id,
        cardId: null,
      };
    }
  }

  const started = nextState(next, {
    type: "START_GAME",
    playerId: turnOwnerId,
    expectedRevision: next.revision,
    actionId: createActionId(turnOwnerId ?? "system", "START_GAME"),
  });

  if (isEngineError(started)) throw new Error(started.message);
  return started;
}

function resolveNormalFirstPlayer(state: GameState) {
  return state.firstPlayRequirement.ownerId ?? findMinCardOwner(state)?.ownerId ?? state.currentTurn ?? undefined;
}

function rotateSwapTargets(room: GameRoom, selections: Record<string, string>) {
  const orderedPlayers = [...room.players].sort((a, b) => a.seatIndex - b.seatIndex);
  const targetPlayerIdByCardId: Record<string, string> = {};
  const offset = Math.max(1, (room.version % orderedPlayers.length) || 1);

  orderedPlayers.forEach((player, index) => {
    const cardId = selections[player.id];
    const target = orderedPlayers[(index + offset) % orderedPlayers.length];
    targetPlayerIdByCardId[cardId] = target.id;
  });

  return targetPlayerIdByCardId;
}

function invertSwapTargets(targetPlayerIdByCardId: Record<string, string>) {
  const swappedInCardIdsByPlayer: Record<string, string> = {};
  for (const [cardId, targetPlayerId] of Object.entries(targetPlayerIdByCardId)) {
    swappedInCardIdsByPlayer[targetPlayerId] = cardId;
  }
  return swappedInCardIdsByPlayer;
}

export async function fetchRoom(roomId: string) {
  await cleanupExpiredRooms();
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from(ROOMS_TABLE).select(ROOM_SELECT).eq("id", roomId).maybeSingle();

  if (error) throw error;
  return data ? normalizeRoom(data as GameRoomRow) : null;
}

export async function listRooms() {
  await cleanupExpiredRooms();
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(ROOMS_TABLE)
    .select(ROOM_SELECT)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) throw error;
  return (data ?? []).map((room) => normalizeRoom(room as GameRoomRow));
}

export async function createRoom(player: PlayerIdentity, preferredRoomId = createRoomId(), mode: RoomMode = "casual") {
  await cleanupExpiredRooms();
  const supabase = getSupabaseClient();
  const room = {
    id: preferredRoomId,
    mode,
    players: [toRoomPlayer(player, 0, true)],
    state: null,
    phase: "waiting_ready" satisfies RoomPhase,
    phase_data: { phaseStartedAt: nowIso(), roomSessionId: createRoomSessionId(), settlementIndex: 0, readyAtByPlayer: {}, scoreHistory: [] },
    version: 0,
  };

  const { data, error } = await supabase.from(ROOMS_TABLE).insert(room).select(ROOM_SELECT).single();

  if (error) throw error;
  await sendSystemMessage(preferredRoomId, `${player.name} 创建了房间`);
  return normalizeRoom(data as GameRoomRow);
}

export async function joinRoom(roomId: string, player: PlayerIdentity) {
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

    if (room.players.some((candidate) => candidate.id === player.id)) {
      const players = room.players.map((candidate) => (candidate.id === player.id ? withLatestPlayerIdentity(candidate, player) : candidate));
      if (JSON.stringify(players) === JSON.stringify(room.players)) return room;
      const saved = await updateRoomWithVersion(room.id, room.version, { players });
      if (saved) return saved;
      continue;
    }
    if (room.phase !== "waiting_ready" || room.players.length >= 4) return room;

    const players = [...room.players, toRoomPlayer(player, room.players.length)];
    const saved = await updateRoomWithVersion(room.id, room.version, { players });
    if (saved) {
      await sendSystemMessage(room.id, `${player.name} 加入了房间`);
      return saved;
    }
  }

  throw new Error("房间正在被其他玩家更新，请稍后重试。");
}

export async function syncRoomPlayerIdentity(roomId: string, player: PlayerIdentity) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const room = await fetchRoom(roomId);
    if (!room) return null;

    const currentPlayer = room.players.find((candidate) => candidate.id === player.id);
    if (!currentPlayer) return room;
    if (currentPlayer.name === player.name && currentPlayer.avatarUrl === player.avatarUrl) return room;

    const players = room.players.map((candidate) => (candidate.id === player.id ? withLatestPlayerIdentity(candidate, player) : candidate));
    const saved = await updateRoomWithVersion(room.id, room.version, { players });
    if (saved) return saved;
  }

  throw new Error("同步头像失败，请稍后重试。");
}

export async function setPlayerReady(roomId: string, playerId: string, ready: boolean) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const room = await fetchRoom(roomId);
    if (!room) throw new Error("房间不存在。");
    if (room.phase !== "waiting_ready" && room.phase !== "finished") {
      throw new Error("当前阶段不能修改准备状态。");
    }

    let nextPhaseData: RoomPhaseData = {
      phaseStartedAt: nowIso(),
      roomSessionId: room.phaseData.roomSessionId ?? createRoomSessionId(),
      settlementIndex: room.phaseData.settlementIndex ?? 0,
      readyAtByPlayer: { ...(room.phaseData.readyAtByPlayer ?? {}) },
      scoreHistory: room.scoreHistory,
    };

    const basePlayers =
      room.phase === "finished" ? syncPlayersWithState(room.players, room.state).map((player) => ({ ...player, ready: false })) : room.players;
    const players = basePlayers.map((player) =>
      player.id === playerId
        ? {
            ...player,
            ready,
          }
        : player,
    );

    if (ready) nextPhaseData.readyAtByPlayer = { ...nextPhaseData.readyAtByPlayer, [playerId]: nowIso() };
    else delete nextPhaseData.readyAtByPlayer?.[playerId];

    const allReady = players.length >= 2 && players.every((player) => player.ready);
    nextPhaseData.notice = allReady ? "所有玩家已准备，等待房主开始游戏。" : "等待玩家准备。";

    const saved = await updateRoomWithVersion(room.id, room.version, {
      players,
      state: room.phase === "finished" ? null : room.state,
      phase: "waiting_ready",
      phaseData: nextPhaseData,
    });
    if (saved) return saved;
  }

  throw new Error("准备状态冲突，请重试。");
}

export async function startRoomGame(roomId: string, hostPlayerId: string) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const room = await fetchRoom(roomId);
    if (!room) throw new Error("房间不存在。");
    if (room.phase !== "waiting_ready") throw new Error("当前阶段不能开始游戏。");

    const actor = room.players.find((player) => player.id === hostPlayerId);
    if (!actor?.isHost) throw new Error("只有房主可以开始游戏。");
    if (room.players.length < 2 || room.players.length > 4) throw new Error("需要 2-4 名玩家才能开始游戏。");
    if (!room.players.every((player) => player.ready)) throw new Error("所有玩家准备后，房主才可以开始游戏。");

    const state = createStateFromPlayers(room.players);
    const phaseData: RoomPhaseData = {
      phaseStartedAt: nowIso(),
      roomSessionId: room.phaseData.roomSessionId ?? createRoomSessionId(),
      settlementIndex: room.phaseData.settlementIndex ?? 0,
      swapVotes: {},
      scoreHistory: room.scoreHistory,
      notice: "房主已开始游戏，进入换牌投票。",
    };

    const saved = await updateRoomWithVersion(room.id, room.version, {
      players: syncPlayersWithState(room.players, state),
      state,
      phase: "swap_vote",
      phaseData,
    });
    if (saved) {
      await sendSystemMessage(room.id, "房主已开始游戏，系统发牌。");
      return saved;
    }
  }

  throw new Error("开始游戏冲突，请重试。");
}

export async function submitSwapVote(roomId: string, playerId: string, wantsSwap: boolean) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const room = await fetchRoom(roomId);
    if (!room?.state) throw new Error("房间尚未发牌。");
    if (room.phase !== "swap_vote") throw new Error("当前不是换牌投票阶段。");

    const swapVotes = { ...(room.phaseData.swapVotes ?? {}), [playerId]: wantsSwap };
    const activeIds = activePlayerIds(room);
    const declinedPlayerId = activeIds.find((id) => swapVotes[id] === false);
    let phase: RoomPhase = "swap_vote";
    let phaseData: RoomPhaseData = { ...room.phaseData, swapVotes };

    if (declinedPlayerId) {
      const declinedPlayerName = room.players.find((player) => player.id === declinedPlayerId)?.name ?? "有玩家";
      phase = "bomb_vote";
      phaseData = {
        phaseStartedAt: nowIso(),
        roomSessionId: room.phaseData.roomSessionId ?? createRoomSessionId(),
        settlementIndex: room.phaseData.settlementIndex ?? 0,
        swapVotes,
        bombVotes: {},
        scoreHistory: room.scoreHistory,
        notice: `${declinedPlayerName} 选择不换牌，跳过换牌，进入拍炸投票。`,
      };
    } else if (allPlayersResponded(room, swapVotes, activeIds)) {
      phase = "swap_select";
      phaseData = {
        phaseStartedAt: nowIso(),
        roomSessionId: room.phaseData.roomSessionId ?? createRoomSessionId(),
        settlementIndex: room.phaseData.settlementIndex ?? 0,
        swapVotes,
        swapSelections: {},
        scoreHistory: room.scoreHistory,
        notice: "全员同意换牌，请每人选择 1 张牌。",
      };
    }

    const saved = await updateRoomWithVersion(room.id, room.version, { phase, phaseData });
    if (saved) {
      if (phase === "bomb_vote" && declinedPlayerId) {
        await sendSystemMessage(room.id, phaseData.notice ?? "有玩家选择不换牌，进入拍炸投票。");
      }
      return saved;
    }
  }

  throw new Error("换牌投票冲突，请重试。");
}

export async function submitSwapSelection(roomId: string, playerId: string, cardId: string) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const room = await fetchRoom(roomId);
    if (!room?.state) throw new Error("房间尚未发牌。");
    if (room.phase !== "swap_select") throw new Error("当前不是换牌选择阶段。");

    const player = room.state.players.find((candidate) => candidate.id === playerId);
    if (!player?.hand.some((card) => card.id === cardId)) {
      throw new Error("只能选择自己手里的 1 张牌换牌。");
    }

    const swapSelections = { ...(room.phaseData.swapSelections ?? {}), [playerId]: cardId };
    let state = room.state;
    let phase: RoomPhase = "swap_select";
    let phaseData: RoomPhaseData = { ...room.phaseData, swapSelections };

    if (allPlayersResponded(room, swapSelections)) {
      const targetPlayerIdByCardId = rotateSwapTargets(room, swapSelections);
      const result = nextState(room.state, {
        type: "SWAP_CARDS",
        playerId,
        selectedCardIdsByPlayer: swapSelections,
        targetPlayerIdByCardId,
        expectedRevision: room.state.revision,
        actionId: createActionId(playerId, "SWAP_CARDS"),
      });

      if (isEngineError(result)) throw new Error(result.message);
      state = result;
      phase = "bomb_vote";
      phaseData = {
        phaseStartedAt: nowIso(),
        roomSessionId: room.phaseData.roomSessionId ?? createRoomSessionId(),
        settlementIndex: room.phaseData.settlementIndex ?? 0,
        swapVotes: room.phaseData.swapVotes,
        swapSelections,
        swappedCardIds: Object.values(swapSelections),
        swappedInCardIdsByPlayer: invertSwapTargets(targetPlayerIdByCardId),
        bombVotes: {},
        scoreHistory: room.scoreHistory,
        notice: "换牌完成，出牌权已按最小手牌重新判定。",
      };
    }

    const saved = await updateRoomWithVersion(room.id, room.version, {
      state,
      players: syncPlayersWithState(room.players, state),
      phase,
      phaseData,
    });
    if (saved) {
      if (phase === "bomb_vote") await sendSystemMessage(room.id, "换牌完成，进入拍炸投票。");
      return saved;
    }
  }

  throw new Error("换牌选择冲突，请重试。");
}

export async function submitBombVote(roomId: string, playerId: string, wantsBomb: boolean) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const room = await fetchRoom(roomId);
    if (!room?.state) throw new Error("房间尚未发牌。");
    if (room.phase !== "bomb_vote") throw new Error("当前不是拍炸投票阶段。");

    const bombVotes = { ...(room.phaseData.bombVotes ?? {}), [playerId]: wantsBomb };
    let state = room.state;
    let phase: RoomPhase = "bomb_vote";
    let phaseData: RoomPhaseData = { ...room.phaseData, bombVotes };

    if (allPlayersResponded(room, bombVotes)) {
      const bombers = activePlayerIds(room).filter((id) => bombVotes[id]);
      const multipliers = Object.fromEntries(activePlayerIds(room).map((id) => [id, bombers.length === 0 ? 1 : 2]));

      if (bombers.length === 0) {
        state = preparePlayingState(room.state, multipliers, resolveNormalFirstPlayer(room.state), true);
        phase = "playing";
        phaseData = { ...phaseData, phaseStartedAt: nowIso(), notice: "无人拍炸，正常开局。" };
      } else if (bombers.length === 1) {
        state = preparePlayingState(room.state, multipliers, bombers[0], false);
        phase = "playing";
        phaseData = { ...phaseData, phaseStartedAt: nowIso(), bombOrder: bombers, notice: "单人拍炸，全员 2 倍。" };
      } else {
        phase = "bomb_conflict";
        phaseData = {
          phaseStartedAt: nowIso(),
          roomSessionId: room.phaseData.roomSessionId ?? createRoomSessionId(),
          settlementIndex: room.phaseData.settlementIndex ?? 0,
          bombVotes,
          bombOrder: bombers,
          bombConflictVotes: {},
          scoreHistory: room.scoreHistory,
          notice: "多人拍炸，进入抢拍阶段。",
        };
      }
    }

    const saved = await updateRoomWithVersion(room.id, room.version, {
      state,
      players: syncPlayersWithState(room.players, state),
      phase,
      phaseData,
    });
    if (saved) return saved;
  }

  throw new Error("拍炸投票冲突，请重试。");
}

export async function submitBombConflictVote(roomId: string, playerId: string, continueBomb: boolean) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const room = await fetchRoom(roomId);
    if (!room?.state) throw new Error("房间尚未发牌。");
    if (room.phase !== "bomb_conflict") throw new Error("当前不是抢拍阶段。");

    const bombers = room.phaseData.bombOrder ?? [];
    if (!bombers.includes(playerId)) throw new Error("只有已拍炸玩家可以参与抢拍。");

    const bombConflictVotes = { ...(room.phaseData.bombConflictVotes ?? {}), [playerId]: continueBomb };
    let state = room.state;
    let phase: RoomPhase = "bomb_conflict";
    let phaseData: RoomPhaseData = { ...room.phaseData, bombConflictVotes };

    if (allPlayersResponded(room, bombConflictVotes, bombers)) {
      const continuers = bombers.filter((id) => bombConflictVotes[id]);
      const allContinue = continuers.length === bombers.length;
      const allGiveUp = continuers.length === 0;
      const multipliers = Object.fromEntries(activePlayerIds(room).map((id) => [id, allGiveUp ? 1 : 2]));

      if (allContinue) {
        for (const id of continuers) multipliers[id] = 4;
      }

      const firstPlayer = allGiveUp
        ? resolveNormalFirstPlayer(room.state)
        : continuers.length === 1
          ? continuers[0]
          : findMinCardOwner(room.state, continuers)?.ownerId ?? continuers[0];

      state = preparePlayingState(room.state, multipliers, firstPlayer, allGiveUp);
      phase = "playing";
      phaseData = {
        ...phaseData,
        phaseStartedAt: nowIso(),
        notice: allGiveUp
          ? "所有拍炸玩家都放弃抢拍，视为正常对局。"
          : allContinue
            ? "所有拍炸玩家继续抢拍，抢拍者 4 倍。"
            : "有人放弃抢拍，本局所有玩家 2 倍。",
      };
    }

    const saved = await updateRoomWithVersion(room.id, room.version, {
      state,
      players: syncPlayersWithState(room.players, state),
      phase,
      phaseData,
    });
    if (saved) return saved;
  }

  throw new Error("抢拍投票冲突，请重试。");
}

export async function resetRoomForNextRound(roomId: string, playerId: string) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const room = await fetchRoom(roomId);
    if (!room) throw new Error("房间不存在。");
    const actor = room.players.find((player) => player.id === playerId);
    if (!actor) throw new Error("只有房间玩家可以开启下一局。");

    const players = syncPlayersWithState(room.players, room.state).map((player) => ({
      ...player,
      ready: player.id === playerId,
      multiplier: 1,
    }));

    const saved = await updateRoomWithVersion(room.id, room.version, {
      players,
      state: null,
      phase: "waiting_ready",
      phaseData: {
        phaseStartedAt: nowIso(),
        roomSessionId: room.phaseData.roomSessionId ?? createRoomSessionId(),
        settlementIndex: room.phaseData.settlementIndex ?? 0,
        readyAtByPlayer: { [playerId]: nowIso() },
        scoreHistory: room.scoreHistory,
        notice: "新一局等待玩家准备。",
      },
    });
    if (saved) return saved;
  }

  throw new Error("开启下一局失败，请重试。");
}

export async function applyRoomAction(roomId: string, action: GameAction): Promise<ActionResult> {
  const room = await fetchRoom(roomId);
  if (!room) {
    return { ok: false, message: "房间不存在。", room: null };
  }

  if (!room.state) {
    return { ok: false, message: "牌局还没有初始化。", room };
  }

  if (room.phase !== "playing" && action.type !== "SET_AUTO_PLAY_LAST_CARD") {
    return { ok: false, message: "当前阶段还不能出牌。", room };
  }

  const actionPlayerId = "playerId" in action ? action.playerId ?? "system" : "system";
  const lockedAction = {
    ...action,
    expectedRevision: room.state.revision,
    actionId: action.actionId ?? createActionId(actionPlayerId, action.type),
  } as GameAction;

  let result = nextState(room.state, lockedAction);

  if (isEngineError(result)) {
    return {
      ok: false,
      room,
      error: result,
      message: result.message,
    };
  }

  if (result.gameStatus === "finished") {
    result = applyRoomScoreDelta(room, result);
  }

  const phase: RoomPhase = result.gameStatus === "finished" ? "finished" : "playing";
  const roundWinnerIds = phase === "finished" ? new Set(getRoundWinnerIds(room, result)) : null;
  const syncedPlayers = syncPlayersWithState(room.players, result).map((player) =>
    roundWinnerIds
      ? {
          ...player,
          gamesPlayed: Number(player.gamesPlayed ?? 0) + 1,
          wins: Number(player.wins ?? 0) + (roundWinnerIds.has(player.id) ? 1 : 0),
        }
      : player,
  );
  const scoreHistory = phase === "finished" ? appendScoreHistory(room, result, syncedPlayers) : room.scoreHistory;
  const phaseData: RoomPhaseData =
    phase === "finished"
      ? { ...room.phaseData, phaseStartedAt: nowIso(), notice: "本局结束，积分已结算。", scoreHistory }
      : room.phaseData;

  const saved = await updateRoomWithVersion(room.id, room.version, {
    state: result,
    players: syncedPlayers,
    phase,
    phaseData,
    scoreHistory,
  });

  if (!saved) {
    return {
      ok: false,
      room: await fetchRoom(roomId),
      conflict: true,
      message: "状态已经被其他玩家更新，请根据最新牌局重试。",
    };
  }

  if (phase === "finished") {
    await sendSystemMessage(room.id, "本局结束，房间积分已结算。");
  }

  return { ok: true, room: saved };
}

export async function fetchRoomMessages(roomId: string, limit = 80) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(MESSAGES_TABLE)
    .select("*")
    .eq("room_id", roomId)
    .eq("message_type", "chat")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return [];
  }

  return (data ?? []).reverse() as RoomMessage[];
}

export async function fetchRoomSpectators(roomId: string) {
  const supabase = getSupabaseClient();
  const since = new Date(Date.now() - 60_000).toISOString();
  const { data, error } = await supabase
    .from(SPECTATORS_TABLE)
    .select("*")
    .eq("room_id", roomId)
    .gte("last_seen_at", since)
    .order("last_seen_at", { ascending: false });

  if (error) return [];
  return (data ?? []) as RoomSpectator[];
}

export async function touchRoomSpectator(roomId: string, player: PlayerIdentity, watchingPlayerId?: string | null) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from(SPECTATORS_TABLE).upsert(
    {
      room_id: roomId,
      user_id: player.id,
      name: player.name,
      avatar_url: player.avatarUrl ?? null,
      watching_player_id: watchingPlayerId ?? null,
      last_seen_at: nowIso(),
    },
    { onConflict: "room_id,user_id" },
  );
  if (error) throw error;
}

export async function setRoomSpectatorWatching(roomId: string, player: PlayerIdentity, watchingPlayerId: string | null) {
  await touchRoomSpectator(roomId, player, watchingPlayerId);
}

export async function leaveRoomSpectator(roomId: string, playerId: string) {
  const supabase = getSupabaseClient();
  await supabase
    .from(SPECTATORS_TABLE)
    .delete()
    .eq("room_id", roomId)
    .eq("user_id", playerId)
    .then(() => undefined)
    .catch(() => undefined);
}

export async function deleteRoomAsHost(roomId: string, playerId: string) {
  const room = await fetchRoom(roomId);
  if (!room) return null;

  const actor = room.players.find((player) => player.id === playerId);
  if (!actor?.isHost) throw new Error("只有房主可以解散房间。");

  const { error } = await getSupabaseClient().from(ROOMS_TABLE).delete().eq("id", roomId);
  if (error) throw error;
  return null;
}

export async function leaveRoomSeat(roomId: string, playerId: string) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const room = await fetchRoom(roomId);
    if (!room) return null;
    if (!room.players.some((player) => player.id === playerId)) return room;
    if (room.phase !== "waiting_ready") throw new Error("牌局进行中不能直接离座，本局结束后可结算离开。");

    const remainingPlayers = room.players.filter((player) => player.id !== playerId);
    if (remainingPlayers.length === 0) {
      const { error } = await getSupabaseClient().from(ROOMS_TABLE).delete().eq("id", roomId);
      if (error) throw error;
      return null;
    }

    const players = resetPlayersForNextBatch(remainingPlayers);
    const saved = await updateRoomWithVersion(room.id, room.version, {
      players,
      state: null,
      phase: "waiting_ready",
      phaseData: {
        phaseStartedAt: nowIso(),
        roomSessionId: createRoomSessionId(),
        settlementIndex: (room.phaseData.settlementIndex ?? 0) + 1,
        readyAtByPlayer: {},
        scoreHistory: [],
        notice: "有玩家离开房间，剩余玩家可重新准备。",
      },
    });
    if (saved) return saved;
  }

  throw new Error("离开房间失败，请重试。");
}

export async function settleAndLeaveRoom(roomId: string, playerId: string): Promise<SettlementResult> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const room = await fetchRoom(roomId);
    if (!room) throw new Error("房间不存在。");
    if (room.phase !== "finished") throw new Error("本轮结束后才能结算牌局。");
    const actor = room.players.find((player) => player.id === playerId);
    if (!actor) throw new Error("只有牌局玩家可以结算牌局。");

    const scoredRoom = ensureFinishedRoundScored(room);
    const syncedRoom: GameRoom = { ...scoredRoom, players: syncPlayersWithState(scoredRoom.players, scoredRoom.state) };
    const remainingPlayers = syncedRoom.players.filter((player) => player.id !== playerId);
    const snapshot = createSettlementSnapshot(syncedRoom, playerId, remainingPlayers.length);
    const settlementRecord = await persistSettlementRecord(snapshot);
    if (settlementRecord.created) {
      await applySettlementToProfiles(snapshot);
    }

    if (remainingPlayers.length === 0) {
      const { error } = await getSupabaseClient().from(ROOMS_TABLE).delete().eq("id", roomId);
      if (error) throw error;
      return { snapshot: { ...snapshot, roomDeleted: true, remainingPlayers: 0 }, room: null };
    }

    const players = resetPlayersForNextBatch(remainingPlayers);
    const saved = await updateRoomWithVersion(room.id, room.version, {
      players,
      state: null,
      phase: "waiting_ready",
      phaseData: {
        phaseStartedAt: nowIso(),
        roomSessionId: createRoomSessionId(),
        settlementIndex: (scoredRoom.phaseData.settlementIndex ?? 0) + 1,
        readyAtByPlayer: {},
        scoreHistory: [],
        notice: `${actor.name} 已结算离开，剩余玩家可准备下一局。`,
      },
      scoreHistory: [],
    });

    if (saved) {
      await sendSystemMessage(room.id, `${actor.name} 已结算并离开房间。`);
      return { snapshot, room: saved };
    }
  }

  throw new Error("结算离开失败，请重试。");
}

export async function fetchPlayerSettlementRecords(playerId: string, mode?: RoomMode, limit = 40) {
  const supabase = getSupabaseClient();
  let query = supabase
    .from(SETTLEMENTS_TABLE)
    .select("*")
    .contains("participant_ids", [playerId])
    .order("settled_at", { ascending: false });

  if (mode) query = query.eq("mode", mode);

  const { data, error } = await query.limit(limit);

  if (error) throw error;
  return (data ?? []) as PlayerSettlementRecord[];
}

export async function sendRoomMessage(roomId: string, player: PlayerIdentity, content: string, role: "player" | "spectator" = "player") {
  const normalized = content.trim().slice(0, 240);
  if (!normalized) return null;

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(MESSAGES_TABLE)
    .insert({
      room_id: roomId,
      sender_id: player.id,
      sender_name: player.name,
      sender_role: role,
      message_type: "chat",
      content: normalized,
    })
    .select("*")
    .maybeSingle();

  if (error) throw error;
  return data as RoomMessage | null;
}

export async function sendSystemMessage(roomId: string, content: string) {
  const supabase = getSupabaseClient();
  await supabase
    .from(MESSAGES_TABLE)
    .insert({
      room_id: roomId,
      sender_id: null,
      sender_name: "系统",
      sender_role: "system",
      message_type: "system",
      content: content.slice(0, 240),
    })
    .then(() => undefined)
    .catch(() => undefined);
}
