# Layer 14.5 Learner-Facing Copy and HT/HTL Exam-Preparation Audit

**Status:** Audit and proposed messaging only — broad copy implementation requires owner approval  
**Branch:** `layer-14-5-exam-positioning-copy`  
**Baseline main commit:** `8df26b01e16cf148edfedf04f73e322cdba8906f`  
**Controlling checkpoint:** `FHL-WEBSITE-SOURCE-2026-08-01-V3.0`  
**Audit date:** August 1, 2026

## 1. Scope and non-negotiable boundaries

This pass changes learner-visible wording and positioning. It does **not** redesign authentication, cloud progress, protected delivery, entitlement logic, database policies, or deployment architecture.

The following product boundaries remain unchanged:

- The complete Fixation lesson remains the strongest free learning experience.
- Anonymous public study remains available.
- A free account provides identity, progress saving, and cross-device continuity for eligible free learning activity.
- Premium access remains separate from account creation.
- Premium is planned to include lessons 2–7, full module quizzes, expanded practice, full mock exams, Targeted Practice, detailed progress history, weak-domain recommendations, protected downloads, and future updates.
- The 70 base questions are authority-reviewed. The 80 alternate scenarios must not be described as fully reviewed until scientific and editorial review is complete.
- No claim may imply guaranteed passage, official examination questions, official endorsement, or affiliation with ASCP or the ASCP Board of Certification.

## 2. Executive findings

The underlying learning product is already strongly aligned with HT/HTL preparation, but the normal learner experience does not consistently communicate that value.

The largest issues are:

1. **The homepage leads with broad histotechnology learning rather than certification preparation.** “Understand the slide—not only the answer” is a useful supporting thought, but it does not immediately answer whether the platform is for the HT or HTL exam.
2. **Architecture language is exposed as product copy.** Examples include “server-controlled entitlement,” “question payloads,” “account-ready record,” “current adapter,” “protected-delivery proof,” “private storage,” and development-layer references.
3. **Account pages explain system behavior instead of learner benefits.** The repeated language about verification, session handling, browser account state, and development previews should be replaced with study continuity, progress, and privacy benefits.
4. **FAQ and structured data contain stale product claims.** They describe the full curriculum as free, describe the mock exam as future work, and mark all learning resources as freely accessible.
5. **Premium previews prove security more strongly than they explain preparation value.** The learner should first understand what the feature helps them practice, what Premium includes, and what to do next.
6. **My Progress contains useful capabilities but describes storage internals.** The page should emphasize strengths, missed questions, weaker domains, recent activity, and the next study action.
7. **Several source lessons are strong educationally but need a clearer exam-domain frame.** Their scientific content should remain intact while titles, hero copy, and calls to action become more exam-focused.

## 3. Recommended positioning statement

### Primary positioning

**Free HTL Guide is an independent HT/HTL certification exam-preparation platform that combines structured histotechnology lessons, practice questions, mock-exam tools, and progress-based review.**

### Supporting promise

**Build the practical knowledge, recall, troubleshooting judgment, and test-taking readiness needed across the major HT and HTL exam domains.**

### Secondary educational value

**The same structured lessons also support histotechnology students, laboratory trainees, working histotechnologists refreshing core knowledge, pathology laboratory professionals, and educators.**

The secondary audience should appear after the certification-preparation promise, not instead of it.

## 4. Audience hierarchy

1. **Primary:** Candidates preparing for the HT or HTL certification examination.
2. **Secondary:** Histotechnology students and laboratory trainees building exam-relevant foundations.
3. **Supporting:** Working histotechnologists and pathology laboratory professionals refreshing knowledge or troubleshooting concepts.
4. **Extended:** Educators and learners seeking structured histology and histotechnology instruction.

## 5. Messaging hierarchy

### Level 1 — Outcome

**Prepare confidently for the HT or HTL certification exam.**

### Level 2 — Method

**Learn the major content domains, practice applying the rules, and use results to decide what to review next.**

### Level 3 — Product system

- **Lessons** build the scientific and practical foundation.
- **Module quizzes** reinforce each subject.
- **Mixed practice and mock exams** test recall and application across domains.
- **Targeted Practice** focuses review on weak domains, missed questions, and saved flags.
- **My Progress** shows study coverage, recent work, performance trends, and recommended next steps.

