import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowRight, Eye, Loader2, Play, Plus, Trophy, Users } from "lucide-react";
import { createRoom } from "../../lib/gameRoomService";
import { isSupabaseConfigured } from "../../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { DonationButton } from "../components/DonationButton";

export function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [roomId, setRoomId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleCreate() {
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

  function handleJoin(event: FormEvent) {
    event.preventDefault();
    const normalized = roomId.trim().toUpperCase();
    if (normalized) navigate(`/room/${normalized}`);
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[radial-gradient(circle_at_top_left,rgba(216,182,90,0.14)_0%,#101816_36%,#070a0a_100%)]">
      <section className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl grid-cols-1 items-center gap-10 px-4 py-8 sm:px-6 sm:py-10 lg:grid-cols-[1fr_420px]">
        <div>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm font-bold text-emerald-100">
            <Users className="h-4 w-4" />
            2-4 人实时联机 · 支持观战聊天
          </div>
          <h1 className="max-w-3xl text-5xl font-black leading-tight tracking-normal text-white sm:text-6xl md:text-7xl">
            打朋友
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-neutral-300">
            熟人开房、换牌博弈、拍炸抢拍、全服积分榜。所有对局状态由 Supabase 同步，出牌规则由标准引擎统一裁决。
          </p>

          {!isSupabaseConfigured && (
            <div className="mt-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
              请先配置 Supabase 环境变量后再创建或加入房间。
            </div>
          )}

          {message && <div className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{message}</div>}

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <button
              onClick={handleCreate}
              disabled={busy || !isSupabaseConfigured}
              className="inline-flex min-w-[132px] items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-[#2f8fbf] px-6 py-3 font-black text-white shadow-xl shadow-black/20 hover:bg-[#3aa6d7] disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              创建房间
            </button>
            <Link
              to="/lobby"
              className="inline-flex min-w-[132px] items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-white/10 bg-white/[0.06] px-6 py-3 font-black text-white hover:bg-white/[0.1]"
            >
              <Play className="h-4 w-4" />
              进入大厅
            </Link>
            <DonationButton />
          </div>

          <form onSubmit={handleJoin} className="mt-8 flex max-w-md gap-2">
            <input
              value={roomId}
              onChange={(event) => setRoomId(event.target.value)}
              placeholder="输入房间号"
              className="min-w-0 flex-1 rounded-lg border border-white/10 bg-neutral-950/80 px-4 py-3 text-white outline-none focus:border-[#d8b65a]"
            />
            <button className="inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-lg bg-white px-5 py-3 font-black text-neutral-950 hover:bg-neutral-200">
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#0b1110]/76 p-5 shadow-2xl shadow-black/40 backdrop-blur">
          <div className="rounded-lg border border-[#d8b65a]/20 bg-white/[0.04] p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-black text-white">快速入口</h2>
              <Trophy className="h-5 w-5 text-amber-300" />
            </div>
            <div className="grid gap-3">
              <QuickLink icon={<Users className="h-5 w-5" />} title="坐下打牌" desc="登录后创建或加入房间" to="/lobby" />
              <QuickLink icon={<Eye className="h-5 w-5" />} title="观战聊天" desc="进入房间旁观公共牌桌" to="/lobby" />
              <QuickLink icon={<Trophy className="h-5 w-5" />} title="冲全服榜" desc="开服以来累计积分排名" to="/leaderboard" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function QuickLink({ icon, title, desc, to }: { icon: ReactNode; title: string; desc: string; to: string }) {
  return (
    <Link to={to} className="flex items-center gap-3 rounded-lg border border-white/10 bg-neutral-950/70 p-4 hover:bg-white/[0.06]">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white/10 text-[#d8b65a]">{icon}</span>
      <span>
        <span className="block font-black text-white">{title}</span>
        <span className="text-sm text-neutral-400">{desc}</span>
      </span>
    </Link>
  );
}
