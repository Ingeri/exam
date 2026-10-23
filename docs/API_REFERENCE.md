# API reference

This is a concise route index for the versioned headless API. Request and response bodies are JSON. The full contract, field validation, status codes, and examples are in [api-docs/README.md](../api-docs/README.md).

## Base URL and authentication

Local base URL: `http://localhost:3000/api/v0`.

Protected routes use `Authorization: Bearer <JWT>`. Tokens must be HS256-signed using `AUTH_JWT_SECRET` (at least 32 bytes); the `sub` claim identifies an existing database user. Roles are loaded from the database for each request. Optional `AUTH_JWT_ISSUER` and `AUTH_JWT_AUDIENCE` configure issuer and audience checks.

The API does **not** implement a login, registration, or token-issuance endpoint. Authentication belongs to a trusted identity provider, which must issue compatible tokens for provisioned users. Public guest attempt submission is the exception: it accepts a name and email for a public exam and creates or reuses a student user record.

## Route index

| Method          | Route                                | Access                                  | Purpose                                                                                                       |
| --------------- | ------------------------------------ | --------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `GET`           | `/exams`                             | Instructor, admin                       | List exams with creator summary and question count.                                                           |
| `POST`          | `/exams`                             | Instructor, admin                       | Create a draft exam using the authenticated creator identity.                                                 |
| `GET`           | `/exams/{examId}`                    | Owning instructor, admin                | Fetch exam and full question configuration, including answer keys; keep this route away from student clients. |
| `POST`          | `/exams/{examId}/questions`          | Owning instructor, admin                | Add a typed question and its nested options, matching pairs, grid cells, or blanks.                           |
| `POST`          | `/exams/{examId}/attempt`            | Student or public guest                 | Submit answers for an exam and receive auto-grading results.                                                  |
| `POST`          | `/attempt`                           | Student or public guest                 | Same submission operation with `examId` in the JSON body.                                                     |
| `GET`           | `/attempts/{attemptId}`              | Attempt owner, owning instructor, admin | Retrieve result and per-answer breakdown.                                                                     |
| `GET`, `POST`   | `/instructor/exams`                  | Instructor, admin                       | List owned exams or create scheduled/restricted exams. Admins can see all.                                    |
| `PUT`, `DELETE` | `/instructor/exams/{examId}`         | Owning instructor, admin                | Update or delete an exam. Deletion cascades to questions and attempts.                                        |
| `GET`           | `/instructor/exams/{examId}/reports` | Owning instructor, admin                | Get marks, pending-review counts, and grade distribution.                                                     |
| `GET`           | `/student/exams`                     | Student                                 | Discover published public or explicitly allowed exams.                                                        |
| `GET`           | `/student/exams/{examId}`            | Authorized student                      | Get student-safe question data without correctness metadata.                                                  |
| `POST`          | `/student/exams/{examId}/verify-key` | Authorized student                      | Verify an exam key and receive a short-lived exam-bound token.                                                |
| `GET`, `PUT`    | `/admin/settings`                    | Admin                                   | Read or update global instructor exam-creation limits.                                                        |
| `GET`           | `/admin/exams`                       | Admin                                   | List paginated system-wide exam metadata.                                                                     |
| `PATCH`         | `/admin/exams/{examId}`              | Admin                                   | Change an exam's publication status.                                                                          |
| `GET`           | `/admin/users`                       | Admin                                   | Search and paginate users.                                                                                    |
| `PATCH`         | `/admin/users/{userId}`              | Admin                                   | Update a user's name, registration number, or role.                                                           |

All routes are under `/api/v0`, for example `POST /api/v0/instructor/exams`. Legacy unversioned endpoints are documented in the full API guide.

## Create an exam

Use `POST /instructor/exams` to create an exam with access settings. Required fields are `title` and positive integer `durationMinutes`; dates, `examKey`, `isPublic`, `passingScore`, description, and `allowedStudents` are optional. The authenticated instructor becomes the creator; caller-supplied creator IDs are not trusted. Exam keys are stored as HMAC digests and are not returned in plaintext.

```http
POST /api/v0/instructor/exams
Authorization: Bearer <JWT>
Content-Type: application/json
```

```json
{
  "title": "Biology assessment",
  "durationMinutes": 45,
  "passingScore": 70,
  "opensAt": "2026-11-01T08:00:00.000Z",
  "closesAt": "2026-11-01T09:00:00.000Z",
  "isPublic": false,
  "allowedStudents": [{ "email": "student@example.com" }]
}
```

Returns `201` with `{ "exam": ... }`. Instructors are subject to `maxExamsPerMonth`; the default is 10. See the complete guide for fields and validation details.

## Add questions

Use `POST /exams/{examId}/questions` with a `type`, prompt `text`, optional positive `points`, `orderIndex`, and type-specific nested arrays. Supported types are all ten values in [QUESTION_TYPES.md](./QUESTION_TYPES.md). The API validates and saves nested data, then returns `201` with the created question.

## Submit and grade an attempt

Submit to `POST /exams/{examId}/attempt`, or to `POST /attempt` with `examId` in the body. The answers object is keyed by question ID and its values follow the question type's contract. Authenticated submitters must be students authorized for that exam. Public guest submissions include `name` and `email` and are limited to public exams.

```json
{
  "answers": {
    "question-id": "selected-option-id",
    "checkbox-question-id": ["option-a", "option-b"],
    "blank-question-id": { "city": "Kigali" }
  }
}
```

Both submission routes enforce published status, `opensAt`/`closesAt`, allowlist/public access, and required exam keys. A correct automatic answer earns its configured points; incorrect answers earn zero. Long answers with non-empty text are marked for manual review, with null per-question correctness and points until a separate grading workflow is provided. The response (`201`) includes the attempt ID and status, score totals and percentage, review flag, and per-question breakdown. Malformed payloads return `400`; access/key denial returns `403`; closed or unpublished exams return `409`.

## Authentication and access tokens

No `POST /auth`, login, or token-creation route exists. The external identity service must provision users and issue a JWT whose `sub` is the `User.id`. Bearer tokens authenticate protected API calls. For keyed exams, a student can call `POST /student/exams/{examId}/verify-key` with `{ "examKey": "..." }`. On success the route returns `keyToken` and `expiresAt`; send the token as `keyToken` in an attempt request. The token is bound to the user and exam and expires within 30 minutes or at the exam close time, whichever comes first.

## Retrieve results

`GET /attempts/{attemptId}` returns attempt metadata, score details, and answers. Students can read their own results; the exam's instructor and admins can also read them. Long-answer pending review is reflected by a nullable score and review flag. Instructor reports are available through `GET /instructor/exams/{examId}/reports`.

## Error responses

Errors use `{ "error": "Human-readable message." }`. Common statuses include `400` invalid input, `401` missing/invalid authentication, `403` insufficient access, `404` missing or owner-hidden resource, `409` status/timing conflict, `429` monthly exam limit, `503` missing service configuration, and `500` unexpected failure.
