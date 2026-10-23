# Question type specification

The persisted question type is `Question.type` in `prisma/schema.prisma`. Each question stores common metadata (`text`, `points`, and `orderIndex`) and may have child records in `QuestionOption`, `MatchPair`, `GridRow`, `GridColumn`, and `ClozeBlank`. The question creation API accepts those child arrays as nested JSON and returns children ordered by `orderIndex`.

The browser app includes account and role dashboards, while question authoring and exam-taking screens are still provided by consuming clients. A client should select its question renderer by the `type` enum, render the question text and ordered configuration, and serialize an answer in the documented shape. Server validation and grading live in `src/lib/grading.ts`; the create-question endpoint validates authoring data.

## Common rules

- Supported enum values are `MULTIPLE_CHOICE`, `CHECKBOX`, `DRAG_DROP`, `SHORT_ANSWER`, `LONG_ANSWER`, `DROPDOWN`, `MATCH`, `FILL_IN`, `GRID_MULTIPLE`, and `GRID_CHECKBOX`.
- Authoring child lists accept optional non-negative integer `orderIndex`; omitted values default to list position. The parent question also uses a non-negative `orderIndex`.
- `points` must be positive when supplied and defaults to `1`.
- The student answer is stored as JSON in `UserAnswer.answerValue`. Never send correctness metadata or accepted answers in student-facing payloads before submission.
- Exact selection matches earn all question points or zero. A non-empty long answer is stored as pending manual review (`isCorrect` and `pointsEarned` are null); the current schema does not provide a separate review-state field.

## Type contracts

| Type | Authoring configuration | Answer JSON | Current validation and grading |
| --- | --- | --- | --- |
| `MULTIPLE_CHOICE` | At least two options; exactly one has `isCorrect: true`. | Option ID string. | Must equal the ID of the single correct option. |
| `CHECKBOX` | At least two options; at least one correct option. | Array of option ID strings. | Exact set equality with all correct option IDs; duplicates are rejected by set comparison rules. |
| `DRAG_DROP` | One or more blanks, each with a unique-by-convention `blankIdentifier` and non-empty `acceptedAnswers`. | Object mapping each blank identifier (or returned blank ID) to text; a string is accepted for a single blank. | Every configured blank must be supplied, with no extra keys; each value matches an accepted answer case-insensitively after trimming. |
| `SHORT_ANSWER` | At least one blank with non-empty `acceptedAnswers`. | Text string. | Compared against accepted answers across the configured blanks using exact, case-sensitive text comparison after trimming the response. |
| `LONG_ANSWER` | Question text and points; no child configuration is required. | Text string. | Empty text is incorrect for zero points; non-empty text is flagged for manual review, with no automatic score. |
| `DROPDOWN` | At least two options; exactly one is marked correct. | Option ID string. | Must equal the ID of the single correct option. |
| `MATCH` | At least two pairs, each with `leftText` and `rightText`. | Object mapping each left text (or pair ID) to right text (or pair ID). | Every configured left side must map to its configured right side; no additional keys are allowed. |
| `FILL_IN` | One or more configured blanks with accepted answers. | Same as `DRAG_DROP`: a string for a single blank or a map for multiple blanks. | Uses the same complete, case-insensitive blank matching as `DRAG_DROP`. |
| `GRID_MULTIPLE` | Non-empty rows and columns plus options encoding correct cells as `rowText=columnText`; each correct cell is marked true. | Object mapping every row (row ID or row text) to one column (column ID or column text). | Exactly one selected column per row; the selected matrix must exactly match the configured correct cells. |
| `GRID_CHECKBOX` | Same rows, columns, and correct-cell option encoding as `GRID_MULTIPLE`. | Object mapping every row to an array of selected columns. | Selected matrix must exactly match the configured correct cells. |

## Nested authoring example

The following is an example payload shape for `POST /api/v0/exams/{examId}/questions`. Include only child arrays needed by the selected type:

```json
{
  "type": "GRID_CHECKBOX",
  "text": "Select each applicable category.",
  "points": 2,
  "orderIndex": 0,
  "gridRows": [{ "text": "A", "orderIndex": 0 }],
  "gridColumns": [{ "text": "One", "orderIndex": 0 }, { "text": "Two", "orderIndex": 1 }],
  "options": [{ "text": "A=Two", "isCorrect": true, "orderIndex": 0 }]
}
```

An answer for the one-row grid could be `{ "<row-id>": ["<column-id>"] }`. IDs are returned with the created question and its related records. See [API documentation](../api-docs/README.md) for endpoint and authentication details.

## Renderer and validation responsibilities

A client renderer should use the ordered child records for stable display and submit only the answer shape for its question type. It should preserve blank identifiers, row/column identities, and option IDs rather than depending on display order or text where IDs are available.

The API validates child record structure and type-specific minimum configuration on question creation. Submission validation checks the answer's broad JSON shape before grading. A malformed answer should be rejected at the API boundary; a valid but incorrect answer receives zero points. If question authoring validation or answer semantics change, update this contract and the grading implementation together.
