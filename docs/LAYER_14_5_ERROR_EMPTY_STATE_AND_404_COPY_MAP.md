# Layer 14.5 Error, Empty-State, and 404 Copy Map

**Status:** Proposed learner-facing wording; implementation requires owner approval.  
**Companion document:** `LAYER_14_5_LEARNER_COPY_AND_EXAM_POSITIONING_AUDIT.md`

## 1. Page-not-found experience

### Current learner goal

Recover from an outdated, mistyped, or removed link and return to useful study content.

### Current state

The current 404 page is clear and functional, but it returns learners to broad “modules” and a study-plan route without reinforcing the primary HT/HTL exam-preparation journey or distinguishing free and Premium destinations.

### Proposed copy

**Title:** Page Not Found | Free HTL Guide  
**Eyebrow:** Page not found  
**H1:** We could not find that study page  
**Lead:** The link may be outdated or mistyped. Return to the HT/HTL course, begin the complete free Fixation lesson, or report a broken link.

**Primary CTA:** Start the free Fixation lesson  
**Secondary CTA:** Explore the HT/HTL course  
**Utility CTA:** Report a broken link

**Suggested lesson card heading:** Looking for an HT/HTL topic?  
**Suggested body:** Review the current course outline for Fixation, Processing, Embedding and Microtomy, Routine H&E, Special Stains, Laboratory Operations, and HTL-focused IHC/ISH.

**Funnel role:** Retention and recovery.

## 2. Account status and error messages

| Current situation | Proposed learner message | Action |
|---|---|---|
| Account service unavailable | Sign-in is temporarily unavailable. Please try again later. | Try again / Return to course |
| Account setup failed | We could not create your account. Check the information entered and try again. | Try again |
| Sign-in failed | We could not sign you in. Check your email and password and try again. | Sign in |
| Verification link invalid or expired | This verification link is no longer valid. Request a new email to finish creating your account. | Resend verification email |
| Password-reset link invalid or expired | This reset link is no longer valid. Request a new password-reset email. | Request a new link |
| Display name save partially failed | Your display name was updated, but we could not finish saving the change everywhere. Please try again later. | Try again |
| Account deleted | Your account and saved account progress were deleted. You can still use the free lesson without an account. | Start the free lesson |
| Account deletion failed | We could not delete your account. Nothing was removed. Please try again. | Try again |

Avoid exposing “authentication initialization,” “profile record synchronization,” “secure session response,” or provider-specific implementation language in normal error states.

## 3. Premium access states

| State | Heading or label | Message | Primary action |
|---|---|---|---|
| Loading | Loading | Loading your lesson… | None |
| Signed out | Sign in required | Sign in to continue learning. | Sign in to continue |
| Session expired | Sign in again | Your session ended. Sign in again to continue. | Sign in again |
| Premium required | Included with Premium | This lesson is included with Premium. Upgrade your plan to continue. | Prepare with Premium |
| Premium enrollment not active | Premium coming soon | This lesson will be included with Premium when enrollment opens. | See what Premium includes |
| Temporary connection problem | Could not load lesson | We could not load this lesson. Check your connection and try again. Your progress has not been changed. | Try again |
| Unexpected response | Could not load lesson | We could not load this lesson. Please try again. Your progress has not been changed. | Try again |
| Access confirmed | Lesson ready | Your lesson is ready. | Continue lesson |
| JavaScript unavailable | JavaScript required | Turn on JavaScript to sign in and open this lesson. | Return to course |

A support reference may remain visible in small text when it helps customer support investigate a genuine access problem.

## 4. My Progress states

| Current situation | Proposed learner message | Action |
|---|---|---|
| Signed out | Progress on this device is available here. Create a free account to continue across devices. | Create free account |
| No progress yet | Start the free Fixation lesson to begin building your study history. | Start free lesson |
| No domain results | Complete a mock exam or Targeted Practice set to see performance by domain. | Preview practice tools |
| No recent activity | Your recent lessons, quizzes, and practice attempts will appear here. | Continue studying |
| Progress loading | Loading your study progress… | None |
| Progress failed to load | We could not load your progress. Existing study data on this device has not been deleted. | Try again |
| Device progress found | We found study activity saved on this device. Add it to your account, or continue with the progress already saved there. | Add this progress to my account |
| Device import failed | We could not add this device’s progress to your account. Nothing was deleted. Please try again. | Try again |
| Offline | You are offline. Your changes are saved on this device and will be added to your account when the connection returns. | Continue studying |
| Sync problem | We could not save the latest changes to your account yet. They remain saved on this device and will be retried. | Continue studying |
| Unfinished-session conflict | A newer unfinished session is saved to your account. Choose which session to continue. Completed work will remain available. | Continue newer session |
| Reset complete, device only | Your study progress on this device was reset. Your notes, theme, and privacy choices were not removed. | Start studying |
| Reset complete, account connected | Your saved study progress was reset. Your account and privacy choices were not removed. | Start studying |

