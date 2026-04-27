import { Link, NavLink, useNavigate } from "react-router";
import type { ReactNode } from "react";
import { Crown, LogOut, Play, User } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { cn } from "../../lib/utils";
import { DonationButton } from "./DonationButton";

export function Navbar() {
  const navigate = useNavigate();
  const { user, loading, signOut } = useAuth();

  async function handleSignOut() {
    await signOut();
    navigate("/");
  }

  return (
    <nav className="sticky top-0 z-50 h-16 border-b border-white/10 bg-neutral-950/90 px-3 backdrop-blur sm:px-6">
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-4 lg:gap-8">
          <Link to="/" className="flex items-center gap-2 text-xl font-black tracking-wide text-white">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-lg shadow-indigo-600/20">
              <Play className="h-5 w-5 fill-current" />
            </span>
            <span className="whitespace-nowrap">打朋友</span>
          </Link>
          <div className="hidden items-center gap-1 md:flex">
            <NavItem to="/lobby">大厅</NavItem>
            <NavItem to="/rules">规则</NavItem>
            <NavItem to="/leaderboard">全服榜</NavItem>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 text-sm sm:gap-3">
          {loading ? (
            <div className="h-9 w-28 animate-pulse rounded-lg bg-white/5" />
          ) : user ? (
            <>
              <DonationButton compact className="px-2.5 py-2 text-xs sm:px-3 sm:text-sm" />
              <Link
                to="/profile"
                className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2 text-neutral-200 hover:bg-white/[0.08] sm:gap-3 sm:px-3"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-indigo-500/15 text-indigo-300">
                  <User className="h-4 w-4" />
                </span>
                <span className="hidden leading-tight sm:block">
                  <span className="block font-bold text-white">{user.nickname}</span>
                  <span className="block text-xs font-mono text-amber-300">{user.score} 分</span>
                </span>
                <Crown className="hidden h-4 w-4 text-amber-400 sm:block" />
              </Link>
              <button
                onClick={handleSignOut}
                className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2 text-neutral-300 hover:bg-white/[0.08] hover:text-white sm:px-3"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">退出</span>
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-neutral-300 hover:bg-white/[0.08] hover:text-white"
              >
                登录
              </Link>
              <Link to="/register" className="rounded-lg bg-indigo-600 px-3 py-2 font-bold text-white hover:bg-indigo-500">
                注册
              </Link>
            </>
          )}
        </div>
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
          "rounded-lg px-4 py-2 text-sm font-bold transition-colors",
          isActive ? "bg-white/10 text-white" : "text-neutral-400 hover:bg-white/[0.06] hover:text-neutral-200",
        )
      }
    >
      {children}
    </NavLink>
  );
}
