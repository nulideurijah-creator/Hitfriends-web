# 标准规则引擎设计：打朋友网页联机纸牌游戏

完整可复制运行的 TypeScript 单模块见：

`web-ui/src/game/ruleEngine.ts`

该模块只负责规则引擎，不包含 UI、HTML、CSS、React、Vue、Supabase、WebSocket 或任何网络逻辑。

## 1. 规则摘要

### 1.1 基础规则

| 项 | 标准 |
| --- | --- |
| 玩家数 | 2-4 人 |
| 牌堆 | 52 张，无大小王 |
| 每人手牌 | 13 张 |
| 未发完牌 | 保留在 `state.deck` 中，不参与本局出牌 |
| 点数大小 | `4 < 5 < 6 < 7 < 8 < 9 < 10 < J < Q < K < A < 2 < 3` |
| 花色大小 | `方块 < 梅花 < 红桃 < 黑桃` |
| 首出玩家 | 优先方块 4 持有者；若无人持有方块 4，则最小单牌持有者 |
| 第一手限制 | 必须包含方块 4；若最小牌开局，则必须包含该最小牌 |
| 回合锁 | 所有非初始化 action 必须带 `expectedRevision`，与 `state.revision` 不一致时拒绝 |
| 换牌后首出权 | 非拍炸情况下，换牌完成后按全场当前手牌最小牌重新确定首出玩家 |
| 最后一张托管 | 玩家只剩 1 张牌时可开启托管，由 `AUTO_PLAY_LAST_CARD` 自动判断出牌或 PASS |

### 1.2 合法牌型

| 牌型 | 张数 | 识别 |
| --- | --- | --- |
| `SINGLE` | 1 | 任意单牌 |
| `PAIR` | 2 | 两张同点数 |
| `TRIPLE` | 3 | 三张同点数 |
| `STRAIGHT` | 5 | 五张连续牌，支持 `A2345` 到 `10JQKA` |
| `FLUSH` | 5 | 五张同花色 |
| `THREE_WITH_TWO` | 5 | 三张同点数 + 一对 |
| `FOUR_WITH_ONE` | 5 | 四张同点数 + 任意一张 |
| `STRAIGHT_FLUSH` | 5 | 同花顺 |

五张牌型权重：

```text
STRAIGHT < FLUSH < THREE_WITH_TWO < FOUR_WITH_ONE < STRAIGHT_FLUSH
```

### 1.3 跟牌规则

| 牌型 | 比较规则 |
| --- | --- |
| 单牌 | 同花色必须点数更大；不同花色必须点数相同且花色更大 |
| 对子 | 点数相同看最大花色；点数更大时必须包含上一手对子中的至少一种花色 |
| 三张 | 只能第一手、跟三张、或玩家只剩 3 张时打出；比较规则同对子 |
| 顺子 | 先比顺子值，`A2345` 最小，`10JQKA` 最大；相同再比最大牌花色 |
| 同花 | 先比花色，再比最大牌点数 |
| 三带二 | 比三张部分点数，再比三张部分最大花色 |
| 四带一 | 比四张部分点数，再比四张部分最大花色 |
| 同花顺 | 先比顺子值，再比花色 |

### 1.4 回合规则

- 所有玩家操作都必须经过 `nextState(state, action)`。
- 只有 `state.currentTurn` 对应玩家可以操作。
- `PLAY_CARD` 成功后：
  - 移除玩家手牌。
  - 写入 `discardPile`。
  - 更新 `lastMove`。
  - 清空 `passCount`。
  - 切换到下一名 active 玩家。
- `PASS` 成功后：
  - 写入 `discardPile`。
  - 增加 `passCount`。
  - 若除上一手出牌者外其他玩家都 pass，则新一轮开始，`lastMove = null`，出牌权回到上一手出牌者。
- 玩家手牌为空时：
  - `gameStatus = "finished"`。
  - `winner = playerId`。
  - `currentTurn = null`。

## 2. 数据结构定义

核心类型在 `web-ui/src/game/ruleEngine.ts` 中定义：

```ts
type Card = {
  id: string;
  suit: "DIAMONDS" | "CLUBS" | "HEARTS" | "SPADES";
  rank: "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K" | "A" | "2" | "3";
};

type Move = {
  type: "PLAY_CARD" | "PASS";
  playerId: string;
  cards: Card[];
  combo: Combo | null;
  round: number;
  sequence: number;
};

type Player = {
  id: string;
  name?: string;
  hand: Card[];
  status: "active" | "finished";
  score: number;
  cardsPlayed: number;
  multiplier: number;
};
```

Action 系统：

