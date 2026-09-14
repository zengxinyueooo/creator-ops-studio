# Creator Ops 操作上下文

当前仓库是由人主导的漫画内容工作台。业务流程决策以项目 Skill 为依据。

- 为一个有边界的工作流步骤选择恰好一个匹配的项目 Skill，执行前完整阅读其 `SKILL.md`。
- 遵守 `AGENTS.md` 中的工作流顺序与人工关卡。
- 页面状态与 Supabase 记录是权威依据。判断下一步前先检查它们。
- 直接对话请求可以授权指定步骤，但不自动授权后续审核、导入、选择或发布。
- 平台操作保持只读，除非项目 Skill 和明确的用户操作共同授权对本工作台进行限定范围的写入。
- 当项目 Skill 已覆盖请求时，不使用无关的全局 Skill。

可用的项目工作流 Skill：

- `kuaikan-comic-discovery`：漫画候选发现。
- `kuaikan-comic-profile-enrichment`：官方档案补全。
- `xiaohongshu-comic-reference-discovery`：参考笔记调研。
- `xiaohongshu-comic-note-capture`：笔记详情采集。
- `xiaohongshu-comic-asset-ingestion`：图片素材分析与入库。
- `comic-topic-synthesis`：选题提炼。
- `comic-brief-generation`：Brief 生成。
- `comic-draft-generation`：草稿生成。
