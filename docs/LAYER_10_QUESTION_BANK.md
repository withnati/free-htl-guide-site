# Layer 10 — 150-Question Practice Bank

## Scope

Layer 10 expands the selectable mock-exam bank from 70 to 150 while preserving a single authoritative grading source.

- 70 original questions remain embedded in the seven reviewed study modules.
- 80 alternate scenarios reference those questions.
- Each alternate scenario preserves the source question's four choices and grading key.
- Variant files contain no answer field, choice list, copied key, or independent scoring logic.

This design increases practice variety without allowing two answer-key sources to drift apart.

## Distribution

The complete bank contains:

- Fixation: 30 questions — 10 originals plus 20 variants
- Processing: 24 questions — 10 originals plus 14 variants
- Embedding/Microtomy: 30 questions — 10 originals plus 20 variants
- Staining: 48 questions — 30 originals plus 18 variants across H&E, Special Stains, and IHC/ISH
- Laboratory Operations: 18 questions — 10 originals plus 8 variants

Total: 150 questions.

The mock exam still draws 50 questions according to the controlled Layer 9 blueprint. Expanding the bank does not change the exam's five-domain percentages, timing, study target, or disclaimer.

## Variant format

`data/question-bank-extension.json` declares seven variant files and their counts. Each record may contain only:

- a unique variant ID;
- the referenced source-question ID;
- an alternate stem compatible with the source choices;
- an alternate teaching explanation;
- one controlled difficulty label: Foundational, Application, or Troubleshooting.

At runtime, `assets/mock-exam-bank-load.js` clones the reviewed source fieldset and replaces only the stem, explanation, and difficulty. The choices and `data-correct` grading key remain inherited from the source module.

## Editorial standard

A variant must:

1. test the same knowledge rule as its source question;
2. remain fully answerable using the unchanged source choices;
3. preserve one-best-answer logic;
4. add a genuinely different scenario, laboratory context, or troubleshooting framing;
5. avoid confidential examination content, unsupported pass predictions, and employer-specific procedures;
6. identify general guidance that remains subordinate to validated local SOPs.

A correction to a choice or keyed answer must be made in the source module, not in a variant file.

## Privacy and analytics

The expansion does not change the local-first storage model. Selected answers, flags, current position, source/variant identity, and attempt history remain in the browser. Analytics receives no question text, selected choice, explanation, or variant ID. After explicit consent, only the existing aggregate quiz-completion fields may be transmitted.

## Automated enforcement

`scripts/validate_mock_exam.py` now rejects:

- a bank total other than 150;
- a variant manifest total other than 80;
- missing or duplicate variant files and IDs;
- unknown source-question references;
- answer, correct, choices, options, domain, source-path, or module-title fields in variant records;
- invalid difficulty labels;
- missing or duplicate stems;
- missing explanations;
- per-module counts that do not match the manifest;
- blueprint targets larger than the available source-plus-variant pool.

Browser tests verify that the runtime loads 70 module questions and 80 variants, constructs a 50-question attempt, includes variants, preserves local resume state, and grades a variant using its inherited source fieldset.

## Maintenance

Any new or revised variant requires editorial review and both protected workflows. Update the manifest count and module count only when the corresponding variant files change. Do not create a second answer bank, add a variant-specific key, or modify the five-domain exam blueprint as part of ordinary question expansion.
