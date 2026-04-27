import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import {
  AlertTriangle,
  Bot,
  Camera,
  Check,
  ChevronLeft,
  Crown,
  Eye,
  Loader2,
  Lock,
  MessageCircle,
  Send,
  ShieldAlert,
  Smile,
  Sparkles,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import type { Card, GameAction, GameState as EngineGameState, Move } from "../../lib/ruleEngine";
import { classifyCards, isValidMove } from "../../lib/ruleEngine";
import type { GameRoom, RoomMessage, RoomPhase, RoomPlayer, RoomSpectator, SettlementSnapshot } from "../../lib/gameRoomService";
import { formatCard, isRedCard, suitLabels } from "../../lib/cardText";
import { cn } from "../../lib/utils";
import { useGameRoom } from "../hooks/useGameRoom";

const phaseLabels: Record<RoomPhase, string> = {
  waiting_ready: "等待准备",
  swap_vote: "换牌投票",
  swap_select: "换牌选择",
  bomb_vote: "拍炸投票",
  bomb_conflict: "二次抢拍",
  playing: "出牌中",
  finished: "结算",
};

const errorText: Record<string, string> = {
  INVALID_COMBO: "选择的牌不成牌型。",
  INVALID_MOVE: "这手牌压不过上一手，或不符合当前跟牌规则。",
  FIRST_HAND_REQUIREMENT: "首手必须包含指定最小牌。",
  NOT_PLAYER_TURN: "还没有轮到你出牌。",
  CANNOT_PASS: "没有上一手牌时不能 PASS。",
  TURN_LOCK_CONFLICT: "牌局状态已经变化，请按最新状态重试。",
  MISSING_TURN_LOCK: "回合锁缺失，请刷新后重试。",
};

type SeatPosition = "bottom" | "left" | "top" | "right";

type SeatView = {
  id: string;
  name: string;
  avatarUrl?: string;
  handCount: number;
  winRate: string;
  batchScore: number;
  lastDelta: number | null;
  multiplier: number;
  ready: boolean;
  isHost: boolean;
  isMe: boolean;
  isTurn: boolean;
  isBomber: boolean;
  isWatched: boolean;
  status: string;
  position: SeatPosition;
};

type ViewMode = "undecided" | "player" | "spectator";

const emojiOptions = ["😀", "😂", "👍", "👏", "🔥", "💣", "🎉", "😎", "😭", "🤝", "❤️", "😅", "👀", "✨", "🍻", "💯"];

export function Room() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const roomId = id?.toUpperCase();
  const [viewMode, setViewMode] = useState<ViewMode>(() => (searchParams.get("spectate") === "true" ? "spectator" : "undecided"));
  const isSpectatorMode = viewMode === "spectator";
  const {
    busy,
    dismissRoom,
    dispatchAction,
    isConfigured,
    isMyTurn,
    isSeated,
    joinAsPlayer,
    leaveSeat,
    loading,
    message,
    messages,
    myRoomPlayer,
    nextRound,
    player,
    room,
    selectSwapCard,
    sendChat,
    settleRoom,
    spectators,
    state,
    startGame,
    toggleReady,
    voteBomb,
    voteBombConflict,
    voteSwap,
  } = useGameRoom(roomId, { spectate: isSpectatorMode });

  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [swapChoice, setSwapChoice] = useState<boolean | null>(null);
  const [bombChoice, setBombChoice] = useState<boolean | null>(null);
  const [conflictChoice, setConflictChoice] = useState<boolean | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [showSettleConfirm, setShowSettleConfirm] = useState(false);
  const [settlementSnapshot, setSettlementSnapshot] = useState<SettlementSnapshot | null>(null);

  const phase = room?.phase ?? "waiting_ready";
  const myGamePlayer = player ? state?.players.find((candidate) => candidate.id === player.id) ?? null : null;
  const myHandIds = useMemo(() => new Set(myGamePlayer?.hand.map((card) => card.id) ?? []), [myGamePlayer]);
  const selectedCards = myGamePlayer?.hand.filter((card) => selectedCardIds.includes(card.id)) ?? [];
  const autoEnabled = Boolean(player && state?.autoPlay.enabledPlayerIds.includes(player.id));
  const canSeeHand = Boolean(isSeated && myGamePlayer && phase !== "waiting_ready" && phase !== "finished");
  const visibleHand = myGamePlayer?.hand ?? [];
  const swappedInCardId = player ? room?.phaseData.swappedInCardIdsByPlayer?.[player.id] : undefined;
  const mySwapVote = player ? room?.phaseData.swapVotes?.[player.id] : undefined;
  const mySwapSelection = player ? room?.phaseData.swapSelections?.[player.id] : undefined;
  const myBombVote = player ? room?.phaseData.bombVotes?.[player.id] : undefined;
  const bombers = room?.phaseData.bombOrder ?? [];
  const myConflictVote = player ? room?.phaseData.bombConflictVotes?.[player.id] : undefined;
  const isBomber = Boolean(player && bombers.includes(player.id));

  const hasPlayable = useMemo(() => {
    if (isSpectatorMode || !state || !player || phase !== "playing" || state.currentTurn !== player.id) return true;
    if (!state.lastMove) return true;
    return playerHasPlayableMove(state, player.id);
  }, [isSpectatorMode, phase, player?.id, state]);

  const playerName = (playerId: string) =>
    room?.players.find((candidate) => candidate.id === playerId)?.name ??
    state?.players.find((candidate) => candidate.id === playerId)?.name ??
    playerId.slice(0, 8);
  const canTakeSeat = Boolean(roomId && !loading && (!room || (room.phase === "waiting_ready" && room.players.length < 4)));
  const canChooseSeatMode = Boolean(!isSeated && viewMode === "undecided" && canTakeSeat);

  const seats = useMemo(() => buildSeats(room, state, player?.id, phase, null), [phase, player?.id, room, state]);
  const latestMoveByPlayer = useMemo(() => {
    const moves: Record<string, Move> = {};
    if (!state) return moves;
    for (const move of state.discardPile) {
      if (move.round === state.round) moves[move.playerId] = move;
    }
    return moves;
  }, [state]);

  const tableNotice = createTableNotice({
    bombers,
    bombChoice,
    error: localError || translateEngineMessage(message),
    hasPlayable,
    phase,
    playerId: player?.id ?? null,
    playerName,
    room,
    state,
    swapChoice,
  });

  useEffect(() => {
    if (loading || !room) return;
    if (isSeated) {
      if (viewMode !== "player") setViewMode("player");
      return;
    }
    if (viewMode === "player") {
      setViewMode(canTakeSeat ? "undecided" : "spectator");
      return;
    }
    if (viewMode === "undecided" && !canTakeSeat) {
      setViewMode("spectator");
    }
  }, [canTakeSeat, isSeated, loading, room, viewMode]);

  useEffect(() => {
    if (isSpectatorMode) {
      setSelectedCardIds([]);
      return;
    }
    setSelectedCardIds((ids) => ids.filter((cardId) => myHandIds.has(cardId)));
  }, [isSpectatorMode, myHandIds]);

  useEffect(() => {
    setLocalError(null);
  }, [phase, state?.revision]);

  useEffect(() => {
    if (isSpectatorMode) return;
    if (!state || busy || !player || !myGamePlayer) return;
    if (phase !== "playing" || state.gameStatus !== "playing") return;
    if (state.currentTurn !== player.id) return;
    if (!state.autoPlay.enabledPlayerIds.includes(player.id)) return;
    if (myGamePlayer.hand.length !== 1) return;

    dispatchAction({ type: "AUTO_PLAY_LAST_CARD", playerId: player.id });
  }, [busy, dispatchAction, isSpectatorMode, myGamePlayer, phase, player, state]);

  async function sendAction(action: GameAction, clearSelection = true) {
    if (isSpectatorMode) {
      setLocalError("观战中不能操作牌局。");
      return false;
    }
    const ok = await dispatchAction(action);
    if (ok && clearSelection) setSelectedCardIds([]);
    if (ok) setLocalError(null);
    return ok;
  }

  async function sendPass() {
    if (!player) return;
    await sendAction({ type: "PASS", playerId: player.id });
  }

  function toggleCard(card: Card) {
    if (isSpectatorMode) return;
    if (!canSeeHand) return;
    if (phase === "swap_select") {
      setSelectedCardIds((ids) => (ids.includes(card.id) ? [] : [card.id]));
      return;
    }
    setSelectedCardIds((ids) =>
      ids.includes(card.id) ? ids.filter((cardId) => cardId !== card.id) : [...ids, card.id],
    );
  }

  async function handlePlay() {
    if (isSpectatorMode) return;
    if (!player || !state) return;
    if (selectedCards.length === 0) {
      setLocalError("请先选择要出的牌。");
      return;
    }
    const move = createCandidateMove(state, player.id, selectedCards);
    if (!move.combo) {
      setLocalError("选择的牌不成牌型。");
      return;
    }
    await sendAction({ type: "PLAY_CARD", playerId: player.id, cards: selectedCards });
  }

  async function handleSwapSubmit() {
    if (isSpectatorMode) return;
    if (selectedCardIds.length !== 1) {
      setLocalError("换牌阶段只能选择 1 张牌。");
      return;
    }
    await selectSwapCard(selectedCardIds[0]);
    setSelectedCardIds([]);
  }

  async function handleSettleRoom() {
    const snapshot = await settleRoom();
    if (snapshot) {
      setSettlementSnapshot(snapshot);
      setShowSettleConfirm(false);
    }
  }

  async function handleJoinAsPlayer() {
    const updated = await joinAsPlayer();
    if (updated && roomId) {
      setViewMode("player");
      navigate(`/room/${roomId}`, { replace: true });
    }
  }

  function handleSpectateRoom() {
    setSelectedCardIds([]);
    setViewMode("spectator");
    if (roomId) navigate(`/room/${roomId}`, { replace: true });
  }

  async function handleLeaveRoom() {
    if (isSeated && phase === "finished") {
      setShowSettleConfirm(true);
      return;
    }
    if (isSeated && phase === "waiting_ready") {
      await leaveSeat();
    }
    navigate("/lobby");
  }

  async function handleDismissRoom() {
    if (!myRoomPlayer?.isHost) return;
    const confirmed = window.confirm("确定要解散这个房间吗？房间、聊天和观众记录都会被删除，其他玩家会回到大厅。");
    if (!confirmed) return;
    const ok = await dismissRoom();
    if (ok) navigate("/lobby", { replace: true });
  }

  if (settlementSnapshot) {
    return <SettlementComplete snapshot={settlementSnapshot} />;
  }

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] flex-col items-center justify-center bg-[#0c1110]">
        <Loader2 className="mb-4 h-10 w-10 animate-spin text-[#d8b65a]" />
        <div className="font-black text-white">正在进入房间</div>
        <div className="mt-1 font-mono text-sm text-white/45">{roomId}</div>
      </div>
    );
  }

  return (
    <div className="dpy-room-shell h-[calc(100vh-4rem)] overflow-hidden bg-[#0c1110] text-neutral-100">
      <header className="dpy-room-header flex h-14 shrink-0 items-center justify-between border-b border-white/10 bg-[#080c0b]/90 px-4">
        <div className="flex items-center gap-4">
          <button onClick={handleLeaveRoom} className="inline-flex items-center gap-2 text-white/65 hover:text-white">
            <ChevronLeft className="h-4 w-4" />
            离开
          </button>
          <div className="h-5 w-px bg-white/10" />
          <div>
            <h1 className="font-black text-white">房间 {roomId}</h1>
            <p className="text-xs font-mono text-white/35">
              version {room?.version ?? "-"} · rev {state?.revision ?? "-"}
            </p>
          </div>
        </div>

        <div className="dpy-room-status flex items-center gap-2 text-sm">
          {myRoomPlayer?.isHost && (
            <button
              onClick={handleDismissRoom}
              disabled={busy}
              className="whitespace-nowrap rounded-lg border border-red-300/25 bg-red-500/10 px-3 py-2 text-xs font-black text-red-100 hover:bg-red-500/20 disabled:opacity-50"
            >
              解散房间
            </button>
          )}
          <InfoPill icon={<Users className="h-4 w-4" />}>{room?.players.length ?? 0}/4</InfoPill>
          <InfoPill icon={<Trophy className="h-4 w-4" />}>{room?.mode === "ladder" ? "天梯" : "休闲"}</InfoPill>
          <InfoPill icon={<Eye className="h-4 w-4" />}>{isSeated ? "玩家" : isSpectatorMode ? "观战" : "选择身份"}</InfoPill>
          <InfoPill icon={<Eye className="h-4 w-4" />}>{spectators.length} 观众</InfoPill>
          <InfoPill icon={<Lock className="h-4 w-4" />}>{phaseLabels[phase]}</InfoPill>
        </div>
      </header>

      {!isConfigured && (
        <div className="border-b border-red-500/20 bg-red-500/10 px-6 py-3 text-sm text-red-200">
          Supabase 未配置，无法同步房间。
        </div>
      )}

      <main className="dpy-room-main grid h-[calc(100%-3.5rem)] min-h-0 grid-cols-1 lg:grid-cols-[1fr_330px]">
        <section className="dpy-room-table-panel min-h-0 min-w-0">
          <GameTable
            autoEnabled={autoEnabled}
            bombChoice={bombChoice}
            busy={busy}
            canAuto={Boolean(state && isSeated && myGamePlayer?.hand.length === 1)}
            canChooseSeatMode={canChooseSeatMode}
            canPass={Boolean(isMyTurn && state?.lastMove)}
            canPlay={Boolean(isMyTurn && selectedCards.length > 0 && hasPlayable)}
            canSeeHand={canSeeHand}
            conflictChoice={conflictChoice}
            isBomber={isBomber}
            isMyTurn={isMyTurn}
            isSeated={isSeated}
            isSpectatorMode={isSpectatorMode}
            latestMoveByPlayer={latestMoveByPlayer}
            myBombVote={myBombVote}
            myConflictVote={myConflictVote}
            myHand={visibleHand}
            myRoomPlayer={myRoomPlayer}
            mySwapSelection={mySwapSelection}
            mySwapVote={mySwapVote}
            notice={tableNotice}
            onAutoToggle={() =>
              player &&
              sendAction(
                {
                  type: "SET_AUTO_PLAY_LAST_CARD",
                  playerId: player.id,
                  enabled: !autoEnabled,
                },
                false,
              )
            }
            onBombChoice={setBombChoice}
            onBombSubmit={() => bombChoice !== null && voteBomb(bombChoice)}
            onClear={() => setSelectedCardIds([])}
            onConflictChoice={setConflictChoice}
            onConflictSubmit={() => conflictChoice !== null && voteBombConflict(conflictChoice)}
            onJoin={handleJoinAsPlayer}
            onNextRound={nextRound}
            onPass={sendPass}
            onPlay={handlePlay}
            onReady={() => toggleReady(!myRoomPlayer?.ready)}
            onSettle={() => setShowSettleConfirm(true)}
            onSpectate={handleSpectateRoom}
            onStartGame={startGame}
            onSwapCardSubmit={handleSwapSubmit}
            onSwapChoice={setSwapChoice}
            onSwapSubmit={() => swapChoice !== null && voteSwap(swapChoice)}
            onToggleCard={toggleCard}
            phase={phase}
            player={player}
            playerName={playerName}
            room={room}
            seats={seats}
            selectedCardIds={selectedCardIds}
            selectedCount={selectedCards.length}
            state={state}
            swapChoice={swapChoice}
            bombChoiceValue={bombChoice}
            swappedInCardId={swappedInCardId}
          />
        </section>

        <ChatPanel
          messages={messages}
          onSend={sendChat}
          player={player}
          room={room}
          spectators={spectators}
        />
      </main>

      {showSettleConfirm && room && (
        <SettlementDialog
          busy={busy}
          onClose={() => setShowSettleConfirm(false)}
          onConfirm={handleSettleRoom}
          playerName={playerName}
          room={room}
          state={state}
        />
      )}
    </div>
  );
}

