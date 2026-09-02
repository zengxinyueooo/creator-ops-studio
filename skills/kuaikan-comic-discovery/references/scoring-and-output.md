# Scoring and Output Contract

## Evidence threshold

A shortlisted candidate must have:

1. One direct official Kuaikan title URL or equivalent official Kuaikan evidence.
2. At least three distinct Xiaohongshu queries.
3. At least three relevant Xiaohongshu notes in total, unless explicitly labeled `weak_evidence`.
4. At least two direct Xiaohongshu note URLs in the final evidence set.

Exclude irrelevant homonyms, generic recommendation lists that only mention the title in passing, and duplicate copies of the same note.

## Score

Score each candidate out of 100. Scores support human review; they are not predictions of virality.

### Proven Xiaohongshu demand: 0-40

Use normalized likes from relevant notes, the number of distinct relevant notes, and consistency across queries. A single outlier cannot earn more than 24 points without supporting notes.

Suggested bands:

- 32-40: several strong notes across multiple intents
- 20-31: clear demand but concentrated in one intent or a few notes
- 8-19: modest signal
- 0-7: little usable evidence

### Current demand: 0-20

Use relevant posting activity from the last 180 days when dates are available. An ongoing, scheduled title can receive additional credit only when its status and schedule are verified.

### Reusable topic breadth: 0-25

Count distinct evidenced angles, such as character arcs, relationship turns, memorable scenes, ending discussion, rereading, or serialized-update discussion. Do not invent scene details from titles alone.

### Account fit: 0-15

Judge against the supplied account brief and previously accepted works. Explain the fit in one sentence. Do not use this category as a substitute for evidence.

## Ranked table

Use these columns:

| Rank | Comic | Status | Score | Strongest signal | Why it fits | Evidence quality |
|---|---|---|---:|---|---|---|

Evidence quality is one of `strong`, `medium`, or `weak_evidence`.

## Candidate record

Return one object per shortlisted comic:

```json
{
  "title": "canonical title",
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

Keep `review_status` as `candidate`. The user performs approval in the workbench.

## Rejections

Return rejected titles separately with one or more reason codes:

- `not_verified_on_kuaikan`
- `duplicate_existing`
- `insufficient_xhs_evidence`
- `poor_account_fit`
- `ambiguous_title`