### Level 4 — Access model

- **Start free:** Complete the full Fixation lesson and its practice experience.
- **Create a free account:** Save eligible progress and continue across devices.
- **Prepare with Premium:** Unlock the full course, expanded practice system, mock exams, targeted review, deeper progress tools, and protected resources when Premium enrollment opens.

### Level 5 — Trust

**Independent, professionally informed, transparent about review status, and not affiliated with or endorsed by ASCP or the ASCP Board of Certification.**

## 6. Website-wide copy inventory and page map

| Page or surface | Current learner goal | Primary exam-preparation message | Current issue | Proposed learner-facing direction | Primary CTA | Funnel role |
|---|---|---|---|---|---|---|
| Homepage | Decide whether the platform fits and begin | Prepare for the HT/HTL exam with lessons, practice, and progress-based review | Hero is broad; architecture and development narration are visible | Lead with HT/HTL exam preparation, show the study system, then explain free account and Premium value | **Start the free Fixation lesson** | Acquisition |
| Global navigation | Find the next major activity | Move between course, practice, progress, and account | “Modules” and mixed labels do not express a complete exam-prep journey | Use **Course**, **Practice**, **Mock exams**, **My progress**, **Premium**, **Sign in** where space permits | **Explore the course** | Acquisition / activation |
| Homepage curriculum | Understand coverage | Cover fixation, processing, embedding/microtomy, staining, laboratory operations, and HTL-level IHC/ISH | Copy emphasizes public/premium delivery status more than exam value | Show each subject as an exam domain with a clear Free or Premium label | **Study Fixation** / **Preview lesson** | Acquisition / conversion |
| Homepage platform section | Understand how features work together | Learn, test, identify gaps, and review weak areas | “Stable attempts,” “revisions,” “question payloads,” and entitlement language | Explain learner outcomes: save progress, review misses, see weaker domains, continue across devices | **View how preparation works** | Activation / conversion |
| Homepage availability notice | Understand what can be used now | Start free now; Premium enrollment is not open yet | Layer/deployment status is visible | Use a plain product notice: “Premium enrollment is not open yet. Start the free lesson or create an account to save progress.” | **Start free** | Acquisition |
| Free Fixation lesson | Complete a high-value lesson | Master a major HT/HTL exam domain through mechanisms, artifacts, controls, and practice | Strong content; title and hero can be more exam-specific | Label it as the **complete free Fixation lesson for HT/HTL exam preparation** | **Start the free Fixation lesson** | Acquisition / learning |
| Processing & Decalcification | Learn a core domain | Apply processing and decalcification principles in exam-style scenarios | Broad “study guide” frame | Connect dehydration, clearing, infiltration, artifacts, and decalcification to the Processing exam domain | **Continue Processing** | Learning / retention |
| Embedding & Microtomy | Learn a core domain | Build orientation, sectioning, cryostat, and artifact-recognition readiness | Broad “study guide” frame | State the exam-domain outcome and emphasize scenario-based troubleshooting | **Continue Embedding & Microtomy** | Learning / retention |
| Routine H&E | Learn staining chemistry and troubleshooting | Prepare for staining questions involving sequence, chemistry, balance, controls, and artifacts | Broad “study guide” frame | Make exam relevance explicit without weakening scientific accuracy | **Study Routine H&E** | Learning / retention |
| Special Stains | Organize high-volume stain facts | Recall target, chemistry, color, control, and critical step for exam questions | Strong lesson but exam benefit is secondary | Lead with the high-yield study framework used in exam and troubleshooting questions | **Study Special Stains** | Learning / retention |
| Laboratory Operations | Prepare for quality, safety, and systems questions | Apply QC, QA, safety, equipment, validation, documentation, and CAPA principles | Strong content but broad title | Make the Laboratory Operations exam domain explicit | **Study Laboratory Operations** | Learning / retention |
| IHC & ISH | Build HTL-level depth | Prepare for advanced HTL questions on preanalytics, controls, retrieval, detection, validation, and troubleshooting | Strong HTL content; “extension” is useful but could better state exam value | Label as an HTL-focused advanced domain and clarify relevance to working professionals | **Study IHC & ISH** | Learning / retention |
| Six-week study plan | Turn content into a schedule | Follow a paced HT/HTL exam-review sequence | Source is strong; public preview needs clearer Premium value | Explain how lessons, quizzes, mock exams, and weak-area review fit together | **Start the study plan** | Activation / retention / conversion |
| Cumulative practice | Test mixed recall | Practice across major HT/HTL domains and review every miss | Current title is generic and source/full-access boundary is unclear | Position as mixed HT/HTL practice questions; offer a free sample and Premium full practice | **Practice sample questions** | Activation / conversion |
| Mock exam | Rehearse exam-style decision making | Complete a 50-question timed or untimed practice exam and review performance by domain | “Saved locally” is stale; question-bank description can mislead; source may imply full current availability | Emphasize exam-style practice, domain results, missed-question review, and no pass prediction | **Preview the mock exam** / **Start mock exam** | Conversion / retention |
| Targeted Practice | Focus on specific gaps | Build sets from weak domains, missed questions, flags, domain, and difficulty | Heavy development-bank, adapter, metadata, and server-enforcement narration | Lead with personalized exam review; disclose review status separately and plainly | **Review weak areas** | Conversion / retention |
| My Progress | Decide what to study next | Track study coverage, quiz results, mock-exam trends, missed questions, and weaker domains | Storage architecture dominates the page | Put next step, strengths, gaps, and recent study first; move plain-language privacy/storage details lower | **Continue studying** | Activation / retention |
| Sign-up | Decide whether an account is worth creating | Save study progress and continue across devices | Session and browser-state explanations replace benefits | Explain: save progress, keep quiz history, continue on another device, manage data; account remains free | **Create free account** | Activation |
| Sign-in | Return to learning | Continue the course and saved progress | “Account and cloud-progress preview” is internal | “Sign in to continue studying and view your saved progress.” | **Sign in to continue** | Activation / retention |
| Verify email | Finish account creation | Confirm the account so progress can be saved securely | Repeated architecture bullets and preview footer | Keep the direct instruction and explain the benefit in one sentence | **Resend verification email** | Activation |
| Forgot password | Recover access | Return to saved study progress | Repeated system bullets | Use privacy-safe reset language and remove architecture narration | **Send reset link** | Retention |
| Reset password | Restore account access | Choose a new password and return to studying | Technical recovery-link narration is acceptable but can be friendlier | “Open the recovery link from your email, then choose a new password.” | **Update password** | Retention |
| Auth callback | Wait for sign-in to complete | Resume learning after verification | “Secure sign-in response” and session-confirmation language | “Finishing your sign-in. Keep this page open for a moment.” | **Return to sign in** | Activation |
| Account settings | Manage profile and data | Control account information and learning records | “Identity attached to learning progress” and repeated browser-state bullets | Explain profile, password, progress controls, sign-out, and deletion in learner language | **Save account settings** | Retention |
| Premium preview template | Decide whether Premium is valuable | See what the full exam-prep feature includes | “Layer 14,” server verification, protected payloads, and delivery proof are prominent | Use **Included with Premium**, benefits, free alternative, and clear availability state | **See what Premium includes** | Conversion |
| Premium lesson access page | Open an included lesson or recover from an access problem | Sign in or use Premium to continue | Entire page is framed as a security proof | Present the lesson title and learner action; keep proof details in documentation/tests | **Sign in to continue** / **Prepare with Premium** | Conversion / learning |
| Access-denied states | Understand why content is unavailable | Sign in, upgrade, or retry without losing progress | Internal status vocabulary and service terminology | State what happened, reassure progress, and give one clear next action | Context-specific | Conversion / retention |
| FAQ | Resolve objections and understand access | Explain HT vs HTL preparation, coverage, free/account/Premium, reviews, and independence | Stale claims: all resources free; mock exam future; all module quizzes available | Rebuild around current product model and common purchase/account questions | **Start the free lesson** | Acquisition / conversion |
| About | Trust the creator and method | Learn why this is a credible independent HT/HTL exam-prep platform | Hero is broad histology education; free-access statement is outdated | Lead with the exam-prep mission, then professional experience and editorial method | **Start studying** | Acquisition |
| Editorial standards | Evaluate quality and independence | Understand exam alignment, source hierarchy, question review, and corrections | Strong page; needs the 70/80 review boundary | Add a clear question-bank status statement and keep technical governance out of acquisition copy | **Review content standards** | Trust / conversion |
| Contact | Report an issue or ask a question | Improve the HT/HTL learning experience | Mostly learner-centered | Add exam-prep context to topic/correction prompts | **Report a correction** | Trust / retention |
| Privacy | Understand data use and controls | Learn what is collected, why, and what choices are available | Excess implementation detail: identifiers, queues, Edge Functions, bearer tokens, allowlists, Layer 14 | Keep provider names, data categories, purposes, safeguards, choices, and deletion; remove architecture narration not required for trust | **Manage privacy choices** | Trust / compliance |
| Terms | Understand permitted use and paid access | Know educational limits, account responsibilities, and future billing terms | Layer references and implementation-specific entitlement explanation | Plain language: paid access begins only after billing confirmation; details shown before purchase | **Return to course** | Trust / compliance |
| Metadata and structured data | Discover the right pages through search | Match HT/HTL exam-preparation intent naturally | Titles are inconsistent; all lesson resources are marked free in generated structured data | Use exam-prep titles/descriptions; mark only genuinely free resources as free | Search acquisition |
| Footer | Confirm independence and find trust pages | Reinforce independent exam-prep role | Some account pages say “Secure account development preview” | Use consistent independence, privacy, terms, FAQ, about, and contact links | **Start the free lesson** where appropriate | Trust / navigation |