function GameTable({
  autoEnabled,
  bombChoice,
  bombChoiceValue,
  busy,
  canAuto,
  canChooseSeatMode,
  canPass,
  canPlay,
  canSeeHand,
  conflictChoice,
  isBomber,
  isMyTurn,
  isSeated,
  isSpectatorMode,
  latestMoveByPlayer,
  myBombVote,
  myConflictVote,
  myHand,
  myRoomPlayer,
  mySwapSelection,
  mySwapVote,
  notice,
  onAutoToggle,
  onBombChoice,
  onBombSubmit,
  onClear,
  onConflictChoice,
  onConflictSubmit,
  onJoin,
  onNextRound,
  onPass,
  onPlay,
  onReady,
  onSettle,
  onSpectate,
  onStartGame,
  onSwapCardSubmit,
  onSwapChoice,
  onSwapSubmit,
  onToggleCard,
  phase,
  player,
  playerName,
  room,
  seats,
  selectedCardIds,
  selectedCount,
  state,
  swapChoice,
  swappedInCardId,
}: {
  autoEnabled: boolean;
  bombChoice: boolean | null;
  bombChoiceValue: boolean | null;
  busy: boolean;
  canAuto: boolean;
  canChooseSeatMode: boolean;
  canPass: boolean;
  canPlay: boolean;
  canSeeHand: boolean;
  conflictChoice: boolean | null;
  isBomber: boolean;
  isMyTurn: boolean;
  isSeated: boolean;
  isSpectatorMode: boolean;
  latestMoveByPlayer: Record<string, Move>;
  myBombVote?: boolean;
  myConflictVote?: boolean;
  myHand: Card[];
  myRoomPlayer: RoomPlayer | null | undefined;
  mySwapSelection?: string;
  mySwapVote?: boolean;
  notice: TableNotice;
  onAutoToggle: () => void;
  onBombChoice: (value: boolean) => void;
  onBombSubmit: () => void;
  onClear: () => void;
  onConflictChoice: (value: boolean) => void;
  onConflictSubmit: () => void;
  onJoin: () => void;
  onNextRound: () => void;
  onPass: () => void;
  onPlay: () => void;
  onReady: () => void;
  onSettle: () => void;
  onSpectate: () => void;
  onStartGame: () => void;
  onSwapCardSubmit: () => void;
  onSwapChoice: (value: boolean) => void;
  onSwapSubmit: () => void;
  onToggleCard: (card: Card) => void;
  phase: RoomPhase;
  player: { id: string; name: string } | null;
  playerName: (playerId: string) => string;
  room: GameRoom | null;
  seats: SeatView[];
  selectedCardIds: string[];
  selectedCount: number;
  state: EngineGameState | null;
  swapChoice: boolean | null;
  swappedInCardId?: string;
}) {
  return (
    <div className={cn("relative h-full min-h-0 overflow-hidden dpy-table-room", isSpectatorMode && "is-spectator-table")}>
      <div className="absolute inset-3 rounded-[28px] border border-amber-950/80 bg-[#5b2e12] shadow-2xl shadow-black/50 dpy-wood-frame" />
      <div className="absolute inset-x-7 top-14 bottom-28 rounded-[36px] border border-amber-200/30 dpy-wood-table" />

      {seats.map((seat) => (
        <TableSeat key={seat.id} seat={seat} />
      ))}

      {isSpectatorMode && phase !== "waiting_ready" && seats.map((seat) => {
        const revealedHand = state?.players.find((candidate) => candidate.id === seat.id)?.hand ?? [];
        return revealedHand.length > 0 ? (
          <SeatRevealedHand key={`${seat.id}-revealed`} cards={revealedHand} position={seat.position} />
        ) : null;
      })}

      {seats.map((seat) => {
        const playedMove = latestMoveByPlayer[seat.id];
        return playedMove ? <SeatPlayedMove key={`${seat.id}-${playedMove.sequence}`} move={playedMove} position={seat.position} /> : null;
      })}

      <TableNoticePanel notice={notice} />

      <div className="dpy-action-layer absolute inset-x-0 bottom-[154px] z-30 flex justify-center px-4">
        <ActionDock
          autoEnabled={autoEnabled}
          bombChoice={bombChoiceValue}
          busy={busy}
          canAuto={canAuto}
          canChooseSeatMode={canChooseSeatMode}
          canPass={canPass}
          canPlay={canPlay}
          conflictChoice={conflictChoice}
          isBomber={isBomber}
          isMyTurn={isMyTurn}
          isSeated={isSeated}
          isSpectatorMode={isSpectatorMode}
          myBombVote={myBombVote}
          myConflictVote={myConflictVote}
          myRoomPlayer={myRoomPlayer}
          mySwapSelection={mySwapSelection}
          mySwapVote={mySwapVote}
          onAutoToggle={onAutoToggle}
          onBombChoice={onBombChoice}
          onBombSubmit={onBombSubmit}
          onClear={onClear}
          onConflictChoice={onConflictChoice}
          onConflictSubmit={onConflictSubmit}
          onJoin={onJoin}
          onNextRound={onNextRound}
          onPass={onPass}
          onPlay={onPlay}
          onReady={onReady}
          onSettle={onSettle}
          onSpectate={onSpectate}
          onStartGame={onStartGame}
          onSwapCardSubmit={onSwapCardSubmit}
          onSwapChoice={onSwapChoice}
          onSwapSubmit={onSwapSubmit}
          phase={phase}
          player={player}
          room={room}
          selectedCount={selectedCount}
          swapChoice={swapChoice}
        />
      </div>

      <div className="absolute inset-x-0 bottom-0 z-40">
        {!isSpectatorMode && (
          <HandDock
            cards={myHand}
            canSeeHand={canSeeHand}
            disabled={false}
            isSpectatorMode={isSpectatorMode}
            mySwapSelection={mySwapSelection}
            onToggle={onToggleCard}
            phase={phase}
            selectedCardIds={selectedCardIds}
            swappedInCardId={swappedInCardId}
          />
        )}
      </div>
    </div>
  );
}

