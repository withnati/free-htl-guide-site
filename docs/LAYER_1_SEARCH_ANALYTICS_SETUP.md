# Layer 1 — Search visibility and analytics activation

The repository-side foundation is installed. Analytics remains disabled until a real GA4 Measurement ID is added.

## What is already implemented

- `robots.txt` allows crawling and points to the production sitemap.
- `sitemap.xml` lists all current canonical public pages with accurate launch dates.
- Core pages generate `LearningResource`, organization, author, item-list, and breadcrumb structured data.
- `assets/analytics.js` supports page views plus these custom events:
  - `module_open`
  - `file_download`
  - `quiz_complete`
  - `quiz_reset`
  - `study_task_toggle`
  - `email_signup_start`
  - `email_signup_success`
  - `email_signup_error`
  - `outbound_click`
- Analytics debug mode works without sending data by adding `?analytics_debug=1` to a page URL and opening the browser console.

## Activate Google Analytics 4

1. Create or open a Google Analytics account.
2. Create a GA4 property for **Free HTL Guide**.
3. Add a web data stream for:
   `https://withnati.github.io/free-htl-guide-site/`
4. Copy the Measurement ID. It begins with `G-`.
5. Update this line near the top of `assets/analytics.js`:

   ```js
   const MEASUREMENT_ID = 'G-XXXXXXXXXX';
   ```

6. Before enabling analytics, update `privacy.html` to describe Google Analytics, its cookies/data collection, and the user's available controls.
7. Deploy the change.
8. Confirm activity in GA4 Realtime and DebugView.

## Verify the event layer before enabling GA4

Open a page with the debug query string:

`https://withnati.github.io/free-htl-guide-site/?analytics_debug=1`

Then open the browser developer console and test:

- opening a module
- downloading a PDF
- submitting a quiz
- resetting a quiz
- checking a study-plan task
- completing or intentionally failing an email signup

The console should show `[Free HTL Analytics]` event messages. No information is sent while the Measurement ID is blank.

For email signup testing, confirm that the payload includes only the form ID, source page, and a generic error type. It must not contain the entered email address.

## Activate Google Search Console

1. Open Google Search Console using the Google account that will own the site property.
2. Add a **URL-prefix property** for:
   `https://withnati.github.io/free-htl-guide-site/`
3. Verify ownership using one of these methods:
   - Google Analytics after GA4 is active, or
   - the exact HTML meta tag/file supplied by Search Console.
4. Submit:
   `https://withnati.github.io/free-htl-guide-site/sitemap.xml`
5. Use URL Inspection for the homepage and several module pages.
6. Request indexing after confirming the rendered page and canonical URL.

## Structured-data checks

Test these URLs using Google's Rich Results Test or rendered HTML inspection:

- homepage
- one core module
- the study plan
- cumulative practice

The homepage exposes the curriculum as an item list of free learning resources. Module pages expose learning-resource and breadcrumb data.

## Suggested GA4 reports

Create simple explorations for:

- module opens by module path
- downloads by file name
- quiz completion rate and score percent
- study-plan task interactions
- email signup starts, successes, and errors
- landing pages and traffic sources

## Privacy note

Do not place email addresses, names, quiz answers, notes, or other user-entered text inside analytics event parameters. The installed event layer records only page IDs, link/file information, task IDs, numeric quiz results, form IDs, source pages, and generic signup outcomes.
