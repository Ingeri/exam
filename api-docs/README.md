# Examination API

Base URL: `http://localhost:3000/api/v0`

All request and response bodies use JSON. The `/api/v0` prefix identifies the current API contract. Legacy unversioned routes remain available at `/api` for compatibility and forward through the same versioned permission, timing, enrollment, and key checks.

## Authentication and RBAC

All protected routes require `Authorization: Bearer <JWT>` except public guest submissions to `POST /attempt` and `POST /exams/{examId}/attempt`. Obtain a token using `POST /auth/login` or `POST /auth/register`. Tokens use HS256 and `AUTH_JWT_SECRET` must be at least 32 bytes. The JWT `sub` claim is the database `User.id`; the database role is loaded on every request, and role claims in the token are ignored. Tokens expire after seven days. Set `AUTH_JWT_ISSUER` and `AUTH_JWT_AUDIENCE` to enforce issuer/audience claims. Exam keys are HMAC-hashed using `EXAM_KEY_SECRET` (at least 32 bytes) or, if absent, `AUTH_JWT_SECRET`; keep the selected key secret stable or existing exam keys will no longer verify. Exam-key tokens use the JWT signing configuration.

Registration accepts `STUDENT` or `INSTRUCTOR`; it never accepts `ADMIN`. Provision the first administrator and any additional administrators through a trusted database or operations workflow. Never trust caller-supplied user IDs or roles on protected operations.

| Role         | Permissions                                                                                                      |
| ------------ | ---------------------------------------------------------------------------------------------------------------- |
| `STUDENT`    | Discover public/allowed exams, verify keys, submit attempts, read own results                                    |
| `INSTRUCTOR` | Manage own exams/questions, read own reports and attempts                                                        |
| `ADMIN`      | Manage all instructor exams/reports, change system settings, list all exams/users, moderate exams and user roles |
| Public guest | Submit to public exams with a name and email; cannot access private exams or results                             |

Missing or invalid credentials return `401`; authenticated users without permission receive `403`. Owner-scoped resources return `404` when they belong to another instructor/student.

## Endpoints

| Method           | Path                                 | Purpose                                                     |
| ---------------- | ------------------------------------ | ----------------------------------------------------------- |
| `POST`           | `/auth/register`                     | Register a student or instructor account                    |
| `POST`           | `/auth/login`                        | Validate credentials and issue a bearer token               |
| `GET`            | `/exams`                             | List exams, creator summaries, and question counts          |
| `POST`           | `/exams`                             | Create a draft exam                                         |
| `GET`            | `/exams/{examId}`                    | Read an exam and its ordered questions and related records  |
| `POST`           | `/exams/{examId}/questions`          | Add a question with type-specific related records           |
| `POST`           | `/exams/{examId}/attempt`            | Submit and grade an exam attempt                            |
| `POST`           | `/attempt`                           | Submit an attempt with `examId` in the body                 |
| `GET`            | `/attempts/{attemptId}`              | Retrieve attempt results and answer breakdown               |
| `GET`            | `/instructor/exams`                  | List exams created by the instructor                        |
| `POST`           | `/instructor/exams`                  | Create a scheduled/keyed/public or restricted exam          |
| `PUT` / `DELETE` | `/instructor/exams/{examId}`         | Update or delete an owned exam                              |
| `POST`           | `/instructor/exams/{examId}/students`| Enroll one or many students in a private exam               |
| `GET`            | `/instructor/exams/{examId}/reports` | Marks and grade distribution                                |
| `GET`            | `/student/exams`                     | Discover published exams available to the student           |
| `GET`            | `/student/exams/{examId}`            | Retrieve authorized exam questions with answer keys removed |
| `POST`           | `/student/exams/{examId}/verify-key` | Verify an exam key and receive a short-lived token          |
| `GET` / `PUT`    | `/admin/settings`                    | Read or update global rules                                 |
| `GET`            | `/admin/exams`                       | Paginated overview of all exams                             |
| `PATCH`          | `/admin/exams/{examId}`              | Change exam status                                          |
| `GET`            | `/admin/users`                       | Paginated/searchable account overview                       |
| `PUT` / `PATCH`  | `/admin/users/{userId}`              | Update a user's name, registration number, or role           |
| `DELETE`         | `/admin/users/{userId}`              | Delete a user and their related exams and attempts           |

## Authentication endpoints

### `POST /auth/register`

Creates a `STUDENT` or `INSTRUCTOR` user and returns `201` with a seven-day bearer token. `name`, `email`, and `password` are required. `registrationNumber` is optional. Passwords must be at least 12 characters and at most 72 UTF-8 bytes. Email is normalized to lowercase. Passwords are stored as bcrypt hashes. `role` defaults to `STUDENT`; `ADMIN` is rejected. Returns `409` when the email is already registered and `503` when `AUTH_JWT_SECRET` is missing or shorter than 32 bytes.

