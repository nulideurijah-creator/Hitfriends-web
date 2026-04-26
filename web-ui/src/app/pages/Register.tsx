import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "../context/AuthContext";
import { UserPlus, ArrowRight } from "lucide-react";

export function Register() {
  const [username, setUsername] = useState("");
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !nickname || !password) {
      setError("请填写所有字段");
      return;
    }
    if (password !== confirmPassword) {
      setError("两次输入的密码不一致");
      return;
    }
    
    // Mock register and login
    login({
      id: "new_user",
      username,
      nickname,
      score: 1000,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
    });
    
    navigate("/lobby", { replace: true });
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-neutral-900 p-8 rounded-2xl border border-neutral-800 shadow-2xl">
        <div>
          <div className="mx-auto h-12 w-12 bg-indigo-500/10 text-indigo-400 rounded-xl flex items-center justify-center">
            <UserPlus className="w-8 h-8" />
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-white">
            注册新账号
          </h2>
          <p className="mt-2 text-center text-sm text-neutral-400">
            已有账号？{" "}
            <Link to="/login" className="font-medium text-indigo-400 hover:text-indigo-300 transition-colors">
              直接登录
            </Link>
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleRegister}>
          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}
          <div className="space-y-4 rounded-md shadow-sm">
            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-1">用户名</label>
              <input
                type="text"
                required
                className="appearance-none rounded-lg relative block w-full px-4 py-3 border border-neutral-700 bg-neutral-950 placeholder-neutral-500 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-all"
                placeholder="用于登录，字母或数字"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-1">昵称</label>
              <input
                type="text"
                required
                className="appearance-none rounded-lg relative block w-full px-4 py-3 border border-neutral-700 bg-neutral-950 placeholder-neutral-500 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-all"
                placeholder="游戏中显示的名字"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-1">密码</label>
              <input
                type="password"
                required
                className="appearance-none rounded-lg relative block w-full px-4 py-3 border border-neutral-700 bg-neutral-950 placeholder-neutral-500 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-all"
                placeholder="不少于6位"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-1">确认密码</label>
              <input
                type="password"
                required
                className="appearance-none rounded-lg relative block w-full px-4 py-3 border border-neutral-700 bg-neutral-950 placeholder-neutral-500 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-all"
                placeholder="再次输入密码"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-bold rounded-lg text-white bg-indigo-600 hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 focus:ring-offset-neutral-900 transition-all shadow-lg shadow-indigo-500/25"
            >
              注册并登录
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
