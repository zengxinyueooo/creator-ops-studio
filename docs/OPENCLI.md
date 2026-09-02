# OpenCLI 接入策略

OpenCLI 只用于登录态下、由用户主动触发的小红书调研。工作台不绕过验证码，不维护批量抓取循环，也不调用自动发布、关注或取关命令。

## 本地准备

项目已固定 `@jackwener/opencli` 版本。使用 Codex 工作区 Node.js 20+ 运行：

```powershell
pnpm opencli:doctor
pnpm opencli:xhs search "关键词" --limit 20 -f json
```

首次使用仍需按照 OpenCLI 官方文档安装 Browser Bridge，并在浏览器中正常登录小红书。

## 数据流

1. 工作台创建 `research_tasks`。
2. 用户复制并执行限量命令。
3. OpenCLI 返回 JSON。
4. 用户在导入箱预览、选择和确认。
5. 通过审核的项目写入 `references`，原始结果保存在 `raw_payload`。

## 默认安全边界

- 单次搜索最多 20 条，数据库硬上限 50 条。
- 不提供定时轮询。
- 不自动下载全部媒体。
- 不自动发布和互动。
- 保存来源链接、采集时间和原始响应。
- 页面或适配器失效时停止并要求人工检查，不尝试高频重试。
