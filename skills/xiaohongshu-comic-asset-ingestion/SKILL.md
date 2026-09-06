---
name: xiaohongshu-comic-asset-ingestion
description: Analyze and store all valid images from one user-selected, already captured Xiaohongshu note in this repository's Supabase-backed manga asset library with source traceability. Use only after the user has kept a note and explicitly started capture. Do not use for broad topic research, topic creation, Brief generation, or publishing.
---

# Xiaohongshu Comic Asset Ingestion

Turn one reviewed Xiaohongshu note into reusable, traceable reference assets for the active manga account. The result is an asset-library record, not a publication-ready claim of ownership.

## Required scope

This is the storage part of `xiaohongshu-comic-note-capture`. Run it only after the user clicks to capture one kept note, its detail metadata has been collected, and its target comic is known.

Confirm only these inputs:

- A user-selected Xiaohongshu note URL or short link, and its target comic.
- The active account and the matching comic record in the workspace.
- Whether the user wants every image retained. Default: retain every valid image from the selected note.

Do not expand to a creator profile, a search-result batch, or another note unless the user explicitly asks. Do not create a Topic/Brief or publish content as part of ingestion.

## Collect the note safely

Use the OpenCLI Xiaohongshu adapter, not hand-written requests to Xiaohongshu. Load `opencli-usage` before starting an OpenCLI session and use the capture record's media list with the adapter's `download` command.

- Check `opencli doctor` first.
- Use the captured note ID and media list; do not retrieve note details again.
- Download its media once to a local ignored temporary directory such as `.tmp/asset-ingestion/<note-id>/`.
- Keep the note ID, title, author, original source URL, topic hashtags, and downloaded image order. A signed URL may expire, so the note ID is the durable deduplication key.
- Keep activity read-only: do not like, save, follow, comment, publish, or repeatedly reload the note.

## Analyze, then store

Inspect only enough to reject corrupt or non-image files. Send every valid image once to the configured visual model before writing the asset record; then store its original bytes without resizing or recompressing them.

The default visual model is an explicit part of capture, not a separate manual-review queue. It must return structured metadata for each image. A continuous vertical comic image remains `single` even if it contains several comic panels; use `collage` only when the uploaded image visibly combines two or more independent images with a joining boundary.

- `visual_format`: `single`, `collage`, `uncertain`, or `invalid`.
- `review_status`: `available` for `single`; `rejected` for `collage` or `invalid`; `pending` only when the model explicitly returns `uncertain`.
- `classification_note`: one concise visual description.
- `content_type`: `cover`, `character`, `interaction`, `plot`, `dialogue`, `atmosphere`, or `other`.
- two to five deduplicated semantic tags and a bounded confidence value.
- `characters`: only names visibly written in the image or supplied as unambiguous comic context; otherwise leave empty. Never create a “角色待确认” asset tag.

If visual analysis is not configured or fails, stop before asset creation and report the configuration/error. Do not silently create an unlabeled `pending` asset. Existing legacy pending assets can be reanalyzed in one explicit maintenance action.

The model’s result is the initial workflow status. The user may later correct an exceptional result, but the standard card should show the actual analysis labels rather than a mandatory “确认单图” action. A rejected collage is retained for provenance but cannot be added to a Brief.

## Write to the asset library

Upload the image bytes to the private `content-assets` Supabase Storage bucket. Save only the object path in the `assets` table; use a signed URL at read time for previews.

Every stored asset must include:

- Account ID, comic ID, original filename, MIME type, byte size, storage path.
- `source_type: xiaohongshu`, original source URL, and stable `sourceNoteId` in `custom_fields` when the importer supports it.
- `copyrightStatus: reference_only` in `custom_fields` unless the user supplies stronger rights information.
- Work name, a note-title-derived chapter/segment label, source-note image order, and any confirmed semantic content tags.

Use two to five semantic tags per image, with at most one from each group when possible:

- Emotion: `甜`, `暧昧`, `心动`, `治愈`, `轻松`, `紧张`, `虐心`, `悬念`, `反差萌`.
- Relationship or story beat: `对视`, `承诺`, `守护`, `吃醋`, `信任危机`, `关系推进`, `设定揭秘`.
- Visual expression: `双人同框`, `双人对话`, `人物特写`, `亲密距离`, `萌宠`.

Use only what the image or its visible dialogue supports. Treat note hashtags as candidate evidence: deduplicate them, retain them in `custom_fields.sourceNoteTags` for traceability, and promote one to a visible content tag only when it describes the actual image. `单图`/`拼图` belong in `visual_format`; characters, content type, chapter labels, and source terms such as `新特典` have their own fields. Never use placeholder tags such as `测试`.

Deduplicate within the active account by stable note ID plus image index/original filename before upload. Preserve an existing asset rather than creating another copy. Never auto-link assets to a Brief; that remains a user review action.

## Verify the result

After upload:

1. Confirm the number of stored assets equals the valid downloaded-image count, accounting for deduplicated items.
2. Reload the asset page and ensure each asset has a working signed preview.
3. Confirm each preview opens the full original image.
4. Report the total, model-available single-image count, retained collage count, uncertain count, and any skipped files.

## Boundaries

- Source images are references only. Do not present them as original work, and do not bypass the user's manual publishing review.
- Do not store an image if it is corrupted, non-image media, or outside the selected note's media list; explain the omission.
- Do not expose Supabase access tokens, long-lived storage credentials, or the user's Xiaohongshu credentials.
- Improve this skill only from repeated workflow evidence. Keep it limited to single-note manga asset storage.
