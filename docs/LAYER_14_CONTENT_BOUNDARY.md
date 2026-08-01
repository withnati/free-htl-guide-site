# Layer 14 Public and Protected Content Boundary

**Status:** Initial repository inventory  
**Purpose:** Define what the public build may contain and what must require server authorization before delivery.

## Governing rule

Premium content is protected only when an unauthorized browser cannot retrieve the protected payload.

The following are not protection:

- access labels in JSON;
- `noindex,nofollow`;
- hiding HTML with CSS;
- disabling links or buttons;
- client-side route guards;
- JavaScript checks;
- user-editable profile fields;
- `localStorage` or URL values;
- public repository files;
- public object-storage URLs.

## Current repository finding

The current GitHub Pages site is a development preview. Premium-designated lesson files, quizzes, question-bank inputs, answer metadata, explanations, interactive runtimes, and downloadable resources are stored in the public repository and can be requested directly.

`data/content-access.json` correctly describes the existing enforcement as metadata-only. Layer 14 must replace that delivery model before a paid launch.

Existing public material cannot be made historically secret merely by removing it from the current branch. Revised or newly created launch-premium assets must remain private from creation onward.

## Target classifications

### Public acquisition content

Content available without an account and suitable for search discovery:

- homepage and course overview;
- instructor/about and authority signals;
- editorial standards;
- privacy, FAQ, contact, and future terms pages;
- complete Fixation lesson as the primary educational hook;
- short sample quiz and selected sample questions;
- limited study-planning material;
- feature previews;
- signup and sign-in entry points;
- future pricing and plan explanation;
- upgrade and access-denied explanations that contain no premium payload.

### Free account content

Content that requires a verified learner identity but not a paid entitlement:

- account settings;
- cloud-backed progress for public/free learning;
- anonymous-progress import choice;
- basic My Progress experience;
- progress export and reset;
- account deletion;
- cross-device continuity for free content;
- limited premium feature previews;
- entitlement summary such as `free`, without trusting it as authorization.

Anonymous learners may continue using local browser progress for the public experience.

### Premium account content

Content delivered only after authenticated server-side entitlement approval:

- Processing and Decalcification lesson;
- Embedding and Microtomy lesson;
- Routine H&E Staining lesson;
- Special Stains lesson;
- Laboratory Operations lesson;
- IHC and ISH Fundamentals lesson;
- complete premium module quizzes;
- full question bank;
- mock-exam question payloads and answer explanations;
- Targeted Practice question payloads and answer explanations;
- detailed weak-domain recommendations;
- advanced attempt history and analytics;
- premium downloadable PDFs, ZIP files, templates, and future study tools;
- revised launch-premium material created after the public exposure audit.

### Server-only content and operations

Never included in public browser output:

- entitlement mutation logic;
- payment-provider customer and subscription identifiers;
- payment webhook records and signing secrets;
- service-role or secret credentials;
- privileged database connection values;
- private bucket paths and publishing manifests where disclosure increases risk;
- administrative grants and overrides;
- entitlement event audit history;
- content publishing controls;
- secret rotation and incident credentials;
- raw premium source material before publication;
- complete answer keys and explanation banks outside an authorized delivery response.

## Existing route inventory

| Current route or area | Current designation | Current delivery | Target Layer 14 treatment |
| --- | --- | --- | --- |
| `index.html` | Public | Public static HTML | Remain public; update premium navigation and product messaging |
| `about.html` | Public | Public static HTML | Remain public |
| `editorial.html` | Public | Public static HTML | Remain public; preserve review-status accuracy |
| `privacy.html` | Public | Public static HTML | Remain public; update hosting and protected-delivery disclosures when implemented |
| `faq.html` | Public | Public static HTML | Remain public |
| `contact.html` | Public | Public static HTML | Remain public |
| `modules/fixation-guide-v3.html` | Public hook | Public static HTML with quiz | Remain a strong public lesson; define a deliberately limited public quiz |
| `modules/processing-guide-v3.html` | Premium-designated | Complete public HTML, quiz answers, explanations, and download links | Replace public route with preview/upgrade shell; move revised payload and protected downloads to authorized delivery |
| `modules/embedding-guide-v3.html` | Premium-designated | Complete public HTML and quiz | Replace with public preview shell; protect revised payload |
| `modules/staining-he-guide.html` | Premium-designated | Complete public HTML and quiz | Replace with public preview shell; protect revised payload |
| `modules/special-stains-guide.html` | Premium-designated | Complete public HTML and quiz | Replace with public preview shell; protect revised payload |
| `modules/lab-operations-guide.html` | Premium-designated | Complete public HTML and quiz | Replace with public preview shell; protect revised payload |
| `modules/ihc-ish-guide.html` | Premium-designated | Complete public HTML and quiz | Replace with public preview shell; protect revised payload |
| `study-plan.html` | Premium-designated | Public static page | Decide public limited planner versus protected complete planner; do not ship premium-only content in public HTML |
| `practice.html` | Premium-designated | Public static practice page | Retain a small public sample or preview; protect full premium question payload |
| `mock-exam.html` | Premium-designated | Public shell and browser-loaded bank | Keep a public feature preview or sample exam; full bank and explanations must be authorized before delivery |
| `targeted-practice.html` | Premium-designated | Complete public tool and browser-loaded bank | Replace with public preview/upgrade shell; authorize question delivery before use |
| `my-progress.html` | Registered / premium mix | Public shell with private browser/account data | Keep account-safe shell; define basic free versus advanced premium views without trusting frontend flags |
| `account/*.html` | Free account | Public static account shells | Continue public delivery with `noindex,nofollow`; account data remains authenticated |

