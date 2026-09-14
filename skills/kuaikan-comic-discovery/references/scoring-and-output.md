# 评分与输出约定

## 证据门槛

入选候选必须具备：

1. 一个直接快看官方作品 URL 或同等官方证据。
2. 至少三个不同的小红书查询。
3. 总计至少三篇相关小红书笔记，除非明确标为 `weak_evidence`。
4. 最终证据集中至少两个直接小红书笔记 URL。

排除不相关同名作品、仅顺带提到作品的泛推荐列表，以及同一笔记的重复副本。

## 评分

每部候选满分 100 分。分数辅助人工审核，不预测爆款。

### 已验证小红书需求：0–40 分

结合相关笔记的标准化点赞、不同相关笔记数量和跨查询一致性。没有其他笔记支撑时，单篇异常高值最多获得 24 分。

建议区间：

- 32–40：多种意图下有多篇强信号笔记。
- 20–31：需求明确，但集中在一种意图或少数笔记。
- 8–19：信号一般。
- 0–7：可用证据很少。

### 当前需求：0–20 分

日期可获取时，使用最近 180 天的相关发布活动。只有连载状态和更新安排都已核验，才能为有固定更新的连载作品加分。

### 可复用选题广度：0–25 分

统计有证据的独立角度，例如人物成长、关系变化、名场面、结局讨论、重读或连载更新讨论。不得仅凭标题编造场景细节。

### 账号匹配：0–15 分

根据提供的账号定位与此前接受的作品判断，用一句话解释匹配理由。不得用此项代替证据。

## 排名表

使用以下列：

| 排名 | 漫画 | 状态 | 分数 | 最强信号 | 匹配理由 | 证据质量 |
|---|---|---|---:|---|---|---|

证据质量取值为 `strong`（强）、`medium`（中）或 `weak_evidence`（证据弱）。

## 候选记录

每部入选漫画返回一个对象：

```json
{
  "title": "规范作品名",
  "aliases": [],
  "author": null,
  "kuaikan_url": "https://...",
  "serialization_status": "ongoing|completed|unknown",
  "update_weekday": null,
  "discovered_at": "YYYY-MM-DD",
  "verification_date": "YYYY-MM-DD",
  "score": 0,
  "evidence_quality": "strong|medium|weak_evidence",
  "signals": {
    "proven_demand": 0,
    "current_demand": 0,
    "topic_breadth": 0,
    "account_fit": 0
  },
  "xhs_queries": [],
  "evidence_notes": [
    {
      "title": "",
      "author": "",
      "url": "https://...",
      "published_at": null,
      "likes_raw": "",
      "likes_count": null,
      "angle": ""
    }
  ],
  "reason": "",
  "uncertainties": [],
  "review_status": "candidate"
}
```

`review_status` 保持 `candidate`，由用户在工作台审核。

## 排除记录

单独返回被排除作品，并提供一个或多个原因代码：

- `not_verified_on_kuaikan`：未核验到快看官方来源。
- `duplicate_existing`：与已有记录重复。
- `insufficient_xhs_evidence`：小红书证据不足。
- `poor_account_fit`：不符合账号定位。
- `ambiguous_title`：作品名有歧义。
