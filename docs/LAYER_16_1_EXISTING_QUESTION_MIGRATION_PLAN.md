# Layer 16.1 Existing Question Migration Plan

## Purpose

Move current quizzes, practice items, mock-exam items, and alternate scenarios into the canonical question-bank format without changing their scientific meaning or silently upgrading their review status.

## Source categories to inventory

1. Fixation lesson quiz items.
2. Module-level quiz items used by lessons 2–7.
3. Mixed-practice questions.
4. Mock-exam base questions.
5. Alternate scenarios and variants.
6. Targeted Practice records and any duplicated question copies.
7. Public sample questions embedded in learner-facing HTML or JavaScript.
8. Retired or superseded items retained for audit history.

## Inventory fields

Each source item must be recorded with:

- current file and object location;
- current identifier, if any;
- learner-facing surfaces that use it;
- current domain and topic;
- current answer and explanation structure;
- known review evidence;
- public or Premium exposure;
- duplicate or variant relationships;
- migration disposition;
- unresolved scientific or editorial issues.

## Migration dispositions

- `migrate_as_approved`: permitted only when scientific and editorial approval evidence is attributable and recorded.
- `migrate_as_review_pending`: structurally usable, but approval evidence is incomplete.
- `rewrite_required`: stem, options, answer, rationale, or distractors need substantive revision.
- `merge_duplicate`: consolidate equivalent records while preserving source history.
- `retire`: exclude from active delivery but retain an audit record.
- `sample_candidate`: may be considered for public sample access after explicit approval.

## Required migration rules

1. Preserve the original wording during initial extraction.
2. Never infer approval from the fact that an item is currently visible on the website.
3. Never classify an alternate scenario as reviewed solely because its base question was reviewed.
4. Assign a stable ID before editing the migrated record.
5. Record substantive edits by incrementing `version`.
6. Create distinct IDs for variants that can be attempted independently.
7. Link variants to the same lesson, domain, topic, and learning objective where appropriate.
8. Write rationales for every incorrect option before an item can become approved.
9. Keep Premium records outside public source and generated deployment roots.
10. Validate the full bank for duplicate IDs and access-boundary violations before release.

## Planned sequence

### Pass 1 — Mechanical inventory

Locate each existing question source and capture counts, identifiers, and delivery surfaces. Do not edit educational content.

### Pass 2 — Canonical extraction

Convert each source into the schema with `draft` or the highest review state directly supported by evidence.

### Pass 3 — Duplicate and variant analysis

Identify repeated copies, close paraphrases, answer-position variants, and true alternate scenarios.

### Pass 4 — Scientific review

Verify the keyed answer, rationale, distractors, terminology, and cited source locator.

### Pass 5 — Editorial and exam-quality review

Check clarity, one-best-answer construction, cueing, option parallelism, reading load, and alignment between difficulty and cognitive level.

### Pass 6 — Access publication

Explicitly select approved public samples. Place all remaining active records in Premium delivery storage and verify they are absent from public builds.

## Completion evidence

Layer 16.1 migration readiness is complete when:

- every known source category has an inventory entry;
- every migrated item has a stable ID and schema-valid record;
- review status is evidence-based;
- duplicates and variants have documented dispositions;
- public sample records are explicitly approved;
- Premium records pass automated public-boundary checks;
- downstream quiz, mock-exam, Targeted Practice, and analytics consumers can use the canonical identifiers.