```ts
type GameAction =
  | { type: "INIT_GAME"; players: PlayerInput[]; deck?: Card[]; shuffle?: boolean }
  | { type: "START_GAME"; playerId?: string; expectedRevision: number; actionId?: string }
  | { type: "PLAY_CARD"; playerId: string; cards: Card[]; expectedRevision: number; actionId?: string }
  | { type: "PASS"; playerId: string; expectedRevision: number; actionId?: string }
  | {
      type: "SWAP_CARDS";
      selectedCardIdsByPlayer: Record<string, string>;
      targetPlayerIdByCardId: Record<string, string>;
      turnOwnerId?: string;
      expectedRevision: number;
      actionId?: string;
    }
  | { type: "SET_AUTO_PLAY_LAST_CARD"; playerId: string; enabled: boolean; expectedRevision: number; actionId?: string }
  | { type: "AUTO_PLAY_LAST_CARD"; playerId: string; expectedRevision: number; actionId?: string }
  | { type: "END_GAME"; playerId?: string; winner?: string | null; reason?: string; expectedRevision: number; actionId?: string };
```

## 3. gameState 设计

`GameState` 是唯一数据源，所有字段均可 JSON 序列化：

```ts
type GameState = {
  version: 1;
  revision: number;
  turnLock: {
    revision: number;
    currentTurn: string | null;
    lastActionId: string | null;
  };
  gameStatus: "waiting" | "playing" | "finished";
  players: Player[];
  playerOrder: string[];
  currentTurn: string | null;
  deck: Card[];
  discardPile: Move[];
  lastMove: Move | null;
  winner: string | null;
  round: number;
  sequence: number;
  passCount: number;
  roundLeaderId: string | null;
  isFirstHand: boolean;
  firstPlayRequirement: {
    kind: "DIAMOND_FOUR" | "MIN_CARD" | "NONE";
    ownerId: string | null;
    cardId: string | null;
  };
  autoPlay: {
    enabledPlayerIds: string[];
  };
  settings: {
    minPlayers: number;
    maxPlayers: number;
    cardsPerPlayer: number;
  };
  lastScoreDelta: Record<string, number> | null;
};
```

设计要点：

- `currentTurn` 是严格回合控制源。
- `discardPile` 是完整动作历史，包含出牌和 PASS。
- `lastMove` 只保存当前轮仍需压过的最后一手出牌；新一轮开始时清空。
- `roundLeaderId` 保存当前轮最后有效出牌者，用于所有其他玩家 PASS 后回到该玩家。
- `firstPlayRequirement` 显式保存第一手要求，避免依赖外部推导。
- `lastScoreDelta` 保存最近一次结算积分变化，可用于排行榜写入。
- `revision` 是乐观锁版本号，每次成功 action 后递增。
- `turnLock` 保存当前 revision、当前出牌人和最近 actionId，便于前端/后端做冲突处理。
- `autoPlay.enabledPlayerIds` 保存已开启“最后一张托管”的玩家。

## 4. 核心函数 nextState

函数签名：

```ts
function nextState(state: GameState | null, action: GameAction): GameState | EngineError
```

成功时返回全新 `GameState`。  
失败时返回：

```ts
{
  error: true,
  code: "INVALID_MOVE",
  message: "...",
  state: 原state
}
```

`nextState` 处理内容：

- `INIT_GAME`：校验玩家数与唯一 ID，创建初始状态。
- 回合锁：除 `INIT_GAME` 外，所有 action 必须包含 `expectedRevision`；如果不等于 `state.revision`，返回 `TURN_LOCK_CONFLICT`。
- `START_GAME`：从 waiting 进入 playing。
- `SWAP_CARDS`：
  - 只允许第一手之前执行。
  - 每名 active 玩家必须选择 1 张牌。
  - 每名 active 玩家必须收到 1 张牌。
  - 换牌后默认重新扫描全场最小手牌，并把 `currentTurn` 和第一手要求交给该最小牌持有者。
  - 如拍炸扩展需要指定拍炸玩家先出，可通过 `turnOwnerId` 覆盖。
- `PLAY_CARD`：
  - 校验是否轮到该玩家。
  - 校验玩家是否 active。
  - 校验牌是否都在该玩家手牌中。
  - 校验牌型。
  - 校验第一手限制。
  - 校验跟牌是否能压过 `lastMove`。
  - 更新手牌、弃牌历史、上一手、当前回合、胜负。
- `PASS`：
  - 校验是否轮到该玩家。
  - 校验当前轮是否已有 `lastMove`。
  - 更新 PASS 计数。
  - 必要时开启新一轮。