function ActionDock({
  autoEnabled,
  bombChoice,
  busy,
  canAuto,
  canChooseSeatMode,
  canPass,
  canPlay,
  conflictChoice,
  isBomber,
  isMyTurn,
  isSeated,
  isSpectatorMode,
  myBombVote,
  myConflictVote,
  myRoomPlayer,
  mySwapSelection,
  mySwapVote,
  onAutoToggle,
  onBombChoice,
  onBombSubmit,
  onClear,
  onConflictChoice,
  onConflictSubmit,
  onJoin,
  onNextRound,
  onPass,
  onPlay,
  onReady,
  onSettle,
  onSpectate,
  onStartGame,
  onSwapCardSubmit,
  onSwapChoice,
  onSwapSubmit,
  phase,
  player,
  room,
  selectedCount,
  swapChoice,
}: {
  autoEnabled: boolean;
  bombChoice: boolean | null;
  busy: boolean;
  canAuto: boolean;
  canChooseSeatMode: boolean;
  canPass: boolean;
  canPlay: boolean;
  conflictChoice: boolean | null;
  isBomber: boolean;
  isMyTurn: boolean;
  isSeated: boolean;
  isSpectatorMode: boolean;
  myBombVote?: boolean;
  myConflictVote?: boolean;
  myRoomPlayer: RoomPlayer | null | undefined;
  mySwapSelection?: string;
  mySwapVote?: boolean;
  onAutoToggle: () => void;
  onBombChoice: (value: boolean) => void;
  onBombSubmit: () => void;
  onClear: () => void;
  onConflictChoice: (value: boolean) => void;
  onConflictSubmit: () => void;
  onJoin: () => void;
  onNextRound: () => void;
  onPass: () => void;
  onPlay: () => void;
  onReady: () => void;
  onSettle: () => void;
  onSpectate: () => void;
  onStartGame: () => void;
  onSwapCardSubmit: () => void;
  onSwapChoice: (value: boolean) => void;
  onSwapSubmit: () => void;
  phase: RoomPhase;
  player: { id: string; name: string } | null;
  room: GameRoom | null;
  selectedCount: number;
  swapChoice: boolean | null;
}) {
  if (canChooseSeatMode) {
    return (
      <div className="dpy-action-dock">
        {player ? (
          <button onClick={onJoin} disabled={busy} className="dpy-game-button dpy-game-button-blue">入座</button>
        ) : (
          <Link to="/login" className="dpy-game-button dpy-game-button-blue">登录入座</Link>
        )}
        <button onClick={onSpectate} disabled={busy} className="dpy-game-button dpy-game-button-yellow">观战</button>
      </div>
    );
  }

  if (isSpectatorMode) {
    return null;
  }

  if (!player) {
    return (
      <div className="dpy-action-dock">
        <Link to="/login" className="dpy-game-button dpy-game-button-blue">登录后入座</Link>
      </div>
    );
  }

  if (!isSeated) {
    return <div className="dpy-action-dock text-sm font-black text-amber-100">观战中</div>;
  }

  if (phase === "waiting_ready") {
    const playerCount = room?.players.length ?? 0;
    const readyCount = room?.players.filter((player) => player.ready).length ?? 0;
    const allReady = playerCount >= 2 && readyCount === playerCount;
    const canStart = Boolean(myRoomPlayer?.isHost && allReady);

    return (
      <div className="dpy-action-dock">
        <button onClick={onReady} disabled={busy} className={cn("dpy-game-button", myRoomPlayer?.ready ? "dpy-game-button-gold" : "dpy-game-button-blue")}>
          {myRoomPlayer?.ready ? "取消准备" : "准备"}
        </button>
        {myRoomPlayer?.isHost ? (
          <button onClick={onStartGame} disabled={busy || !canStart} className="dpy-game-button dpy-game-button-blue">
            开始游戏
          </button>
        ) : (
          <span className="rounded-full bg-black/35 px-3 py-2 text-xs font-black text-amber-100/75">
            {allReady ? "等待房主开始" : `${readyCount}/${playerCount} 已准备`}
          </span>
        )}
      </div>
    );
  }

  if (phase === "swap_vote") {
    const locked = mySwapVote !== undefined;
    const effectiveChoice = mySwapVote ?? swapChoice;
    return (
      <div className="dpy-action-dock">
        <button onClick={() => onSwapChoice(true)} disabled={busy || locked} className={cn("dpy-game-button dpy-game-button-gold", effectiveChoice === true && "is-active", locked && mySwapVote === true && "is-confirmed")}>
          换牌
        </button>
        <button onClick={() => onSwapChoice(false)} disabled={busy || locked} className={cn("dpy-game-button dpy-game-button-yellow", effectiveChoice === false && "is-active", locked && mySwapVote === false && "is-confirmed")}>
          不换
        </button>
        <button onClick={onSwapSubmit} disabled={busy || locked || swapChoice === null} className={cn("dpy-game-button dpy-game-button-blue", locked && "is-confirmed")}>
          {locked ? "已确认" : busy ? "确认中" : "确认"}
        </button>
      </div>
    );
  }

  if (phase === "swap_select") {
    return (
      <div className="dpy-action-dock">
        <button onClick={onClear} disabled={busy || selectedCount === 0 || Boolean(mySwapSelection)} className="dpy-game-button dpy-game-button-yellow">重选</button>
        <button onClick={onSwapCardSubmit} disabled={busy || selectedCount !== 1 || Boolean(mySwapSelection)} className="dpy-game-button dpy-game-button-blue">确认换牌</button>
      </div>
    );
  }

  if (phase === "bomb_vote") {
    const locked = myBombVote !== undefined;
    const effectiveChoice = myBombVote ?? bombChoice;
    return (
      <div className="dpy-action-dock">
        <button onClick={() => onBombChoice(false)} disabled={busy || locked} className={cn("dpy-game-button dpy-game-button-yellow", effectiveChoice === false && "is-active", locked && myBombVote === false && "is-confirmed")}>
          不拍
        </button>
        <button onClick={() => onBombChoice(true)} disabled={busy || locked} className={cn("dpy-game-button dpy-game-button-red", effectiveChoice === true && "is-active", locked && myBombVote === true && "is-confirmed")}>
          拍炸
        </button>
        <button onClick={onBombSubmit} disabled={busy || locked || bombChoice === null} className={cn("dpy-game-button dpy-game-button-blue", locked && "is-confirmed")}>
          {locked ? "已确认" : busy ? "确认中" : "确认"}
        </button>
      </div>
    );
  }

  if (phase === "bomb_conflict") {
    if (!isBomber) return <div className="dpy-action-dock text-sm font-black text-amber-100">等待拍炸玩家抢拍</div>;
    const locked = myConflictVote !== undefined;
    const effectiveChoice = myConflictVote ?? conflictChoice;
    return (
      <div className="dpy-action-dock">
        <button onClick={() => onConflictChoice(false)} disabled={busy || locked} className={cn("dpy-game-button dpy-game-button-yellow", effectiveChoice === false && "is-active", locked && myConflictVote === false && "is-confirmed")}>放弃</button>
        <button onClick={() => onConflictChoice(true)} disabled={busy || locked} className={cn("dpy-game-button dpy-game-button-red", effectiveChoice === true && "is-active", locked && myConflictVote === true && "is-confirmed")}>继续抢拍</button>
        <button onClick={onConflictSubmit} disabled={busy || locked || conflictChoice === null} className={cn("dpy-game-button dpy-game-button-blue", locked && "is-confirmed")}>
          {locked ? "已确认" : busy ? "确认中" : "确认"}
        </button>
      </div>
    );
  }

  if (phase === "finished") {
    return (
      <div className="dpy-action-dock">
        <button onClick={onNextRound} disabled={busy} className="dpy-game-button dpy-game-button-blue">下一局</button>
        <button onClick={onSettle} disabled={busy} className="dpy-game-button dpy-game-button-red">结算牌局</button>
      </div>
    );
  }

  return (
    <div className="dpy-action-dock">
      <button onClick={onPass} disabled={!canPass || busy} className="dpy-game-button dpy-game-button-yellow">
        跳过
      </button>
      <button onClick={onPlay} disabled={!canPlay || busy} className="dpy-game-button dpy-game-button-blue">
        出牌
      </button>
      <button
        onClick={onAutoToggle}
        disabled={!canAuto || busy}
        className={cn("dpy-icon-button", autoEnabled && "is-active")}
        title="最后一张托管"
      >
        <Bot className="h-5 w-5" />
      </button>
      {!isMyTurn && <span className="hidden rounded-full bg-black/35 px-3 py-2 text-xs font-black text-amber-100/75 md:inline">等待其他玩家</span>}
    </div>
  );
}

