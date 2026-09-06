---
name: xiaohongshu-comic-note-capture
description: Capture the complete metadata and media list for one human-kept Xiaohongshu comic reference note, then hand valid images to the asset-ingestion skill. Use only after a user keeps a research-inbox note and clicks capture. Do not use for discovery batches, topic synthesis, Brief generation, or publishing.
---

# Xiaohongshu Comic Note Capture

Capture one retained reference note as a durable research asset. The human decision to keep the note has already happened; this skill does not make another keep/reject decision.

## Start gate

Start only when all are true:

- The user clicked **采集完整信息/素材** for one note already persisted from the research inbox.
- The note belongs to the active comic and has a source URL or stable note ID.
- The note is marked `kept` by the user.

If a list-only candidate has not been kept, stop and send it back for human review. Never capture a search-result batch.

## Capture contract

1. Use the local OpenCLI Xiaohongshu adapter with the existing login state. Read `opencli-usage` before beginning an OpenCLI session.
2. Run `opencli doctor` once. Retrieve the chosen note's detail once, then stop on a verification page, expired signed URL, access refusal, or abnormal prompt. Do not repeatedly retry.
3. Persist only facts returned by the detail view: stable note ID, canonical/source URL, title, body, hashtags, author, publication time, visible engagement, media count, media order, retrieval timestamp, and `detail_status: captured`.
4. Preserve the list-row query and metrics as retrieval provenance; detailed values do not overwrite that history.
5. Call `xiaohongshu-comic-asset-ingestion` for the selected note's valid image files. Its default result is `pending` human review, not an invented semantic label.

## Stop gate

After metadata and media have been persisted, show the note as **已采集，待素材审核**. Stop before:

- deciding whether an image is a single image or collage;
- selecting material for a Brief;
- creating a topic or Brief;
- generating text or publishing.

## Safety and traceability

- Keep every platform action read-only: no liking, saving, following, commenting, or publishing.
- Never copy source captions into a generated draft. Note body and hashtags are research evidence with source provenance.
- Preserve source-note ID and image order for deduplication. Do not expose login credentials or storage/API secrets.