## 7. Proposed homepage acquisition copy

### Hero

**Eyebrow**  
HT/HTL certification exam preparation

**H1**  
Prepare confidently for the HT or HTL exam

**Lead**  
Build the histotechnology knowledge, recall, and troubleshooting judgment needed across fixation, processing, embedding and microtomy, staining, laboratory operations, and HTL-level methods. Learn with structured lessons, practice questions, mock-exam tools, and progress-based review.

**Proof points**

- Complete free Fixation lesson
- Exam-domain lessons and quizzes
- Mock-exam and targeted-practice tools
- Progress and weak-area review

**Primary CTA**  
Start the free Fixation lesson

**Secondary CTA**  
Explore the course

**Account CTA**  
Create a free account

**Account support line**  
Save eligible progress and continue studying across devices.

**Premium support line**  
Premium will unlock the complete course, expanded practice, full mock exams, Targeted Practice, deeper progress insights, and protected study resources.

**Trust line**  
Independent educational resource. Not affiliated with or endorsed by ASCP or the ASCP Board of Certification.

### Replace the architecture card

**Current concept:** “Premium content protected before delivery” followed by server/session/payload narration.

**Replacement heading:** Prepare with the complete study system

**Replacement body:** Premium brings the full lessons, module quizzes, mock exams, Targeted Practice, attempt history, and weak-domain recommendations together so you can spend more time reviewing what needs attention.

