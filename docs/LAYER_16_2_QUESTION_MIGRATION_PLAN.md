# Layer 16.2 Existing Question Migration

## Objective

Inventory and mechanically migrate the website's existing quiz, practice, mock-exam, and Targeted Practice records into the Layer 16.1 canonical question format without silently changing educational meaning or overstating review status.

## Migration rules

1. Preserve the original stem, answer choices, keyed answer, rationale, domain, and source location.
2. Assign a stable canonical ID and version 1 to each migrated record.
3. Treat records as `draft` unless completed scientific and editorial review evidence already exists.
4. Do not infer missing distractor rationales. Mark them as migration gaps for later authoring.
5. Do not promote alternate scenarios merely because a related base question was reviewed.
6. Preserve the public/Premium boundary. Existing public samples remain candidates for `sample`; all expanded banks default to `premium` pending access review.
7. Record source-file and source-key provenance in the migration manifest.
8. Detect duplicate or near-duplicate stems for human review rather than merging automatically.
9. Keep the current runtime unchanged until migrated records pass structural, scientific, editorial, and browser regression checks.

## Source families to inventory

- Module lesson quizzes
- General practice bank
- Mock-exam base questions
- Alternate scenario questions
- Targeted Practice sources
- Sample questions embedded in public pages
- Generated or protected Premium question payloads

## Migration stages

### Stage 1: inventory

Create a machine-readable manifest with source path, source format, estimated record count, access classification, current review claim, and migration readiness.

### Stage 2: extraction

Use source-specific adapters to convert existing records into a neutral intermediate structure. Extraction must not rewrite educational text.

### Stage 3: canonical mapping

Map the intermediate record into the canonical schema. Missing required fields become explicit migration issues.

### Stage 4: validation

Run schema, semantic, duplicate, taxonomy, access-boundary, and provenance checks.

### Stage 5: review queue

Separate records into:

- structurally ready but awaiting scientific review;
- scientifically reviewed but awaiting editorial review;
- incomplete rationale or distractor rationale;
- ambiguous keyed answer;
- duplicate or near-duplicate candidate;
- access classification requiring owner review.

### Stage 6: runtime adoption

Adopt canonical records one surface at a time, beginning with the free Fixation quiz and public sample questions. Mock exams and Premium banks follow only after protected-delivery regression testing.

## Completion criteria

Layer 16.2 is complete when every existing learner-visible question source is represented in the inventory, mechanically extractable records have canonical mappings, migration gaps are explicit, and no learner-visible runtime behavior changes without dedicated regression testing.
