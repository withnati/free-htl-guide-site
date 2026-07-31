# Layer 8 — privacy-first analytics and learner measurement

## Scope

Layer 8 replaced the original analytics placeholder with a controlled measurement system. It was merged with analytics disabled by default, then activated through a separate reviewed branch using the production GA4 web-stream Measurement ID.

It provides:

- one machine-readable activation source;
- an explicit opt-in consent flow;
- a permanent Privacy choices control;
- consent revocation and analytics-cookie cleanup;
- an allowlisted event taxonomy;
- URL and parameter sanitization;
- aggregate quiz measurement without answer collection;
- local debug evidence;
- static validation, regression tests, and browser tests;
- a documented reporting plan.

## Files

- `data/analytics-config.json` — activation, consent, retention, event, and prohibited-field contract.
- `assets/analytics.js` — shared-feature loader, consent controller, sanitizer, event collector, and GA4 loader.
- `assets/analytics-consent.css` — responsive banner, dialog, footer control, and debug styling.
- `privacy.html` — transparent analytics and consent disclosures.
- `scripts/validate_analytics.py` — dependency-free analytics contract validator.
- `tests/test_validate_analytics.py` — disabled-state and enabled-state validator regression suite.
- `browser-tests/analytics.spec.cjs` — pre-consent blocking, decline, grant, sanitization, persistence, revocation, and re-consent coverage.
- `docs/ANALYTICS_MEASUREMENT_PLAN.md` — event dictionary, indicators, custom definitions, and reporting cadence.

## Current activation state

The controlled production configuration is:

```json
{
  "enabled": true,
  "measurementId": "G-BTGBBLRFB3",
  "consentRequired": true
}
```

Activation does **not** mean automatic tracking. Before a visitor chooses **Allow analytics**:

- no Google analytics script is requested;
- no analytics event is transmitted to Google;
- an equal-choice banner presents Allow analytics and Decline analytics;
- `?analytics_debug=1` may display sanitized local event evidence without transmitting it.

## Consent behavior

1. The site reads the versioned consent record from local storage.
2. With no current choice, an equal-choice banner displays **Allow analytics**, **Decline analytics**, and **Details**.
3. Declining stores the decision and does not load the Google tag.
4. Allowing stores the decision, grants analytics storage, loads one GA4 tag, and sends the current page view.
5. Reopening Privacy choices allows the visitor to change the decision.
6. Revoking consent denies analytics storage, removes visible `_ga` cookies for the site paths, and stops later events.
7. Re-consent reuses the existing tag and resumes with one new page view.

The tag is blocked before consent rather than relying on cookieless denied-consent pings.

## Activation record

The production activation change:

1. Uses the GA4 Measurement ID supplied from the Free HTL Guide web data stream.
2. Sets `enabled` and the Measurement ID together.
3. Keeps `consentRequired: true`.
4. Updates the privacy policy to describe the active but consent-gated state.
5. Updates browser coverage so the committed production configuration must make zero Google requests before consent.
6. Adds validator coverage for both disabled and enabled policy states.
7. Preserves Google Signals and advertising-personalization safeguards.

Future Measurement ID, consent-version, retention, event-taxonomy, or disclosure changes require another reviewed pull request.

## Local validation

```bash
python -m unittest discover -s tests -p "test_*.py" -v
python scripts/validate_analytics.py --root .
node --check assets/analytics.js
npm run test:browser
```

For local event inspection:

```text
http://127.0.0.1:4173/?analytics_debug=1
```

The debug panel is session-only and does not persist event payloads.

## CI contract

`Validate static site` rejects:

- an enabled configuration without a valid GA4 Measurement ID;
- a disabled configuration that retains an ID;
- consent being optional;
- unreviewed event names or duplicate parameters;
- prohibited field names in event parameters;
- a hardcoded Measurement ID in JavaScript;
- a static third-party analytics script in HTML;
- missing consent, sanitization, revocation, or privacy-control implementation markers;
- a privacy policy that does not match the current activation state.

`Browser smoke tests` verifies:

- the activated configuration makes no Google requests before consent;
- equal Allow and Decline controls remain accessible;
- declining persists without loading a tag;
- granting loads exactly one mocked tag;
- page, quiz, and share events are allowlisted and sanitized;
- query strings and fragments do not reach event payloads;
- revocation removes test analytics cookies and stops later events;
- re-consent resumes without loading a duplicate tag.

## Security and privacy boundaries

- A GA4 Measurement ID is a public routing identifier, not a secret.
- No analytics secret or GitHub Actions write permission is added.
- No email, note, answer, question-response, patient, employer, or user-ID field is allowed.
- Analytics does not alter quiz scoring or local study progress.
- The email form remains mocked in browser tests and is never submitted during quality checks.
- Behavioral indicators do not establish learner identity, examination readiness, or pass probability.
