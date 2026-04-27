# 打朋友网页版联机纸牌游戏

这是一个基于 React + Vite + Supabase 的网页端多人联机纸牌游戏。项目包含完整牌局 UI、规则引擎、房间同步、观战、聊天、排行榜、个人资料、结算记录、打赏弹窗和移动端适配。

## 项目结构

```text
web-ui/
  src/
    app/          页面、路由、布局、组件、Hooks
    assets/       静态资源
    game/         规则引擎归档
    lib/          Supabase、房间服务、规则引擎、工具函数
    styles/       全局样式与响应式适配
  supabase/       数据库 schema
vercel.json       Vercel 根目录部署配置
```

## 本地运行

```bash
cd web-ui
npm install
copy .env.example .env.local
npm run dev
```

`.env.local` 需要填写：

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-publishable-or-anon-key
```

首次运行前，在 Supabase SQL Editor 执行：

```text
web-ui/supabase/schema.sql
```

## 构建检查

```bash
cd web-ui
npm run build
npm run preview
```

预览地址：

```text
http://127.0.0.1:4173/
```

## 上传 GitHub

上传仓库根目录：

```text
D:\VIBE CODING 项目\打朋友网页端
```

上传前确认不要提交：

```text
node_modules/
dist/
.env
.env.local
.vercel/
```

这些文件已经写入 `.gitignore`。

## Vercel 部署

推荐直接导入 GitHub 仓库根目录。根目录的 `vercel.json` 已配置：

```json
{
  "installCommand": "cd web-ui && npm ci",
  "buildCommand": "cd web-ui && npm run build",
  "outputDirectory": "web-ui/dist"
}
```

在 Vercel Project Settings -> Environment Variables 添加：

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

部署完成后，在 Supabase Dashboard -> Authentication -> URL Configuration 添加 Vercel 域名：

```text
Site URL: https://你的项目名.vercel.app
Redirect URLs: https://你的项目名.vercel.app/**
```

## 发布后测试

- 注册 / 登录
- 创建房间、加入房间
- 2-4 人准备开局
- 换牌、拍炸、抢拍、出牌、PASS
- 观战明牌
- 聊天和 emoji
- 结算与排行榜
- 手机和平板端布局
- 打赏弹窗显示和关闭
