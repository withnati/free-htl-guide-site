# Layer 16.7 Fixation Runtime Shadow Verification

## Purpose

Verify the approved canonical Fixation question set against the runtime, learner-facing rollback path, and progress-data boundary without activating the adapter on the public lesson.

## Verified contracts

- The pilot session selects approved public-sample Fixation records only.
- The answering payload excludes answer keys, rationales, references, and review metadata.
- Canonical grading preserves stable question ID and version.
- The progress projection contains aggregate score data plus allowlisted question-result metadata only.
- Question-result metadata includes question ID, version, module, domain, topic, difficulty, selected option, correctness, omitted state, and flag state.
- Answer keys, stems, options, rationales, lesson references, and review data are excluded from the progress projection.
- Omitted answers preserve stable question identity without inventing a selected option.
- The current embedded ten-question quiz remains present as the immediate rollback path.
- The public Fixation page does not yet load the canonical runtime or adapter.

## Activation status

Content approval and runtime shadow contracts are complete. Learner-facing activation remains a separate change so it can be reviewed, deployed, tested on Cloudflare staging, and rolled back independently.

## Remaining activation work

1. Connect runtime grading to the existing quiz result UI.
2. Dispatch the aggregate progress attempt through the existing progress service.
3. Extend the progress service to retain only the approved question-result metadata fields.
4. Verify signed-out local persistence and signed-in cloud synchronization.
5. Run desktop, mobile, keyboard, retry, duplicate-submission, and staging smoke tests.
6. Preserve the embedded quiz implementation for one controlled rollback cycle.
