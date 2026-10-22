# Frequently asked questions

## How do exam timers work?

The API returns `durationMinutes` to a student client and enforces the configured `opensAt` and `closesAt` timestamps when questions are fetched and answers are submitted. At present, there is no attempt-start endpoint or server-side per-student countdown: `ExamAttempt.startedAt` is assigned when the attempt record is created during submission. A client countdown based on `durationMinutes` is therefore informational and cannot currently make the server reject an answer solely because that duration elapsed. Use `closesAt` as the enforced deadline, or add a server-side start/resume flow before relying on an individual timer for high-stakes exams.

## Which question types are supported?

The API supports `MULTIPLE_CHOICE`, `CHECKBOX`, `DRAG_DROP`, `SHORT_ANSWER`, `LONG_ANSWER`, `DROPDOWN`, `MATCH`, `FILL_IN`, `GRID_MULTIPLE`, and `GRID_CHECKBOX`. Payload formats and grading rules are documented in [QUESTION_TYPES.md](./docs/QUESTION_TYPES.md).

## Is there a frontend renderer for each type?

No. This repository provides the headless API and does not include assessment UI renderers. A consuming application should render each enum value and submit the answer shape defined by the question-type specification.

## Why did a submission fail?

Check that the exam is published and inside its `opensAt`/`closesAt` window, the student is allowed to take it, and any required exam key was verified or included. Confirm the `answers` property is a JSON object keyed by question IDs from that exam and each value has the right shape. Public guest requests also need a valid `name` and `email`. The API returns a JSON `error` message and status code; common cases include `400` for malformed data, `401` for missing/expired bearer tokens, `403` for access or key denial, and `409` for an unpublished or out-of-window exam.

## Can a student resubmit an exam?

There is no start/resume or retry policy enforced by a dedicated attempt workflow. Each accepted submission creates a new attempt record. If retries must be limited, apply an operational policy at the client or extend the API with a server-side attempt policy before using it for a high-stakes assessment.

## How is automatic grading calculated?

Objective responses are graded against server-stored correct data. The current engine awards all configured points for an exact correct selection/set/matrix or accepted text response, and zero for an incorrect or unanswered response. Grid, matching, and checkbox answers are compared as complete sets. Drag-drop and fill-in accepted text matching is case-insensitive; short answers use exact case-sensitive matching after response trimming. See [QUESTION_TYPES.md](./docs/QUESTION_TYPES.md) for exact details.

## How are long answers graded?

A non-empty `LONG_ANSWER` receives a manual-review flag, with null correctness and per-question points. Its attempt remains `SUBMITTED` and is marked provisional. The current API provides instructor reports that expose pending-review status, but no endpoint for entering or releasing a manual grade. A human grading process must be arranged separately until that workflow is added.

## Where can I get a bearer token?

The API does not implement login or token issuance. A trusted external identity provider must issue an HS256 JWT for an existing database user, with `sub` set to that user's database ID. See the [API reference](./docs/API_REFERENCE.md) and [API guide](./api-docs/README.md).

## Does a public exam require a student account?

No. Public exam submission accepts `name` and `email` and creates or reuses a student record associated with that email. Email ownership is not verified by the API, so use authenticated accounts when verified identity matters. Private exams require an authenticated, allowlisted student.

## Where do I report a bug or security issue?

Use the GitHub bug report template for reproducible, non-sensitive bugs. Report vulnerabilities privately using the process in [SECURITY.md](./SECURITY.md). Never include student records, exam keys, bearer tokens, or database URLs in an issue.