function HandDock({
  cards,
  canSeeHand,
  disabled,
  handOwnerName,
  isSpectatorMode,
  mySwapSelection,
  onToggle,
  phase,
  selectedCardIds,
  swappedInCardId,
}: {
  cards: Card[];
  canSeeHand: boolean;
  disabled: boolean;
  handOwnerName?: string;
  isSpectatorMode: boolean;
  mySwapSelection?: string;
  onToggle: (card: Card) => void;
  phase: RoomPhase;
  selectedCardIds: string[];
  swappedInCardId?: string;
}) {
  const rackWrapRef = useRef<HTMLDivElement | null>(null);
  const [rackContainerWidth, setRackContainerWidth] = useState(0);

  useEffect(() => {
    if (!canSeeHand) return undefined;
    const element = rackWrapRef.current;
    if (!element) return undefined;

    const updateWidth = () => {
      setRackContainerWidth(Math.floor(element.clientWidth));
    };

    updateWidth();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateWidth);
      return () => window.removeEventListener("resize", updateWidth);
    }

    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);
    return () => observer.disconnect();
  }, [canSeeHand]);

  if (!canSeeHand) {
    return null;
  }

  if (cards.length === 0) {
    return null;
  }

  const rackLayout = getHandRackLayout(cards.length, rackContainerWidth);
  const rackStyle = {
    width: rackLayout.width,
    "--card-height": `${rackLayout.cardHeight}px`,
    "--card-scale": String(rackLayout.cardWidth / 108),
    "--card-width": `${rackLayout.cardWidth}px`,
  } as CSSProperties & Record<string, string | number>;

  return (
    <div className="dpy-hand-rack-wrap" ref={rackWrapRef}>
      {handOwnerName && <div className="mb-1 text-center text-xs font-black text-amber-100/65">正在查看：{handOwnerName} 的手牌</div>}
      <div className="dpy-hand-rack" style={rackStyle}>
        {cards.map((card, index) => {
          const selected = selectedCardIds.includes(card.id);
          const pendingSwap = phase === "swap_select" && (selected || mySwapSelection === card.id);
          const swappedIn = swappedInCardId === card.id && phase !== "swap_select";
          return (
            <RackCard
              key={card.id}
              card={card}
              disabled={disabled}
              left={index * rackLayout.spacing}
              pendingSwap={pendingSwap}
              selected={selected}
              swappedIn={swappedIn}
              zIndex={index + 1}
              onClick={() => onToggle(card)}
            />
          );
        })}
      </div>
    </div>
  );
}

