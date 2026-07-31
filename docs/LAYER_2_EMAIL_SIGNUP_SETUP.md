# Layer 2 — Email Signup Activation

The website-side email journey is complete. The homepage form now uses JavaScript to submit to Formspree, prevents duplicate submissions, displays accessible progress and error messages, requires affirmative consent, and redirects successful visitors to `thank-you.html`.

## What is already implemented

- Existing Formspree endpoint: `https://formspree.io/f/mnnzlgrw`
- Required `email` field for Formspree autoresponse routing
- Required consent checkbox
- Hidden source and subscription-type fields
- Duplicate-submit protection
- JSON/AJAX submission with an error state
- Branded success page with immediate downloads
- Manual unsubscribe page
- Privacy-policy update
- Analytics-ready signup start, success, and error events
- No email address is sent to the site's analytics layer

## Formspree dashboard setup

1. Sign in to the Formspree account that owns form `mnnzlgrw`.
2. Open the form used by Free HTL Guide.
3. Confirm that submissions are reaching the expected owner email.
4. Enable the **Autoresponse** or **Send a confirmation/response email** plugin if the account plan supports it.
5. Confirm the recipient field is `email`. The site already submits the address under that exact field name.
6. Paste the welcome subject and body below.
7. Send a test submission using an address you control.
8. Verify the message in inbox, spam, and promotions folders.
9. Verify that the unsubscribe link opens the website's unsubscribe page.
10. Keep a record of completed unsubscribe and deletion requests until an automated mailing-list provider is connected.

Formspree may send from a Formspree-owned address unless a custom sending domain is configured. Feature availability and branding options can depend on the Formspree plan.

## Recommended welcome email

### Subject

Welcome to Free HTL Guide — your starter resources

### Body

Hi,

Thanks for joining Free HTL Guide.

You can begin immediately with these free resources:

- Six-week HT/HTL study plan: https://withnati.github.io/free-htl-guide-site/study-plan.html
- Orientation Quick Cards: https://withnati.github.io/free-htl-guide-site/assets/Orientation_Quick_Cards.pdf
- Processing Schedule Templates: https://withnati.github.io/free-htl-guide-site/assets/Processing_Schedules_Templates.pdf
- Decalcification Methods Comparison: https://withnati.github.io/free-htl-guide-site/assets/Decalc_Methods_Comparison.pdf
- Complete module library: https://withnati.github.io/free-htl-guide-site/#modules

Free HTL Guide is designed to connect exam concepts with practical histology workflow, artifact recognition, controls, and troubleshooting. You will receive occasional notices when meaningful new modules, practice tools, or resources are released.

Free HTL Guide is an independent educational resource and is not affiliated with or endorsed by ASCP or the ASCP Board of Certification.

To stop future updates, use this page:
https://withnati.github.io/free-htl-guide-site/unsubscribe.html

Best,
Natnale Mengesha, HTL(ASCP)cm
Free HTL Guide

## Suggested notification email subject

For owner notifications, use:

`New Free HTL Guide email subscriber`

The website already sends this value as the `_subject` field.

## Manual unsubscribe process

Until a dedicated mailing-list platform is connected:

1. Confirm the unsubscribe request came from the subscribed address.
2. Remove or suppress the address from any export, spreadsheet, contact list, or campaign list used for updates.
3. Retain only the minimum record needed to prevent accidental re-mailing.
4. Respond with a brief confirmation when practical.
5. Complete deletion requests across Formspree and any downstream list where the address was copied.

## Testing checklist

### Successful submission

- Consent is required.
- Submit button changes to `Subscribing…`.
- Repeated clicks do not create duplicate requests.
- Successful submission redirects to `thank-you.html?source=email-signup`.
- Starter PDF links open successfully.
- Formspree receives `email`, `consent`, `source`, `subscription_type`, and `_subject`.

### Error handling

- Invalid email is blocked by browser validation.
- A provider error displays a visible error message.
- The submit button becomes available again after an error.
- No typed email address appears in analytics debug events.

### Analytics debug mode

Analytics remains disabled until a GA4 ID is configured. Event construction can still be inspected without sending data:

1. Open the homepage with `?analytics_debug=1#starter`.
2. Open the browser console.
3. Submit a test signup.
4. Confirm `email_signup_start` and either `email_signup_success` or `email_signup_error` appear.
5. Confirm the console payload contains no email address.

## Future mailing-list upgrade

Formspree autoresponse confirms a submission, but it is not a full newsletter-management system. Before sending regular campaigns, connect a mailing-list provider that supports:

- confirmed consent or double opt-in
- automated unsubscribe processing
- suppression lists
- campaign reporting
- bounce and complaint handling
- export and deletion controls

When that provider is selected, update the privacy policy before changing how addresses are processed.
