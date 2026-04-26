# 打朋友网页联机纸牌游戏

这是一个网页端多人联机纸牌游戏项目，包含：

- 纯规则引擎：`STANDARD_RULE_ENGINE.ts`
- 规则引擎测试：`ENGINE_RULE_TESTS.mjs`
- React/Vite 前端：`web-ui/`
- Supabase 房间表结构：`web-ui/supabase/schema.sql`
- GitHub Pages 自动部署 workflow：`.github/workflows/deploy-pages.yml`

## 本地运行

```bash
cd web-ui
npm install
npm run dev
```

## Supabase 配置

1. 在 Supabase SQL Editor 执行 `web-ui/supabase/schema.sql`。
2. 复制 `web-ui/.env.example` 为 `web-ui/.env.local`。
3. 填入：

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## 构建

```bash
cd web-ui
npm run build
```

## GitHub Pages 部署

仓库推送到 GitHub 后：

1. 在仓库 Settings -> Pages 中选择 GitHub Actions。
2. 在仓库 Settings -> Secrets and variables -> Actions 中配置：
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. 推送到 `main` 分支后，workflow 会自动构建并发布。