function getHandRackLayout(cardCount: number, containerWidth: number) {
  const fallbackWidth = typeof window === "undefined" ? 780 : Math.min(window.innerWidth, 780);
  const availableWidth = Math.max(240, (containerWidth || fallbackWidth) - 18);
  const isPhone = availableWidth <= 640;
  const isTablet = availableWidth > 640 && availableWidth <= 900;
  const cardWidth = isPhone ? 72 : isTablet ? 88 : 108;
  const cardHeight = Math.round(cardWidth * 1.215);
  const maxSpacing = isPhone ? 44 : isTablet ? 56 : 72;
  const minSpacing = isPhone ? 16 : isTablet ? 22 : 42;

  if (cardCount <= 1) {
    return { cardHeight, cardWidth, spacing: 0, width: cardWidth };
  }

  const fitSpacing = (availableWidth - cardWidth) / (cardCount - 1);
  const spacing = fitSpacing >= minSpacing ? Math.min(maxSpacing, fitSpacing) : Math.max(6, fitSpacing);
  const width = Math.min(availableWidth, Math.ceil(spacing * (cardCount - 1) + cardWidth));
  return { cardHeight, cardWidth, spacing, width };
}

function RackCard({
  card,
  disabled,
  left,
  onClick,
  pendingSwap,
  selected,
  swappedIn,
  zIndex,
}: {
  card: Card;
  disabled: boolean;
  left: number;
  onClick: () => void;
  pendingSwap: boolean;
  selected: boolean;
  swappedIn: boolean;
  zIndex: number;
}) {
  const red = isRedCard(card);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn("dpy-rack-card", selected && "is-selected", pendingSwap && "is-swap", swappedIn && "is-swapped", disabled && "is-disabled")}
      style={{ left, zIndex }}
    >
      {(pendingSwap || swappedIn) && <span className="dpy-card-tag">{pendingSwap ? "待交换" : "交换获得"}</span>}
      <span className={cn("dpy-rack-corner", red ? "text-red-600" : "text-neutral-950")}>
        <span>{card.rank}</span>
        <span>{suitLabels[card.suit]}</span>
      </span>
      <span className={cn("dpy-rack-suit", red ? "text-red-600" : "text-neutral-950")}>{suitLabels[card.suit]}</span>
      <span className={cn("dpy-rack-corner dpy-rack-corner-bottom", red ? "text-red-600" : "text-neutral-950")}>
        <span>{card.rank}</span>
        <span>{suitLabels[card.suit]}</span>
      </span>
    </button>
  );
}

type TableNotice = {
  title: string;
  subtitle: string;
  tone: "normal" | "warning" | "danger" | "success";
  icon: ReactNode;
  voteItems?: VoteNoticeItem[];
};

type VoteNoticeItem = {
  id: string;
  name: string;
  label: string;
  tone: "active" | "negative" | "pending";
  confirmed: boolean;
  isMe: boolean;
};