## Existing data and runtime inventory

| Current file group | Risk | Target treatment |
| --- | --- | --- |
| `data/content-access.json` | Metadata may be mistaken for authorization | Retain as product/build metadata only; server entitlement remains authoritative |
| `data/mock-exam-blueprint.json` | Reveals bank composition and directly references public source modules | Publish only non-sensitive blueprint information; remove private source paths from public runtime |
| `data/question-bank-extension.json` | Publicly lists all variant-part files | Remove premium manifest from public build |
| `data/question-variants-*.json` | Contains premium-designated stems and explanations | Move revised launch versions to private storage or server-only source |
| Module HTML quiz fieldsets | Contains question text, correct-answer attributes, and explanations | Public Fixation quiz may remain intentionally limited; premium quiz payloads move behind authorization |
| `assets/mock-exam-bank*.js` | Loads and assembles full public question bank | Refactor to request authorized payloads; public client code may render content but may not contain the bank |
| `assets/mock-exam-*.js` | Client exam runtime | May remain public if it contains no protected questions, answers, or secret authorization logic |
| `assets/targeted-practice*.js` | Client filtering and runtime | May remain public if it receives only authorized question payloads and cannot self-authorize |
| `assets/progress-service.js` and cloud adapters | Learner progress logic | Preserve central service contract; do not add content text or entitlement authority to progress storage |
| `assets/supabase-config.js` | Contains browser-safe project URL and publishable key | Replace with deployment-specific browser-safe configuration; never add secret credentials |
| `supabase/functions/*` | Server-side privileged operations | Keep source private before adding protected-delivery and entitlement logic |
| `supabase/migrations/*` | Database schema and policy definitions | Keep controlled; entitlement tables must deny browser mutation |

## Download inventory rule

Every downloadable file must be classified individually.

### Public downloads

May include:

- public Fixation handouts;
- a short sample study planner;
- non-premium checklists;
- public editorial or privacy documents.

### Protected downloads

Must include revised premium:

- processing schedules and templates;
- decalcification comparison and endpoint resources;
- embedding/microtomy references;
- staining resources;
- IHC/ISH resources;
- full study plans;
- question-bank exports;
- answer explanations;
- future certificates or personalized reports.

A protected download must be stored in a private bucket and delivered only after server authorization, normally through a streamed response or short-lived signed URL.

## Public build allowlist

The production public build should be generated from an explicit allowlist rather than deploying the repository root indiscriminately.

The allowlist may include:

- approved public HTML shells;
- public CSS and client runtime code;
- public images and fonts licensed for distribution;
- public manifest, sitemap, and robots files;
- deliberately public sample data;
- browser-safe environment configuration.

It must exclude:

- revised premium HTML payloads;
- full premium question JSON;
- explanations and answer-key files;
- private storage manifests;
- entitlement fixtures that grant access;
- administrative scripts;
- service credentials and local environment files;
- editorial working files not approved for publication;
- production logs and test artifacts.

## Protected payload format

The first proof may use a compact JSON content package such as:

```json
{
  "schemaVersion": 1,
  "contentId": "processing-proof-v1",
  "title": "Protected Processing Lesson Proof",
  "sections": [],
  "questions": []
}
```

This example defines structure only. The real proof payload must contain a unique canary phrase so automated tests can prove it is absent from public source and build output.

The browser may know the non-sensitive `contentId`. Knowledge of that identifier does not grant access.

## Delivery response rules

Authorized premium responses must:

- require a valid Supabase bearer token;
- derive the user identity from the verified token;
- check an effective server-controlled entitlement;
- validate the requested content ID against a server allowlist;
- deny direct arbitrary object-path requests;
- return `Cache-Control: private, no-store` for the initial proof;
- avoid logging payloads or tokens;
- fail with generic safe errors;
- remain inaccessible through direct public bucket URLs.

## Upgrade and denial experience

The public shell should distinguish:

- signed out: explain that sign-in is required;
- signed in but free: show an upgrade-required state;
- expired or revoked: explain that access is unavailable without exposing internal status details;
- server error: show a retry/support state without pretending the learner is unauthorized;
- authorized: load the protected payload and then initialize learning progress.

All states must be keyboard accessible, screen-reader understandable, and usable on desktop and mobile.

## Migration sequence

1. Preserve the current development deployment while the proof is built.
2. Create one revised protected payload with a unique leakage-test canary.
3. Store it only in staging private storage.
4. Build and test server authorization.
5. Replace one public premium route with a shell that contains no protected payload.
6. Verify signed-out, free, entitled, revoked, expired, invalid-token, incorrect-origin, and direct-URL cases.
7. Add public-build scanning.
8. Review the proof before migrating additional curriculum.
9. Migrate premium lessons and question content incrementally after security approval.
10. Keep the complete Fixation lesson and useful public samples as the acquisition funnel.

## Editorial boundary

The 80 alternate scenarios still require final scientific and editorial review. They must not be marketed as fully reviewed premium content until that review is complete.

Layer 14 protects delivery. It does not itself certify scientific accuracy or close the editorial-review requirement.

## Open decisions

The following can be deferred until after the protected proof:

- exact amount of the study plan that remains public;
- number of public sample questions;
- whether a short sample mock exam remains public;
- exact advanced analytics included in premium;
- whether previously public premium lessons are revised, expanded, or fully replaced for launch;
- future institutional content packaging.
