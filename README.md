# Creator Ops Studio

面向个人创作者的双账号内容运营工作台。第一条完整业务链服务漫画账号，底层数据模型同时支持“求职 + 学习 + 技术”成长账号。

## 当前能力

- 双账号切换与独立内容定位
- 选题看板、评分和人工审核状态流
- OpenCLI 小红书调研任务与导入箱
- 素材分组、来源与使用记录界面
- 文案版本与审核工作台
- 漫画更新、发布和复盘日历
- 发布表现与栏目分析界面
- Supabase schema、索引、触发器和 RLS 策略
- 无 Supabase 密钥时自动使用本地演示数据

## 本地启动

本项目需要 Node.js 20.18.1 或更高版本。当前 Codex 工作区使用内置 Node.js 24。

```powershell
pnpm install
pnpm dev
```

访问终端输出的本地地址。浏览器本地模式的修改会保存到 `localStorage`。

## 接入 Supabase

1. 复制 `.env.example` 为 `.env.local`。
2. 在 Supabase 项目设置中找到 Project URL 和 publishable key。
3. 填写环境变量，并将 `VITE_DATA_MODE` 改成 `supabase`。
4. 执行 `supabase/migrations/202609020001_initial_schema.sql`。
5. 在 Supabase Storage 创建私有 bucket：`content-assets`。

```env
VITE_SUPABASE_URL=https://kxodqxkuusdmlzgteabx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
VITE_DATA_MODE=supabase
```

publishable key 可以出现在前端，但 `service_role` 和 AI API Key 永远不能放进 `VITE_*` 环境变量。

## OpenCLI

项目将 OpenCLI 固定为开发依赖，用于低频、人工触发的小红书调研：

```powershell
pnpm opencli:doctor
pnpm opencli:xhs search "关键词" --limit 20 -f json
```

详细边界见 `docs/OPENCLI.md`。自动发布、批量互动和无人值守抓取不在项目范围内。

## 验证

```powershell
pnpm lint
pnpm test
pnpm build
```

## 部署计划

后续使用 GitHub 连接 Cloudflare Pages：

- Production branch：`main`
- Build command：`pnpm build`
- Build output directory：`dist`

当前阶段只保证本地运行，不执行线上部署。
