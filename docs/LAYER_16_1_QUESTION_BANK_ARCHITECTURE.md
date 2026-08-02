# Layer 16.1 — Question-Bank Architecture

## Objective

Create a durable, reviewable content system for HT/HTL practice questions that can power module quizzes, mixed practice, mock exams, Targeted Practice, missed-question review, and progress analytics without duplicating question content across pages.

## Product boundary

The question bank is designed first for HT/HTL certification exam preparation. It is an independent educational resource and must not claim to contain official examination questions, guarantee passage, or imply endorsement by a certifying organization.

## Access model

- Public builds may contain only explicitly approved sample questions.
- Premium questions remain outside the public deployment and are delivered only after server-side authorization.
- Browser storage may remember attempts, flags, or progress, but it never determines whether a question is public or Premium.
- Question identifiers are stable across revisions so attempt history remains meaningful.

## Canonical question record

Every question must contain:

- `id`: stable lowercase identifier, never reused
- `status`: `draft`, `scientific_review`, `editorial_review`, `approved`, `retired`
- `access`: `sample` or `premium`
- `certification_scope`: `HT`, `HTL`, or `HT_HTL`
- `domain`: controlled exam-preparation domain
- `topic`: controlled topic within the domain
- `difficulty`: `foundational`, `applied`, or `advanced`
- `cognitive_level`: `recall`, `application`, or `analysis`
- `stem`: learner-facing prompt
- `options`: exactly four answer choices with stable option IDs
- `correct_option_id`: one matching option ID
- `rationale`: explanation of why the correct answer is best
- `distractor_rationales`: explanation for every incorrect option
- `learning_objective`: the knowledge or decision skill being assessed
- `lesson_refs`: one or more related lesson identifiers
- `references`: review references or source notes suitable for internal verification
- `review`: scientific and editorial review metadata
- `version`: positive integer incremented for material changes
- `created_at` and `updated_at`: ISO-8601 timestamps

## Controlled domains

Initial platform domains:

1. `fixation`
2. `processing`
3. `embedding`
4. `microtomy`
5. `staining`
6. `laboratory_operations`
7. `special_procedures`

These platform domains support learner navigation and analytics. They should be mapped to the current examination content outline during scientific review rather than presented as an official certifying-organization taxonomy unless that mapping is documented.

## Difficulty standard

### Foundational

Tests accurate recall or direct recognition of a core principle, reagent purpose, sequence, or artifact.

### Applied

Requires choosing the best action, cause, correction, or interpretation in a realistic laboratory scenario.

### Advanced

Requires integration of multiple variables, troubleshooting competing explanations, or selecting the best response when several options are partly plausible.

Difficulty is not based on obscure trivia or intentionally confusing wording.

## Cognitive-level standard

- `recall`: identify or state established knowledge
- `application`: use knowledge in a routine laboratory scenario
- `analysis`: interpret evidence, distinguish causes, or prioritize corrective action

## Review workflow

1. Author creates a `draft` question.
2. Scientific reviewer verifies accuracy, terminology, answer uniqueness, and rationale.
3. Editorial reviewer verifies clarity, grammar, accessibility, and absence of unintended clues.
4. Validator confirms schema, controlled vocabulary, uniqueness, and access boundaries.
5. Only `approved` questions may enter learner-facing production pools.
6. Material corrections increment `version` and preserve review history.
7. Retired questions remain addressable for historical attempt records but are excluded from new sessions.

## Quality rules

- Exactly one answer is defensibly best.
- The stem includes all information needed to answer.
- Avoid negative stems unless the negative term is necessary and visually emphasized.
- Avoid `all of the above` and `none of the above`.
- Avoid grammatical clues, unequal option detail, and repeated stem wording that reveals the answer.
- Options should be parallel in grammar and plausibility.
- Rationales teach the underlying principle rather than merely restating the correct choice.
- Distractor rationales explain the misconception or condition under which the option might appear plausible.
- No unpublished, proprietary, patient-identifiable, or official examination content may be included.

## Session-generation contract

Practice and mock-exam engines request questions using server-authorized filters such as:

- access scope
- certification scope
- domain or topic
- difficulty or cognitive level
- approved status
- exclusion of recently served questions
- exclusion or inclusion of missed and flagged IDs

The engine receives only the question fields needed for the active phase. Correct answers and rationales should not be sent before submission when the delivery architecture supports phased disclosure.

## Analytics contract

Attempt records reference:

- stable question ID
- question version
- selected option ID
- correctness
- response time
- session type
- attempt timestamp
- flagged state
- domain and topic snapshot

This supports weak-domain recommendations while preserving the exact question version seen by the learner.

## Layer 16.1 deliverables

- JSON Schema for canonical questions
- controlled vocabulary file
- sample bank containing only approved public examples
- validation script and automated tests
- content review checklist
- migration plan for existing questions
- documented Premium/public build boundary

## Exclusions

- Writing the complete 150-question bank
- Replacing current practice and mock-exam interfaces
- Live database delivery
- Payment integration
- Claims that content has been reviewed before review metadata is complete
