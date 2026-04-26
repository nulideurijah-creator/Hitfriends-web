import { BookOpen, Target, AlertTriangle, Zap, Coins, Users } from "lucide-react";

export function Rules() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="mb-12">
        <h1 className="text-4xl font-extrabold text-white flex items-center gap-3">
          <BookOpen className="w-8 h-8 text-indigo-400" />
          游戏规则说明
        </h1>
        <p className="text-neutral-400 mt-4 text-lg">打朋友是一款适合 2-4 人熟人对局的纸牌游戏，以快速、刺激、互动为核心体验。</p>
      </div>

      <div className="grid gap-8">
        {/* Section 1 */}
        <section className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 md:p-8">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2 mb-6">
            <Target className="w-6 h-6 text-blue-400" />
            基础规则
          </h2>
          <div className="space-y-4 text-neutral-300 leading-relaxed">
            <p><strong className="text-white">开局与人数：</strong> 游戏支持 2 到 4 名玩家入座。满 2 人即可由房主点击开始。</p>
            <p><strong className="text-white">牌序大小：</strong> 2 {'>'} A {'>'} K {'>'} Q {'>'} J {'>'} 10 {'>'} 9 {'>'} 8 {'>'} 7 {'>'} 6 {'>'} 5 {'>'} 4 {'>'} 3</p>
            <p><strong className="text-white">花色大小：</strong> 黑桃 ♠ {'>'} 红桃 ♥ {'>'} 梅花 ♣ {'>'} 方块 ♦</p>
            <p><strong className="text-white">目标：</strong> 尽早出完手中的牌，第一个出完的玩家即为本局赢家，赢得所有积分。</p>
          </div>
        </section>

        {/* Section 2 */}
        <section className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 md:p-8">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2 mb-6">
            <Zap className="w-6 h-6 text-amber-400" />
            特色玩法
          </h2>
          <div className="space-y-6 text-neutral-300 leading-relaxed">
            <div>
              <h3 className="text-lg font-bold text-amber-400 mb-2">换牌阶段</h3>
              <p>发牌后，系统发起换牌投票。如果<strong>所有玩家</strong>都同意换牌，则进入换牌选择阶段。每位玩家选择 1 张手牌进行顺时针交换。这增加了开局的策略性和随机性。</p>
            </div>
            <div className="h-px w-full bg-neutral-800"></div>
            <div>
              <h3 className="text-lg font-bold text-red-400 mb-2">拍炸与抢拍</h3>
              <p>换牌结束后，进入“是否拍炸”投票。</p>
              <ul className="list-disc pl-5 mt-2 space-y-2 text-neutral-400">
                <li>无人拍炸：倍率为 1x。</li>
                <li>1 人拍炸：倍率升至 2x，该玩家获得优先出牌权。</li>
                <li>多人拍炸：触发<strong>二次抢拍</strong>。继续抢拍者倍率升至 4x，放弃者保持 2x。最终继续抢拍且单牌最小的玩家获得优先出牌权。</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Section 3 */}
        <section className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 md:p-8">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2 mb-6">
            <Coins className="w-6 h-6 text-emerald-400" />
            支持牌型与计分
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="font-bold text-white mb-4 border-b border-neutral-800 pb-2">出牌牌型</h3>
              <ul className="space-y-3 text-neutral-400 text-sm">
                <li><strong className="text-neutral-200">单张：</strong> 任意一张单牌。</li>
                <li><strong className="text-neutral-200">对子：</strong> 两张点数相同的牌。</li>
                <li><strong className="text-neutral-200">三张：</strong> 三张点数相同的牌。</li>
                <li><strong className="text-neutral-200">连对：</strong> 三对或以上点数相连的对子（如 334455）。</li>
                <li><strong className="text-neutral-200">炸弹：</strong> 四张点数相同的牌，可管任何非炸弹牌型。</li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold text-white mb-4 border-b border-neutral-800 pb-2">积分结算</h3>
              <ul className="space-y-3 text-neutral-400 text-sm">
                <li><strong className="text-emerald-400">赢家收益：</strong> 所有输家剩余牌数 × 基础分 × 当前倍率的总和。</li>
                <li><strong className="text-red-400">输家扣分：</strong> 自己剩余牌数 × 基础分 × 当前倍率。</li>
                <li><strong className="text-neutral-200">春天/反春：</strong> 如果赢家出完牌时，某位输家一张牌未出，该输家扣分翻倍。</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Section 4 */}
        <section className="bg-indigo-900/20 border border-indigo-500/20 rounded-2xl p-6 md:p-8 flex items-start gap-4">
          <Users className="w-8 h-8 text-indigo-400 shrink-0 mt-1" />
          <div>
            <h2 className="text-xl font-bold text-indigo-300 mb-2">观战系统</h2>
            <p className="text-indigo-200/70 text-sm leading-relaxed">
              每个房间都支持好友旁观。观众可以看到对局的公共信息（比分、打出的牌、倍率）并参与聊天互动，但<strong>无法看到玩家的私人手牌</strong>。如果房间内有空座且在等待阶段，观众可以随时申请入座参与游戏。
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