Replace learner-facing labels such as “Supabase cloud,” “anonymous browser profile,” “current adapter,” “account record active,” and “explicit import” with “Saved on this device,” “Saved to your account,” “Free,” “Included with account,” or “Included with Premium.”

## 5. Mock-exam states

| Situation | Proposed copy | Action |
|---|---|---|
| Bank loading | Preparing your mock exam… | None |
| Exam unavailable | We could not prepare the mock exam. Please try again. | Try again |
| Saved unfinished attempt | You have an unfinished mock exam. Continue where you left off or start again. | Resume mock exam |
| Unanswered questions | You still have **N** unanswered questions. Return to them or submit the exam now. | Review unanswered questions |
| Attempt complete | Review your total score, performance by domain, missed questions, and saved flags. | Review missed questions |
| No history | Your completed mock exams will appear here. | Start a mock exam |
| History cleared | Your mock-exam history was cleared. | Start a new exam |

Keep the existing statement that results are private study indicators and are not official ASCP scores or pass predictions.

## 6. Targeted Practice states

| Situation | Proposed copy | Action |
|---|---|---|
| Question pool loading | Preparing your practice options… | None |
| No matching questions | No questions match these filters. Select another domain, difficulty, or question source. | Change filters |
| Too few matching questions | This combination has fewer questions than the selected set size. Choose a smaller set or broaden the filters. | Update practice set |
| No previous misses | Complete a mock exam or Targeted Practice set first, then return here to review missed questions. | Start mixed practice |
| No saved flags | Flag questions during a mock exam or practice set, then return here to review them. | Start practice |
| No measured weak domain | Complete a mock exam or Targeted Practice set to identify weaker domains. | Start practice |
| Answer saved | Answer saved. | Continue |
| Study-mode answer required | Choose an answer before checking it. | Choose an answer |
| Attempt complete | Review your domain results, missed questions, and saved flags, then build your next focused set. | Build another set |
| No missed or flagged questions | No missed or flagged questions in this set. | Build another set |
| No recent attempts | Your completed Targeted Practice sets will appear here. | Build a practice set |

Do not expose “development records,” “account-ready progress,” “current adapter,” browser metadata, or server-enforcement explanations on the learner-facing page.

## 7. General quiz and lesson states

| Situation | Proposed copy | Action |
|---|---|---|
| Quiz submitted at or above study target | Study target met. Review the explanations, then continue to the next topic. | Continue studying |
| Quiz submitted below study target | Review each explanation and try the quiz again after revisiting the weak points. | Review explanations |
| Quiz reset | Your answers were cleared. | Retake quiz |
| Copy action failed | Copy did not work. Select the text and copy it manually. | Close |
| Lesson progress not yet started | Start this lesson to begin tracking your progress. | Start lesson |
| Lesson completed | Lesson complete. Take the quiz or continue to the next exam domain. | Take the quiz |

The 80% target remains a study goal, not an official passing score or exam-performance prediction.

## 8. Button-label standard

Use action labels that describe the learner’s next step:

- Start the free Fixation lesson
- Explore the course
- Practice sample questions
- Start mock exam
- Build a practice set
- Review weak areas
- Review missed questions
- View my progress
- Continue studying
- Create free account
- Sign in to continue
- See what Premium includes
- Prepare with Premium
- Try again
- Return to course

Avoid:

- Begin
- Continue without context
- Request content
- Verify access
- Load payload
- Check entitlement
- Open protected route
- Use adapter
- Import record

## 9. Validation requirement

The learner-copy validator proposed in the primary audit should scan this error and empty-state vocabulary in HTML and client-side JavaScript. Automated tests should verify the approved text for signed-out, free-account, Premium-required, expired-session, offline, conflict, empty-history, and unavailable states on desktop and mobile.