**CTA:** See what Premium includes

### Replace the development note

**Proposed notice before checkout is active:**  
**Premium enrollment is not open yet.** You can start the complete free Fixation lesson now or create a free account to save eligible progress.

This notice should be removed or updated when Layer 15 activates checkout.

## 8. Free, account, and Premium language

### Free

Use:

- Complete free Fixation lesson
- Free Fixation practice quiz
- Selected free study resources
- Course and Premium previews
- No account required to begin

Avoid implying that all seven lessons, all quizzes, the full bank, or mock exams are free.

### Free account

Use:

- Save eligible study progress
- Continue across devices
- Keep your study activity connected to your account
- Manage, export, reset, or delete your learning records

Avoid:

- verified session
- account-backed adapter
- browser account state
- account-ready record
- cloud-progress preview

### Premium

Use:

- Complete lessons 2–7
- Full module quizzes
- Expanded practice bank
- Full mock exams
- Targeted Practice by domain, difficulty, weak area, missed question, and flag
- Detailed progress dashboard and attempt history
- Weak-domain recommendations
- Protected study downloads and future updates

Until the 80 alternate scenarios complete review, use this disclosure wherever the number 150 appears:

> The expanded 150-question bank will be released as fully reviewed content only after the remaining alternate scenarios complete scientific and editorial review.

