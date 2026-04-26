import { Link, NavLink } from "react-router";
import type { ReactNode } from "react";
import { Crown, Play, User } from "lucide-react";
import { getLocalPlayerIdentity } from "../../lib/playerIdentity";
import { cn } from "../../lib/utils";

export function Navbar() {
  const player = getLocalPlayerIdentity();

  return (
    <nav className="h-16 border-b border-neutral-800 bg-neutral-950 px-6 flex items-center justify-between sticky top-0 z-50">
      <div className="flex items-center gap-8">
        <Link to="/" className="flex items-center gap-2 text-indigo-400 font-bold text-xl tracking-wide">
          <Play className="w-6 h-6 fill-current" />
          <span>打朋友</span>
        </Link>
        <div className="flex items-center gap-1">
          <NavItem to="/lobby">大厅</NavItem>
          <NavItem to="/rules">规则</NavItem>
          <NavItem to="/leaderboard">全服榜</NavItem>
        </div>
      </div>

      <div className="flex items-center gap-3 text-sm">
        <div className="w-8 h-8 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center">
          <User className="w-4 h-4 text-neutral-300" />
        </div>
        <div className="leading-tight">
          <div className="text-white font-medium">{player.name}</div>
          <div className="text-neutral-500 font-mono text-[11px]">{player.id.slice(0, 8)}</div>
        </div>
        <Crown className="w-4 h-4 text-amber-400" />
      </div>
    </nav>
  );
}

function NavItem({ to, children }: { to: string; children: ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "px-4 py-2 rounded-md text-sm font-medium transition-colors",
          isActive ? "bg-neutral-800 text-white" : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50",
        )
      }
    >
      {children}
    </NavLink>
  );
}
