---
name: xiaohongshu-comic-topic-research
description: Research Xiaohongshu topic references for one selected Kuaikan comic, import a bounded candidate set for human review, and turn same-comic references into a content topic. Use after a comic has been selected and before collecting source images. Do not use for broad comic discovery, image ingestion, copy generation, or publishing.
---

# Xiaohongshu Comic Topic Research

Turn one selected Kuaikan comic into a reviewable Xiaohongshu topic candidate without automating publication.

## Boundaries

- Work on exactly one selected comic per research task.
- Treat search results as reference candidates, not approved topics.
- Keep browser work read-only. Stop on verification, abnormal prompts, or access failures; do not auto-retry.
- Do not download images in this skill. Use `xiaohongshu-comic-asset-ingestion` only after the user has chosen a source note or topic.
- Do not invent note details. A `list_only` result may contain only title, author, engagement, date, URL, and note ID.

## Research contract

1. Confirm the comic already exists in the workbench and is selected or followed.
2. Choose the query and time strategy from the comic's serialization status. For an ongoing comic, prepare two or three title-containing queries around the newest chapter, special episode, or update point and use a one-week window. For a completed comic, use durable angles such as named scenes, character interaction, classic lines, ending discussion, or plot points; do not query “latest chapter” or apply a recency window.
3. Use the local OpenCLI browser workflow with the user's existing login state. Read the stable image-post search route and only the first result screen. Sort the captured list by likes locally; for an ongoing comic, retain notes dated in the last week. “Unseen” means not already imported into this workbench, not the platform's private viewing-history flag.
4. Read only the first result screen for each query. Do not auto-scroll. Deduplicate by note ID, falling back to the signed source URL, then keep at most ten results across all queries.
5. Show the results before import. Import only the rows the user explicitly checks.

## Review and topic creation

- Imported rows start as `candidate` and remain visible in the reference-note library.
- Let the user mark each note `kept` or `rejected`; importing alone is not approval.
- Preserve the source URL, note ID, matched query, title, author, engagement, publication date, comic relation, and detail status.
- Only references for the same comic may be combined into one topic.
- When the user creates a topic, link the chosen references to it and mark them `kept`. Do not consume or delete references; one reference remains part of the research record.
- Generate the Brief from linked, kept references. Use their shared attention signals and highest-engagement angle as evidence, but do not copy source wording.

## Completion

The workflow is complete when the user can see the persistent reference candidates, review them, create a linked topic, and inspect a candidate Brief. Stop before material download, final copy generation, or publishing.
