import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { Loader2, Medal, Trophy, Users } from "lucide-react";
import { getSupabaseClient, isSupabaseConfigured } from "../../lib/supabase";
import { useAuth } from "../context/AuthContext";

type ProfileRow = {
  id: string;
  nickname: string;
  avatar_url: string | null;
  score: number;
  games_played: number;
  wins: number;
  best_single_score: number;
  updated_at?: string;
};

export function Leaderboard() {
  const { user } = useAuth();
  const [players, setPlayers] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!isSupabaseConfigured) {
        setLoading(false);
        setMessage("Supabase 未配置，暂时无法读取排行榜。");
        return;
      }

      try {
        const { data, error } = await getSupabaseClient()
          .from("profiles")
          .select("id, nickname, avatar_url, score, games_played, wins, best_single_score, updated_at")
          .order("score", { ascending: false })
          .order("wins", { ascending: false })
          .limit(100);
        if (error) throw error;
        setPlayers((data ?? []) as ProfileRow[]);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "排行榜读取失败。");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const myRank = useMemo(() => {
    if (!user) return null;
    const index = players.findIndex((player) => player.id === user.id);
    return index >= 0 ? index + 1 : null;
  }, [players, user]);

  const topThree = players.slice(0, 3);
  const rest = players.slice(3);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-10 text-center">
        <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-xl bg-amber-400/10 text-amber-300">
          <Trophy className="h-8 w-8" />
        </div>
        <h1 className="text-4xl font-black text-white">全服积分榜</h1>
        <p className="mt-2 text-neutral-400">开服以来累计积分排名，看看谁最吊。</p>
      </div>

      {message && <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">{message}</div>}

      {loading ? (
        <div className="flex flex-col items-center py-24 text-neutral-500">
          <Loader2 className="mb-4 h-8 w-8 animate-spin text-indigo-400" />
          正在读取排行榜
        </div>
      ) : players.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 bg-neutral-950/60 p-12 text-center">
          <Users className="mx-auto mb-4 h-10 w-10 text-neutral-600" />
          <p className="font-bold text-neutral-300">暂无排名</p>
          <p className="mt-2 text-sm text-neutral-500">完成一局对战后就会上榜。</p>
        </div>
      ) : (
        <>
          <div className="mb-10 grid gap-4 md:grid-cols-3">
            {topThree.map((player, index) => (
              <TopCard key={player.id} player={player} rank={index + 1} />
            ))}
          </div>

          <div className="mb-8 rounded-xl border border-indigo-400/20 bg-indigo-400/10 p-5">
            {user ? (
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                  <div className="text-sm font-bold text-indigo-200">我的排名</div>
                  <div className="mt-1 text-xl font-black text-white">
                    {myRank ? `#${myRank}` : "暂未上榜"} · {user.nickname}
                  </div>
                </div>
                <div className="text-3xl font-black text-amber-300">{user.score} 分</div>
              </div>
            ) : (
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                  <div className="font-black text-white">登录后查看你的排名</div>
                  <div className="mt-1 text-sm text-neutral-400">参与对局，赢取积分。</div>
                </div>
                <Link to="/login" className="rounded-lg bg-indigo-600 px-5 py-2 font-black text-white">
                  去登录
                </Link>
              </div>
            )}
          </div>

          <div className="overflow-hidden rounded-xl border border-white/10 bg-neutral-950/70">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.03] text-sm text-neutral-400">
                  <th className="w-24 px-6 py-4 font-bold">排名</th>
                  <th className="px-6 py-4 font-bold">玩家</th>
                  <th className="px-6 py-4 text-right font-bold">累计积分</th>
                  <th className="hidden px-6 py-4 text-center font-bold md:table-cell">总局数</th>
                  <th className="hidden px-6 py-4 text-center font-bold md:table-cell">胜率</th>
                  <th className="hidden px-6 py-4 text-right font-bold sm:table-cell">最佳单局</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {rest.map((player, index) => (
                  <PlayerRow key={player.id} player={player} rank={index + 4} />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function TopCard({ player, rank }: { player: ProfileRow; rank: number }) {
  const colors = rank === 1 ? "border-amber-400/40 bg-amber-400/10" : rank === 2 ? "border-slate-300/30 bg-slate-300/10" : "border-orange-400/30 bg-orange-400/10";
  return (
    <div className={`rounded-xl border p-5 text-center ${colors}`}>
      <Medal className="mx-auto mb-3 h-8 w-8 text-amber-300" />
      <div className="text-sm font-black text-neutral-400">#{rank}</div>
      <div className="mt-2 truncate text-xl font-black text-white">{player.nickname}</div>
      <div className="mt-3 text-3xl font-black text-amber-300">{player.score}</div>
      <div className="mt-2 text-sm text-neutral-400">
        {player.games_played} 局 · 胜率 {winRate(player)}
      </div>
    </div>
  );
}

function PlayerRow({ player, rank }: { player: ProfileRow; rank: number }) {
  return (
    <tr className="hover:bg-white/[0.03]">
      <td className="px-6 py-4 font-mono font-bold text-neutral-500">#{rank}</td>
      <td className="px-6 py-4">
        <div className="font-bold text-neutral-200">{player.nickname}</div>
      </td>
      <td className="px-6 py-4 text-right font-mono font-black text-amber-300">{player.score}</td>
      <td className="hidden px-6 py-4 text-center text-neutral-400 md:table-cell">{player.games_played}</td>
      <td className="hidden px-6 py-4 text-center text-neutral-400 md:table-cell">{winRate(player)}</td>
      <td className="hidden px-6 py-4 text-right text-neutral-400 sm:table-cell">{player.best_single_score}</td>
    </tr>
  );
}

function winRate(player: ProfileRow) {
  if (!player.games_played) return "0%";
  return `${Math.round((player.wins / player.games_played) * 100)}%`;
}
