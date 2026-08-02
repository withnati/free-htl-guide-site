# Layer 16.6 Fixation Shadow Verification

## Objective

Prove that the canonical Fixation runtime can reproduce the current learner experience and progress contract without activating it on the learner-facing page.

## Current verified foundation

- Ten canonical Fixation review candidates exist.
- Each candidate preserves the current stem, option order, keyed answer, and correct-answer explanation.
- All thirty distractor rationales are complete.
- Canonical validation and exact educational-content parity tests pass.
- The runtime and Fixation adapter remain dormant.

## Activation gates

### Content gates

1. All ten records pass canonical schema and taxonomy validation.
2. The ten-question set remains explicitly classified as public sample content.
3. Scientific review events approve each exact question version and content digest.
4. Editorial review events approve each exact question version and content digest.
5. Publication gates mark all ten records eligible without stale, missing, or superseded approvals.

### Runtime gates

1. The canonical session contains exactly ten approved sample Fixation questions.
2. Question order, option order, stems, and option text match the existing quiz for the pilot seed.
3. The answering payload contains no keyed answers, rationales, references, or review metadata.
4. Grading uses the canonical bank rather than browser-supplied answer data.
5. Correct, incorrect, and omitted responses map consistently into the existing attempt model.
6. Stable question IDs, versions, selected-option IDs, correctness, domain, and topic are available for progress storage.

### Learner-experience gates

1. Keyboard navigation and radio-group behavior remain equivalent.
2. Existing result summary, per-question feedback, retry, and progress states remain available.
3. No flash of answers or hidden answer metadata appears before submission.
4. Desktop and mobile layouts remain equivalent to the current public Fixation quiz.
5. The learner has a clear next action after completion.

### Progress and cloud gates

1. One completed runtime attempt creates one stable attempt record.
2. Question-result rows contain only allowlisted IDs and result metadata.
3. No question text, answer keys, explanations, or unrestricted content blobs enter cloud progress.
4. Duplicate submission does not create duplicate completed attempts.
5. Signed-out local progress and signed-in cloud progress both preserve existing behavior.
6. Offline queue and later synchronization remain compatible.

### Rollback gate

The current embedded Fixation quiz remains available as the immediate rollback path until the canonical runtime has passed staging verification after activation.

## Current decision

Shadow verification may proceed, but learner-facing activation remains blocked by pending scientific and editorial approval. No approval is inferred from prior module review or from the existence of complete rationales.
