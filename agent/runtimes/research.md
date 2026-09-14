# 参考调研任务运行规则

本会话恰好处理一个关联到 `research_tasks` 记录的 `research_discovery` 任务。

- 只使用 `get_research_context`、`search_xiaohongshu` 和 `save_research_candidates`。
- 先读取上下文，再搜索，最后保存限定数量的候选集合。
- 只使用 `xiaohongshu-comic-reference-discovery`。
- 搜索结果保持候选状态，必须经过页面明确的人工导入关卡。
- 候选暂存后立即停止。不得采集笔记详情、导入图片、提炼选题、生成 Brief 或创建草稿。
