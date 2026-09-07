---
name: kuaikan-comic-profile-enrichment
description: Verify and enrich the official profile and cover of a Kuaikan comic after the user has kept it. Use for selected-library profile completion or re-verification; do not use for candidate discovery, selection, topic research, or publishing.
---

# Kuaikan Comic Profile Enrichment

Complete one already-kept comic record from its official Kuaikan title page. Keep candidate discovery and human selection outside this workflow.

## Entry and Authorization

Only process comics whose status is `selected`, `following`, `paused`, or `completed`. A click on the comic card's “自动补全官方档案” or “重新核验官方档案” button authorizes fetching and saving that comic only. An explicit user request to enrich a named kept comic is equivalent authorization.

Do not process `candidate` records or change a comic's review status. Do not expand a single-comic action into a batch unless the user explicitly requests the batch.

## Official Source Resolution

Prefer an existing `officialSourceUrl` that is an HTTPS `www.kuaikanmanhua.com/web/topic/<id>` page. Otherwise search `https://www.kuaikanmanhua.com/sou/<作品名>` and select a direct official topic page only after verifying its title.

Allow a minor title variant only when the match is unambiguous. Preserve the library title and surface the canonical Kuaikan title as a warning; never silently rename the record. Stop when the official title is materially different or no reliable topic page is found.

## Evidence Boundary

Treat only the official topic page's title, author, tags, description, and official cover as source facts. Do not use Xiaohongshu, comments, encyclopedias, search snippets, or model memory to fill plot details.

The text model may conservatively organize the official description into these fields:

- `officialSynopsis`
- `officialSourceUrl`
- `setting`
- `mainCharacters`
- `relationshipSummary`
- `coreConflicts`
- `contentThemes`
- `toneTags`
- `spoilerBoundary`

Keep `officialSynopsis` verbatim except for removing the page's title prefix and trailing update/editorial boilerplate. Derived fields must not add names, identities, relationships, events, reversals, or endings absent from that synopsis. Mark missing information as not stated by the official synopsis.

## Save Result

Fetch the official landscape cover, validate that it is an image no larger than the application's cover limit, and save it through the existing private Storage path together with the structured profile. Use the repository's normal profile save operation so account and comic ownership checks remain enforced.

On success, report the official URL and any title-variant warning. On failure, save nothing and return an actionable error. Do not publish, generate content, or modify other comics as part of this workflow.