Do not use “150 reviewed questions” before that work is complete.

## 9. Premium preview and upgrade copy

### Preview template

**Eyebrow:** Included with Premium  
**Heading:** Feature or lesson title  
**Summary:** What the learner will study or practice and how it supports HT/HTL exam preparation  
**Feature heading:** What you will receive with Premium  
**Primary CTA before checkout:** See what Premium includes  
**Primary CTA after checkout launches:** Prepare with Premium  
**Secondary CTA:** Start the free Fixation lesson  
**Account CTA:** Sign in

**Availability note before Layer 15:**  
Premium enrollment is not open yet. Creating a free account lets you save eligible progress but does not unlock Premium features.

Remove “Layer 14,” “protected before delivery,” “server verifies,” “entitlement,” and “question payload” from this template.

### Premium lesson access states

| State | Recommended learner copy | CTA |
|---|---|---|
| Loading | Loading your lesson… | None |
| Signed out | Sign in to continue learning. | Sign in to continue |
| Session ended | Your session ended. Sign in again to continue. | Sign in again |
| Premium required | This lesson is included with Premium. Upgrade your plan to continue. | Prepare with Premium |
| Premium not yet for sale | This lesson will be included with Premium when enrollment opens. | See what Premium includes |
| Temporary error | We could not load this lesson. Please try again. Your progress has not been changed. | Try again |
| Authorized | Your lesson is ready. | Continue lesson |
| No JavaScript | Turn on JavaScript to sign in and open this lesson. | Return to course |

A support reference may remain available in small text because it can help resolve an account problem.

## 10. Account copy standard

### Sign-up intro

**Eyebrow:** Free learner account  
**H1:** Save your HT/HTL study progress  
**Lead:** Create a free account to keep eligible lesson and quiz progress, continue across devices, and manage your learning records.

**Benefits:**

- Continue where you left off
- Keep study activity connected to your account
- View progress and recommended next steps
- Control, export, reset, or delete your learning records

**Clarifier:** A free account does not include Premium lessons or practice tools.

### Sign-in intro

**H1:** Welcome back  
**Lead:** Sign in to continue studying and view your saved progress.

### Verification

**Lead:** Open the verification link we sent to finish creating your account and start saving progress.

### Settings

**Lead:** Update your profile, manage your study data, sign out, or delete your account.

### Account footer

Replace “Secure account development preview” with:

**Independent HT/HTL exam-preparation platform**

## 11. My Progress copy direction

### Page promise

**Eyebrow:** Your HT/HTL study dashboard  
**H1:** My progress  
**Lead:** See what you have studied, review recent scores, identify weaker domains, and choose your next step.

### Account callout

**Signed out:** Progress on this device is available here. Create a free account to continue across devices.  
**Signed in:** Your progress is connected to your account.

### Import choice

**Heading:** Add this device’s study progress to your account?  
**Body:** We found study activity saved on this device. Add it to your account, or continue with the progress already saved there.  
**Primary CTA:** Add this progress to my account  
**Secondary CTA:** Use my account progress

### Conflict choice

**Heading:** Choose which unfinished practice session to continue  
**Body:** A newer unfinished session is saved to your account. Completed work and other progress will remain available.  
**Primary CTA:** Continue the newer session  
**Secondary CTA:** Continue this device’s session

### Empty states

- No domain data: Complete a mock exam or Targeted Practice set to see performance by domain.
- No activity: Your recent lessons, quizzes, and practice attempts will appear here.
- No attempts: Complete your first practice set to begin building a study history.

### Access labels

Replace “Premium planned,” “Account feature,” “Public preview,” “Supabase cloud,” and “Ready for explicit import” with learner labels such as:

- Free
- Included with account
- Included with Premium
- Saved on this device
- Saved to your account
- Ready to add

## 12. FAQ replacement topics

The FAQ should be rebuilt around the actual product model:

1. Is this designed for the HT and HTL certification exams?
2. Is Free HTL Guide affiliated with ASCP?
3. What is the difference between HT and HTL preparation?
4. Which exam domains are covered?
5. What can I study for free?
6. What does a free account provide?
7. What will Premium include?
8. Are these official examination questions?
9. How are questions reviewed?
10. Is the 150-question bank fully reviewed?
11. How do mock exams and Targeted Practice work together?
12. Does a score predict whether I will pass?
13. Can working histotechnologists use the lessons for review?
14. Can the content replace a laboratory SOP?
15. How can I report a correction or technical problem?