```json
{
  "name": "Amina Niyonsenga",
  "email": "amina@example.com",
  "password": "a-long-unique-passphrase",
  "registrationNumber": "REG-204",
  "role": "STUDENT"
}
```

The response contains `{ "user": { ... }, "token": "...", "tokenType": "Bearer", "expiresIn": 604800 }`. Only public user fields are returned.

### `POST /auth/login`

Accepts `{ "email": "amina@example.com", "password": "..." }`. Returns the same token response as registration. Unknown accounts and incorrect passwords share the same `401` response.

Send the token on protected requests as `Authorization: Bearer <token>`. The browser UI keeps it in tab-scoped `sessionStorage`; production deployments should use HTTPS and apply their standard XSS protections. There is no server-side token revocation store; tokens expire after seven days, and deleting the user makes their token unusable.

## `POST /instructor/exams/{examId}/students`

Requires the owning instructor or an admin. The exam must be private. Submit a single identity, a `students` array, or the `emails` and/or `registrationNumbers` arrays. Each identity needs an email, a registration number, or both. The endpoint accepts at most 1,000 entries, trims identifiers, normalizes email to lowercase, and skips duplicates already present for that exam.

```json
{
  "students": [
    { "email": "amina@example.com", "registrationNumber": "REG-204" },
    { "email": "jean@example.com" }
  ]
}
```

For separate lists, send `{ "emails": ["amina@example.com"], "registrationNumbers": ["REG-204"] }`. A single entry can be sent as `{ "email": "amina@example.com" }`. Success returns `201` with `{ "added": 2, "submitted": 2 }`. Public exams are rejected with `409`; an exam owned by another instructor is returned as `404`.

## `GET /exams`

Instructors see their own exams; admins see all exams. Results are newest first and include creator details and `_count.questions`.

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

Creates a draft. `title` and positive integer `durationMinutes` are required. `description` and `passingScore` are optional; passing score is from 0 to 100. `createdById`, if supplied, is ignored; the authenticated instructor is always used.

```json
{
  "title": "Biology Final",
  "description": "Unit 1 assessment",
  "durationMinutes": 60,
  "passingScore": 70,
  "createdById": "user_id"
}
```

Returns `201` with `{ "exam": ... }`, including creator details and question count. Returns `400` for invalid input.

For scheduling, keys, visibility, allow-lists, and the monthly limit, use `POST /instructor/exams`.

## `GET /exams/{examId}`

Returns `{ "exam": ... }`, including creator details and questions ordered by `orderIndex`. Each question includes its ordered `options`, `matchPairs`, `gridRows`, `gridColumns`, and `blanks` arrays. Option correctness and blank accepted answers are included because this endpoint returns the stored question records; restrict it to trusted authoring/administration clients and do not expose it directly to exam takers.

Returns `404` if the exam does not exist.

This route requires the exam's instructor or an admin. The response includes answer keys, so it is for trusted authoring clients only.

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

Both routes use the same grading behavior. The short route requires `examId` in the JSON body; the nested route takes the exam ID from the URL. Authenticated student identity comes from the bearer token; any supplied `userId` is ignored. An unauthenticated guest must submit `name` and `email` and may take public exams only. Every submission needs an `answers` object keyed by question ID. Omitted questions are saved as unanswered and scored incorrect.

