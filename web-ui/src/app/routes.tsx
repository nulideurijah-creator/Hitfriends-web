import { createHashRouter, Link } from "react-router";
import type { ReactNode } from "react";
import { RootLayout } from "./layouts/RootLayout";
import { Home } from "./pages/Home";
import { Lobby } from "./pages/Lobby";
import { Room } from "./pages/Room";

export const router = createHashRouter([
  {
    path: "/",
    Component: RootLayout,
    children: [
      { index: true, Component: Home },
      { path: "lobby", Component: Lobby },
      { path: "room/:id", Component: Room },
      { path: "rules", Component: RulesPage },
      { path: "leaderboard", Component: LeaderboardPage },
      { path: "login", Component: Home },
      { path: "register", Component: Home },
      { path: "profile", Component: Home },
    ],
  },
]);

function RulesPage() {
  return (
    <SimplePage title="规则">
      <p>当前最小版本已接入标准规则引擎，出牌、PASS、首手限制、胜利判断都通过 nextState 执行。</p>
      <p>完整规则文档在项目根目录的 GAME_RULES_IMPLEMENTATION.md 和 STANDARD_RULE_ENGINE.md。</p>
    </SimplePage>
  );
}

function LeaderboardPage() {
  return (
    <SimplePage title="全服榜">
      <p>积分榜页面会在接入玩家积分表后展示。当前房间结算分数已保存在 GameState.lastScoreDelta。</p>
    </SimplePage>
  );
}

function SimplePage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold text-white mb-4">{title}</h1>
      <div className="space-y-3 rounded-lg border border-neutral-800 bg-neutral-900 p-6 text-neutral-300">{children}</div>
      <Link to="/lobby" className="inline-block mt-6 rounded-lg bg-indigo-600 px-5 py-2.5 font-bold text-white">
        返回大厅
      </Link>
    </div>
  );
}
