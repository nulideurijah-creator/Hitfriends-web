import { useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../context/AuthContext";
import { Settings, LogOut, History, Edit3, Shield } from "lucide-react";

export function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"stats" | "history" | "settings">("stats");

  if (!user) {
    navigate("/login");
    return null;
  }

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col md:flex-row gap-8">
      {/* Left Sidebar */}
      <div className="w-full md:w-64 shrink-0 space-y-6">
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 flex flex-col items-center text-center">
          <div className="w-24 h-24 rounded-full bg-neutral-800 border-4 border-indigo-500 overflow-hidden mb-4 relative group cursor-pointer">
            <img src={user.avatar} alt="avatar" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/50 hidden group-hover:flex items-center justify-center text-white transition-all">
              <Edit3 className="w-6 h-6" />
            </div>
          </div>
          <h2 className="text-xl font-bold text-white mb-1">{user.nickname}</h2>
          <p className="text-sm text-neutral-500 mb-4 font-mono">@{user.username}</p>
          <div className="w-full bg-neutral-950 rounded-lg p-3 border border-neutral-800 flex items-center justify-center gap-2 text-sm text-neutral-300">
            <Shield className="w-4 h-4 text-emerald-500" />
            已实名认证
          </div>
        </div>

        <nav className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden flex flex-col">
          <button 
            onClick={() => setActiveTab("stats")}
            className={`px-4 py-3 text-left text-sm font-medium flex items-center gap-3 transition-colors ${activeTab === 'stats' ? 'bg-indigo-600/10 text-indigo-400 border-l-2 border-indigo-500' : 'text-neutral-400 hover:text-white hover:bg-neutral-800 border-l-2 border-transparent'}`}
          >
            我的战绩
          </button>
          <button 
            onClick={() => setActiveTab("history")}
            className={`px-4 py-3 text-left text-sm font-medium flex items-center gap-3 transition-colors ${activeTab === 'history' ? 'bg-indigo-600/10 text-indigo-400 border-l-2 border-indigo-500' : 'text-neutral-400 hover:text-white hover:bg-neutral-800 border-l-2 border-transparent'}`}
          >
            对局记录
          </button>
          <button 
            onClick={() => setActiveTab("settings")}
            className={`px-4 py-3 text-left text-sm font-medium flex items-center gap-3 transition-colors ${activeTab === 'settings' ? 'bg-indigo-600/10 text-indigo-400 border-l-2 border-indigo-500' : 'text-neutral-400 hover:text-white hover:bg-neutral-800 border-l-2 border-transparent'}`}
          >
            账号设置
          </button>
        </nav>
      </div>

      {/* Right Content */}
      <div className="flex-1 bg-neutral-900 border border-neutral-800 rounded-2xl p-6 md:p-8 min-h-[400px]">
        {activeTab === "stats" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div>
              <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                <History className="w-5 h-5 text-indigo-400" />
                生涯统计
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-neutral-950 border border-neutral-800 p-4 rounded-xl text-center">
                  <div className="text-neutral-500 text-sm mb-1">全服排名</div>
                  <div className="text-2xl font-bold text-white">#142</div>
                </div>
                <div className="bg-neutral-950 border border-neutral-800 p-4 rounded-xl text-center">
                  <div className="text-neutral-500 text-sm mb-1">累计积分</div>
                  <div className="text-2xl font-bold text-amber-400 font-mono">{user.score}</div>
                </div>
                <div className="bg-neutral-950 border border-neutral-800 p-4 rounded-xl text-center">
                  <div className="text-neutral-500 text-sm mb-1">总对局数</div>
                  <div className="text-2xl font-bold text-white">328</div>
                </div>
                <div className="bg-neutral-950 border border-neutral-800 p-4 rounded-xl text-center">
                  <div className="text-neutral-500 text-sm mb-1">胜率</div>
                  <div className="text-2xl font-bold text-emerald-400">54.2%</div>
                </div>
              </div>
            </div>
            
            <div>
              <h3 className="text-lg font-bold text-white mb-4">特色数据</h3>
              <div className="bg-neutral-950 border border-neutral-800 rounded-xl divide-y divide-neutral-800">
                <div className="p-4 flex items-center justify-between">
                  <span className="text-neutral-400">最佳单局得分</span>
                  <span className="font-bold text-amber-400">+1,024</span>
                </div>
                <div className="p-4 flex items-center justify-between">
                  <span className="text-neutral-400">拍炸次数</span>
                  <span className="font-bold text-white">86 次</span>
                </div>
                <div className="p-4 flex items-center justify-between">
                  <span className="text-neutral-400">抢拍成功率</span>
                  <span className="font-bold text-white">32%</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "history" && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <h3 className="text-lg font-bold text-white mb-6">最近对局 (近 10 场)</h3>
            {[1, 2, 3, 4, 5].map((i) => {
              const isWin = i % 3 !== 0;
              return (
                <div key={i} className="bg-neutral-950 border border-neutral-800 p-4 rounded-xl flex items-center justify-between hover:border-neutral-700 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center font-bold text-lg ${isWin ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-neutral-800 text-neutral-400 border border-neutral-700'}`}>
                      {isWin ? '胜' : '负'}
                    </div>
                    <div>
                      <div className="font-medium text-white">经典四人局</div>
                      <div className="text-xs text-neutral-500 mt-1">2026-04-{26 - i} 14:30 • 房间 RM-{Math.floor(Math.random() * 10000)}</div>
                    </div>
                  </div>
                  <div className={`font-mono font-bold text-xl ${isWin ? 'text-emerald-400' : 'text-neutral-400'}`}>
                    {isWin ? '+' : ''}{isWin ? Math.floor(Math.random() * 100 + 50) : -Math.floor(Math.random() * 50 + 20)}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === "settings" && (
          <div className="max-w-md animate-in fade-in slide-in-from-bottom-2 duration-300">
            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <Settings className="w-5 h-5 text-indigo-400" />
              账号设置
            </h3>
            
            <form className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-1">修改昵称</label>
                <div className="flex gap-2">
                  <input type="text" defaultValue={user.nickname} className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 transition-colors" />
                  <button type="button" className="px-4 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg font-medium transition-colors">保存</button>
                </div>
              </div>
              
              <div className="pt-4 border-t border-neutral-800">
                <label className="block text-sm font-medium text-neutral-400 mb-1">修改密码</label>
                <div className="space-y-3">
                  <input type="password" placeholder="原密码" className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 transition-colors" />
                  <input type="password" placeholder="新密码" className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 transition-colors" />
                  <button type="button" className="w-full px-4 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg font-medium transition-colors">更新密码</button>
                </div>
              </div>

              <div className="pt-8 mt-8 border-t border-neutral-800">
                <button 
                  type="button" 
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-lg font-bold transition-colors"
                >
                  <LogOut className="w-5 h-5" />
                  退出登录
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
