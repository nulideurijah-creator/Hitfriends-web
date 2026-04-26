import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { Loader2, Play, Plus, Users } from "lucide-react";
import { createRoom } from "../../lib/gameRoomService";
import { getLocalPlayerIdentity } from "../../lib/playerIdentity";
import { isSupabaseConfigured } from "../../lib/supabase";

export function Home() {
  const navigate = useNavigate();
  const [roomId, setRoomId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleCreate() {
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

  function handleJoin(event: FormEvent) {
    event.preventDefault();
    const normalized = roomId.trim().toUpperCase();
    if (normalized) navigate(`/room/${normalized}`);
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <section className="min-h-[52vh] flex flex-col justify-center">
        <p className="text-indigo-300 font-semibold mb-4">网页联机版</p>
        <h1 className="text-5xl sm:text-6xl font-black tracking-tight text-white mb-5">打朋友</h1>
        <p className="max-w-2xl text-neutral-400 text-lg mb-8">
          一个由 Supabase 共享 GameState、由标准规则引擎驱动的 2-4 人实时纸牌对局。
        </p>

        {!isSupabaseConfigured && (
          <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-amber-200 text-sm">
            请先复制 .env.example 为 .env.local，并填入 Supabase URL 与 anon key。
          </div>
        )}

        {message && (
          <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-200 text-sm">
            {message}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-4 mb-10">
          <button
            onClick={handleCreate}
            disabled={busy || !isSupabaseConfigured}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 font-bold text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            创建房间
          </button>
          <Link
            to="/lobby"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-neutral-800 px-6 py-3 font-bold text-white hover:bg-neutral-700"
          >
            <Users className="w-4 h-4" />
            查看大厅
          </Link>
        </div>

        <form onSubmit={handleJoin} className="flex max-w-md gap-2">
          <input
            value={roomId}
            onChange={(event) => setRoomId(event.target.value)}
            placeholder="输入房间号"
            className="flex-1 rounded-lg border border-neutral-800 bg-neutral-950 px-4 py-3 text-white outline-none focus:border-indigo-500"
          />
          <button className="rounded-lg bg-neutral-800 px-5 py-3 font-bold text-white hover:bg-neutral-700">
            <Play className="w-4 h-4" />
          </button>
        </form>
      </section>
    </div>
  );
}