- `END_GAME`：手动结束，必须提供或已有 winner。
- `SET_AUTO_PLAY_LAST_CARD`：玩家仅在手牌数为 1 时可开启最后一张托管。
- `AUTO_PLAY_LAST_CARD`：当前轮到托管玩家时，系统尝试打出最后一张；若不能压过上一手且可以 PASS，则自动 PASS。

### 4.1 回合锁使用方式

调用方读取 state 后，提交 action 时必须带上读取到的 `revision`：

```ts
const action = {
  type: "PLAY_CARD",
  playerId: "A",
  cards: [card],
  expectedRevision: state.revision,
  actionId: "client-generated-id-001"
};

const result = nextState(state, action);
```

如果两个人几乎同时出牌：

- 两个客户端都读到 `revision = 12`。
- A 的 action 成功，返回 `revision = 13`。
- B 的 action 如果再基于最新 state 执行，但仍带 `expectedRevision = 12`，会得到 `TURN_LOCK_CONFLICT`。
- 数据库保存时也应使用 `WHERE revision = expectedRevision` 之类的条件更新，形成真正的端到端防冲突。

## 5. 辅助函数

模块中已拆分以下可单测函数：

| 函数 | 职责 |
| --- | --- |
| `classifyCards(cards)` | 识别牌型 |
| `compareMoves(moveA, moveB)` | 判断 moveA 是否能压过 moveB |
| `isValidMove(state, move)` | 判断 PLAY/PASS move 是否合法 |
| `getNextPlayer(state, fromPlayerId?)` | 获取下一名 active 玩家 |
| `checkWin(state)` | 检查是否有玩家手牌为空 |
| `applyMove(state, move)` | 在已校验前提下应用 move，返回新 state |
| `getAutoPlayAction(state)` | 如果当前玩家已开启最后一张托管且只剩 1 张，返回可提交的自动 action |
| `createDeck()` | 创建 52 张无王牌堆 |
| `shuffleDeck(deck)` | 洗牌，仅初始化阶段使用 |
| `sortCards(cards)` | 按游戏牌序排序 |
| `isEngineError(result)` | 判断 `nextState` 返回值是否为错误 |

## 6. 初始化函数

函数：

```ts
function createInitialState(
  players: PlayerInput[],
  options?: { deck?: Card[]; shuffle?: boolean }
): GameState
```

行为：

- 创建或接收牌堆。
- 初始化时可洗牌，`shuffle: false` 可用于测试。
- 每人发 13 张。
- 未发完的牌保留在 `deck`。
- 手牌排序。
- 找到首出玩家。
- 设置 `firstPlayRequirement`。
- 返回 `gameStatus = "waiting"` 的完整状态。

推荐启动流程：

```ts
let state = nextState(null, {
  type: "INIT_GAME",
  players: [
    { id: "A", name: "玩家A" },
    { id: "B", name: "玩家B" },
    { id: "C", name: "玩家C" }
  ]
});

if (!isEngineError(state)) {
  state = nextState(state, { type: "START_GAME", expectedRevision: state.revision });
}
```

## 7. 示例流程

### 7.1 初始 state 示例

为了示例稳定，使用 `shuffle: false`：

```ts
let state = nextState(null, {
  type: "INIT_GAME",
  shuffle: false,
  players: [
    { id: "A", name: "玩家A" },
    { id: "B", name: "玩家B" },
    { id: "C", name: "玩家C" }
  ]
});
```

此时 state 关键字段类似：

```json
{
  "gameStatus": "waiting",
  "currentTurn": "A",
  "round": 1,
  "isFirstHand": true,
  "firstPlayRequirement": {
    "kind": "DIAMOND_FOUR",
    "ownerId": "A",
    "cardId": "DIAMONDS-4"
  },
  "lastMove": null,
  "winner": null
}
```

开始游戏：

```ts
if (!isEngineError(state)) {
  state = nextState(state, { type: "START_GAME", expectedRevision: state.revision });
}
```

### 7.2 玩家 A 出牌

A 是方块 4 持有者，第一手必须包含方块 4：

```ts
if (!isEngineError(state)) {
  const playerA = state.players.find(p => p.id === "A")!;
  const diamondFour = playerA.hand.find(c => c.id === "DIAMONDS-4")!;

  state = nextState(state, {
    type: "PLAY_CARD",
    playerId: "A",
    cards: [diamondFour],
    expectedRevision: state.revision
  });
}
```

变化：

```json
{
  "currentTurn": "B",
  "lastMove": {
    "type": "PLAY_CARD",
    "playerId": "A",
    "cards": [{ "id": "DIAMONDS-4" }]
  },
  "passCount": 0,
  "isFirstHand": false
}
```

