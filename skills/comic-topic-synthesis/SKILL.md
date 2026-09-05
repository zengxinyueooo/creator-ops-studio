---
name: comic-topic-synthesis
description: Turn one to four human-kept, fully captured references for the same comic into one editable candidate content topic with evidence links. Use after reference capture and before Brief generation. Do not use for searching, media ingestion, Brief approval, draft generation, or publishing.
---

# Comic Topic Synthesis

Create an editable topic candidate from evidence the user has deliberately retained. A topic is a content hypothesis, not an approved Brief.

## Start gate

Start only after the user selects one to four references that are all:

- for the same comic;
- marked `kept`;
- `detail_status: captured`.

One reference is allowed when it clearly supports a distinct angle; prefer two to four references for stronger evidence. Do not combine comics or substitute list-only result cards.

## Create the candidate

Produce and persist only these fields:

- concise topic title;
- comic and optional chapter/scene scope;
- content angle and intended reader response;
- linked reference IDs, each with its source evidence;
- reason the angle is supported (engagement signal, recurring discussion point, or update relevance);
- initial workflow status `inspiration`.

Base wording on the underlying scene and cross-note pattern. Do not reproduce a source caption, title, or distinctive sentence. Include uncertainty when evidence is thin.

## Human gate and stop condition

The user reviews and may edit the candidate topic in the topic board. Stop after the candidate is saved. Do not:

- auto-create a Brief;
- mark the topic as researched or approved;
- choose or link material;
- generate copy or publish.

The next explicit action is **生成 Brief**, handled by `comic-brief-generation`.
