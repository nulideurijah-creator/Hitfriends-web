import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router";
import { useAuth } from "../context/AuthContext";
import { LogIn, ArrowRight } from "lucide-react";

export function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError("请输入用户名和密码");
      return;
    }
    // Mock login
    login({
      id: "1",
      username,
      nickname: "游客_" + Math.floor(Math.random() * 1000),
      score: 1200,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
    });
    
    const from = location.state?.from?.pathname || "/lobby";
    navigate(from, { replace: true });
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-neutral-900 p-8 rounded-2xl border border-neutral-800 shadow-2xl">
        <div>
          <div className="mx-auto h-12 w-12 bg-indigo-500/10 text-indigo-400 rounded-xl flex items-center justify-center">
            <LogIn className="w-8 h-8" />
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-white">
            登录打朋友
          </h2>
          <p className="mt-2 text-center text-sm text-neutral-400">
            或{" "}
            <Link to="/register" className="font-medium text-indigo-400 hover:text-indigo-300 transition-colors">
              免费注册账号
            </Link>
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}
          <div className="space-y-4 rounded-md shadow-sm">
            <div>
              <label className="sr-only">用户名</label>
              <input
                type="text"
                required
                className="appearance-none rounded-lg relative block w-full px-4 py-3 border border-neutral-700 bg-neutral-950 placeholder-neutral-500 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-all"
                placeholder="用户名"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div>
              <label className="sr-only">密码</label>
              <input
                type="password"
                required
                className="appearance-none rounded-lg relative block w-full px-4 py-3 border border-neutral-700 bg-neutral-950 placeholder-neutral-500 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-all"
                placeholder="密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-bold rounded-lg text-white bg-indigo-600 hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 focus:ring-offset-neutral-900 transition-all shadow-lg shadow-indigo-500/25"
            >
              登 录
              <span className="absolute right-0 inset-y-0 flex items-center pr-3">
                <ArrowRight className="h-5 w-5 text-indigo-400 group-hover:text-indigo-300 transition-colors" />
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