### 7.3 玩家 B 出牌

B 可以用方块 5 压方块 4：

```ts
if (!isEngineError(state)) {
  const playerB = state.players.find(p => p.id === "B")!;
  const diamondFive = playerB.hand.find(c => c.id === "DIAMONDS-5")!;

  state = nextState(state, {
    type: "PLAY_CARD",
    playerId: "B",
    cards: [diamondFive],
    expectedRevision: state.revision
  });
}
```

变化：

```json
{
  "currentTurn": "C",
  "lastMove": {
    "type": "PLAY_CARD",
    "playerId": "B",
    "cards": [{ "id": "DIAMONDS-5" }]
  },
  "roundLeaderId": "B",
  "passCount": 0
}
```

### 7.4 玩家 C PASS

```ts
if (!isEngineError(state)) {
  state = nextState(state, {
    type: "PASS",
    playerId: "C",
    expectedRevision: state.revision
  });
}
```

变化：

```json
{
  "currentTurn": "A",
  "lastMove": {
    "type": "PLAY_CARD",
    "playerId": "B"
  },
  "passCount": 1,
  "round": 1
}
```

如果随后 A 也 PASS，则除 B 外其他玩家都 PASS，新一轮开始：

```json
{
  "currentTurn": "B",
  "lastMove": null,
  "passCount": 0,
  "round": 2
}
```

## 8. 错误返回示例

非当前玩家出牌：

```ts
const result = nextState(state, {
  type: "PLAY_CARD",
  playerId: "A",
  cards: [someCard],
  expectedRevision: state.revision
});

if (isEngineError(result)) {
  console.log(result.code);    // "NOT_YOUR_TURN"
  console.log(result.message); // "It is not this player turn."
  console.log(result.state);   // 原 state
}
```

## 9. 换牌与首出权修正示例

换牌 action 不在引擎内随机洗牌，而是由调用方提供最终映射，保证 `nextState` 仍然是纯函数。

```ts
state = nextState(state, {
  type: "SWAP_CARDS",
  expectedRevision: state.revision,
  selectedCardIdsByPlayer: {
    A: "DIAMONDS-4",
    B: "CLUBS-7",
    C: "SPADES-K"
  },
  targetPlayerIdByCardId: {
    "DIAMONDS-4": "B",
    "CLUBS-7": "C",
    "SPADES-K": "A"
  }
});
```

如果方块 4 被 A 换给 B，且这是全场当前最小手牌，则结果会自动变为：

```json
{
  "currentTurn": "B",
  "firstPlayRequirement": {
    "kind": "MIN_CARD",
    "ownerId": "B",
    "cardId": "DIAMONDS-4"
  }
}
```

这修正了旧项目中“最小牌换走了，但出牌权没有跟随”的错误。

## 10. 最后一张托管示例

玩家只剩 1 张牌时，可以开启托管：

```ts
state = nextState(state, {
  type: "SET_AUTO_PLAY_LAST_CARD",
  playerId: "C",
  enabled: true,
  expectedRevision: state.revision
});
```

当轮到 C 时，调用方可以让规则引擎生成自动 action：

```ts
const autoAction = getAutoPlayAction(state);

if (autoAction) {
  state = nextState(state, autoAction);
}
```

托管逻辑：

- 如果最后一张能合法打出，则自动 `PLAY_CARD`。
- 如果不能打出但可以 PASS，则自动 `PASS`。
- 如果两者都不合法，返回错误，状态不变。

## 11. 与旧项目差异说明

- 旧项目使用 class 和内存 Map 管理房间；新模块完全函数式，无外部状态。
- 旧项目部分注释写“每人 14 张”，但主流程和规则文档为每人 13 张；本模块以 13 张为准。
- 旧项目的 `mustPlayCards()` 对五张牌型判断不完整；本模块不使用该简化逻辑。
- 旧项目的换牌、拍炸、抢拍属于完整房间流程。本模块当前聚焦“标准出牌规则引擎”，保留 `multiplier` 和 `score` 字段，后续可继续以 action 形式扩展 `SWAP_*`、`BOMB_*`，但不应破坏 `nextState` 唯一入口。
- 本模块已加入 `SWAP_CARDS` 的纯函数换牌解析，并修正换牌后首出权必须跟随全场当前最小手牌。
- 本模块已加入 `revision/expectedRevision` 乐观回合锁，用于防止多人同时操作覆盖状态。
- 本模块已加入最后一张托管能力，通过 `SET_AUTO_PLAY_LAST_CARD` 和 `AUTO_PLAY_LAST_CARD` 驱动。
