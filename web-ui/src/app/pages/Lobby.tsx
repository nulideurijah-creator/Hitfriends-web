import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { Loader2, Plus, RefreshCw, Search, Trophy, Users } from "lucide-react";
import type { GameRoom, RoomPhase } from "../../lib/gameRoomService";
import { createRoom, listRooms } from "../../lib/gameRoomService";
import { isSupabaseConfigured } from "../../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { cn } from "../../lib/utils";

const phaseLabels: Record<RoomPhase, string> = {
  waiting_ready: "等待准备",
  swap_vote: "换牌投票",
  swap_select: "换牌选择",
  bomb_vote: "拍炸投票",
  bomb_conflict: "抢拍中",
  playing: "出牌中",
  finished: "已结算",
};

export function Lobby() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [rooms, setRooms] = useState<GameRoom[]>([]);
  const [roomId, setRoomId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function refreshRooms() {
    if (!isSupabaseConfigured) {
      setLoading(false);
      setMessage("请先配置 Supabase 环境变量。");
      return;
    }

    try {
      const nextRooms = await listRooms();
      setRooms(nextRooms);
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "读取房间列表失败。");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateRoom() {
    if (!user) {
      navigate("/login?redirect=/lobby");
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      const room = await createRoom({
        id: user.id,
        name: user.nickname,
        createdAt: user.createdAt,
        score: user.score,
        avatarUrl: user.avatar,
      });
      navigate(`/room/${room.id}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "创建房间失败。");
    } finally {
      setBusy(false);
    }
  }

  function handleJoinById(event: FormEvent) {
    event.preventDefault();
    const normalized = roomId.trim().toUpperCase();
    if (normalized) navigate(`/room/${normalized}`);
  }

  useEffect(() => {
    refreshRooms();
    const interval = window.setInterval(refreshRooms, 2000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-8 grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="rounded-xl border border-white/10 bg-[#0b1110]/80 p-6 shadow-xl shadow-black/20">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <p className="mb-2 text-sm font-bold text-[#d8b65a]">GAME LOBBY</p>
              <h1 className="text-4xl font-black text-white">游戏大厅</h1>
              <p className="mt-2 text-neutral-400">创建房间、输入房号进入，再选择入座或观战。</p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-end">
              <form onSubmit={handleJoinById} className="relative shrink-0">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
                <input
                  value={roomId}
                  onChange={(event) => setRoomId(event.target.value)}
                  placeholder="房间号"
                  className="w-56 rounded-lg border border-white/10 bg-neutral-950 py-2.5 pl-9 pr-4 text-white outline-none focus:border-[#d8b65a]"
                />
              </form>
              <button
                onClick={refreshRooms}
                disabled={loading}
                className="inline-flex min-w-[96px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-white/10 bg-white/[0.05] px-4 py-2.5 font-bold text-neutral-100 hover:bg-white/[0.1] disabled:opacity-50"
              >
                <RefreshCw className="h-4 w-4" />
                刷新
              </button>
              <button
                onClick={handleCreateRoom}
                disabled={busy || !isSupabaseConfigured}
                className="inline-flex min-w-[132px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-[#2f8fbf] px-5 py-2.5 font-black text-white shadow-lg shadow-black/20 hover:bg-[#3aa6d7] disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                创建房间
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[#d8b65a]/25 bg-[#d8b65a]/10 p-6">
          <div className="mb-2 flex items-center gap-2 text-amber-200">
            <Trophy className="h-5 w-5" />
            <span className="font-black">全服榜入口</span>
          </div>
          <p className="mb-4 text-sm leading-6 text-amber-100/70">每局结算后积分会进入开服累计榜，看看谁最吊。</p>
          <Link to="/leaderboard" className="inline-flex whitespace-nowrap rounded-lg bg-[#d8b65a] px-4 py-2 text-sm font-black text-neutral-950">
            查看排行榜
          </Link>
        </div>
      </div>

      {message && <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">{message}</div>}

      {loading ? (
        <div className="flex flex-col items-center py-24 text-neutral-500">
          <Loader2 className="mb-4 h-8 w-8 animate-spin text-indigo-400" />
          正在同步大厅
        </div>
      ) : rooms.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 bg-neutral-950/50 p-12 text-center text-neutral-400">
          还没有房间，先开一桌。
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {rooms.map((room) => (
            <RoomCard key={room.id} room={room} />
          ))}
        </div>
      )}
    </div>
  );
}

function RoomCard({ room }: { room: GameRoom }) {
  const canJoin = room.phase === "waiting_ready" && room.players.length < 4;
  return (
    <div className="rounded-xl border border-white/10 bg-[#0b1110]/78 p-5 shadow-xl shadow-black/10">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-white">房间 {room.id}</h2>
          <p className="mt-1 text-xs font-mono text-neutral-500">version {room.version}</p>
        </div>
        <span
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-black",
            room.phase === "waiting_ready"
              ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
            : room.phase === "playing"
                ? "border-sky-400/30 bg-sky-400/10 text-sky-200"
                : "border-amber-400/30 bg-amber-400/10 text-amber-200",
          )}
        >
          {phaseLabels[room.phase]}
        </span>
      </div>

      <div className="mb-5 flex items-center gap-2 text-sm text-neutral-300">
        <Users className="h-4 w-4 text-neutral-500" />
        <span>{room.players.length}/4 玩家</span>
        {room.state?.winner && <span className="text-amber-300">赢家 {room.state.winner.slice(0, 6)}</span>}
      </div>

      <div className="mb-5 space-y-2">
        {room.players.map((player) => (
          <div key={player.id} className="flex justify-between rounded-lg bg-white/[0.04] px-3 py-2 text-sm">
            <span className="text-neutral-200">
              {player.name}
              {player.isHost && <span className="ml-2 text-xs text-amber-300">房主</span>}
            </span>
            <span className="font-mono text-neutral-500">{player.ready ? "已准备" : `${player.multiplier}x`}</span>
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <Link
          to={`/room/${room.id}`}
          className="flex-1 whitespace-nowrap rounded-lg border border-sky-400/30 bg-sky-500/15 py-2 text-center text-sm font-black text-sky-100 hover:bg-sky-500/25"
        >
          {canJoin ? "进入房间" : "进入观战"}
        </Link>
      </div>
    </div>
  );
}
