---
name: xiaohongshu-comic-asset-ingestion
description: Store all valid images from one user-selected, already captured Xiaohongshu note in this repository's Supabase-backed manga asset library with source traceability. Use only after the user has kept a note and explicitly started capture. Do not use for broad topic research, automatic image judgment, topic creation, Brief generation, or publishing.
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

## Store first; review separately

Inspect only enough to reject corrupt or non-image files. Store valid image bytes without resizing or recompressing them.

Do not claim that an unconfigured background vision workflow has classified an image. Unless a separately configured visual model has actually returned a result, create each asset with:

- `visual_format: uncertain`
- `review_status: pending`
- `content_type: other`
- `classification_note`: `已从参考笔记采集，待人工确认图型与内容标签（第 N 张）`
- no semantic tags and no inferred character names

The user reviews format and tags in the material-review page. An explicit human click may then mark a single image `available` or a collage `rejected` while retaining both in the asset library.

If a configured visual-classification call is explicitly requested and succeeds, it may prefill the following smallest useful metadata set, but its result remains reviewable:

- `visual_format`: `single`, `collage`, `uncertain`, or `invalid`.
- `review_status`: `available` for a confirmed `single`; `rejected` for `collage` or `invalid`; `pending` for `uncertain`.
- `classification_note`: short visual reason, including the image position in the note.
- `content_type`: choose only when evident (`cover`, `character`, `interaction`, `plot`, `dialogue`, `atmosphere`); otherwise use `other`.
- `characters`: add names only when they are known from the comic or clearly identifiable; never guess.

For the current workflow, a `rejected` collage is still retained in the library. It simply cannot be added to a Brief because the first version only uses one continuous image per asset.

## Write to the asset library

Upload the image bytes to the private `content-assets` Supabase Storage bucket. Save only the object path in the `assets` table; use a signed URL at read time for previews.

Every stored asset must include:

- Account ID, comic ID, original filename, MIME type, byte size, storage path.
- `source_type: xiaohongshu`, original source URL, and stable `sourceNoteId` in `custom_fields` when the importer supports it.
- `copyrightStatus: reference_only` in `custom_fields` unless the user supplies stronger rights information.
- Work name, a note-title-derived chapter/segment label, source-note image order, and any confirmed semantic content tags.

When classification has actually occurred, use at most three semantic tags per image, with at most one from each group when possible:

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
4. Report the total, pending-review count, retained collage count (if manually or model-confirmed), and any skipped files.

## Boundaries

- Source images are references only. Do not present them as original work, and do not bypass the user's manual publishing review.
- Do not store an image if it is corrupted, non-image media, or outside the selected note's media list; explain the omission.
- Do not expose Supabase access tokens, long-lived storage credentials, or the user's Xiaohongshu credentials.
- Improve this skill only from repeated workflow evidence. Keep it limited to single-note manga asset storage.
