# 本地 Pi Worker 使用说明

该 Node 进程领取排队中的 `agent_runs`，为每个任务创建一个能力受限的 Pi `AgentSession`，并保存待人工审核的结果。当前支持官方档案补全、参考调研、笔记及素材采集、选题提炼、Brief 生成和草稿生成六类任务。

公共运行约束在 `RUNTIME.md`，任务专用约束在 `runtimes/`。

1. 按顺序应用项目数据库迁移；Agent 接入包含 `supabase/migrations/202609080001_agent_execution.sql` 和 `supabase/migrations/202609080002_generalize_agent_runs.sql`。
2. 在 `.env.local` 配置 `SUPABASE_SERVICE_ROLE_KEY`，不得加上 `VITE_` 前缀。
3. 使用 `pnpm dev:agent` 同时启动页面和 Worker。

默认模型为 `openai-codex/gpt-5.6-terra`，可用 `PI_RESEARCH_MODEL` 覆盖。Worker 使用 Pi 常规 Agent 目录中的 Codex 认证，并通过 `CREATOR_OPS_APP_URL` 访问本地 Vite 桥。该地址必须与实际页面服务地址一致。

`pnpm worker` 可单独启动 Worker；`pnpm worker:once` 只进行一轮领取处理。上述命令用于实际运行，不是只读校验。
