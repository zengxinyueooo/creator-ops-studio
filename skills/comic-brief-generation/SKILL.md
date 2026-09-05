---
name: comic-brief-generation
description: Generate one structured, editable Xiaohongshu content Brief from a user-selected comic topic and its captured same-comic references. Use only after the user clicks generate Brief. Do not use for research, asset selection, Brief approval, draft generation, or publishing.
---

# Comic Brief Generation

Generate a proposal for the user to audit before material selection. It is not a command to publish.

## Start gate

Start only when:

- a user has selected an existing candidate topic;
- the topic has at least one linked, captured, kept reference for the same comic;
- the user explicitly clicks **生成 Brief** or **重新生成 Brief**.

## Output contract

Create exactly one persisted Brief version with status `candidate`, containing:

- content angle and a non-derivative hook;
- core emotional keywords;
- a three-step content structure;
- three image-selection requirements stated as visual needs, not source-image instructions;
- spoiler and originality guardrails;
- linked evidence/reference IDs and model/provider metadata when a model was used.

Use an explicitly configured text model when available. If no model is configured, use a clearly labelled deterministic template fallback and record `generation_mode: template`; never represent it as a model result.

Do not copy reference captions. Do not invent plot facts absent from the selected evidence or supplied comic context.

## Human gate and stop condition

Present the Brief as **待你审核**. The user may approve, reject, or regenerate it. Stop before approval, material selection, draft generation, or publishing. A passed Brief is the sole entry condition for the material-review stage.
