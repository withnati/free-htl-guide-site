# Layer 16.3 — Scientific and Editorial Question Review System

## Objective

Create a durable, auditable review workflow for HT/HTL question content so that no learner-facing question can be published merely because it exists in the repository or has been used before.

## Lifecycle

Questions move through the following controlled states:

1. `draft`
2. `scientific_review`
3. `editorial_review`
4. `approved`
5. `retired`

A review request may return a question to `draft` or the relevant review stage with `changes_requested`. Publication is permitted only when both scientific and editorial reviews are approved and all automated quality gates pass.

## Scientific review standard

Scientific review verifies:

- the keyed answer is defensibly the single best answer;
- no distractor is also correct under the facts provided;
- terminology is scientifically accurate and appropriate for HT/HTL preparation;
- domain, topic, difficulty, cognitive level, and learning objective are appropriate;
- correct-answer and distractor rationales are accurate and educational;
- cited references support the tested principle;
- the question does not reproduce official, proprietary, unpublished, or patient-identifiable material;
- the item does not make unsupported endorsement, passage, or exam-prediction claims.

Scientific review records a decision, reviewer identity, timestamp, confidence, verified references, checklist results, and comments.

## Editorial review standard

Editorial review verifies:

- the stem is clear, complete, and concise;
- the question tests one defined decision or concept;
- answer options are parallel, plausible, and grammatically consistent;
- wording does not unintentionally reveal the answer;
- negative phrasing is avoided unless necessary and clearly emphasized;
- abbreviations, capitalization, punctuation, and terminology follow the content style guide;
- rationales explain the principle in learner-centered language;
- reading burden is appropriate for the intended difficulty;
- accessibility and plain-language requirements are met without weakening scientific precision.

Editorial review is independent from scientific approval. Editorial changes that alter scientific meaning invalidate the prior scientific approval and require scientific re-review.

## Versioning

- Stable question IDs never change.
- Material edits increment the positive integer `version`.
- A review applies only to the exact question version and content digest reviewed.
- Any change to the stem, options, keyed answer, rationale, distractor rationales, domain, topic, difficulty, cognitive level, or learning objective invalidates prior approvals.
- Typographic-only edits may use the same major version but still require a new content digest and editorial review record.
- Historical review events are append-only and never overwritten.

## Review event model

Each review event stores:

- immutable event ID;
- question ID and version;
- content SHA-256 digest;
- review type: `scientific` or `editorial`;
- decision: `approved` or `changes_requested`;
- reviewer identifier and display name;
- reviewer role or qualification note;
- review timestamp;
- confidence: `high`, `medium`, or `low`;
- checklist results;
- verified reference locators;
- comments;
- optional issue codes;
- optional superseded event ID.

## Publication gates

A question may be marked `approved` only when:

- the canonical schema passes;
- taxonomy passes;
- exactly four unique options exist;
- one keyed answer exists;
- the correct rationale is complete;
- all three distractor rationales are complete;
- a measurable learning objective exists;
- references are present;
- duplicate and near-duplicate review is resolved;
- access classification is confirmed;
- a scientific approval exists for the current version and digest;
- an editorial approval exists for the current version and digest;
- neither approval has been superseded or invalidated;
- no unresolved changes-requested event exists after the approvals.

## Independence and conflicts

The system supports one person serving both roles during early development, but the review events remain separate. When additional reviewers are available, scientific and editorial review should be performed by different people. A reviewer must disclose uncertainty or conflicts in comments rather than approving with low confidence.

## Evidence and reference rules

References must identify a verifiable source and locator. A generic title without a chapter, section, page, guideline version, or internal authority locator is insufficient for final approval. The review tool records which references were actually checked; merely listing a reference in the question does not count as verification.

## Change-control rules

- `changes_requested` prevents publication.
- Editing content after approval invalidates approvals through digest mismatch.
- Changing the keyed answer always requires both scientific and editorial re-review.
- Retired questions remain available for historical attempt interpretation but are excluded from new sessions.
- Reinstating a retired question requires current-version review and approval.

## Psychometric feedback boundary

Learner performance statistics may trigger review but may never automatically change a keyed answer or approve a question. Low discrimination, unexpected option selection, extreme response time, or high omission rates create a review signal. Scientific and editorial reviewers decide whether revision is needed.

## Layer 16.3 deliverables

- Review-event JSON Schema
- Review checklist definitions
- Content-digest utility
- Append-only review-event validator
- Publication-gate evaluator
- Review templates
- Automated tests for stale approvals, missing checklists, superseded events, and digest mismatch
- Documentation for reviewer workflow and change control

## Exclusions

- Public reviewer dashboard
- User-role administration
- Live database persistence
- Automatic publication
- Psychometric scoring implementation
- Claiming that existing questions are approved before actual review events are recorded
