#!/usr/bin/env python3
"""Canonical entry point for the allowlisted FHL public build."""
from __future__ import annotations

import build_public_site

build_public_site.PREVIEW_TEMPLATE = "templates/premium-preview.tpl"
if "404.html" not in build_public_site.PUBLIC_SOURCE_HTML:
    build_public_site.PUBLIC_SOURCE_HTML += ("404.html",)

for route in (
    "pricing.html",
    "premium/index.html",
    "account/subscription.html",
    "account/payment-pending.html",
    "account/checkout-canceled.html",
    "account/subscription-confirmed.html",
):
    if route not in build_public_site.PUBLIC_SOURCE_HTML:
        build_public_site.PUBLIC_SOURCE_HTML += (route,)

if "pricing.html" not in build_public_site.PUBLIC_INDEXABLE_HTML:
    build_public_site.PUBLIC_INDEXABLE_HTML += ("pricing.html",)

LEARNER_PREVIEW_COPY: dict[str, dict[str, object]] = {
    "study-plan.html": {
        "title": "Six-week HT/HTL study plan",
        "eyebrow": "Included with Premium",
        "summary": "Follow a structured six-week sequence that connects exam-domain lessons, quizzes, mock exams, and focused review.",
        "features": ["A paced plan across the major HT/HTL exam domains", "Study checkpoints that connect lessons with practice", "Progress you can continue across devices with your account"],
    },
    "practice.html": {
        "title": "Cumulative HT/HTL practice",
        "eyebrow": "Included with Premium",
        "summary": "Use mixed-domain questions to reinforce core rules and identify topics that need another review.",
        "features": ["Questions across fixation, processing, microtomy, staining, and laboratory operations", "Detailed explanations that reinforce the correct rule", "Results that contribute to weaker-domain recommendations"],
    },
    "mock-exam.html": {
        "title": "50-question HT/HTL mock exam",
        "eyebrow": "Included with Premium",
        "summary": "Practice in timed or untimed mode, flag questions, and finish with domain results and missed-question review.",
        "features": ["A 50-question practice blueprint across the major exam domains", "Missed-question explanations after submission", "Attempt history and continuation across devices"],
    },
    "targeted-practice.html": {
        "title": "Targeted HT/HTL practice",
        "eyebrow": "Included with Premium",
        "summary": "Build focused question sets by exam domain, difficulty, weaker area, previously missed question, or saved flag.",
        "features": ["Study mode with immediate feedback or Exam mode with end-of-set review", "Weaker-domain, missed-question, and flagged-question practice", "Saved sessions you can resume later"],
    },
    "modules/processing-guide-v3.html": {
        "title": "Processing and Decalcification",
        "eyebrow": "Premium core lesson",
        "summary": "Prepare for processing questions involving dehydration, clearing, infiltration, processor variables, decalcification, artifacts, quality control, and safety.",
        "features": ["Complete lesson and troubleshooting tables", "Module quiz with explanations", "Processing schedules, comparison tools, and study downloads"],
        "proof": True,
    },
    "modules/embedding-guide-v3.html": {
        "title": "Embedding and Microtomy",
        "eyebrow": "Premium core lesson",
        "summary": "Build exam readiness in orientation, sectioning, cryostat work, artifact recognition, quality control, and safety.",
        "features": ["Orientation and section-quality guidance", "Troubleshooting practice and quiz explanations", "Reference tools and study downloads"],
    },
    "modules/staining-he-guide.html": {
        "title": "Routine H&E Staining",
        "eyebrow": "Premium core lesson",
        "summary": "Connect hematoxylin and eosin chemistry with sequence, differentiation, bluing, balance, artifacts, and stain quality.",
        "features": ["Reagent chemistry and expected morphology", "Systematic artifact troubleshooting", "Module quiz and supporting study resources"],
    },
    "modules/special-stains-guide.html": {
        "title": "Special Stains",
        "eyebrow": "Premium core lesson",
        "summary": "Study stain targets, expected colors, control selection, chemistry, critical steps, artifacts, and troubleshooting.",
        "features": ["Major stain families and control strategy", "Target–chemistry–color review tables", "Module quiz and supporting reference materials"],
    },
    "modules/lab-operations-guide.html": {
        "title": "Laboratory Operations",
        "eyebrow": "Premium core lesson",
        "summary": "Strengthen exam readiness in safety, quality systems, calculations, equipment, validation, documentation, and corrective action.",
        "features": ["Safety and quality-system decision making", "Calculations and operational troubleshooting", "Module quiz and practical study tools"],
    },
    "modules/ihc-ish-guide.html": {
        "title": "IHC and ISH Fundamentals",
        "eyebrow": "Premium HTL lesson",
        "summary": "Prepare for advanced HTL questions involving preanalytics, retrieval, controls, detection, validation, ISH, and troubleshooting.",
        "features": ["IHC and ISH workflow principles", "Control selection, validation, and lot bridging", "Advanced quiz and supporting study resources"],
    },
}

build_public_site.PREVIEW_ROUTES.update(LEARNER_PREVIEW_COPY)

_BASE_WRITE_HEADERS = build_public_site.write_headers


def write_headers_with_extensionless_previews(output, environment, supabase_url) -> None:
    _BASE_WRITE_HEADERS(output, environment, supabase_url)
    extensionless_routes = sorted({f"/{route.removesuffix('.html')}" for route in build_public_site.PREVIEW_ROUTES if route.endswith(".html")})
    rules = "\n\n".join(f"{route}\n  Cache-Control: private, no-store\n  X-Robots-Tag: noindex, nofollow" for route in extensionless_routes)
    if rules:
        with (output / "_headers").open("a", encoding="utf-8") as headers:
            headers.write(f"\n{rules}\n")


build_public_site.write_headers = write_headers_with_extensionless_previews

if __name__ == "__main__":
    raise SystemExit(build_public_site.main())
