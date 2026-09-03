---
name: kuaikan-comic-discovery
description: Discover and evaluate comics for a Kuaikan-only Xiaohongshu account by verifying official Kuaikan availability and validating demand with read-only OpenCLI Xiaohongshu research. Use when building or refreshing the comic candidate library. Do not use for topic or material research for an already selected comic.
---

# Kuaikan Comic Discovery

Create an evidence-backed shortlist for the user's review. Treat every result as a candidate, never as an approved comic.

## Inputs

Collect or infer these inputs before research:

- Target account brief. Default to the user's Kuaikan-comic Xiaohongshu account when this repository is the active project.
- Desired shortlist size. Default to 10 candidates.
- Optional titles the user has read, likes, dislikes, or already rejected.
- Existing comic records, so results can be deduplicated.

Do not block when optional inputs are absent. State reasonable assumptions and proceed.

## Workflow

### 1. Build a seed pool

Use current, public Kuaikan sources to collect plausible titles. Prefer official Kuaikan rankings, recommendations, search results, or verified title pages. Supplement with user-provided titles.

Record the discovery source and date. Do not treat general web popularity as proof that a title is available on Kuaikan.

### 2. Apply the Kuaikan hard gate

For every title, find a direct official Kuaikan title page or equivalent official Kuaikan evidence. Record:

- Canonical title
- Official Kuaikan URL
- Author when available
- Serialization status: `ongoing`, `completed`, or `unknown`
- Update weekday when explicitly published; otherwise `null`
- Verification date

Reject the title if official Kuaikan availability cannot be verified. Do not infer an update weekday.

### 3. Validate Xiaohongshu demand with OpenCLI

Load and follow `opencli-usage` before starting an OpenCLI session. Prefer the Xiaohongshu adapter over raw browser driving.

Run discovery first because adapter commands can change:

```bash
opencli list -f json
opencli xiaohongshu search --help
```

Confirm browser connectivity and the signed-in account if the adapter requires it:

```bash
opencli doctor
opencli xiaohongshu whoami -f json
```

Use only read commands. Every Xiaohongshu query must contain the canonical comic title (or an explicitly recorded title alias). Put the comic title first; intent words such as `漫画`, `名场面`, `特典`, or `更新` may follow it, but never search a generic intent by itself. For each title, search at least three distinct intents, adapting wording to the title:

```bash
opencli xiaohongshu search "<作品名> 漫画" --limit 20 -f json
opencli xiaohongshu search "<作品名> 名场面" --limit 20 -f json
opencli xiaohongshu search "<作品名> 重温" --limit 20 -f json
```

For ongoing titles, add an update-oriented query such as `"<作品名> 更新"`. For romance or nostalgia-heavy works, alternatives such as `白月光`, `意难平`, or a verified character name are acceptable when they test a genuinely different intent.

Keep query, retrieval time, note URL or note ID, title, author, raw likes, normalized likes, and published time. Never fabricate missing engagement or dates.

Before a note can support comic-specific demand, validate relevance from the note title and, when available, the note body or hashtags. If neither contains the comic title or a verified alias, classify the note as an off-topic false positive and exclude it from the candidate evidence set. Keep the exclusion reason for review; do not silently treat generic keyword matches as comic demand.

Normalize and deduplicate exported search JSON with:

```bash
node <skill-dir>/scripts/normalize_results.mjs <results.json>
```

Resolve `<skill-dir>` to this skill's directory. The script also accepts JSON on stdin. It does not fetch data or write to a database.

### 4. Evaluate evidence

Read [scoring-and-output.md](references/scoring-and-output.md) before scoring.

Use multiple representative notes rather than one outlier. Separate these signals:

- Proven demand: engagement on relevant notes
- Current demand: recent relevant activity
- Reusable breadth: distinct discussion angles evidenced by search results
- Account fit: suitability for the account brief

Do not describe a title as a likely hit solely because it is famous elsewhere.

### 5. Return candidates for review

Return a ranked table followed by structured records using the schema in the reference. Include concise reasons, evidence URLs, uncertainties, and rejected-title reasons.

Deduplicate against existing records by canonical title and aliases. Never silently replace user-entered fields.

Do not write to Supabase unless the user explicitly asks. If asked, upsert only as `candidate` or the repository's equivalent unapproved state. Never mark a comic selected or approved on the user's behalf.

## Safety and Quality Boundaries

- Keep Xiaohongshu activity read-only: no publishing, liking, saving, following, commenting, or deleting.
- Do not download or copy other creators' images during candidate discovery.
- Do not copy captions. Titles and short phrases may be retained only as research evidence.
- Rate-limit naturally: use focused queries, small result limits, and no exhaustive crawling.
- Cite direct official Kuaikan evidence and direct Xiaohongshu note evidence for every shortlisted title.
- Mark unavailable or ambiguous data as `unknown`; never fill gaps by guesswork.
- Keep this skill limited to discovering comics. Hand selected-title topic and material research to a separate workflow.
