import type { ReactNode } from "react";
import { AlertTriangle, BookOpen, Coins, Eye, ShieldAlert, Sparkles, Target, Users, Zap } from "lucide-react";

const rankOrder = ["4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A", "2", "3"];
const suitOrder = ["方块", "梅花", "红桃", "黑桃"];

export function Rules() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 text-white sm:px-6 sm:py-10">
      <div className="mb-8 rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(216,182,90,0.16),rgba(10,17,16,0.92)_46%,rgba(5,7,7,0.96)_100%)] p-6 shadow-2xl shadow-black/30 sm:p-8">
        <p className="mb-3 text-sm font-black tracking-[0.18em] text-[#d8b65a]">RULE BOOK</p>
        <h1 className="flex items-center gap-3 text-4xl font-black tracking-normal text-white">
          <BookOpen className="h-9 w-9 text-[#d8b65a]" />
          打朋友完整打法说明
        </h1>
        <p className="mt-5 max-w-4xl text-lg leading-8 text-neutral-300">
          本网页支持 2-4 人入座、房主开局、换牌、拍炸、抢拍、观战、聊天、休闲和天梯两种模式。所有出牌都会经过规则引擎校验，页面提示只作为辅助。
        </p>
      </div>

      <div className="grid gap-5">
        <RuleSection icon={<Target className="h-6 w-6 text-blue-300" />} title="1. 基础规则">
          <RuleList
            items={[
              "每桌 2-4 名玩家，入座玩家先点准备；所有玩家准备后，由房主点击开始游戏。",
              "等待准备阶段不会发牌，也看不到手牌；开局后每名玩家发 13 张牌。",
              "第一个出完全部手牌的玩家结束本局，并进入本局积分结算。",
              "休闲模式只记录房间和个人对局记录，不进入全服榜；天梯模式结算后进入全服积分榜。",
            ]}
          />
        </RuleSection>

        <RuleSection icon={<Sparkles className="h-6 w-6 text-amber-300" />} title="2. 牌面大小">
          <div className="grid gap-4 md:grid-cols-2">
            <InfoCard title="点数大小" value={rankOrder.join(" < ")} />
            <InfoCard title="花色大小" value={suitOrder.join(" < ")} />
          </div>
          <p>顺子使用特殊连续顺序：A、2、3、4、5、6、7、8、9、10、J、Q、K，所以支持 A2345 到 10JQKA。</p>
        </RuleSection>

        <RuleSection icon={<ShieldAlert className="h-6 w-6 text-emerald-300" />} title="3. 合法牌型">
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="bg-white/[0.06] text-[#f0d58b]">
                <tr>
                  <th className="px-4 py-3">张数</th>
                  <th className="px-4 py-3">牌型</th>
                  <th className="px-4 py-3">说明</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 text-neutral-300">
                <RuleRow count="1" name="单牌" desc="任意 1 张牌。" />
                <RuleRow count="2" name="对子" desc="两张相同点数。" />
                <RuleRow count="3" name="三张" desc="三张相同点数，只能首手、跟三张，或手里只剩 3 张时打出。" />
                <RuleRow count="5" name="顺子" desc="五张连续牌。" />
                <RuleRow count="5" name="同花" desc="五张同花色，不要求连续。" />
                <RuleRow count="5" name="三带二" desc="三张相同点数 + 一对。" />
                <RuleRow count="5" name="四带一" desc="四张相同点数 + 任意 1 张。" />
                <RuleRow count="5" name="同花顺" desc="同花色且连续。" />
              </tbody>
            </table>
          </div>
          <p>五张牌型压制顺序：顺子 &lt; 同花 &lt; 三带二 &lt; 四带一 &lt; 同花顺。</p>
        </RuleSection>

        <RuleSection icon={<Zap className="h-6 w-6 text-red-300" />} title="4. 跟牌与跳过">
          <RuleList
            items={[
              "有上一手时，单牌、对子、三张必须跟同类牌型；五张牌可以用同类更大牌或更高权重五张牌型压制。",
              "单牌同花色时必须点数更大；不同花色时必须点数相同且花色更大。",
              "对子和三张点数更大时，必须至少包含上一手中的一种花色；点数相同则比最大花色。",
              "第一手不能跳过；没有上一手牌时不能跳过。",
              "当前玩家没有可压过上一手的牌时，系统只提示可以跳过，不会自动 PASS，需要玩家自己点击“跳过”。",
              "一圈内除最后有效出牌者外都跳过后，开启新一轮，上一手清空，出牌权回到最后有效出牌者。",
            ]}
          />
        </RuleSection>

        <RuleSection icon={<Users className="h-6 w-6 text-cyan-300" />} title="5. 首手与换牌">
          <RuleList
            items={[
              "正常情况下，持有方块 4 的玩家先手；如果方块 4 没发到玩家手里，则全场最小手牌持有者先手。",
              "第一手必须包含方块 4 或当前判定的全场最小牌。",
              "开局后先进入换牌投票。任意玩家选择不换，会立刻跳过换牌并进入拍炸投票。",
              "所有玩家都同意换牌时，每名玩家选择并确认 1 张牌；确认后该牌会锁定，后续点击其他手牌不会改变交换牌。",
              "换牌完成后，非拍炸情况下会重新扫描全场最小手牌，出牌权跟随最小牌持有者。",
            ]}
          />
        </RuleSection>

        <RuleSection icon={<Zap className="h-6 w-6 text-orange-300" />} title="6. 拍炸与抢拍">
          <RuleList
            items={[
              "无人拍炸：所有玩家 1 倍，按正常规则由最小牌玩家先手。",
              "只有 1 人拍炸：所有玩家 2 倍，拍炸玩家先手。",
              "多人拍炸：进入抢拍阶段，只有已拍炸玩家需要选择继续或放弃。",
              "所有拍炸玩家都继续抢拍：继续抢拍者 4 倍，未拍炸玩家 2 倍。",
              "有人继续、有人放弃：所有玩家都是 2 倍。",
              "所有拍炸玩家都放弃：所有玩家 1 倍，视为正常对局，由全场最小牌玩家先手。",
            ]}
          />
        </RuleSection>

        <RuleSection icon={<Coins className="h-6 w-6 text-emerald-300" />} title="7. 积分结算">
          <RuleList
            items={[
              "每局结束后，房间内每名玩家附近会显示当前积分和本局变化。",
              "普通局中，输家扣分 = 剩余手牌数 × 自己倍率，赢家获得所有输家扣分总和。",
              "如果输家一张牌都没出，按 15 张牌计算扣分。",
              "拍炸玩家赢：其他输家按各自剩余牌数 × 对应倍率扣分，分数给拍炸赢家。",
              "拍炸玩家输：拍炸玩家是输家，其他所有非拍炸玩家都是赢家；拍炸玩家按自己剩余牌数 × 自己倍率分别给每名赢家。",
              "点击“结算牌局”后，本批累计积分会正式记录到个人页；天梯房同时更新全服积分榜。结算后留在房间的玩家积分清 0，进入新一批。",
            ]}
          />
        </RuleSection>

        <RuleSection icon={<Eye className="h-6 w-6 text-indigo-300" />} title="8. 观战与聊天">
          <RuleList
            items={[
              "房间未满且未开局时，进入房间可选择入座或观战；满人或已开局时默认观战。",
              "观众不能准备、换牌、拍炸、出牌、跳过、下一局或结算牌局。",
              "观战时可以看到牌局玩家的手牌明牌展示和各玩家本轮打出的牌。",
              "玩家和观众都可以在房间聊天发送文字和 emoji；聊天框只展示用户发言，不展示系统消息。",
            ]}
          />
        </RuleSection>

        <section className="rounded-2xl border border-amber-400/25 bg-amber-400/10 p-5">
          <div className="flex items-start gap-4">
            <AlertTriangle className="mt-1 h-7 w-7 shrink-0 text-amber-300" />
            <div>
              <h2 className="text-xl font-black text-amber-100">最终判定</h2>
              <p className="mt-2 text-sm leading-7 text-amber-100/80">
                页面会提前显示提示和按钮状态，但真正能否出牌、能否跳过、谁获得出牌权、积分如何变化，都以写入前调用规则引擎 `nextState` 的结果为准。
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function RuleSection({ children, icon, title }: { children: ReactNode; icon: ReactNode; title: string }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-neutral-950/72 p-5 shadow-xl shadow-black/20 sm:p-6">
      <h2 className="mb-4 flex items-center gap-2 text-2xl font-black tracking-normal text-white">
        {icon}
        {title}
      </h2>
      <div className="space-y-4 leading-8 text-neutral-300">{children}</div>
    </section>
  );
}

function RuleList({ items }: { items: string[] }) {
  return (
    <ul className="grid gap-2">
      {items.map((item) => (
        <li key={item} className="flex gap-3">
          <span className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-[#d8b65a]" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function InfoCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
      <p className="mb-2 text-sm font-black text-[#d8b65a]">{title}</p>
      <p className="font-mono text-sm leading-7 text-neutral-200">{value}</p>
    </div>
  );
}

function RuleRow({ count, desc, name }: { count: string; desc: string; name: string }) {
  return (
    <tr>
      <td className="px-4 py-3 font-mono text-[#f0d58b]">{count}</td>
      <td className="px-4 py-3 font-black text-white">{name}</td>
      <td className="px-4 py-3">{desc}</td>
    </tr>
  );
}
