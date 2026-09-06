---
name: xiaohongshu-comic-reference-discovery
description: Find a small, deduplicated set of Xiaohongshu image-post reference candidates for one selected Kuaikan comic and stage them for explicit human import. Use after comic selection and before note-detail capture. Do not use for importing, reading full note details, asset ingestion, topic creation, Brief generation, copy generation, or publishing.
---

# Xiaohongshu Comic Reference Discovery

Return a reviewable research result set for one selected Kuaikan comic. This skill ends at the user's explicit import decision.

## Boundaries

- Work on exactly one selected comic per research task.
- Treat search results as reference candidates, not approved topics.
- Keep browser work read-only. Stop on verification, abnormal prompts, or access failures; do not auto-retry.
- Do not open note-detail pages, download media, or create database records in this skill.
- Never create a topic or a Brief. Hand each imported note to `xiaohongshu-comic-note-capture`; topic formation belongs to `comic-topic-synthesis`.
- Do not invent note details. A `list_only` result may contain only title, author, engagement, date, URL, and note ID.

## Research contract

1. Confirm the comic already exists in the workbench and is selected or followed.
2. Choose the query and time strategy from the comic's serialization status. For an ongoing comic, prepare two or three title-containing queries around the newest chapter, special episode, or update point and use a one-week window. For a completed comic, use durable angles such as named scenes, character interaction, classic lines, ending discussion, or plot points; do not query “latest chapter” or apply a recency window.
3. Use the local OpenCLI browser workflow with the user's existing login state. Read the stable image-post search route and only the first result screen. Sort the captured list by likes locally; for an ongoing comic, retain notes dated in the last week. “Unseen” means not already imported into this workbench, not the platform's private viewing-history flag.
4. Read only the first result screen for each query. Do not auto-scroll. Deduplicate by note ID, falling back to the signed source URL, then keep at most ten results across all queries.
5. Show the results before import. Import only the rows the user explicitly checks.

## Human gate: import candidates

- Present the list in the research inbox. The user must explicitly click **确定导入** for each row; do not auto-import search results.
- On that click, persist only: source URL, note ID, matched query, list title, author, engagement, publication date, comic relation, retrieval timestamp, and `detail_status: list_only`.
- Imported rows start as `candidate`; import is not a “keep” decision. The next human action is to keep or reject the reference in the library.
- Never call the detail-capture workflow from this skill. It must begin only when the user asks to capture a kept note.

## Completion

The workflow is complete when the user can see a bounded candidate set and explicitly import selected list records into the research inbox. Stop before full-note capture, material download, topic formation, Brief generation, final copy generation, or publishing.
