# 打朋友网页版联机整合说明

## Supabase 表

SQL 文件：`supabase/schema.sql`

核心表：`game_rooms`

```sql
id text primary key,
players jsonb not null default '[]'::jsonb,
state jsonb,
version integer not null default 0,
created_at timestamptz not null default now()
```

`state` 直接存储 `STANDARD_RULE_ENGINE.ts` 产生的 `GameState`。房间只有 1 名玩家时，规则引擎还不能 `INIT_GAME`，因此 `state` 暂为 `null`；第 2 名玩家入座后通过 `nextState(null, INIT_GAME)` 初始化。

## 前端入口

- Supabase client：`src/lib/supabase.ts`
- 玩家本地身份：`src/lib/playerIdentity.ts`
- 房间服务：`src/lib/gameRoomService.ts`
- React 状态同步：`src/app/hooks/useGameRoom.ts`
- 大厅页面：`src/app/pages/Lobby.tsx`
- 房间页面：`src/app/pages/Room.tsx`

## 操作链路

```text
按钮点击
  -> 生成 GameAction
  -> applyRoomAction(roomId, action)
  -> 从 Supabase 拉取最新 room.state 与 room.version
  -> action.expectedRevision = state.revision
  -> nextState(state, action)
  -> update game_rooms
       set state = newState, version = oldVersion + 1
       where id = roomId and version = oldVersion
  -> 所有客户端通过 Realtime + 1s polling 同步新 state
```

## 本地运行

1. 在 Supabase SQL Editor 执行 `supabase/schema.sql`。
2. 复制 `.env.example` 为 `.env.local`。
3. 填入：

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

4. 安装依赖并启动：

```bash
npm install
npm run dev
```

## 当前最小功能

- 创建房间
- 加入房间
- 2-4 人初始化 GameState
- START_GAME
- PLAY_CARD
- PASS
- 最后一张牌托管开关与自动执行
- Supabase `version` 乐观锁
- 引擎 `revision` 回合锁
- Realtime 订阅 + 1 秒轮询兜底
