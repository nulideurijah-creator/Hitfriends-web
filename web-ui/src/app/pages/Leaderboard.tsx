import { Trophy, Medal, Star, Target, Users, Play, Clock, HelpCircle, FileText, Settings, History } from "lucide-react";
import { Link } from "react-router";
import { useAuth } from "../context/AuthContext";

export function Leaderboard() {
  const { user } = useAuth();
  const mockLeaderboard = Array.from({ length: 20 }, (_, i) => ({
    rank: i + 1,
    id: `u${i}`,
    nickname: `打牌高手_${Math.floor(Math.random() * 1000)}`,
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=user${i}`,
    score: 10000 - i * 350,
    games: 100 + i * 5,
    winRate: (60 - i).toFixed(1) + "%",
    recent: i % 2 === 0 ? "刚刚" : "2小时前",
  }));

  const topThree = mockLeaderboard.slice(0, 3);
  const rest = mockLeaderboard.slice(3);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-extrabold text-white flex items-center justify-center gap-3">
          <Trophy className="w-10 h-10 text-amber-400" />
          全服积分榜
        </h1>
        <p className="text-neutral-400 mt-2">开服以来累计积分排名 • 每日凌晨更新</p>
      </div>

      {/* Top 3 Podiums */}
      <div className="flex justify-center items-end gap-4 mb-16 h-64">
        {/* 2nd Place */}
        <div className="w-48 bg-neutral-900 border border-neutral-800 rounded-t-2xl flex flex-col items-center p-4 relative" style={{ height: '80%' }}>
          <div className="absolute -top-10 w-20 h-20 rounded-full bg-neutral-800 border-4 border-neutral-400 overflow-hidden shadow-lg shadow-neutral-400/20">
            <img src={topThree[1].avatar} alt={topThree[1].nickname} />
          </div>
          <div className="mt-10 font-bold text-neutral-200 truncate w-full text-center">{topThree[1].nickname}</div>
          <div className="text-sm text-neutral-500 mb-2">胜率 {topThree[1].winRate}</div>
          <div className="mt-auto text-xl font-mono font-bold text-neutral-400">{topThree[1].score}</div>
          <div className="text-xs font-bold text-neutral-500 mt-1 uppercase tracking-wider">Rank 2</div>
        </div>

        {/* 1st Place */}
        <div className="w-56 bg-neutral-900 border border-amber-500/30 rounded-t-2xl flex flex-col items-center p-4 relative shadow-2xl shadow-amber-500/10" style={{ height: '100%' }}>
          <div className="absolute -top-6 text-amber-400">
            <Medal className="w-8 h-8 fill-current" />
          </div>
          <div className="absolute -top-12 w-24 h-24 rounded-full bg-neutral-800 border-4 border-amber-400 overflow-hidden shadow-lg shadow-amber-400/30">
            <img src={topThree[0].avatar} alt={topThree[0].nickname} />
          </div>
          <div className="mt-14 font-bold text-white text-lg truncate w-full text-center">{topThree[0].nickname}</div>
          <div className="text-sm text-amber-500/70 mb-2">胜率 {topThree[0].winRate}</div>
          <div className="mt-auto text-3xl font-mono font-extrabold text-amber-400">{topThree[0].score}</div>
          <div className="text-xs font-bold text-amber-500 mt-1 uppercase tracking-wider">Rank 1</div>
        </div>

        {/* 3rd Place */}
        <div className="w-48 bg-neutral-900 border border-neutral-800 rounded-t-2xl flex flex-col items-center p-4 relative" style={{ height: '70%' }}>
          <div className="absolute -top-10 w-20 h-20 rounded-full bg-neutral-800 border-4 border-orange-700 overflow-hidden shadow-lg shadow-orange-700/20">
            <img src={topThree[2].avatar} alt={topThree[2].nickname} />
          </div>
          <div className="mt-10 font-bold text-neutral-200 truncate w-full text-center">{topThree[2].nickname}</div>
          <div className="text-sm text-neutral-500 mb-2">胜率 {topThree[2].winRate}</div>
          <div className="mt-auto text-xl font-mono font-bold text-orange-500">{topThree[2].score}</div>
          <div className="text-xs font-bold text-orange-700 mt-1 uppercase tracking-wider">Rank 3</div>
        </div>
      </div>

      {/* My Rank Card */}
      {user ? (
        <div className="bg-indigo-950/30 border border-indigo-500/20 rounded-xl p-4 mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-500/10 text-indigo-400 font-bold text-xl rounded-lg flex items-center justify-center">
              142
            </div>
            <div>
              <div className="text-sm text-indigo-300 font-medium">我的排名</div>
              <div className="text-white font-bold">{user.nickname}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-mono font-bold text-amber-400">{user.score} <span className="text-sm text-neutral-500 font-sans">分</span></div>
            <div className="text-xs text-neutral-400">距离上一名差 15 分</div>
          </div>
        </div>
      ) : (
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 mb-8 flex flex-col sm:flex-row items-center justify-between text-center sm:text-left gap-4">
          <div>
            <div className="text-white font-medium">登录后查看你的排名</div>
            <div className="text-sm text-neutral-400 mt-1">参与对局，赢取积分，冲击全服前百。</div>
          </div>
          <Link to="/login" className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors">去登录</Link>
        </div>
      )}

      {/* Leaderboard Table */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-neutral-950 border-b border-neutral-800 text-sm text-neutral-400">
                <th className="px-6 py-4 font-medium w-24">排名</th>
                <th className="px-6 py-4 font-medium">玩家</th>
                <th className="px-6 py-4 font-medium text-right">累计积分</th>
                <th className="px-6 py-4 font-medium text-center hidden md:table-cell">总局数</th>
                <th className="px-6 py-4 font-medium text-center hidden md:table-cell">胜率</th>
                <th className="px-6 py-4 font-medium text-right hidden sm:table-cell">最近活跃</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {rest.map((player) => (
                <tr key={player.id} className="hover:bg-neutral-800/50 transition-colors group cursor-pointer">
                  <td className="px-6 py-4 font-mono text-neutral-500 font-medium">
                    #{player.rank}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-neutral-800 overflow-hidden">
                        <img src={player.avatar} alt="avatar" />
                      </div>
                      <span className="font-medium text-neutral-200 group-hover:text-white transition-colors">{player.nickname}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono font-bold text-amber-400 text-right">
                    {player.score}
                  </td>
                  <td className="px-6 py-4 text-center text-neutral-400 hidden md:table-cell">
                    {player.games}
                  </td>
                  <td className="px-6 py-4 text-center text-neutral-400 hidden md:table-cell">
                    {player.winRate}
                  </td>
                  <td className="px-6 py-4 text-sm text-neutral-500 text-right hidden sm:table-cell">
                    {player.recent}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
