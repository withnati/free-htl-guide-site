# Layer 12 — Targeted Practice

## Product purpose

Layer 12 turns the 150-record development bank into a focused practice generator. The bank contains 70 authority-reviewed base questions and 80 alternate scenarios that remain subject to final manual scientific and editorial review. The feature is designed as a future premium tool while remaining usable during development so its educational behavior can be tested before authentication, protected content delivery, and payment enforcement exist.

## Learner experience

Learners can:

- choose 10, 20, or 30 questions;
- select one or more of the five controlled exam domains;
- select one or more Foundational, Application, and Troubleshooting difficulty levels;
- use Study mode for immediate answer feedback;
- use Exam mode for feedback after submission;
- build sets from the two weakest measured areas within selected domains;
- practice the exact questions missed in earlier mock or targeted attempts;
- flag questions and later build a dedicated review set from exact flagged question IDs;
- resume an unfinished set;
- review domain results, missed items, explanations, and source-module links.

Clearing every domain or difficulty is treated as invalid input. The interface requires at least one selected domain and at least one selected difficulty level before a set can start.

## Question integrity

Targeted practice uses the same `FreeHTLMockExamBank` runtime as the full mock exam. It does not create another answer-key store.

- Original questions retain their reviewed source fieldsets.
- Alternate scenarios inherit the source fieldset choices and grading key but remain in the manual editorial-review queue.
- Runtime selection stores stable question IDs.
- Previously missed and flagged modes match exact stored `questionId` values; they do not silently expand into source-linked alternate scenarios.
- Account-ready progress stores selected option IDs and correctness, not question text, explanations, or grading keys.

A future separate mode may intentionally offer source-linked similar scenarios, but that behavior is not part of “Previously missed” or “Flagged for review.”

## Weak-domain calculation

Weak-domain selection aggregates `correct` and `total` counts across measured attempts before calculating domain percentages. This avoids giving a one-question targeted result the same statistical weight as a larger domain sample. Legacy records that only contain percentages retain a percentage-average fallback.

When a recommendation link includes a specific domain, the selected domain acts as the allowed domain set. Without a domain parameter, weak-domain practice selects the two lowest measured areas among the learner’s checked domains.

## Account-ready progress

Progress schema version 2 adds:

- `targetedPracticeAttempts`;
- the `targeted-practice` active-session type;
- selected domains and difficulties;
- practice source and feedback mode;
- domain summaries;
- sanitized question-level results.

The storage key remains `free-htl-progress-v1` so existing anonymous progress migrates in place. Targeted practice never creates a parallel local-storage record.

## Subscription boundary

`data/content-access.json` marks targeted practice as premium and points to `targeted-practice.html`. The current enforcement mode remains `metadata-only`.

The page clearly identifies itself as a development preview. Neither the browser nor local progress metadata can authorize paid access. Final access must be based on an authenticated server session and a server-verified entitlement.

Because this is a future account application screen, it is:

- `noindex,nofollow`;
- excluded from `sitemap.xml`;
- excluded from the public SEO registry.

A separate public pricing or product page can market the feature at launch.

## Privacy

The feature does not send answers, flags, question IDs, weak domains, missed-question history, or flagged-question history to Google Analytics. Existing analytics remains consent-gated and receives no new targeted-practice event fields in this layer.

Progress export continues to exclude notes, email addresses, theme, and analytics-consent state.

## Automated protection

Layer 12 adds:

- `scripts/validate_targeted_practice.py`;
- regression tests for filters, modes, access status, editorial-status wording, corrected result guidance, noindex handling, and storage boundaries;
- desktop and Pixel 7 browser tests for loading, required filters, Study mode, resume, Exam mode, weak-domain selection, domain-specific weak links, exact missed-question selection, exact flagged-question selection, sanitized stored outcomes, and responsive layout;
- continued execution of all existing site, authority, mock-exam, SEO, analytics, and progress checks.

## Future backend transition

When authenticated cloud progress is introduced, the targeted-practice interface should continue calling the same progress-service methods:

- `recordTargetedPracticeSession`
- `recordTargetedPracticeAttempt`
- `getSnapshot`

Only the storage adapter and protected question delivery should change. Layer 13 must additionally define record revisions, idempotent attempt upserts, server timestamps, account ownership checks, anonymous-progress migration, conflict resolution, and explicit field allowlists before multi-device cloud writes are enabled.
