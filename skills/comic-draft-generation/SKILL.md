---
name: comic-draft-generation
description: Generate an editable Xiaohongshu title and caption draft from one approved Brief and the user-selected eligible single-image assets. Use only after Brief approval and material selection. Do not use for Brief approval, asset review, automated publication, or account actions.
---

# Comic Draft Generation

Turn an approved plan and chosen materials into a reviewable caption draft. The user remains responsible for final editing and manual publication.

## Start gate

Start only when:

- one Brief has status `approved`;
- the user selected at least one asset linked to that Brief;
- every selected asset is `available`, `visual_format: single`, and belongs to the same comic;
- the user explicitly clicks **基于 Brief 生成** or **生成新版本**.

## Output contract

Create one editable draft version containing a title, body, optional topic tags, and a reference to its Brief and selected asset IDs. The draft must:

- use the Brief's angle, structure, and spoiler constraints;
- mention no unsupported plot fact;
- be original rather than a rewrite of a source note;
- preserve generation mode/model metadata;
- leave every source image's use count unchanged.

If no text model is configured, generate a clearly labelled template fallback. Do not claim an LLM generated it.

## Stop gate

Save as `draft` and show it for user editing. Stop before any Xiaohongshu interaction. Only a separate, manual user action can mark an already published draft as published and then increment selected assets' usage history.
