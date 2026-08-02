# Layer 16.4 — Runtime Question Engine

## Objective

Create one reusable runtime contract for module quizzes, mixed practice, mock exams, Targeted Practice, missed-question review, and future adaptive study without exposing Premium records or answer keys before the appropriate learning phase.

## Core principles

- The canonical question bank is the content source of truth.
- Only approved questions matching the current content digest may enter learner sessions.
- Public clients may receive only approved `sample` questions.
- Premium questions are selected and delivered only after server-side authorization.
- Correct answers and rationales are withheld during the answering phase.
- Session generation is deterministic when given the same seed and eligible pool.
- Attempt records use stable question IDs and versions.
- Browser storage may preserve session progress but never determines access.

## Delivery phases

### Answering phase

The learner receives only:

- stable question ID;
- question version;
- stem;
- four answer choices;
- domain and topic labels;
- difficulty and cognitive level where appropriate;
- session position and navigation metadata.

The answering payload excludes:

- correct option ID;
- correct-answer rationale;
- distractor rationales;
- internal references;
- review metadata;
- unpublished notes.

### Review phase

After submission, the authorized learner may receive:

- selected option;
- correct option;
- correctness;
- correct-answer rationale;
- explanation for the selected distractor, when incorrect;
- related lesson references;
- domain and topic snapshot.

The runtime should avoid sending all distractor rationales when only the selected one is required.

## Session request contract

A session request may include:

- session type: module quiz, mixed practice, mock exam, targeted practice, missed review, or flagged review;
- access scope established by the trusted server;
- certification scope;
- approved domain and topic filters;
- difficulty and cognitive-level filters;
- requested question count;
- seed;
- question IDs to include or exclude;
- recently served IDs;
- blueprint targets;
- timed or untimed mode.

Client-supplied access scope is never trusted. The trusted application layer supplies effective access after authentication and entitlement verification.

## Eligibility rules

A question is eligible only when:

- status is `approved`;
- publication gates pass for its exact version and digest;
- access matches the authorized scope;
- certification scope matches;
- filters match;
- it is not retired;
- it is not explicitly excluded;
- it is not a duplicate of another selected item;
- requested blueprint constraints remain satisfiable.

## Selection rules

- Stable IDs provide deterministic tie-breaking.
- Seeded randomization prevents predictable ordering while allowing exact replay for debugging.
- Question selection and answer-choice shuffling use separate deterministic streams.
- Blueprint sessions allocate by domain before filling any remaining slots.
- Selection fails explicitly when the eligible pool cannot satisfy the request; it never silently weakens access or review requirements.

## Attempt contract

Each submitted response records:

- session ID and type;
- stable question ID;
- question version;
- selected option ID or omission;
- correctness computed by the trusted grading layer;
- response time;
- flagged state;
- answered-at timestamp;
- domain and topic snapshot;
- content digest snapshot.

## Security boundaries

- Premium bank files must not be included in public builds.
- Public JavaScript must not contain Premium stems, choices, answers, or rationales.
- A checkout return URL, cookie, profile field, localStorage value, or query parameter cannot widen access.
- The grading layer must use the canonical server-side record rather than a client-supplied answer key.
- Session responses must use no-store or appropriately private caching for protected content.

## Runtime adoption sequence

1. Pure engine and contract tests.
2. Approved public sample bank pilot.
3. Free Fixation quiz adapter with exact regression comparison.
4. Mixed-practice adapter.
5. Mock-exam blueprint adapter.
6. Targeted Practice and missed-question adapters.
7. Premium server delivery after payment and entitlement integration.

## Exclusions

- Live database or Edge Function deployment
- Replacing current learner-visible quizzes in this initial checkpoint
- Authoring or approving question content
- Stripe integration
- Adaptive psychometric selection
