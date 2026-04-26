import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { Eye, Loader2, Plus, RefreshCw, Search, Users } from "lucide-react";
import type { GameRoom } from "../../lib/gameRoomService";
import { createRoom, listRooms } from "../../lib/gameRoomService";
import { getLocalPlayerIdentity } from "../../lib/playerIdentity";
import { isSupabaseConfigured } from "../../lib/supabase";

const statusLabels = {
  waiting: "等待中",
  playing: "游戏中",
  finished: "已结束",
} as const;

export function Lobby() {
  const navigate = useNavigate();
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
    setBusy(true);
    setMessage(null);
    try {
      const room = await createRoom(getLocalPlayerIdentity());
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
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">游戏大厅</h1>
          <p className="text-neutral-400">创建房间，或加入一个等待中的对局。</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <form onSubmit={handleJoinById} className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
            <input
              value={roomId}
              onChange={(event) => setRoomId(event.target.value)}
              placeholder="房间号"
              className="w-56 rounded-lg border border-neutral-800 bg-neutral-950 py-2.5 pl-9 pr-4 text-white outline-none focus:border-indigo-500"
            />
          </form>
          <button
            onClick={refreshRooms}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-2.5 text-neutral-200 hover:bg-neutral-800 disabled:opacity-50"
          >
            <RefreshCw className="w-4 h-4" />
            刷新
          </button>
          <button
            onClick={handleCreateRoom}
            disabled={busy || !isSupabaseConfigured}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 font-bold text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            创建房间
          </button>
        </div>
      </div>

      {message && (
        <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-amber-200 text-sm">
          {message}
        </div>
      )}

      {loading ? (
        <div className="py-24 flex flex-col items-center text-neutral-500">
          <Loader2 className="w-8 h-8 animate-spin mb-4 text-indigo-400" />
          正在同步大厅
        </div>
      ) : rooms.length === 0 ? (
        <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-10 text-center text-neutral-400">
          还没有房间，先开一桌。
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {rooms.map((room) => {
            const status = room.state?.gameStatus ?? "waiting";
            const canJoin = status === "waiting" && room.players.length < 4;

            return (
              <div key={room.id} className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <h2 className="font-bold text-white text-lg">房间 {room.id}</h2>
                    <p className="text-xs text-neutral-500 font-mono mt-1">version {room.version}</p>
                  </div>
                  <span className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-bold text-indigo-300">
                    {statusLabels[status]}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-sm text-neutral-300 mb-5">
                  <Users className="w-4 h-4 text-neutral-500" />
                  <span>{room.players.length}/4 玩家</span>
                  {room.state?.winner && <span className="text-amber-300">赢家 {room.state.winner.slice(0, 6)}</span>}
                </div>

                <div className="space-y-2 mb-5">
                  {room.players.map((player) => (
                    <div key={player.id} className="flex justify-between rounded-md bg-neutral-950 px-3 py-2 text-sm">
                      <span className="text-neutral-200">{player.name}</span>
                      <span className="font-mono text-neutral-500">{player.id.slice(0, 8)}</span>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3">
                  <Link
                    to={`/room/${room.id}`}
                    className="flex-1 rounded-lg bg-indigo-600/15 border border-indigo-500/30 py-2 text-center text-sm font-bold text-indigo-300 hover:bg-indigo-600/25"
                  >
                    {canJoin ? "加入" : "进入"}
                  </Link>
                  <Link
                    to={`/room/${room.id}?spectate=true`}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2 text-sm font-bold text-white hover:bg-neutral-700"
                  >
                    <Eye className="w-4 h-4" />
                    观战
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
