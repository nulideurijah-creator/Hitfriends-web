import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { Bot, Check, Eye, Loader2, Lock, LogOut, Play, RefreshCw, Send, SkipForward, Trophy, Users } from "lucide-react";
import type { Card, GameAction, GameState as EngineGameState } from "../../lib/ruleEngine";
import { comboNames, formatCard, isRedCard } from "../../lib/cardText";
import { cn } from "../../lib/utils";
import { useGameRoom } from "../hooks/useGameRoom";

const statusLabels: Record<EngineGameState["gameStatus"], string> = {
  waiting: "等待开始",
  playing: "进行中",
  finished: "已结束",
};

type SeatView = {
  id: string;
  name: string;
  handCount: number;
  score: number;
  status: string;
  isMe: boolean;
  isTurn: boolean;
};

export function Room() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const roomId = id?.toUpperCase();
  const spectate = searchParams.get("spectate") === "true";
  const {
    busy,
    dispatchAction,
    isConfigured,
    isMyTurn,
    isSeated,
    joinAsPlayer,
    loading,
    message,
    player,
    room,
    state,
  } = useGameRoom(roomId, { spectate });
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);

  const myGamePlayer = state?.players.find((candidate) => candidate.id === player.id) ?? null;
  const myHandIds = useMemo(() => new Set(myGamePlayer?.hand.map((card) => card.id) ?? []), [myGamePlayer]);
  const selectedCards = myGamePlayer?.hand.filter((card) => selectedCardIds.includes(card.id)) ?? [];
  const autoEnabled = Boolean(state?.autoPlay.enabledPlayerIds.includes(player.id));

  const playerName = (playerId: string) =>
    room?.players.find((candidate) => candidate.id === playerId)?.name ??
    state?.players.find((candidate) => candidate.id === playerId)?.name ??
    playerId.slice(0, 8);

  const seats: SeatView[] = state
    ? state.players.map((candidate) => ({
        id: candidate.id,
        name: playerName(candidate.id),
        handCount: candidate.hand.length,
        score: candidate.score,
        status: candidate.status,
        isMe: candidate.id === player.id,
        isTurn: candidate.id === state.currentTurn,
      }))
    : (room?.players ?? []).map((candidate) => ({
        id: candidate.id,
        name: candidate.name,
        handCount: 0,
        score: 0,
        status: "active",
        isMe: candidate.id === player.id,
        isTurn: false,
      }));

  useEffect(() => {
    setSelectedCardIds((ids) => ids.filter((cardId) => myHandIds.has(cardId)));
  }, [myHandIds]);

  useEffect(() => {
    if (!state || busy || !myGamePlayer) return;
    if (state.gameStatus !== "playing") return;
    if (state.currentTurn !== player.id) return;
    if (!state.autoPlay.enabledPlayerIds.includes(player.id)) return;
    if (myGamePlayer.hand.length !== 1) return;

    dispatchAction({ type: "AUTO_PLAY_LAST_CARD", playerId: player.id });
  }, [busy, dispatchAction, myGamePlayer, player.id, state]);

  async function sendAction(action: GameAction) {
    const ok = await dispatchAction(action);
    if (ok) setSelectedCardIds([]);
  }

  function toggleCard(card: Card) {
    if (!isMyTurn) return;
    setSelectedCardIds((ids) =>
      ids.includes(card.id) ? ids.filter((cardId) => cardId !== card.id) : [...ids, card.id],
    );
  }

  const canStart = Boolean(state && state.gameStatus === "waiting" && isSeated && state.players.length >= 2);
  const canPlay = Boolean(isMyTurn && selectedCards.length > 0);
  const canPass = Boolean(isMyTurn && state?.lastMove);
  const canAuto = Boolean(state && isSeated && myGamePlayer?.hand.length === 1);

  if (loading) {
    return (
      <div className="h-[calc(100vh-4rem)] bg-neutral-950 flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-400 mb-4" />
        <div className="text-white font-bold">正在进入房间</div>
        <div className="text-neutral-500 font-mono text-sm mt-1">{roomId}</div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] bg-neutral-950 flex flex-col overflow-hidden">
      <header className="h-16 shrink-0 border-b border-neutral-800 bg-neutral-900 px-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/lobby")} className="text-neutral-400 hover:text-white flex items-center gap-2">
            <LogOut className="w-4 h-4" />
            离开
          </button>
          <div className="h-5 w-px bg-neutral-800" />
          <div>
            <h1 className="text-white font-bold">房间 {roomId}</h1>
            <p className="text-xs text-neutral-500 font-mono">
              db version {room?.version ?? "-"} · state rev {state?.revision ?? "-"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-sm">
          <Badge icon={<Users className="w-4 h-4" />}>{room?.players.length ?? 0}/4</Badge>
          <Badge icon={<Eye className="w-4 h-4" />}>{isSeated ? "玩家" : "观战"}</Badge>
          <Badge icon={<Lock className="w-4 h-4" />}>{state ? statusLabels[state.gameStatus] : "未初始化"}</Badge>
        </div>
      </header>

      {message && (
        <div className="border-b border-amber-500/20 bg-amber-500/10 px-6 py-3 text-sm text-amber-200">
          {message}
        </div>
      )}

      {!isConfigured && (
        <div className="border-b border-red-500/20 bg-red-500/10 px-6 py-3 text-sm text-red-200">
          Supabase 未配置，无法同步房间。
        </div>
      )}

      <main className="flex-1 min-h-0 flex">
        <section className="flex-1 min-w-0 flex flex-col">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-6">
            {seats.map((seat) => (
              <PlayerSeat key={seat.id} seat={seat} />
            ))}
            {Array.from({ length: Math.max(0, 4 - seats.length) }).map((_, index) => (
              <div key={index} className="rounded-lg border border-dashed border-neutral-800 bg-neutral-900/40 p-4 text-neutral-600">
                空座位
              </div>
            ))}
          </div>

          <div className="flex-1 min-h-0 flex items-center justify-center px-6">
            <CenterDesk state={state} playerName={playerName} />
          </div>

          <div className="border-t border-neutral-800 bg-neutral-950 px-6 py-5">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <div>
                <div className="text-white font-bold">
                  {isSeated ? `${player.name} 的手牌` : "观战模式"}
                </div>
                <div className="text-xs text-neutral-500">
                  {state?.currentTurn ? `当前出牌权：${playerName(state.currentTurn)}` : "等待牌局状态"}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {!isSeated && room && (state?.gameStatus ?? "waiting") === "waiting" && room.players.length < 4 && (
                  <button
                    onClick={joinAsPlayer}
                    disabled={busy}
                    className="rounded-lg bg-indigo-600 px-4 py-2 font-bold text-white hover:bg-indigo-500 disabled:opacity-50"
                  >
                    入座
                  </button>
                )}
                <button
                  onClick={() => sendAction({ type: "START_GAME", playerId: player.id })}
                  disabled={!canStart || busy}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 font-bold text-white hover:bg-indigo-500 disabled:opacity-40"
                >
                  <Play className="w-4 h-4" />
                  开始游戏
                </button>
                <button
                  onClick={() => sendAction({ type: "PASS", playerId: player.id })}
                  disabled={!canPass || busy}
                  className="inline-flex items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2 font-bold text-white hover:bg-neutral-700 disabled:opacity-40"
                >
                  <SkipForward className="w-4 h-4" />
                  PASS
                </button>
                <button
                  onClick={() => sendAction({ type: "PLAY_CARD", playerId: player.id, cards: selectedCards })}
                  disabled={!canPlay || busy}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 font-bold text-white hover:bg-emerald-500 disabled:opacity-40"
                >
                  <Send className="w-4 h-4" />
                  出牌
                </button>
                <button
                  onClick={() => sendAction({ type: "SET_AUTO_PLAY_LAST_CARD", playerId: player.id, enabled: !autoEnabled })}
                  disabled={!canAuto || busy}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-lg border px-4 py-2 font-bold disabled:opacity-40",
                    autoEnabled
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                      : "border-neutral-700 bg-neutral-800 text-white hover:bg-neutral-700",
                  )}
                >
                  <Bot className="w-4 h-4" />
                  {autoEnabled ? "已托管" : "最后一张托管"}
                </button>
                <button
                  onClick={() => setSelectedCardIds([])}
                  disabled={selectedCardIds.length === 0}
                  className="rounded-lg px-3 py-2 text-neutral-400 hover:text-white disabled:opacity-40"
                >
                  清空选择
                </button>
              </div>
            </div>

            <div className="min-h-40 overflow-x-auto">
              {myGamePlayer ? (
                <div className="flex gap-2 pb-3">
                  {myGamePlayer.hand.map((card) => (
                    <PlayingCard
                      key={card.id}
                      card={card}
                      selected={selectedCardIds.includes(card.id)}
                      disabled={!isMyTurn}
                      onClick={() => toggleCard(card)}
                    />
                  ))}
                </div>
              ) : (
                <div className="h-36 rounded-lg border border-neutral-800 bg-neutral-900 flex items-center justify-center text-neutral-500">
                  {room ? "入座后显示你的手牌" : "房间不存在"}
                </div>
              )}
            </div>
          </div>
        </section>

        <aside className="w-80 shrink-0 border-l border-neutral-800 bg-neutral-900 flex flex-col">
          <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
            <h2 className="text-white font-bold">牌局日志</h2>
            <RefreshCw className="w-4 h-4 text-neutral-500" />
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {!state || state.discardPile.length === 0 ? (
              <p className="text-sm text-neutral-500">暂无出牌记录。</p>
            ) : (
              state.discardPile.slice().reverse().map((move) => (
                <div key={`${move.sequence}-${move.playerId}`} className="rounded-lg bg-neutral-950 border border-neutral-800 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-white">{playerName(move.playerId)}</span>
                    <span className="text-xs text-neutral-500">#{move.sequence}</span>
                  </div>
                  {move.type === "PASS" ? (
                    <div className="text-neutral-400 text-sm">PASS</div>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {move.cards.map((card) => (
                        <MiniCard key={card.id} card={card} />
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}

function Badge({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-1.5 text-neutral-200">
      <span className="text-neutral-500">{icon}</span>
      {children}
    </div>
  );
}

function PlayerSeat({ seat }: { seat: SeatView }) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-neutral-900 p-4",
        seat.isTurn ? "border-emerald-500/60 shadow-lg shadow-emerald-500/10" : "border-neutral-800",
        seat.isMe && "bg-indigo-950/30",
      )}
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <div className={cn("font-bold", seat.isMe ? "text-indigo-300" : "text-white")}>
            {seat.name}
            {seat.isMe && "（我）"}
          </div>
          <div className="text-xs text-neutral-500 font-mono">{seat.id.slice(0, 8)}</div>
        </div>
        {seat.isTurn && <Check className="w-5 h-5 text-emerald-400" />}
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-neutral-400">{seat.status}</span>
        <span className="text-amber-300 font-mono">{seat.score} 分</span>
      </div>
      <CardBackStack count={seat.handCount} />
    </div>
  );
}

function CenterDesk({
  state,
  playerName,
}: {
  state: EngineGameState | null;
  playerName: (playerId: string) => string;
}) {
  if (!state) {
    return (
      <div className="text-center">
        <Users className="w-12 h-12 mx-auto text-neutral-700 mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">等待玩家加入</h2>
        <p className="text-neutral-500">2 名玩家入座后会生成初始 GameState。</p>
      </div>
    );
  }

  if (state.gameStatus === "finished") {
    return (
      <div className="w-full max-w-xl rounded-lg border border-amber-500/30 bg-amber-500/10 p-8 text-center">
        <Trophy className="w-12 h-12 text-amber-300 mx-auto mb-4" />
        <h2 className="text-3xl font-black text-white mb-2">本局结束</h2>
        <p className="text-neutral-300">赢家：{state.winner ? playerName(state.winner) : "未记录"}</p>
        {state.lastScoreDelta && (
          <div className="grid grid-cols-2 gap-2 mt-6">
            {Object.entries(state.lastScoreDelta).map(([playerId, score]) => (
              <div key={playerId} className="rounded-md bg-neutral-950/70 p-3 flex justify-between">
                <span className="text-neutral-300">{playerName(playerId)}</span>
                <span className={score >= 0 ? "text-emerald-300" : "text-red-300"}>{score}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  const lastMove = state.lastMove;

  return (
    <div className="w-full max-w-2xl text-center">
      <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900 px-4 py-2 text-sm text-neutral-300">
        <span>第 {state.round} 轮</span>
        <span className="text-neutral-600">·</span>
        <span>连续 PASS {state.passCount}</span>
      </div>

      <div className="min-h-48 rounded-lg border border-neutral-800 bg-neutral-900/80 p-6 flex flex-col items-center justify-center">
        {!lastMove ? (
          <div>
            <div className="text-2xl font-bold text-white mb-2">等待首手</div>
            <div className="text-sm text-neutral-500">
              需要出牌：{state.firstPlayRequirement.ownerId ? playerName(state.firstPlayRequirement.ownerId) : "任意玩家"}
            </div>
          </div>
        ) : (
          <>
            <div className="text-sm text-neutral-500 mb-3">
              上手：{playerName(lastMove.playerId)}
              {lastMove.combo && ` · ${comboNames[lastMove.combo.type]}`}
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {lastMove.cards.map((card) => (
                <PlayingCard key={card.id} card={card} selected={false} disabled />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function PlayingCard({
  card,
  selected,
  disabled,
  onClick,
}: {
  card: Card;
  selected: boolean;
  disabled: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-20 h-28 shrink-0 rounded-lg border-2 bg-white p-2 text-left shadow-lg transition-transform",
        selected ? "-translate-y-4 border-indigo-500 shadow-indigo-500/30" : "border-neutral-200",
        disabled ? "cursor-default" : "hover:-translate-y-3",
      )}
    >
      <div className={cn("text-xl font-black leading-none", isRedCard(card) ? "text-red-600" : "text-neutral-950")}>
        {card.rank}
      </div>
      <div className={cn("text-3xl leading-none mt-1", isRedCard(card) ? "text-red-600" : "text-neutral-950")}>
        {formatCard(card).slice(-1)}
      </div>
    </button>
  );
}

function MiniCard({ card }: { card: Card }) {
  return (
    <span
      className={cn(
        "inline-flex min-w-9 items-center justify-center rounded bg-white px-2 py-1 text-xs font-black",
        isRedCard(card) ? "text-red-600" : "text-neutral-950",
      )}
    >
      {formatCard(card)}
    </span>
  );
}

function CardBackStack({ count }: { count: number }) {
  return (
    <div className="mt-4 flex items-center gap-2">
      <div className="flex -space-x-3">
        {Array.from({ length: Math.min(count, 5) }).map((_, index) => (
          <div key={index} className="w-7 h-10 rounded border border-indigo-400/30 bg-indigo-600/20" />
        ))}
      </div>
      <span className="text-xs text-neutral-500">{count} 张</span>
    </div>
  );
}
