# Layer 8 — privacy-first analytics and learner measurement

## Scope

Layer 8 converts the original disabled analytics placeholder into a controlled measurement system while keeping analytics inactive on `main`.

It adds:

- one machine-readable configuration source;
- an explicit opt-in consent flow;
- a permanent Privacy choices control;
- consent revocation and analytics-cookie cleanup;
- an allowlisted event taxonomy;
- URL and parameter sanitization;
- aggregate quiz measurement without answer collection;
- local debug evidence that works while analytics is disabled;
- static validation, regression tests, and browser tests;
- a documented activation and reporting plan.

## Files

- `data/analytics-config.json` — activation, consent, retention, event, and prohibited-field contract.
- `assets/analytics.js` — shared-feature loader, consent controller, sanitizer, event collector, and GA4 loader.
- `assets/analytics-consent.css` — responsive banner, dialog, footer control, and debug styling.
- `privacy.html` — transparent current and future analytics disclosures.
- `scripts/validate_analytics.py` — dependency-free analytics contract validator.
- `tests/test_validate_analytics.py` — validator regression suite.
- `browser-tests/analytics.spec.cjs` — disabled, decline, grant, sanitization, persistence, and revocation coverage.
- `docs/ANALYTICS_MEASUREMENT_PLAN.md` — event dictionary, indicators, custom definitions, and reporting cadence.

## Default behavior

The committed configuration is intentionally:

```json
{
  "enabled": false,
  "measurementId": ""
}
```

Therefore:

- no Google analytics script is requested;
- no analytics event is transmitted;
- the footer Privacy choices control reports that analytics is off;
- `?analytics_debug=1` can display sanitized local event evidence without activating Google Analytics.

## Consent behavior after a future activation

When a valid GA4 Measurement ID and `enabled: true` are committed together:

1. The site reads the versioned consent record from local storage.
2. With no current choice, an equal-choice banner displays **Allow analytics**, **Decline analytics**, and **Details**.
3. Declining stores the decision and does not load the Google tag.
4. Allowing stores the decision, grants analytics storage, loads one GA4 tag, and sends the current page view.
5. Reopening Privacy choices allows the visitor to change the decision.
6. Revoking consent denies analytics storage, removes visible `_ga` cookies for the site paths, and stops later events.

The tag is blocked before consent rather than relying on cookieless denied-consent pings.

## Activation checklist

Activation must be a separate pull request.

1. Create a GA4 property and web data stream for the production GitHub Pages URL.
2. Confirm the property has no advertising use, Google Signals, or ad-personalization requirement.
3. Set event-data retention to 14 months or lower.
4. Enter the production `G-...` Measurement ID in `data/analytics-config.json`.
5. Set `enabled` to `true` in the same change.
6. Update `consentVersion` when the disclosure or choice materially changes.
7. Update `privacy.html` so it no longer says analytics is currently disabled.
8. Run the Python, JavaScript, and Playwright suites.
9. Test Allow, Decline, persistence, revocation, cookie cleanup, and no pre-consent Google requests.
10. Verify Realtime and DebugView with only the documented events and parameters.
11. Register only the custom dimensions and metrics listed in the measurement plan.
12. Merge only after the protected checks pass.

## Local validation

```bash
python -m unittest discover -s tests -p "test_*.py" -v
python scripts/validate_analytics.py --root .
node --check assets/analytics.js
npm run test:browser
```

For local event inspection without a Measurement ID:

```text
http://127.0.0.1:4173/?analytics_debug=1
```

The debug panel is session-only and does not persist event payloads.

## CI contract

`Validate static site` now also rejects:

- an enabled configuration without a valid GA4 Measurement ID;
- a disabled configuration that retains an ID;
- consent being optional;
- unreviewed event names or duplicate parameters;
- prohibited field names in event parameters;
- a hardcoded Measurement ID in JavaScript;
- a static third-party analytics script in HTML;
- missing consent, sanitization, revocation, or privacy-control implementation markers;
- a privacy policy that does not match the disabled configuration.

`Browser smoke tests` verifies:

- the committed disabled state makes no Google requests;
- transparent privacy controls remain accessible;
- declining persists without loading a tag;
- granting loads exactly one mocked tag;
- page, quiz, and share events are allowlisted and sanitized;
- query strings and fragments do not reach event payloads;
- revocation removes test analytics cookies and stops later events.

## Security and privacy boundaries

- No analytics secret is needed or committed.
- No write permission is added to GitHub Actions.
- No email, note, answer, question-response, patient, employer, or user-ID field is allowed.
- Analytics does not alter quiz scoring or local study progress.
- The email form is still mocked in browser tests and is never submitted during quality checks.
- This layer does not make claims about learner identity, readiness, certification results, or examination performance.
