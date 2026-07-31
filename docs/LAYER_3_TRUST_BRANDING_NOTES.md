# Layer 3 — Trust and Personal Branding

This layer strengthens authorship and credibility without inventing a photograph, employer endorsement, completed degree, or external affiliation.

## Public identity used on the site

- Name: Natnale Mengesha
- Credential: HTL(ASCP)cm
- Professional description: histotechnologist and molecular pathology scientist
- Education wording: currently engaged in part-time graduate study in Pathology Laboratory Sciences at Boston University
- Contact email: withnati@gmail.com

The site must not describe the graduate degree as completed unless that changes in the future.

## What is implemented

- Rebuilt `about.html` using the shared site design.
- Added factual professional background and areas of laboratory experience.
- Added editorial standards, independence disclosures, content boundaries, and a correction pathway.
- Added `contact.html` with prepared correction, technical issue, topic suggestion, and collaboration emails.
- Replaced homepage placeholder language with a deliberate NM monogram identity.
- Added Person, AboutPage, and ContactPage structured data.
- Added the Contact page to the sitemap.
- Loaded `assets/signup.js` on the homepage so the Layer 2 email workflow actually runs.
- Moved consent, help text, and the status region into the HTML so the form remains consent-aware if JavaScript is unavailable.

## Headshot policy

No headshot is included in this layer because no approved image was supplied. Do not use a stock portrait, generated face, GitHub avatar, or unrelated laboratory image as a substitute for the creator.

When an approved professional headshot is available:

1. Use a square or near-square source image with at least 1200 × 1200 pixels.
2. Export an optimized WebP or JPEG version under 300 KB when practical.
3. Store it as `assets/natnale-mengesha.webp` or another descriptive file name.
4. Use the alt text: `Natnale Mengesha, creator of Free HTL Guide`.
5. Replace the homepage and About-page monogram only after checking mobile cropping and dark mode.
6. Keep the monogram as a fallback if the image fails to load.

## Credential formatting

Preferred visible forms:

- `Natnale Mengesha, HTL(ASCP)cm`
- HTML may render the certification-maintenance suffix as superscript when it remains readable.

Avoid:

- implying that Free HTL Guide is an official ASCP resource
- adding unverified degrees, licenses, awards, memberships, or institutional endorsements
- presenting ongoing graduate study as a completed M.S.

## Contact and correction handling

Correction reports should ideally include:

- page or module title
- exact passage
- explanation of the concern
- reliable supporting source

Do not request or retain patient-identifiable information, employer-confidential information, proprietary protocols, passwords, or other sensitive material.

## Maintenance checks

When professional details change:

1. Update `index.html`.
2. Update `about.html`.
3. Update structured data on `about.html` and `contact.html`.
4. Review the dynamic Person schema in `assets/guide.js`.
5. Update this document.
6. Confirm the wording remains consistent with `privacy.html` and the educational disclaimer.