Remove stale claims that the complete curriculum is free or that the mock-exam system is only a future feature.

## 13. SEO title and description map

| Route | Proposed title | Proposed description |
|---|---|---|
| `/` | HT/HTL Exam Preparation, Lessons and Practice \| Free HTL Guide | Prepare for the HT or HTL certification exam with a complete free Fixation lesson, structured histotechnology review, practice tools, and progress-based study support. |
| `/about.html` | About the HT/HTL Exam-Prep Guide and Instructor \| Free HTL Guide | Meet Natnale Mengesha, HTL(ASCP)cm, and learn how this independent HT/HTL exam-preparation platform develops practical lessons and original questions. |
| `/faq.html` | HT/HTL Exam Preparation FAQ \| Free HTL Guide | Answers about HT and HTL exam preparation, covered domains, free lessons, learner accounts, Premium features, practice questions, and independence. |
| `/editorial.html` | HT/HTL Content Review and Editorial Standards \| Free HTL Guide | Learn how lessons and original practice questions are aligned, sourced, reviewed, corrected, and kept independent from the certifying organization. |
| `/modules/fixation-guide-v3.html` | Free Fixation Lesson for HT/HTL Exam Preparation | Study fixation mechanisms, preanalytics, artifacts, safety, troubleshooting, and practice questions in a complete free HT/HTL lesson. |
| `/modules/processing-guide-v3.html` | Processing and Decalcification for HT/HTL Exam Prep | Review dehydration, clearing, infiltration, processor variables, decalcification, artifacts, quality control, and exam-style practice. |
| `/modules/embedding-guide-v3.html` | Embedding and Microtomy for HT/HTL Exam Prep | Prepare for orientation, paraffin embedding, microtomy, cryostat, section artifacts, safety, quality control, and practice questions. |
| `/modules/staining-he-guide.html` | Routine H&E Staining for HT/HTL Exam Prep | Learn H&E chemistry, differentiation, bluing, eosin control, stain balance, artifacts, quality control, and exam-focused practice. |
| `/modules/special-stains-guide.html` | Special Stains for HT/HTL Exam Preparation | Review stain targets, chemistry, expected colors, controls, critical steps, artifacts, troubleshooting, and practice questions. |
| `/modules/lab-operations-guide.html` | Laboratory Operations for HT/HTL Exam Prep | Study quality systems, safety, equipment, validation, documentation, calculations, troubleshooting, CAPA, and practice questions. |
| `/modules/ihc-ish-guide.html` | IHC and ISH for HTL Exam Preparation | Build HTL-level knowledge of preanalytics, controls, retrieval, detection, validation, in situ hybridization, and troubleshooting. |
| `/study-plan.html` | Six-Week HT/HTL Exam Study Plan \| Free HTL Guide | Follow a structured six-week HT/HTL study sequence connecting lessons, quizzes, mock exams, and weak-area review. |
| `/practice.html` | HT/HTL Practice Questions and Mixed Review \| Free HTL Guide | Practice fixation, processing, microtomy, staining, and laboratory operations with explanations and missed-question review. |
| `/mock-exam.html` | 50-Question HT/HTL Mock Exam Practice \| Free HTL Guide | Use timed or untimed HT/HTL exam-style practice with flags, domain results, missed-question explanations, and attempt history. |
| `/targeted-practice.html` | Targeted HT/HTL Practice for Weak Domains | Build focused HT/HTL practice sets by domain, difficulty, weak area, previously missed question, or saved flag. |
| `/my-progress.html` | My HT/HTL Study Progress \| Free HTL Guide | Review private lesson activity, quiz scores, mock-exam trends, weaker domains, and recommended next study steps. |

Account pages remain `noindex,nofollow` but should use descriptive learner titles, such as “Create Your Free HT/HTL Study Account” and “Sign In to Continue Your HT/HTL Study.”

## 14. Structured-data corrections

The dynamic structured data currently treats all seven module resources and some Premium study tools as freely accessible. Implementation should:

