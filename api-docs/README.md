# Examination API

Base URL: `http://localhost:3000/api/v0`

All request and response bodies use JSON. The `/api/v0` prefix identifies the current API contract. Legacy unversioned routes remain available at `/api` for compatibility.

## Endpoints

| Method | Path                        | Purpose                                                    |
| ------ | --------------------------- | ---------------------------------------------------------- |
| `GET`  | `/exams`                    | List exams, creator summaries, and question counts         |
| `POST` | `/exams`                    | Create a draft exam                                        |
| `GET`  | `/exams/{examId}`           | Read an exam and its ordered questions and related records |
| `POST` | `/exams/{examId}/questions` | Add a question with type-specific related records          |
| `POST` | `/exams/{examId}/attempt`   | Submit and grade an exam attempt                           |
| `POST` | `/attempt`                  | Submit an attempt with `examId` in the body                |
| `GET`  | `/attempts/{attemptId}`     | Retrieve attempt results and answer breakdown              |

## `GET /exams`

Returns exams newest first, including creator details and `_count.questions`.

```json
{
  "exams": [
    {
      "id": "exam_id",
      "title": "Biology Final",
      "description": null,
      "durationMinutes": 60,
      "passingScore": 70,
      "status": "DRAFT",
      "createdById": "user_id",
      "createdBy": {
        "id": "user_id",
        "name": "Instructor",
        "email": "instructor@example.com",
        "role": "INSTRUCTOR"
      },
      "_count": { "questions": 0 }
    }
  ]
}
```

## `POST /exams`

Creates a draft. `title`, `createdById`, and positive integer `durationMinutes` are required. `description` and `passingScore` are optional; passing score is from 0 to 100.

```json
{
  "title": "Biology Final",
  "description": "Unit 1 assessment",
  "durationMinutes": 60,
  "passingScore": 70,
  "createdById": "user_id"
}
```

Returns `201` with `{ "exam": ... }`, including creator details and question count. Returns `400` for invalid input and `404` if the creator does not exist.

## `GET /exams/{examId}`

Returns `{ "exam": ... }`, including creator details and questions ordered by `orderIndex`. Each question includes its ordered `options`, `matchPairs`, `gridRows`, `gridColumns`, and `blanks` arrays. Option correctness and blank accepted answers are included because this endpoint returns the stored question records; restrict it to trusted authoring/administration clients and do not expose it directly to exam takers.

Returns `404` if the exam does not exist.

## `POST /exams/{examId}/questions`

Creates a question and its nested records atomically. Shared fields:

```json
{
  "type": "MULTIPLE_CHOICE",
  "text": "Which planet is known as the Red Planet?",
  "points": 1,
  "orderIndex": 0,
  "options": [
    { "text": "Venus", "isCorrect": false },
    { "text": "Mars", "isCorrect": true }
  ]
}
```

`type` must be one of `MULTIPLE_CHOICE`, `CHECKBOX`, `DRAG_DROP`, `SHORT_ANSWER`, `LONG_ANSWER`, `DROPDOWN`, `MATCH`, `FILL_IN`, `GRID_MULTIPLE`, or `GRID_CHECKBOX`. `points` defaults to 1; `orderIndex` defaults to the next index.

Type-specific fields:

| Types                                  | Nested fields and constraints                                                                                                                                                 |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MULTIPLE_CHOICE`, `DROPDOWN`          | `options`: at least two `{ text, isCorrect, orderIndex? }`, exactly one correct                                                                                               |
| `CHECKBOX`                             | `options`: at least two, at least one correct                                                                                                                                 |
| `MATCH`                                | `matchPairs`: at least two `{ leftText, rightText, orderIndex? }`                                                                                                             |
| `DRAG_DROP`, `FILL_IN`, `SHORT_ANSWER` | `blanks`: `{ blankIdentifier, acceptedAnswers: string[], orderIndex? }`; at least one blank. Short answers are exact text matches; drag/drop and fill-in answers ignore case. |
| `GRID_MULTIPLE`, `GRID_CHECKBOX`       | `gridRows` and `gridColumns`: arrays of `{ text, orderIndex? }`; `options` encodes each correct cell as `{ "text": "rowText=columnText", "isCorrect": true }`.                |
| `LONG_ANSWER`                          | No nested fields required; non-empty responses are flagged for manual review.                                                                                                 |

Returns `201` with `{ "question": ... }`. Returns `400` for invalid input and `404` if the exam does not exist.

## Submitting attempts

### `POST /exams/{examId}/attempt`

### `POST /attempt`

Both routes use the same grading behavior. The short route requires `examId` in the JSON body; the nested route takes the exam ID from the URL. Both require `userId` and an `answers` object keyed by question ID. Omitted questions are saved as unanswered and scored incorrect.

```json
{
  "userId": "student_id",
  "answers": {
    "question_mcq": "option_id",
    "question_checkbox": ["option_id_1", "option_id_2"],
    "question_match": { "leftText": "rightText" },
    "question_fill": { "blankIdentifier": "Kigali" },
    "question_short": "42",
    "question_long": "A written response...",
    "question_grid": { "row_id": "column_id" },
    "question_grid_checkbox": { "row_id": ["column_id"] }
  }
}
```

Answer formats by type:

| Types                         | Answer value                                                                                                                  |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `MULTIPLE_CHOICE`, `DROPDOWN` | Selected option ID string                                                                                                     |
| `CHECKBOX`                    | Array of selected option ID strings; selection must exactly match the correct set                                             |
| `MATCH`                       | Object mapping each left text (or match-pair ID) to its right text (or pair ID)                                               |
| `DRAG_DROP`, `FILL_IN`        | Object mapping every blank identifier (or blank ID) to text. A single-blank question may use a string. Matching ignores case. |
| `SHORT_ANSWER`                | Text string matched exactly against accepted answers                                                                          |
| `LONG_ANSWER`                 | Text string; non-empty answers await manual review                                                                            |
| `GRID_MULTIPLE`               | Object mapping every row ID/text to one selected column ID/text                                                               |
| `GRID_CHECKBOX`               | Object mapping every row ID/text to an array of selected column ID/text values                                                |

Returns `201` with the attempt, earned and possible points, percentage, manual-review flag, and per-question breakdown. If long answers need review, the attempt remains `SUBMITTED`; its returned score is provisional. Otherwise it is marked `GRADED`. Returns `400` for malformed answers or question IDs outside the exam, `404` for a missing exam or user, and `409` unless the exam is `PUBLISHED`.

## `GET /attempts/{attemptId}`

Returns attempt metadata, exam and student summaries, score details, and an ordered answer breakdown. The `score` object includes `pointsEarned`, `pointsPossible`, `percentage`, `passingScore`, `passed`, `requiresManualReview`, and `isProvisional`. `passed` is `null` while manual review is pending or no passing score is set.

Returns `404` if the attempt does not exist.

## Errors

Errors use this format:

```json
{ "error": "A human-readable explanation." }
```

`500` indicates an unexpected database or server failure. Route handlers do not return internal exception details.

## Access control

The current project has no authentication or authorization layer. These endpoints accept caller-supplied user IDs, and exam retrieval includes answer keys. Deploy behind an access-control layer and limit authoring/result routes to trusted callers before exposing the API publicly.
