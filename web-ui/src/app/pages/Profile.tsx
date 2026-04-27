import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { Camera, Edit3, History, Loader2, LogOut, Settings, Shield, Trophy } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { fetchPlayerSettlementRecords, type PlayerSettlementRecord, type RoomMode } from "../../lib/gameRoomService";

export function Profile() {
  const { user, loading, signOut, updateAvatar, updateNickname } = useAuth();
  const navigate = useNavigate();
  const [nickname, setNickname] = useState(user?.nickname ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [settlements, setSettlements] = useState<PlayerSettlementRecord[]>([]);
  const [settlementMode, setSettlementMode] = useState<RoomMode>("casual");
  const [settlementsLoading, setSettlementsLoading] = useState(false);
  const [settlementsError, setSettlementsError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.nickname) setNickname(user.nickname);
  }, [user?.nickname]);

  useEffect(() => {
    let cancelled = false;
    async function loadSettlements() {
      if (!user?.id) {
        setSettlements([]);
        return;
      }
      setSettlementsLoading(true);
      setSettlementsError(null);
      try {
        const records = await fetchPlayerSettlementRecords(user.id, settlementMode);
        if (!cancelled) setSettlements(records);
      } catch (error) {
        if (!cancelled) setSettlementsError(error instanceof Error ? error.message : "房间积分记录加载失败。");
      } finally {
        if (!cancelled) setSettlementsLoading(false);
      }
    }
    loadSettlements();
    return () => {
      cancelled = true;
    };
  }, [settlementMode, user?.id]);

  async function handleLogout() {
    await signOut();
    navigate("/");
  }

  async function handleNickname(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      await updateNickname(nickname);
      setMessage("昵称已更新。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "更新失败。");
    } finally {
      setBusy(false);
    }
  }

  async function handleAvatarUpload(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setMessage(null);
    try {
      await updateAvatar(file);
      setMessage("头像已更新。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "头像上传失败，请确认 Supabase Storage 已配置。");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-6 py-16 text-center">
        <h1 className="text-3xl font-black text-white">请先登录</h1>
        <p className="mt-2 text-neutral-400">登录后可以查看个人积分、胜率和账号设置。</p>
        <Link to="/login?redirect=/profile" className="mt-6 inline-flex rounded-lg bg-indigo-600 px-5 py-3 font-black text-white">
          去登录
        </Link>
      </div>
    );
  }

  const winRate = user.gamesPlayed ? Math.round((user.wins / user.gamesPlayed) * 100) : 0;

  return (
    <div className="mx-auto grid max-w-5xl gap-6 px-6 py-10 lg:grid-cols-[280px_1fr]">
      <aside className="rounded-xl border border-white/10 bg-neutral-950/70 p-6 text-center">
        <label className="group relative mx-auto mb-4 flex h-28 w-28 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-indigo-400/30 bg-indigo-400/10 text-3xl font-black text-indigo-200">
          <img src={user.avatar} alt={user.nickname} className="h-full w-full object-cover" />
          <span className="absolute inset-0 hidden items-center justify-center bg-black/55 text-white group-hover:flex">
            <Camera className="h-7 w-7" />
          </span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="sr-only"
            onChange={(event) => handleAvatarUpload(event.target.files?.[0])}
          />
        </label>
        <h2 className="text-2xl font-black text-white">{user.nickname}</h2>
        <p className="mt-1 break-all text-xs font-mono text-neutral-500">{user.email}</p>
        <div className="mt-5 rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-sm font-bold text-emerald-200">
          <Shield className="mr-1 inline h-4 w-4" />
          Supabase Auth
        </div>
      </aside>

      <main className="space-y-6">
        <section className="rounded-xl border border-white/10 bg-neutral-950/70 p-6">
          <h3 className="mb-5 flex items-center gap-2 text-xl font-black text-white">
            <Trophy className="h-5 w-5 text-amber-300" />
            生涯统计
          </h3>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Stat label="累计积分" value={user.score} tone="amber" />
            <Stat label="总局数" value={user.gamesPlayed} />
            <Stat label="胜局" value={user.wins} tone="emerald" />
            <Stat label="胜率" value={`${winRate}%`} />
          </div>
        </section>

        <section className="rounded-xl border border-white/10 bg-neutral-950/70 p-6">
          <h3 className="mb-5 flex items-center gap-2 text-xl font-black text-white">
            <History className="h-5 w-5 text-indigo-300" />
            特色数据
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <InfoRow label="最佳单局得分" value={user.bestSingleScore} />
            <InfoRow label="注册时间" value={new Date(user.createdAt).toLocaleDateString()} />
          </div>
        </section>

        <section className="rounded-xl border border-white/10 bg-neutral-950/70 p-6">
          <h3 className="mb-5 flex items-center gap-2 text-xl font-black text-white">
            <History className="h-5 w-5 text-amber-300" />
            房间积分记录
          </h3>
          <div className="mb-5 inline-flex rounded-lg border border-white/10 bg-neutral-950 p-1">
            <button
              type="button"
              onClick={() => setSettlementMode("casual")}
              className={`rounded-md px-4 py-2 text-sm font-black ${settlementMode === "casual" ? "bg-[#d8b65a] text-neutral-950" : "text-neutral-300 hover:bg-white/[0.06]"}`}
            >
              休闲模式
            </button>
            <button
              type="button"
              onClick={() => setSettlementMode("ladder")}
              className={`rounded-md px-4 py-2 text-sm font-black ${settlementMode === "ladder" ? "bg-[#d8b65a] text-neutral-950" : "text-neutral-300 hover:bg-white/[0.06]"}`}
            >
              天梯模式
            </button>
          </div>
          {settlementsLoading ? (
            <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 text-neutral-300">
              <Loader2 className="h-4 w-4 animate-spin" />
              正在加载记录
            </div>
          ) : settlementsError ? (
            <div className="rounded-lg border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">{settlementsError}</div>
          ) : settlements.length === 0 ? (
            <div className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-neutral-400">暂无房间结算记录。</div>
          ) : (
            <div className="space-y-3">
              {settlements.map((record) => {
                const self = record.participants.find((player) => player.id === user.id);
                const winner = record.participants.find((player) => player.id === record.winner_id);
                return (
                  <div key={record.id} className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="font-black text-white">
                          房间 {record.room_id}
                          <span className="ml-2 rounded-full bg-[#d8b65a]/15 px-2 py-0.5 text-xs text-[#f0d58b]">
                            {record.mode === "ladder" ? "天梯" : "休闲"}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-neutral-500">
                          {new Date(record.settled_at).toLocaleString()} · {record.participants.length} 人局 · {record.score_history.length} 局
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-neutral-500">本次结算积分</div>
                        <div className={`text-xl font-black ${Number(self?.score ?? 0) >= 0 ? "text-amber-300" : "text-red-300"}`}>
                          {self?.score ?? 0}
                        </div>
                      </div>
                    </div>
                    <div className="mb-3 flex flex-wrap gap-2 text-xs text-neutral-300">
                      {record.participants.map((participant) => (
                        <span key={participant.id} className="rounded-full bg-black/25 px-2 py-1">
                          {participant.name} 最终 {participant.score} ({formatSigned(participant.lastDelta)})
                        </span>
                      ))}
                    </div>
                    <div className="text-xs text-neutral-500">最近赢家：{winner?.name ?? "未记录"}</div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-white/10 bg-neutral-950/70 p-6">
          <h3 className="mb-5 flex items-center gap-2 text-xl font-black text-white">
            <Settings className="h-5 w-5 text-indigo-300" />
            账号设置
          </h3>
          {message && <div className="mb-4 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">{message}</div>}
          <form onSubmit={handleNickname} className="flex flex-col gap-3 sm:flex-row">
            <input
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-white/10 bg-neutral-950 px-4 py-3 text-white outline-none focus:border-indigo-400"
              placeholder="修改昵称"
            />
            <button disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 py-3 font-black text-white disabled:opacity-50">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Edit3 className="h-4 w-4" />}
              保存
            </button>
          </form>

          <button
            onClick={handleLogout}
            className="mt-6 inline-flex items-center gap-2 rounded-lg border border-red-400/30 bg-red-400/10 px-5 py-3 font-black text-red-200"
          >
            <LogOut className="h-4 w-4" />
            退出登录
          </button>
        </section>
      </main>
    </div>
  );
}

function Stat({ label, value, tone = "neutral" }: { label: string; value: string | number; tone?: "neutral" | "amber" | "emerald" }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4 text-center">
      <div className="text-sm text-neutral-500">{label}</div>
      <div className={`mt-2 text-2xl font-black ${tone === "amber" ? "text-amber-300" : tone === "emerald" ? "text-emerald-300" : "text-white"}`}>
        {value}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3">
      <span className="text-neutral-400">{label}</span>
      <span className="font-black text-white">{value}</span>
    </div>
  );
}

function formatSigned(value: number) {
  return value > 0 ? `+${value}` : `${value}`;
}
