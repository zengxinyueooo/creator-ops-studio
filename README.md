# Creator Ops Studio

面向个人创作者的双账号内容运营工作台。第一条完整业务链服务漫画账号，底层数据模型同时支持“求职 + 学习 + 技术”成长账号。

## 当前能力

- 双账号切换与独立内容定位
- 选题看板、结构化内容 Brief 与人工审核状态流
- OpenCLI 小红书 2–3 关键词批次调研、固定筛选、去重预览与人工勾选导入
- 素材单图/拼图审核、漫画和 Brief 关联、来源与可复用使用记录
- 基于已通过 Brief 和已选单图的文案演示工作台
- 漫画更新、发布和复盘日历
- 发布表现与栏目分析界面
- Supabase schema、索引、触发器和 RLS 策略
- Supabase 邮箱认证与按用户隔离的云端数据
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
4. 按文件名顺序执行 `supabase/migrations/` 中的 SQL。

第二份迁移会创建私有 bucket `content-assets`，限制图片格式与 15MB 大小，并确保每个用户只能访问以自己用户 ID 开头的目录。

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
```

本地开发服务器提供受限的 `/api/opencli/xhs-search` 桥接端点。它只接受本机工作台请求，通过 OpenCLI 控制已登录 Chrome 的公开搜索页面，并在保存前移除 `xsec_token` 等临时参数。工作台中的使用流程是：

1. 选择所属漫画，填写 2–3 个明确关键词。
2. 点击“本机执行”；每个关键词依次选择“图文 / 一周内 / 未看过 / 最多点赞”。
3. 每个关键词只读取初始可视区域，不自动滚动；跨关键词去重后最多返回 10 条。
4. 逐条检查并勾选，点击“确认导入”后才写入 Supabase。

Cloudflare Pages 不会运行本机 OpenCLI。线上版本仍需电脑上的伴随服务在线；当前阶段只验证本机流程。

详细边界见 `docs/OPENCLI.md`。自动发布、批量互动、自动滚动和无人值守抓取不在项目范围内。

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

## 漫画知识档案与 Brief

在漫画候选区或已保留库点击“编辑漫画档案”，保存官方简介、快看官方链接、故事设定、人物、关系、冲突、主题、情绪与剧透边界。空字段代表未知。云端使用既有 `comics.custom_fields.content_profile`，保留其他扩展字段，不需要新增迁移；封面存入私有 `content-assets`，`cover_storage_path` 持久化路径，页面加载时生成一小时签名链接。本地演示模式保存到浏览器本地存储。

先保留参考并采集完整正文及全部图片，再从同漫画参考创建选题。点击生成 Brief 时校验所属账号、漫画、保留状态、采集状态和图片完整性；输入完整正文与档案，保存本次档案快照及参考 ID。没有模型时输出待人工策划清单，缺项标注未知。审核通过后仍须手动选素材和人工发布。