- mark the complete Fixation lesson as free;
- avoid marking Premium lessons, mock exams, Targeted Practice, or the complete study plan as free;
- describe the site primarily as professional certification preparation;
- use natural HT exam preparation, HTL exam preparation, histotechnician certification study, histotechnologist certification study, and histotechnology practice-question language;
- avoid adding pricing or availability schema until the Premium plan and checkout are real;
- keep the independent/non-endorsed statement visible on the page rather than attempting to encode unsupported affiliation claims.

## 15. Internal narration to remove from normal learner pages

The implementation should prevent these phrases or close variants from appearing in public headings, body copy, buttons, notices, empty states, and learner-facing JavaScript messages:

- production design
- production hosting
- protected delivery proof
- server-controlled entitlement
- entitlement verification
- effective entitlement
- bearer token or bearer session
- protected payload or question payload
- private object or private bucket
- Edge Function
- origin validation or origin allowlist
- authorization architecture
- content-delivery proof
- Layer 13, Layer 14, Layer 14.5, or Layer 15
- staging-only proof
- browser role
- current adapter
- account-ready record
- cloud-progress preview
- secure account development preview
- stable IDs, record revisions, pending-write queue, or conflict metadata when a plain learner explanation is sufficient

Technical documentation, migrations, server code, tests, logs, and architecture records remain outside this learner-copy restriction.

Privacy and Terms may describe necessary safeguards, providers, stored data categories, billing confirmation, and user rights, but should do so in plain language and without narrating internal implementation unnecessarily.

## 16. Proposed automated copy guards

Add a dedicated learner-copy validation step during implementation.

### Suggested validator

`python scripts/validate_learner_copy.py`

### Scan targets

- public and account HTML source files;
- the Premium preview template;
- learner-facing status and error strings in `assets/auth-ui.js`, `assets/premium-content-client.js`, `assets/cloud-progress-controller.js`, `assets/dashboard.js`, mock-exam UI/results, and Targeted Practice UI;
- generated public `dist` output;
- metadata and structured-data generators.

### Exclusions

- `docs/`
- `supabase/`
- migrations and database tests
- server implementation
- browser/unit test descriptions
- README architecture sections

### Required assertions

1. No forbidden developer-narration phrase appears in normal learner-visible copy.
2. Homepage title, description, H1, lead, and primary CTA clearly express HT/HTL exam preparation.
3. Homepage visibly explains the free lesson, account value, and Premium value.
4. FAQ does not claim the complete curriculum is free or that mock exams are merely future work.
5. No page claims all 150 questions are fully reviewed while 80 scenarios remain pending.
6. Structured data does not mark Premium resources as free.
7. Account and access states use approved learner wording.
8. Independence and no-guarantee statements remain present.

## 17. Recommended implementation order after approval

1. Add the learner-copy validator and failing regression tests.
2. Rewrite homepage, navigation, footer, metadata, and structured data.
3. Rewrite the Premium preview template and protected-lesson access states.
4. Rewrite sign-up, sign-in, verification, recovery, callback, settings, and auth status messages.
5. Rewrite My Progress labels, import/conflict language, empty states, access labels, and recommendations.
6. Rebuild FAQ and update About positioning.
7. Update lesson titles, hero framing, and calls to action without altering scientific lesson content.
8. Simplify Privacy and Terms while preserving required disclosures and safeguards.
9. Update mock exam, Targeted Practice, practice, and study-plan framing.
10. Run Site Quality, Browser Quality, Database Quality, Layer 14 Security, and the new learner-copy validation.
11. Deploy the exact branch head to staging and review desktop, mobile, keyboard, screen-reader, and conversion flow behavior.
12. Record before-and-after screenshots and test evidence in the draft pull request.
13. Do not merge without explicit owner approval.

## 18. Approval gate

Broad learner-copy implementation should begin only after the owner approves:

- the primary positioning statement;
- the audience hierarchy;
- the homepage hero and CTA direction;
- the free/account/Premium language;
- the handling of the 70 reviewed base questions and 80 scenarios still under review;
- the Premium preview and access-state wording;
- the proposed SEO title/description direction.

No Layer 15 payment implementation belongs in this branch.