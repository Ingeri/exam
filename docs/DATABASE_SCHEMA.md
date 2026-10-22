# Database schema

The PostgreSQL schema is declared in [`prisma/schema.prisma`](../prisma/schema.prisma). Prisma Client models map to relational tables; IDs are generated as CUIDs unless a model uses a natural key. The schema uses PostgreSQL, Prisma-managed timestamps, and database foreign keys for the relations below.

## Model overview

| Model | Purpose | Important relations and constraints |
| --- | --- | --- |
| `User` | Account identity, email, optional registration number, and role (`STUDENT`, `INSTRUCTOR`, `ADMIN`). | `email` is unique. `registrationNumber` is indexed but nullable and not unique. Has created exams and attempts. |
| `Exam` | Assessment metadata, creator, publication state, access settings, questions, and attempts. | `createdById` references `User.id`; creator/time and visibility/window fields are indexed. Has optional timing window, optional access key, and `isPublic` false by default. |
| `AllowedStudent` | Email and/or registration-number allowlist entry for a restricted exam. | `examId` references `Exam.id`; composite unique constraints on `(examId, email)` and `(examId, registrationNumber)`. Each identity field is nullable and indexed. |
| `SystemSetting` | Global key/value configuration, with JSON value and update timestamp. | `key` is the primary key. No user foreign key. |
| `Question` | Ordered, typed prompt with point value. | `examId` references `Exam.id`; type is the `QuestionType` enum; `orderIndex` positions it within the exam. |
| `QuestionOption` | Ordered selectable option and correctness flag. | `questionId` references `Question.id`. Used by multiple-choice, checkbox, dropdown, and grid correct-cell encoding. |
| `MatchPair` | Ordered left/right matching pair. | `questionId` references `Question.id`. |
| `GridRow`, `GridColumn` | Ordered row and column labels for grid questions. | Each `questionId` references `Question.id`. Correct cells are represented in the question's options. |
| `ClozeBlank` | Blank identifier and accepted-answer list. | `questionId` references `Question.id`; `acceptedAnswers` is a PostgreSQL string array. Used by drag-drop, fill-in, and short-answer grading. |
| `ExamAttempt` | A user's attempt, status, timestamps, and aggregate score. | `examId` references `Exam.id`; `userId` references `User.id`; has related `UserAnswer` rows. Status is `IN_PROGRESS`, `SUBMITTED`, or `GRADED`. |
| `UserAnswer` | Submission for one question within an attempt, plus grading result. | `attemptId` references `ExamAttempt.id`; `questionId` references `Question.id`; unique `(attemptId, questionId)`. `answerValue` is JSON; `isCorrect` and `pointsEarned` are nullable for manual review. |

The schema does not define separate `Submission` or `Grade` models. Submitted response data is stored in `UserAnswer`; per-question grading is stored in its nullable `isCorrect` and `pointsEarned` fields; the attempt-level score is `ExamAttempt.score`. Long answers awaiting human review are represented by null grading fields. A separate review workflow/status is not currently modeled.

## Relationship map

```text
User ──< Exam                         (creator: Exam.createdById)
User ──< ExamAttempt                 (candidate: ExamAttempt.userId)
Exam ──< AllowedStudent
Exam ──< Question
Exam ──< ExamAttempt
Question ──< QuestionOption
Question ──< MatchPair
Question ──< GridRow
Question ──< GridColumn
Question ──< ClozeBlank
Question ──< UserAnswer
ExamAttempt ──< UserAnswer
```

`UserAnswer` points to both an attempt and a question. The schema does not currently declare a composite foreign key proving that the answer's question belongs to the same exam as its attempt; API submission logic must enforce that invariant.

## Referential behavior

The relations use cascading deletes as specified in Prisma:

- Deleting a `User` cascades to exams they created and their attempts.
- Deleting an `Exam` cascades to allowed-student entries, questions, and attempts.
- Deleting a `Question` cascades to its options, match pairs, grid rows and columns, blanks, and user answers.
- Deleting an `ExamAttempt` cascades to its user answers.

These cascades make parent deletion destructive to dependent assessment and result data. Apply retention and authorization controls before exposing delete operations in production.

## Enums and indexes

- `Role`: `STUDENT`, `INSTRUCTOR`, `ADMIN`
- `QuestionType`: `MULTIPLE_CHOICE`, `CHECKBOX`, `DRAG_DROP`, `SHORT_ANSWER`, `LONG_ANSWER`, `DROPDOWN`, `MATCH`, `FILL_IN`, `GRID_MULTIPLE`, `GRID_CHECKBOX`
- `ExamStatus`: `DRAFT`, `PUBLISHED`, `ARCHIVED`
- `AttemptStatus`: `IN_PROGRESS`, `SUBMITTED`, `GRADED`
- Additional lookup indexes cover user registration number, exam creator/time, public status and time window, and allowlist identity fields.

For API payload shapes and grading semantics by type, see [QUESTION_TYPES.md](./QUESTION_TYPES.md). For the endpoint contracts, see [API documentation](../api-docs/README.md).
