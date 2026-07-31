# Layer 11 — Account-ready progress foundation

## Product direction

Free HTL Guide is being developed toward a subscription learning platform. The intended final access model is:

- one complete public lesson used as the quality hook;
- account creation for personal progress;
- paid access for the remaining lessons, full practice bank, mock exams, targeted practice, and detailed progress history;
- server-verified subscription entitlements before protected content is returned.

Layer 11 does **not** implement authentication, payment, or a secure paywall. The current GitHub Pages deployment remains public. The access metadata in this layer describes the future product and must never be used as proof that a visitor has paid.

## What Layer 11 adds

- A private, `noindex` **My progress** dashboard.
- A versioned learner record under `free-htl-progress-v1`.
- An asynchronous progress-service interface with a local browser adapter.
- A documented replacement point for a future authenticated cloud adapter.
- Migration of existing lesson, checklist, quiz, and mock-exam browser data.
- Stable account-ready module, attempt, domain, question, and activity records.
- Export and reset controls.
- Future access-tier metadata for lessons and features.
- Static and browser enforcement of privacy and authorization boundaries.

## Current storage behavior

The current adapter stores the normalized record in browser local storage. The dashboard clearly identifies this as an anonymous browser profile. It does not claim that an account exists or that progress is synchronized across devices.

The service exposes asynchronous methods so later work can replace the local adapter with authenticated API calls without rebuilding every lesson, quiz, mock exam, and dashboard component.

## Account-ready progress fields

The record may include:

- anonymous record and migration identifiers;
- module start, last activity, last section, sections viewed, and completion state;
- study-plan task IDs and completion state;
- module quiz attempt IDs, score totals, percentages, and timestamps;
- active mock-exam question IDs, selected option IDs, flags, timing, and current position;
- completed mock-exam score, timing, five-domain summaries, and sanitized question outcomes;
- recent learning-activity summaries;
- a development-only entitlement description that is not authorization.

Question outcomes use stable IDs. The progress record does not copy question text, explanations, or answer keys.

## Information excluded by default

The account-ready schema explicitly excludes:

- personal notes;
- email addresses;
- analytics-consent state;
- theme preference.

Export and reset behavior follows the same boundary. Resetting learning progress does not remove notes, theme, or analytics choices.

## Legacy migration

On first use, the service imports compatible values from the current keys:

- `last:*`
- `check:*`
- `quiz:*`
- `best:*`
- `free-htl-mock-active-v1`
- `free-htl-mock-history-v1`

The original keys remain available to existing page behavior until later layers fully retire them. New interactions also write through the normalized service.

## Access metadata

`data/content-access.json` currently declares:

- Fixation as the public hook lesson;
- the other six modules as premium in the final product;
- the dashboard as a registered-account feature with a local preview;
- the study plan, cumulative practice, mock exam, and future targeted practice as premium.

This metadata supports interface planning and validation only. Secure access requires authenticated server-side enforcement and protected content delivery.

## Future secure layers

A later authentication layer should provide:

1. verified account identity and secure sessions;
2. an authenticated cloud progress adapter;
3. explicit migration of anonymous browser progress into the account;
4. conflict handling for progress recorded on multiple devices.

A later premium-content layer should move paid lesson and question data out of the public static deployment.

A later payment layer should:

1. create checkout and billing-management flows;
2. receive signed payment-provider webhooks;
3. update subscription state on the server;
4. calculate entitlements on the server;
5. return premium content only after authorization.

A browser value, access label, query parameter, or local-storage entry must never grant paid access.

## Quality contract

The protected checks enforce:

- one public hook lesson and six premium-designated modules;
- private-dashboard `noindex` behavior and sitemap exclusion;
- server-verified future payment entitlements;
- an adapter-based progress service;
- migration of current browser progress;
- exclusion of notes, email, analytics consent, and theme from account sync;
- no copied question text or answer keys in the progress record;
- dashboard behavior, export/reset boundaries, migration, quiz integration, and mobile layout.
