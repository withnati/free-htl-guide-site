# Layer 6: Content authority and exam alignment

## Purpose

Layer 6 makes the educational basis of Free HTL Guide visible, maintainable, and testable. It does not claim affiliation with or endorsement by ASCP or the ASCP Board of Certification.

The review framework uses the public **ASCP BOC HT/HTL Examination Content Guideline revised December 5, 2025**. The published ranges used by the site are:

- Fixation: 15–25%
- Processing: 10–20%
- Embedding/Microtomy: 15–25%
- Staining: 30–40%
- Laboratory Operations: 10–15%

These ranges describe the official public content areas. They do not promise that the site duplicates the exact distribution or difficulty of an individual examination.

## What this layer adds

### Public transparency

`editorial.html` explains:

- independence and non-endorsement;
- examination-alignment boundaries;
- the source hierarchy;
- the practice-question rubric;
- the difference between durable principles and SOP-dependent details;
- semantic versioning and review dates;
- the correction-reporting process and dated change log.

### Controlled module metadata

`data/module-authority.json` is the source of truth for all seven modules. Each module entry includes:

- repository path and body `data-page` key;
- module title, semantic version, and exact review date;
- primary and secondary public content areas;
- the published exam-weight range;
- mapped outline topics and HTL-specific emphasis;
- ten question-difficulty classifications;
- the editorial source set.

Do not duplicate or manually maintain this information in multiple module files. Update the JSON source and let `assets/authority.js` render it.

### Visible module authority layer

`assets/authority.js` and `assets/authority.css` add the following to each current module:

- version and exact review date in the hero status;
- a visible exam-alignment and editorial-status section;
- mapped topics and HTL emphasis;
- a warning that exact laboratory practice is SOP-dependent;
- official content-guideline, reading-list, and correction-log links;
- an expanded module source set;
- Foundational, Application, or Troubleshooting labels on all questions;
- structured data for version, modification date, and educational alignment.

### Automated integrity checks

`scripts/validate_authority.py` enforces:

- exactly seven governed modules and 70 questions;
- valid dates, versions, URLs, paths, and weight formats;
- ten approved difficulty labels per module;
- matching module `data-page` identifiers;
- ten questions per module;
- four distinct answer choices per question;
- one shared radio-group name per question;
- a correct-answer key that matches an available choice;
- one non-empty explanation per question;
- the presence of the public editorial page and authority renderer.

`tests/test_validate_authority.py` covers successful validation and important failure modes.

The existing browser suite also visits all seven modules and confirms that authority metadata loads, the panel is visible, module versioning is shown, and all 70 questions are classified.

## Question standards

Every question should:

1. have one best supported answer;
2. use plausible distractors without relying on trick wording;
3. include an explanation that teaches the underlying principle;
4. identify local SOP dependence where one operational rule is not universal;
5. avoid reproducing or claiming knowledge of confidential examination content;
6. avoid suggesting that a site score predicts the official examination result.

Difficulty labels mean:

- **Foundational:** recall or explain a core fact, sequence, reagent, structure, or principle;
- **Application:** apply a principle to select a method, control, reagent, or next step;
- **Troubleshooting:** interpret a failure pattern and choose the most appropriate corrective action.

## Source hierarchy

Use sources in this order when practical:

1. Current official ASCP BOC credential, content-guideline, and reading-list pages for exam alignment.
2. Established histotechnology texts listed by ASCP BOC or widely recognized in the field.
3. Primary regulator, standards body, or manufacturer sources for safety, instrument, and assay requirements.
4. Current validated local SOPs and quality-system documents for actual laboratory practice.

Do not reproduce copyrighted chapters, proprietary SOPs, restricted documents, or examination questions.

## Updating the curriculum

When the public content guideline changes:

1. confirm the new official revision date and URL;
2. update `examGuideline` in `data/module-authority.json`;
3. re-map each module and revise HTL emphasis where necessary;
4. review all affected questions and explanations;
5. update module semantic versions and review dates;
6. update `editorial.html` and the corrections log;
7. update sitemap modification dates;
8. run all validation and browser checks.

A displayed review date means an editorial review by the site creator or designated reviewer. It must not be described as independent peer review or ASCP review unless that actually occurs and can be documented.

## Local checks

```bash
python -m unittest discover -s tests -p "test_*.py" -v
python scripts/validate_site.py --root .
python scripts/validate_authority.py --root .
npm install --ignore-scripts --no-audit --no-fund
npx playwright install chromium
npm run test:browser
```

## CI protection

The required checks remain:

- `Validate static site`
- `Browser smoke tests`

Layer 6 extends these checks rather than creating a third required job name. This preserves the repository ruleset while adding authority, quiz-integrity, and real-browser coverage.