```json
{
  "name": "Guest Student",
  "email": "guest@example.com",
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

If an exam has an `opensAt`, submission is accepted only strictly after that time; if it has a `closesAt`, submission must arrive strictly before it. The exam must be `PUBLISHED`, and private exams require an allowed email or registration number. If an exam key is configured, submit `examKey` or a valid `keyToken` returned by `/student/exams/{examId}/verify-key`. Returns `201` with the attempt, earned and possible points, percentage, manual-review flag, and per-question breakdown. If long answers need review, the attempt remains `SUBMITTED`; its score is provisional. Otherwise it is marked `GRADED`. Returns `400` for malformed answers, `403` for access/key failures, `404` for a missing exam/user, and `409` for unpublished exams or a closed timing window.

## `GET /attempts/{attemptId}`

Returns attempt metadata, exam and student summaries, score details, and an ordered answer breakdown. The `score` object includes `pointsEarned`, `pointsPossible`, `percentage`, `passingScore`, `passed`, `requiresManualReview`, and `isProvisional`. `passed` is `null` while manual review is pending or no passing score is set.

Returns `404` if the attempt does not exist.

Students can read only their own attempt. The owning instructor and admins can also read it.

## Instructor endpoints

### `GET /instructor/exams`

Lists exams created by the authenticated instructor, including counts of questions, submissions, and allowed students. Admins receive all exams.

### `POST /instructor/exams`

Creates an exam owned by the authenticated instructor. The request accepts `title`, `description`, `durationMinutes`, `passingScore`, `opensAt`, `closesAt`, `examKey`, `isPublic`, and `allowedStudents`. Dates must be ISO strings or `null`; the open time must precede the close time. Each allowed student must contain an email, a registration number, or both. Public exams cannot be created with a restricted list. The exam key is stored as a hash and is never returned in plaintext. New exams start as `DRAFT`.

Example:

```json
{
  "title": "Term Exam",
  "durationMinutes": 60,
  "passingScore": 50,
  "opensAt": "2026-11-01T08:00:00.000Z",
  "closesAt": "2026-11-01T10:00:00.000Z",
  "examKey": "classroom-code",
  "isPublic": false,
  "allowedStudents": [
    { "email": "student@example.com" },
    { "registrationNumber": "REG-204" }
  ]
}
```

Instructor creation is limited by `maxExamsPerMonth`, default `10`. The limit counts exams created during the current UTC month. Admins can change it through `/admin/settings`.

### `PUT /instructor/exams/{examId}` and `DELETE /instructor/exams/{examId}`

`PUT` updates supplied exam fields; omitted fields remain unchanged. To clear `examKey`, `opensAt`, or `closesAt`, pass `null`. If provided, `allowedStudents` replaces the complete allow-list. `DELETE` cascades to related questions and attempts and returns `204`; both operations require the owning instructor or an admin.

### `GET /instructor/exams/{examId}/reports`

Returns student marks, submission status, manual-review flags, average percentage, submission count, pending-review count, and grade distribution. Only the owning instructor or an admin may access the report.

## Student endpoints

### `GET /student/exams`

Returns published public exams and private published exams whose allow-list matches the authenticated student's email or registration number. The response contains no correct answers or exam key.

### `GET /student/exams/{examId}`

Returns questions only while the exam is published and inside its configured time window. The response omits option correctness, accepted answers, grid answer cells, and match pairings. Matching questions provide the left-side prompts and a separately shuffled `matchChoices` list. For keyed exams, send the token from `/verify-key` in the `X-Exam-Key-Token` header.

### `POST /student/exams/{examId}/verify-key`

Requires an authenticated, authorized student and an open published exam. Body: `{ "examKey": "classroom-code" }`. On success returns `{ "verified": true, "keyToken": "...", "expiresAt": "..." }`. The signed token is bound to the student and exam, expires after 30 minutes or at `closesAt` (whichever comes first), and is submitted as `keyToken` when taking the exam. The raw key can also be provided with the attempt request.

## Admin endpoints

### `GET /admin/settings` and `PUT /admin/settings`

Both require `ADMIN`. `GET` returns the stored `maxExamsPerMonth`, or default `10` if unset. `PUT` accepts `{ "maxExamsPerMonth": 10 }` where the value is an integer from 0 to 10000; zero disables instructor exam creation.

### `GET /admin/exams`

Returns paginated system-wide exam metadata, creator details, and counts. Query parameters: `page` (default 1) and `limit` (default 50, maximum 100).

### `PATCH /admin/exams/{examId}`

Accepts `{ "status": "PUBLISHED" }`, `{ "status": "ARCHIVED" }`, or `{ "status": "DRAFT" }`. Publishing is rejected if the exam has no questions.

### `GET /admin/users`, `PUT` / `PATCH /admin/users/{userId}`, and `DELETE /admin/users/{userId}`

The list supports `page`, `limit`, text search `q`, and a `role` filter. `PUT` and `PATCH` accept any combination of `name`, `registrationNumber`, and `role`. The last administrator cannot be demoted or deleted. Admins cannot delete their own account. User deletion cascades to that user's instructor exams and student attempts; the operation cannot be undone.

## Errors

Errors use this format:

```json
{ "error": "A human-readable explanation." }
```

`500` indicates an unexpected database or server failure. Route handlers do not return internal exception details.
`409` is used for timing/status conflicts and `429` when an instructor reaches the monthly exam limit. Missing signing or database authentication configuration returns `503`.

## Access control notes

Public guest submissions associate attempts with the submitted email but do not verify email ownership. Use authenticated student tokens where identity matters. Self-service instructor registration is available; schools that require verified instructor identities should restrict access at the deployment or identity-provider layer. The first administrator must be provisioned through a trusted operations workflow.
