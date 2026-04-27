# 打朋友 Web UI

React + Vite 前端应用，使用 Supabase 提供认证、房间状态、聊天、观战、排行榜和结算数据存储。

## 命令

```bash
npm install
npm run dev
npm run build
npm run preview
```

## 环境变量

复制 `.env.example` 为 `.env.local`：

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-publishable-or-anon-key
```

生产环境请在 Vercel Project Settings -> Environment Variables 中配置同名变量。

## Supabase

在 Supabase SQL Editor 执行：

```text
supabase/schema.sql
```

前端统一从 `src/lib/supabase.ts` 初始化 Supabase client。

## 目录

```text
src/app/components   通用组件
src/app/pages        页面
src/app/hooks        前端状态和房间 Hook
src/app/context      登录态
src/game             规则引擎归档
src/lib              Supabase、规则引擎和服务层
src/styles           样式与移动端适配
```

## Vercel

如果把仓库根目录导入 Vercel，可以直接使用根目录 `vercel.json`。

如果只导入 `web-ui` 子目录，请在 Vercel 中使用：

```text
Build Command: npm run build
Output Directory: dist
```
