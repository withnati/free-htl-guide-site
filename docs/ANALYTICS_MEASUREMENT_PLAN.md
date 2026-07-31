# Free HTL Guide analytics measurement plan

## Purpose

The measurement layer should answer a small set of educational-product questions without collecting personal study content:

1. Which modules and study resources are reached most often?
2. Where do learners continue reading or leave?
3. How often do learners begin and complete quizzes?
4. Which resources lead learners into another module, the study plan, downloads, sharing, or email signup?
5. Are site changes improving engagement without degrading privacy, accessibility, or performance?

The plan does not measure individual question selections, personal notes, email addresses, names, employers, patient information, or user IDs.

## Activation state

`data/analytics-config.json` is the only activation source.

- `enabled` is `false` on `main`.
- `measurementId` is blank on `main`.
- No Google tag is requested in that state.
- A future activation requires a separate reviewed pull request that changes both values and updates the privacy policy if its wording is no longer accurate.
- Even after activation, the tag remains blocked until the visitor selects **Allow analytics**.

## Event dictionary

| Event | Trigger | Approved parameters | Primary use |
|---|---|---|---|
| `page_view` | Current page after consent and tag load | `page_title`, sanitized `page_location`, sanitized `page_referrer` | Reach and landing-page analysis |
| `scroll_depth` | 25%, 50%, 75%, and 100% document milestones | `scroll_percent` | Reading-depth proxy |
| `module_open` | Link to a current module | `module_path`, `link_text` | Module discovery paths |
| `file_download` | Supported document/archive download | `file_name`, `file_extension`, `link_text`, sanitized `link_url` | Resource demand |
| `outbound_click` | Link to another origin | `link_domain`, `link_text`, sanitized `link_url` | Reference and service use |
| `email_signup_start` | Valid signup submission begins | `form_id`, `signup_source` | Signup-funnel entry |
| `email_signup_success` | Mocked or real form success event | `form_id`, `signup_source`, `transport_type` | Signup conversion |
| `email_signup_error` | Form submission error | `form_id`, `signup_source`, `error_type` | Reliability monitoring |
| `quiz_start` | First answer interaction in a quiz | `quiz_id` | Assessment engagement |
| `quiz_complete` | Quiz is graded | `quiz_id`, `score`, `total_questions`, `score_percent`, `score_band`, `target_met` | Aggregate mastery proxy |
| `quiz_reset` | Quiz reset | `quiz_id` | Reattempt behavior |
| `study_task_toggle` | Study-plan task changed | `task_id`, `checked` | Plan engagement |
| `share` | Native share or copy-link action | `share_method`, `share_page`, sanitized `share_url` | Resource advocacy |

All event and parameter names are controlled by the configuration allowlist. Unknown names are rejected rather than sent.

## Data minimization rules

- Query strings and URL fragments are removed before transmission.
- Only primitive allowlisted parameter values are accepted.
- Prohibited field names are rejected.
- Email addresses and form-entered text are never passed into analytics events.
- Quiz events contain aggregate scores only, not selected answers or question text.
- No `user_id` or custom learner identifier is configured.
- Google Signals and advertising-personalization signals are disabled.
- Advertising consent states remain denied.
- When consent is declined, the Google tag is not loaded.
- Revoking consent updates the consent state, removes `_ga` cookies visible to the site, and stops subsequent event transmission.

## Recommended GA4 custom definitions

Create these only after the property is activated and events are visible in DebugView.

### Event-scoped dimensions

- `page_id`
- `module_path`
- `quiz_id`
- `score_band`
- `target_met`
- `signup_source`
- `share_method`
- `share_page`
- `file_extension`
- `link_domain`

### Event-scoped metrics

- `scroll_percent`
- `score`
- `total_questions`
- `score_percent`

Custom parameters must be registered in GA4 before they are available in standard reports and explorations.

## Core indicators

- **Module reach:** module page views and `module_open` events by module.
- **Reading depth:** percentage of module page views reaching 50%, 75%, and 100% scroll milestones.
- **Quiz start rate:** `quiz_start` divided by quiz-page views.
- **Quiz completion rate:** `quiz_complete` divided by `quiz_start`.
- **Target-met rate:** `quiz_complete` events with `target_met=true` divided by all quiz completions.
- **Study-plan engagement:** study-plan page views with at least one checked `study_task_toggle`.
- **Share rate:** `share` divided by page views for share-enabled resources.
- **Signup completion:** `email_signup_success` divided by `email_signup_start`.
- **Error rate:** `email_signup_error` divided by signup attempts.

These are behavioral indicators, not claims about examination readiness or pass probability.

## Reporting cadence

After activation and sufficient traffic:

- Review Realtime and DebugView during releases.
- Review acquisition, top content, errors, and consented engagement monthly.
- Review event taxonomy and custom definitions quarterly.
- Remove unused events before adding new ones.
- Do not make educational-content decisions from very small samples.

## Current primary references

- Google tag consent implementation: https://developers.google.com/tag-platform/security/guides/consent
- Google tag API consent reference: https://developers.google.com/tag-platform/gtagjs/reference
- GA4 event setup: https://developers.google.com/analytics/devguides/collection/ga4/events
- GA4 event parameters and custom definitions: https://developers.google.com/analytics/devguides/collection/ga4/event-parameters
- GA4 configuration limits: https://support.google.com/analytics/answer/12229528
