---
name: xiaohongshu-comic-asset-ingestion
description: Ingest all images from one user-selected Xiaohongshu note into this repository's Supabase-backed manga asset library. Use after the user has selected a specific note and comic; do not use for broad topic research or publishing.
---

# Xiaohongshu Comic Asset Ingestion

Turn one reviewed Xiaohongshu note into reusable, traceable reference assets for the active manga account. The result is an asset-library record, not a publication-ready claim of ownership.

## Required scope

Confirm or infer only these inputs:

- A user-selected Xiaohongshu note URL or short link, and its target comic.
- The active account and the matching comic record in the workspace.
- Whether the user wants every image retained. Default: retain every valid image from the selected note.

Do not expand to a creator profile, a search-result batch, or another note unless the user explicitly asks. Do not create a Topic/Brief or publish content as part of ingestion.

## Collect the note safely

Use the OpenCLI Xiaohongshu adapter, not hand-written requests to Xiaohongshu. Load `opencli-usage` before starting an OpenCLI session and prefer its `note` and `download` commands.

- Check `opencli doctor` first.
- Use a full signed note URL or supported short link.
- Retrieve the note details once, then download its media once to a local ignored temporary directory such as `.tmp/asset-ingestion/<note-id>/`.
- Keep the note ID, title, author, original source URL, and downloaded image order. A signed URL may expire, so the note ID is the durable deduplication key.
- Keep activity read-only: do not like, save, follow, comment, publish, or repeatedly reload the note.

## Classify before writing

Inspect each downloaded image individually. Store valid images without resizing or recompressing them.

Assign the smallest useful metadata set:

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
- Work name, a note-title-derived chapter/segment label, source-note image order, and default tags.

Use default tags sparingly: `单图` or `拼图`, plus a concrete segment tag when the note makes it clear (for example `新特典`). The comic relationship belongs in `comic_id`, not a redundant free-text tag. Do not fabricate emotional or character tags merely to make filtering look richer.

Deduplicate within the active account by stable note ID plus image index/original filename before upload. Preserve an existing asset rather than creating another copy. Never auto-link assets to a Brief; that remains a user review action.

## Verify the result

After upload:

1. Confirm the number of stored assets equals the valid downloaded-image count, accounting for deduplicated items.
2. Reload the asset page and ensure each asset has a working signed preview.
3. Confirm stored collage images fill their card normally and that clicking any preview opens the full original image.
4. Report the total, available single-image count, retained collage/uncertain count, and any skipped files or uncertain classifications.

## Boundaries

- Source images are references only. Do not present them as original work, and do not bypass the user's manual publishing review.
- Do not store an image if it is corrupted, non-image media, or outside the selected note's media list; explain the omission.
- Do not expose Supabase access tokens, long-lived storage credentials, or the user's Xiaohongshu credentials.
- Improve this skill only from repeated workflow evidence. Keep it limited to single-note manga asset ingestion.