function TableNoticePanel({ notice }: { notice: TableNotice }) {
  return (
    <div className={cn("absolute left-1/2 top-1/2 z-20 w-[min(420px,56vw)] -translate-x-1/2 -translate-y-1/2 text-center dpy-table-notice", `tone-${notice.tone}`)}>
      <div className="dpy-table-notice-icon">{notice.icon}</div>
      <div className="dpy-table-notice-title">{notice.title}</div>
      {notice.subtitle && <div className="dpy-table-notice-subtitle">{notice.subtitle}</div>}
      {notice.voteItems && notice.voteItems.length > 0 && (
        <div className="dpy-vote-list">
          {notice.voteItems.map((item) => (
            <div
              key={item.id}
              className={cn(
                "dpy-vote-chip",
                `is-${item.tone}`,
                item.confirmed && "is-confirmed",
                item.isMe && "is-me",
              )}
            >
              <span className="dpy-vote-name">{item.name}</span>
              <span className="dpy-vote-state">
                {item.label}
                {item.confirmed && <Check className="h-3.5 w-3.5" />}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TableSeat({ seat }: { seat: SeatView }) {
  return (
    <div className={cn("absolute z-30 dpy-seat", `seat-${seat.position}`, seat.isTurn && "is-turn", seat.isMe && "is-me", seat.isBomber && "is-bomber", seat.isWatched && "is-watched")}>
      <div className="relative">
        {seat.isBomber && <div className="dpy-bomb-badge" aria-label="拍炸玩家">💣</div>}
        <div className="dpy-seat-avatar">
          {seat.avatarUrl ? <img src={seat.avatarUrl} alt={seat.name} /> : <span>{seat.name.slice(0, 1)}</span>}
        </div>
        <div className="dpy-mobile-seat-stats">
          {seat.handCount}张 · {seat.winRate} · <span className={scoreToneClass(seat.batchScore)}>{formatSigned(seat.batchScore)}</span>
        </div>
        {seat.isTurn && <div className="dpy-turn-star"><Sparkles className="h-4 w-4" /></div>}
        {seat.isHost && <div className="dpy-host-crown"><Crown className="h-4 w-4" /></div>}
      </div>
      <div className="dpy-seat-info">
        <div className="max-w-28 truncate text-sm font-black text-white">{seat.name}{seat.isMe ? "（我）" : ""}</div>
        <div className="flex items-center gap-2 text-xs font-black">
          <span className="text-amber-200">胜率 {seat.winRate}</span>
          <span className="rounded bg-red-500 px-1.5 py-0.5 text-white">{seat.multiplier}倍</span>
          <span className="text-sky-100">{seat.handCount}张</span>
        </div>
        <div className="mt-1 flex items-center gap-2 text-[11px] font-black">
          <span className={cn("rounded-full bg-black/24 px-2 py-0.5", scoreToneClass(seat.batchScore))}>本批 {formatSigned(seat.batchScore)}</span>
          {seat.lastDelta !== null && (
            <span className={cn("rounded-full bg-black/24 px-2 py-0.5", scoreToneClass(seat.lastDelta))}>本局 {formatSigned(seat.lastDelta)}</span>
          )}
        </div>
        <div className="text-[11px] font-black text-emerald-200">{seat.ready ? "已准备" : seat.status}</div>
      </div>
    </div>
  );
}

function SeatRevealedHand({ cards, position }: { cards: Card[]; position: SeatPosition }) {
  return (
    <div className={cn("dpy-seat-open-hand is-revealed-hand", `seat-${position}`)}>
      <div className="dpy-seat-card-strip">
        {cards.map((card) => (
          <OpenMiniCard key={card.id} card={card} />
        ))}
      </div>
    </div>
  );
}

function SeatPlayedMove({ move, position }: { move: Move; position: SeatPosition }) {
  return (
    <div className={cn("dpy-seat-played-move is-table-played", `seat-${position}`, move.type === "PASS" && "is-pass")}>
      {move.type === "PASS" ? (
        <span>不出</span>
      ) : (
        <div className="dpy-seat-card-strip is-played">
          {move.cards.map((card) => (
            <OpenMiniCard key={card.id} card={card} />
          ))}
        </div>
      )}
    </div>
  );
}

function OpenMiniCard({ card }: { card: Card }) {
  const red = isRedCard(card);
  return (
    <span className={cn("dpy-open-mini-card", red ? "is-red" : "is-black")}>
      <span className="dpy-open-mini-rank">{card.rank}</span>
      <span className="dpy-open-mini-suit">{suitLabels[card.suit]}</span>
    </span>
  );
}

function ChatPanel({
  messages,
  onSend,
  player,
  room,
  spectators,
}: {
  messages: RoomMessage[];
  onSend: (content: string) => Promise<boolean>;
  player: { id: string; name: string } | null;
  room: GameRoom | null;
  spectators: RoomSpectator[];
}) {
  const [text, setText] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const chatMessages = messages.filter((message) => message.message_type === "chat");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const ok = await onSend(text);
    if (ok) {
      setText("");
      setEmojiOpen(false);
    }
  }

  function insertEmoji(emoji: string) {
    setText((value) => `${value}${emoji}`);
  }

  return (
    <aside className="dpy-chat-panel flex min-h-0 flex-col border-l border-amber-900/50 bg-[#140c07]/95">
      <div className="flex h-14 items-center justify-between border-b border-amber-900/50 px-4">
        <h2 className="inline-flex items-center gap-2 font-black text-amber-50">
          <MessageCircle className="h-4 w-4 text-amber-300" />
          房间聊天
        </h2>
        <span className="rounded-full bg-amber-100/10 px-2 py-1 text-xs text-amber-100/60">{room?.players.length ?? 0} 玩家 · {spectators.length} 观众</span>
      </div>

      <div className="border-b border-amber-900/50 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-black text-amber-50">观众席</h3>
          <span className="text-xs text-amber-100/45">{spectators.length} 人</span>
        </div>
        {spectators.length === 0 ? (
          <p className="text-sm text-amber-100/40">暂无观众。</p>
        ) : (
          <div className="space-y-2">
            {spectators.map((spectator) => (
              <div key={spectator.user_id} className="flex items-center gap-3 rounded-lg border border-amber-100/10 bg-black/20 px-3 py-2">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/10 text-xs font-black text-white">
                  {spectator.avatar_url ? <img src={spectator.avatar_url} alt={spectator.name} className="h-full w-full object-cover" /> : spectator.name.slice(0, 1)}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-black text-white">{spectator.name}</div>
                  <div className="truncate text-xs text-amber-100/45">观战中</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {chatMessages.length === 0 ? (
          <p className="text-sm text-amber-100/40">还没有消息，先打个招呼。</p>
        ) : (
          chatMessages.map((message) => <ChatMessage key={message.id} message={message} />)
        )}
      </div>

      <form onSubmit={handleSubmit} className="border-t border-amber-900/50 p-4">
        {player ? (
          <div className="space-y-2">
            {emojiOpen && (
              <div className="grid grid-cols-8 gap-1 rounded-lg border border-amber-100/10 bg-black/35 p-2">
                {emojiOptions.map((emoji) => (
                  <button key={emoji} type="button" onClick={() => insertEmoji(emoji)} className="rounded-md px-1 py-1.5 text-lg hover:bg-white/10">
                    {emoji}
                  </button>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEmojiOpen((value) => !value)}
                className={cn("rounded-lg border border-amber-100/10 bg-black/35 px-3 py-2 text-amber-100 hover:bg-white/10", emojiOpen && "border-amber-300/40 bg-amber-300/10")}
                title="发表情"
              >
                <Smile className="h-4 w-4" />
              </button>
              <input
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="输入聊天内容或表情"
                maxLength={240}
                className="min-w-0 flex-1 rounded-lg border border-amber-100/10 bg-black/35 px-3 py-2 text-sm text-white outline-none focus:border-amber-300"
              />
              <button className="rounded-lg bg-amber-400 px-3 py-2 text-[#4b2208] hover:bg-amber-300">
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : (
          <Link to="/login" className="block rounded-lg border border-amber-100/10 bg-amber-100/10 px-4 py-3 text-center text-sm font-black text-amber-100">
            登录后发言
          </Link>
        )}
      </form>
    </aside>
  );
}

function ChatMessage({ message }: { message: RoomMessage }) {
  return (
    <div className="rounded-lg border border-amber-100/10 bg-black/25 p-3">
      <div className="mb-1 flex items-center justify-between gap-3">
        <span className="min-w-0 truncate text-sm font-black text-white">
          {message.sender_name}
          {message.sender_role === "spectator" && <span className="ml-2 rounded-full bg-sky-400/15 px-2 py-0.5 text-[10px] text-sky-100">观众</span>}
        </span>
        <span className="shrink-0 text-[11px] text-amber-100/35">{new Date(message.created_at).toLocaleTimeString()}</span>
      </div>
      <p className="break-words text-sm leading-6 text-amber-50/80">{message.content}</p>
    </div>
  );
}

function SettlementDialog({
  busy,
  onClose,
  onConfirm,
  playerName,
  room,
  state,
}: {
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
  playerName: (playerId: string) => string;
  room: GameRoom;
  state: EngineGameState | null;
}) {
  const players = syncSettlementPlayers(room, state);
  const latestDelta = state?.lastScoreDelta ?? {};
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/62 px-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl border border-amber-100/15 bg-[#101816] p-6 shadow-2xl shadow-black/50">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-white">结算牌局</h2>
            <p className="mt-1 text-sm text-amber-100/55">确认后会记录本批玩家积分并离开房间；房间会保留给剩余玩家继续游戏。</p>
          </div>
          <button onClick={onClose} disabled={busy} className="rounded-lg border border-white/10 px-3 py-2 text-sm font-black text-white/70 hover:bg-white/10">
            取消
          </button>
        </div>

        <div className="mb-5 rounded-xl border border-amber-100/10 bg-black/22 p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-black text-amber-100/70">本轮赢家</span>
            <span className="text-lg font-black text-white">{state?.winner ? playerName(state.winner) : "未记录"}</span>
          </div>
          <div className="grid gap-2">
            {players.map((player) => (
              <div key={player.id} className="flex items-center justify-between rounded-lg bg-white/[0.04] px-3 py-2">
                <span className="font-black text-white">{player.name}</span>
                <span className="flex items-center gap-3 font-mono text-sm">
                  <span className={Number(latestDelta[player.id] ?? 0) >= 0 ? "text-emerald-300" : "text-red-300"}>
                    {formatSigned(Number(latestDelta[player.id] ?? 0))}
                  </span>
                  <span className="text-amber-100">本批 {formatSigned(player.score)}</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        {room.scoreHistory.length > 0 && (
          <div className="mb-5 max-h-36 overflow-y-auto rounded-xl border border-white/10 bg-black/18 p-3">
            {room.scoreHistory.map((entry) => (
              <div key={`${entry.roundNo}-${entry.finishedAt}`} className="flex items-center justify-between border-b border-white/5 py-2 text-xs last:border-b-0">
                <span className="font-black text-white/75">第 {entry.roundNo} 局 · {entry.winnerId ? playerName(entry.winnerId) : "无赢家"}</span>
                <span className="text-amber-100/45">{new Date(entry.finishedAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button onClick={onClose} disabled={busy} className="rounded-lg border border-white/10 px-5 py-3 font-black text-white hover:bg-white/10 disabled:opacity-50">
            暂不离开
          </button>
          <button onClick={onConfirm} disabled={busy} className="rounded-lg bg-red-500 px-5 py-3 font-black text-white hover:bg-red-400 disabled:opacity-50">
            结算并离开房间
          </button>
        </div>
      </div>
    </div>
  );
}

function SettlementComplete({ snapshot }: { snapshot: SettlementSnapshot }) {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#0c1110] px-6 py-10 text-white">
      <div className="mx-auto max-w-3xl rounded-2xl border border-amber-100/15 bg-[#101816] p-6 shadow-2xl shadow-black/35">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-black text-[#d8b65a]">ROOM SETTLED</p>
            <h1 className="mt-1 text-3xl font-black">你已结算并离开房间 {snapshot.roomId}</h1>
            <p className="mt-2 text-sm text-white/45">
              {new Date(snapshot.settledAt).toLocaleString()} · {snapshot.roomDeleted ? "房间已无人并删除" : `房间仍有 ${snapshot.remainingPlayers} 名玩家`}
            </p>
          </div>
          <Link to="/lobby" className="whitespace-nowrap rounded-lg bg-[#2f8fbf] px-5 py-3 font-black text-white hover:bg-[#3aa6d7]">
            返回大厅
          </Link>
        </div>

        <div className="mb-6 rounded-xl border border-amber-100/10 bg-black/22 p-4">
          <div className="mb-3 text-sm font-black text-amber-100/70">本批累计总分</div>
          <div className="grid gap-2">
            {[...snapshot.players].sort((a, b) => b.score - a.score).map((player) => (
              <div key={player.id} className="flex items-center justify-between rounded-lg bg-white/[0.04] px-3 py-2">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/10 text-sm font-black">
                    {player.avatarUrl ? <img src={player.avatarUrl} alt={player.name} className="h-full w-full object-cover" /> : player.name.slice(0, 1)}
                  </div>
                  <span className="truncate font-black">{player.name}</span>
                </div>
                <span className="flex items-center gap-3 font-mono text-sm">
                  <span className={scoreToneClass(player.lastDelta)}>本局 {formatSigned(player.lastDelta)}</span>
                  <span className={cn("font-black", scoreToneClass(player.score))}>本批 {formatSigned(player.score)}</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/18 p-4">
          <div className="mb-3 text-sm font-black text-white/70">本房间牌局记录</div>
          {snapshot.scoreHistory.length === 0 ? (
            <p className="text-sm text-white/40">暂无历史记录。</p>
          ) : (
            <div className="space-y-2">
              {snapshot.scoreHistory.map((entry) => (
                <div key={`${entry.roundNo}-${entry.finishedAt}`} className="rounded-lg bg-white/[0.04] px-3 py-2 text-sm">
                  <div className="mb-1 flex justify-between gap-3">
                    <span className="font-black">第 {entry.roundNo} 局</span>
                    <span className="text-white/40">{new Date(entry.finishedAt).toLocaleString()}</span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-white/65">
                    {Object.entries(entry.deltas).map(([playerId, delta]) => (
                      <span key={playerId} className="rounded-full bg-black/25 px-2 py-1">
                        {snapshot.players.find((player) => player.id === playerId)?.name ?? playerId.slice(0, 6)} {formatSigned(delta)}
                        <span className="ml-1 text-white/40">总 {formatSigned(Number(entry.totals[playerId] ?? 0))}</span>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoPill({ children, icon }: { children: ReactNode; icon: ReactNode }) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-lg border border-amber-100/10 bg-black/25 px-3 py-1.5 text-amber-100">
      <span className="text-amber-300">{icon}</span>
      {children}
    </div>
  );
}

function MiniCard({ card }: { card: Card }) {
  return (
    <span
      className={cn(
        "inline-flex h-16 w-11 items-center justify-center rounded-lg border border-neutral-200 bg-white text-sm font-black shadow-lg",
        isRedCard(card) ? "text-red-600" : "text-neutral-950",
      )}
    >
      {formatCard(card)}
    </span>
  );
}

function formatSigned(value: number) {
  return value > 0 ? `+${value}` : `${value}`;
}

function scoreToneClass(value: number) {
  if (value > 0) return "text-emerald-300";
  if (value < 0) return "text-red-300";
  return "text-amber-100/70";
}

function syncSettlementPlayers(room: GameRoom, state: EngineGameState | null) {
  return room.players.map((player) => {
    const gamePlayer = state?.players.find((candidate) => candidate.id === player.id);
    return {
      ...player,
      score: Number(gamePlayer?.score ?? player.score ?? 0),
    };
  });
}

function formatWinRate(wins?: number, gamesPlayed?: number) {
  const total = Number(gamesPlayed ?? 0);
  if (!total) return "0%";
  return `${Math.round((Number(wins ?? 0) / total) * 100)}%`;
}

function buildSeats(room: GameRoom | null, state: EngineGameState | null, playerId: string | undefined, phase: RoomPhase, watchedPlayerId?: string | null): SeatView[] {
  const roomPlayers = [...(room?.players ?? [])].sort((a, b) => a.seatIndex - b.seatIndex);
  if (roomPlayers.length === 0) return [];
  const bomberIds = new Set(room?.phaseData.bombOrder ?? []);
  Object.entries(room?.phaseData.bombVotes ?? {}).forEach(([id, voted]) => {
    if (voted) bomberIds.add(id);
  });

  const currentIndex = playerId ? roomPlayers.findIndex((player) => player.id === playerId) : -1;
  const ordered = currentIndex >= 0
    ? [...roomPlayers.slice(currentIndex), ...roomPlayers.slice(0, currentIndex)]
    : roomPlayers;

  const positionSets: Record<number, SeatPosition[]> = {
    1: ["bottom"],
    2: ["bottom", "top"],
    3: ["bottom", "left", "right"],
    4: ["bottom", "left", "top", "right"],
  };
  const positions = positionSets[Math.min(4, ordered.length)] ?? positionSets[4];
  const latestScoreEntry = room?.scoreHistory.at(-1);

  return ordered.map((candidate, index) => {
    const gamePlayer = state?.players.find((item) => item.id === candidate.id);
    const batchScore = Number(gamePlayer?.score ?? candidate.score ?? latestScoreEntry?.totals?.[candidate.id] ?? 0);
    const lastDelta = latestScoreEntry?.deltas?.[candidate.id];
    return {
      id: candidate.id,
      name: candidate.name,
      avatarUrl: candidate.avatarUrl,
      handCount: phase === "waiting_ready" ? 0 : gamePlayer?.hand.length ?? 0,
      winRate: formatWinRate(candidate.wins, candidate.gamesPlayed),
      batchScore,
      lastDelta: typeof lastDelta === "number" ? lastDelta : null,
      multiplier: gamePlayer?.multiplier ?? candidate.multiplier ?? 1,
      ready: candidate.ready,
      isHost: candidate.isHost,
      isMe: candidate.id === playerId,
      isTurn: candidate.id === state?.currentTurn && phase === "playing",
      isBomber: bomberIds.has(candidate.id),
      isWatched: candidate.id === watchedPlayerId,
      status: gamePlayer?.status ?? "active",
      position: positions[index] ?? "top",
    };
  });
}

function createTableNotice({
  bombers,
  bombChoice,
  error,
  hasPlayable,
  phase,
  playerId,
  playerName,
  room,
  state,
  swapChoice,
}: {
  bombers: string[];
  bombChoice: boolean | null;
  error: string | null;
  hasPlayable: boolean;
  phase: RoomPhase;
  playerId: string | null;
  playerName: (playerId: string) => string;
  room: GameRoom | null;
  state: EngineGameState | null;
  swapChoice: boolean | null;
}): TableNotice {
  if (error) {
    return { title: error, subtitle: "", tone: "danger", icon: <AlertTriangle className="h-6 w-6" /> };
  }
  if (phase === "waiting_ready") {
    const ready = room?.players.filter((player) => player.ready).length ?? 0;
    const total = room?.players.length ?? 0;
    const allReady = total >= 2 && ready === total;
    return {
      title: allReady ? "等待房主开始" : "等待准备",
      subtitle: allReady ? "所有玩家已准备" : `${ready}/${total} 已准备`,
      tone: "normal",
      icon: <Users className="h-6 w-6" />,
    };
  }
  if (phase === "swap_vote") {
    return {
      title: "是否换牌？",
      subtitle: "红色表示选择换牌，勾表示已确认",
      tone: "warning",
      icon: <ShieldAlert className="h-6 w-6" />,
      voteItems: buildVoteNoticeItems(room, playerId, room?.phaseData.swapVotes, swapChoice, "换牌", "不换"),
    };
  }
  if (phase === "swap_select") {
    return { title: "选择 1 张牌交换", subtitle: "", tone: "warning", icon: <Sparkles className="h-6 w-6" /> };
  }
  if (phase === "bomb_vote") {
    return {
      title: room?.phaseData.notice ?? "是否拍炸？",
      subtitle: "红色表示选择拍炸，勾表示已确认",
      tone: "danger",
      icon: <Zap className="h-6 w-6" />,
      voteItems: buildVoteNoticeItems(room, playerId, room?.phaseData.bombVotes, bombChoice, "拍炸", "不拍"),
    };
  }
  if (phase === "bomb_conflict") {
    return { title: "多人拍炸，是否继续抢拍？", subtitle: `参与拍炸：${bombers.map(playerName).join("、")}`, tone: "danger", icon: <Zap className="h-6 w-6" /> };
  }
  if (phase === "finished" || state?.gameStatus === "finished") {
    return { title: "本局结束", subtitle: state?.winner ? `${playerName(state.winner)} 获胜` : "等待下一局", tone: "success", icon: <Trophy className="h-6 w-6" /> };
  }
  const currentTurn = state?.currentTurn ? playerName(state.currentTurn) : "等待";
  return {
    title: state?.currentTurn === playerId ? "轮到你出牌" : `轮到 ${currentTurn}`,
    subtitle: state?.currentTurn === playerId && state?.lastMove && !hasPlayable ? "没有可压过的牌，可以选择跳过" : "",
    tone: state?.currentTurn === playerId ? "success" : "normal",
    icon: <Sparkles className="h-6 w-6" />,
  };
}

function buildVoteNoticeItems(
  room: GameRoom | null,
  playerId: string | null,
  confirmedVotes: Record<string, boolean> | undefined,
  localChoice: boolean | null,
  activeLabel: string,
  negativeLabel: string,
): VoteNoticeItem[] {
  return [...(room?.players ?? [])]
    .sort((a, b) => a.seatIndex - b.seatIndex)
    .map((player) => {
      const confirmed = confirmedVotes?.[player.id];
      const isMe = player.id === playerId;
      const value = confirmed ?? (isMe ? localChoice : undefined);
      return {
        id: player.id,
        name: player.name,
        label: value === true ? activeLabel : value === false ? negativeLabel : "未选择",
        tone: value === true ? "active" : value === false ? "negative" : "pending",
        confirmed: confirmed !== undefined,
        isMe,
      };
    });
}

function createCandidateMove(state: EngineGameState, playerId: string, cards: Card[]): Move {
  return {
    type: "PLAY_CARD",
    playerId,
    cards,
    combo: classifyCards(cards),
    round: state.round,
    sequence: state.sequence + 1,
  };
}

function combinations<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  const stack: T[] = [];
  function visit(start: number) {
    if (stack.length === size) {
      result.push([...stack]);
      return;
    }
    for (let index = start; index < items.length; index += 1) {
      stack.push(items[index]);
      visit(index + 1);
      stack.pop();
    }
  }
  visit(0);
  return result;
}

function playerHasPlayableMove(state: EngineGameState, playerId: string) {
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (!player || player.hand.length === 0) return false;
  for (const size of [1, 2, 3, 5]) {
    if (player.hand.length < size) continue;
    for (const cards of combinations(player.hand, size)) {
      const move = createCandidateMove(state, playerId, cards);
      if (move.combo && isValidMove(state, move)) return true;
    }
  }
  return false;
}

function translateEngineMessage(message: string | null) {
  if (!message) return null;
  for (const [code, text] of Object.entries(errorText)) {
    if (message.includes(code)) return text;
  }
  if (message.includes("valid combo")) return errorText.INVALID_COMBO;
  if (message.includes("previous move")) return errorText.INVALID_MOVE;
  if (message.includes("minimum card") || message.includes("diamond four")) return errorText.FIRST_HAND_REQUIREMENT;
  return message;
}
