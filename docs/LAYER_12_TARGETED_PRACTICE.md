# Layer 12 — Targeted Practice

## Product purpose

Layer 12 turns the reviewed 150-question bank into a focused practice generator. It is designed as a future premium feature while remaining usable during development so its educational behavior can be tested before authentication, protected content delivery, and payment enforcement exist.

## Learner experience

Learners can:

- choose 10, 20, or 30 questions;
- select one or more of the five controlled exam domains;
- filter by Foundational, Application, and Troubleshooting difficulty;
- use Study mode for immediate answer feedback;
- use Exam mode for feedback after submission;
- build sets from their two weakest measured domains;
- practice questions missed in earlier mock or targeted attempts;
- flag questions for review;
- resume an unfinished set;
- review domain results, missed items, explanations, and source-module links.

## Question integrity

Targeted practice uses the same `FreeHTLMockExamBank` runtime as the full mock exam. It does not create another answer-key store.

- Original questions retain their reviewed source fieldsets.
- Alternate scenarios inherit the source fieldset choices and grading key.
- Runtime selection stores stable question IDs.
- Account-ready progress stores selected option IDs and correctness, not question text, explanations, or grading keys.

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

The feature does not send answers, flags, question IDs, weak domains, or missed-question history to Google Analytics. Existing analytics remains consent-gated and receives no new targeted-practice event fields in this layer.

Progress export continues to exclude notes, email addresses, theme, and analytics-consent state.

## Automated protection

Layer 12 adds:

- `scripts/validate_targeted_practice.py`;
- regression tests for filters, modes, access status, noindex handling, and storage boundaries;
- desktop and Pixel 7 browser tests for loading, Study mode, resume, Exam mode, weak-domain selection, missed-question selection, sanitized stored outcomes, and responsive layout;
- continued execution of all existing site, authority, mock-exam, SEO, analytics, and progress checks.

## Future backend transition

When authenticated cloud progress is introduced, the targeted-practice interface should continue calling the same progress-service methods:

- `recordTargetedPracticeSession`
- `recordTargetedPracticeAttempt`
- `getSnapshot`

Only the storage adapter and protected question delivery should change.
