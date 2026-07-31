# Layer 9 — HT/HTL Mock Exam MVP

## Scope

Layer 9 adds a 50-question, exam-weighted practice simulator using the 70 questions already reviewed in the seven study modules. It does not create a parallel answer-key source. The browser loads and reuses the existing module quiz fieldsets, preserving the same keyed answers and explanations.

## Blueprint

The controlled source is `data/mock-exam-blueprint.json`:

- Fixation: 10 questions (20%; official range 15–25%)
- Processing: 8 questions (16%; official range 10–20%)
- Embedding/Microtomy: 10 questions (20%; official range 15–25%)
- Staining: 16 questions (32%; official range 30–40%)
- Laboratory Operations: 6 questions (12%; official range 10–15%)

The 80% result label is a study target only. It is not an ASCP passing score or pass prediction.

## Learner experience

- timed 75-minute or untimed mode;
- randomized question order;
- one question at a time;
- previous/next and direct question navigation;
- answered and flagged indicators;
- persistent in-progress attempt in local storage;
- automatic submission when a timed attempt expires;
- unanswered-item warning before voluntary submission;
- overall and domain results;
- explanations for missed or flagged items;
- source-module review links;
- ten-attempt local history.

## Privacy

Selected answers, flags, current position, and attempt history stay in the learner's browser. They are not included in analytics. After visitor consent, the existing analytics controller receives only the same aggregate quiz-completion fields used elsewhere: quiz ID, score, total, percentage, score band, and target-met state.

## Integrity protection

`scripts/validate_mock_exam.py` verifies:

- the fixed 50-question and 75-minute contract;
- five official content areas;
- count/percentage agreement;
- every percentage remains within its published range;
- module targets total each domain count;
- each target is available from the reviewed source modules;
- exactly 70 reviewed source questions remain available;
- the public page and required runtime files exist.

`browser-tests/mock-exam.spec.cjs` verifies loading, blueprint display, 50-question construction, answer and flag persistence, resume behavior, unanswered warnings, results, domain breakdowns, history, and mobile navigation.

## Maintenance

Changes to the blueprint, timing, study target, storage model, source modules, grading behavior, or analytics disclosure require a reviewed pull request and both protected workflows. The source module answer keys remain authoritative; do not copy them into a second manually maintained bank.
