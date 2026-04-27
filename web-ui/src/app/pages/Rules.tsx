import type { ReactNode } from "react";
import { AlertTriangle, BookOpen, Coins, ShieldAlert, Sparkles, Target, Users, Zap } from "lucide-react";

export function Rules() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-10">
        <p className="mb-2 text-sm font-bold text-indigo-300">RULE BOOK</p>
        <h1 className="flex items-center gap-3 text-4xl font-black text-white">
          <BookOpen className="h-8 w-8 text-indigo-300" />
          游戏规则说明
        </h1>
        <p className="mt-4 max-w-3xl text-lg leading-8 text-neutral-400">
          打朋友网页版支持 2-4 人入座、多人观战、聊天、换牌、拍炸和全服积分结算。规则引擎负责所有出牌合法性判断。
        </p>
      </div>

      <div className="grid gap-6">
        <RuleSection icon={<Target className="h-6 w-6 text-blue-300" />} title="基础规则">
          <p>2-4 名玩家入座，所有玩家点击准备后才发牌。等待阶段任何人都看不到手牌。</p>
          <p>第一个出完手牌的玩家获胜，输家按剩余牌数和本局倍率扣分，赢家获得总分。</p>
        </RuleSection>

        <RuleSection icon={<Sparkles className="h-6 w-6 text-indigo-300" />} title="换牌规则">
          <p>发牌后先进入换牌投票。只有所有玩家都同意换牌，才进入换牌选择。</p>
          <p>换牌选择阶段每名玩家只能选 1 张牌，系统统一交换。换牌完成后，非拍炸情况下出牌权跟随全场手牌最小牌的拥有者。</p>
        </RuleSection>

        <RuleSection icon={<Zap className="h-6 w-6 text-red-300" />} title="拍炸与二次抢拍">
          <ul className="list-disc space-y-2 pl-5 text-neutral-300">
            <li>无人拍炸：所有玩家 1 倍，视为正常对局，全场最小牌玩家先手。</li>
            <li>只有一人拍炸：所有玩家 2 倍，拍炸玩家先手。</li>
            <li>多人拍炸：进入二次抢拍。</li>
            <li>抢拍阶段所有拍炸者都继续：继续抢拍者 4 倍，未拍炸玩家 2 倍。</li>
            <li>抢拍阶段有人继续、有人放弃：所有玩家都是 2 倍。</li>
            <li>抢拍阶段所有拍炸者都放弃：所有玩家 1 倍，视为正常对局，全场最小牌玩家先手。</li>
          </ul>
        </RuleSection>

        <RuleSection icon={<ShieldAlert className="h-6 w-6 text-amber-300" />} title="出牌与 PASS">
          <p>玩家必须严格按当前出牌权操作。不是自己的回合时，出牌与 PASS 都会被拒绝。</p>
          <p>如果上一家出牌后，当前玩家没有任何牌可以压过，页面会显示“你没有牌可以出”，3 秒后自动 PASS。</p>
          <p>选错牌型时，页面会用醒目的错误提示说明原因，并保留已选手牌，方便重新调整。</p>
        </RuleSection>

        <RuleSection icon={<Coins className="h-6 w-6 text-emerald-300" />} title="积分榜">
          <p>每局结算后，积分会累计到个人资料和全服积分榜。排行榜按累计积分排序，胜局数作为辅助排序。</p>
        </RuleSection>

        <section className="rounded-xl border border-indigo-400/20 bg-indigo-400/10 p-6">
          <div className="flex items-start gap-4">
            <Users className="mt-1 h-8 w-8 shrink-0 text-indigo-300" />
            <div>
              <h2 className="text-xl font-black text-indigo-100">观战说明</h2>
              <p className="mt-2 text-sm leading-7 text-indigo-100/75">
                观众可以看公共桌面、剩余牌数、倍率和聊天，但永远不能看到玩家私人手牌。等待阶段有空座时，登录观众可以申请入座。
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-amber-400/20 bg-amber-400/10 p-6">
          <div className="flex items-start gap-4">
            <AlertTriangle className="mt-1 h-7 w-7 shrink-0 text-amber-300" />
            <p className="text-sm leading-7 text-amber-100/80">
              当前网页端以规则引擎为最终裁决：前端会提前提示，但真正能不能出牌，仍以后端写入前调用 `nextState` 的结果为准。
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

function RuleSection({ children, icon, title }: { children: ReactNode; icon: ReactNode; title: string }) {
  return (
    <section className="rounded-xl border border-white/10 bg-neutral-950/70 p-6">
      <h2 className="mb-4 flex items-center gap-2 text-2xl font-black text-white">
        {icon}
        {title}
      </h2>
      <div className="space-y-3 leading-8 text-neutral-300">{children}</div>
    </section>
  );
}
