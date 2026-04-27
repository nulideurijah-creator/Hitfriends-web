import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { ArrowRight, Loader2, LogIn, UserPlus } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { isSupabaseConfigured } from "../../lib/supabase";

function getRedirect(location: ReturnType<typeof useLocation>) {
  const params = new URLSearchParams(location.search);
  return params.get("redirect") || "/lobby";
}

export function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      await signIn(email.trim(), password);
      navigate(getRedirect(location), { replace: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "登录失败，请检查邮箱和密码。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title="登录打朋友" subtitle="每个浏览器窗口使用独立 session，方便你开多窗口测试多人开局。">
      <form onSubmit={handleSubmit} className="space-y-4">
        <AuthMessage message={message} />
        <AuthField label="邮箱" type="email" value={email} onChange={setEmail} placeholder="name@example.com" />
        <AuthField label="密码" type="password" value={password} onChange={setPassword} placeholder="请输入密码" />
        <button
          disabled={busy || !isSupabaseConfigured}
          className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 py-3 font-bold text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
          登录
          <ArrowRight className="w-4 h-4" />
        </button>
      </form>
    </AuthShell>
  );
}

export function Register() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signUp, signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (password.length < 6) {
      setMessage("密码至少需要 6 位。");
      return;
    }
    if (password !== confirmPassword) {
      setMessage("两次输入的密码不一致。");
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      await signUp(email.trim(), password, nickname.trim());
      await signIn(email.trim(), password).catch(() => undefined);
      navigate(getRedirect(location), { replace: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "注册失败，请稍后重试。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title="注册新账号" subtitle="登录后才能入座、准备、聊天和进入全服积分榜。">
      <form onSubmit={handleSubmit} className="space-y-4">
        <AuthMessage message={message} />
        <AuthField label="邮箱" type="email" value={email} onChange={setEmail} placeholder="name@example.com" />
        <AuthField label="昵称" value={nickname} onChange={setNickname} placeholder="游戏里显示的名字" />
        <AuthField label="密码" type="password" value={password} onChange={setPassword} placeholder="至少 6 位" />
        <AuthField label="确认密码" type="password" value={confirmPassword} onChange={setConfirmPassword} placeholder="再次输入密码" />
        <button
          disabled={busy || !isSupabaseConfigured}
          className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 py-3 font-bold text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
          注册并登录
        </button>
      </form>
    </AuthShell>
  );
}

function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="min-h-[calc(100vh-4rem)] px-4 py-10 flex items-center justify-center bg-[radial-gradient(circle_at_top,#1f2a44_0%,#0a0f1c_45%,#05070d_100%)]">
      <div className="w-full max-w-md rounded-xl border border-white/10 bg-neutral-950/80 p-7 shadow-2xl shadow-black/40 backdrop-blur">
        <div className="mb-6">
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-300">
            <LogIn className="h-6 w-6" />
          </div>
          <h1 className="text-3xl font-black text-white">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-neutral-400">{subtitle}</p>
        </div>

        {!isSupabaseConfigured && (
          <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            Supabase 未配置，登录注册暂不可用。
          </div>
        )}

        {children}

        <div className="mt-6 flex items-center justify-between text-sm">
          <Link to="/login" className="text-indigo-300 hover:text-indigo-200">
            登录
          </Link>
          <Link to="/register" className="text-indigo-300 hover:text-indigo-200">
            注册
          </Link>
          <Link to="/lobby" className="text-neutral-400 hover:text-white">
            去大厅
          </Link>
        </div>
      </div>
    </div>
  );
}

function AuthField({
  label,
  type = "text",
  value,
  onChange,
  placeholder,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm text-neutral-400">{label}</span>
      <input
        type={type}
        required
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-white/10 bg-neutral-950 px-4 py-3 text-white outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20"
      />
    </label>
  );
}

function AuthMessage({ message }: { message: string | null }) {
  if (!message) return null;
  return <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{message}</div>;
}
