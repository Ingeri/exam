# Ingeri Exam platform guide

Ingeri Exam is a PostgreSQL-backed examination platform built with Next.js 16 App Router, TypeScript, Prisma, and Tailwind CSS 4. The browser experience lives alongside a versioned JSON API under `/api/v0`.

## Getting started

Install dependencies, set `DATABASE_URL` and a high-entropy `AUTH_JWT_SECRET` of at least 32 bytes in `.env`, then sync the schema and start the app:

```bash
pnpm install
pnpm exec prisma db push
pnpm exec prisma generate
pnpm dev
```

Open `http://localhost:3000`. Create an account at `/register`, sign in at `/login`, and the app will send you to the workspace for your account role. The API needs PostgreSQL and the signing secret to register users or issue tokens.

## Authentication

`POST /api/v0/auth/register` creates a `STUDENT` or `INSTRUCTOR` account from a name, email, password, and optional registration number. Passwords must contain at least 12 characters and no more than 72 UTF-8 bytes. They are stored as bcrypt hashes. Email addresses are normalized to lowercase. Public registration does not permit the `ADMIN` role; provision the first administrator through a trusted database or operations process.

`POST /api/v0/auth/login` validates an email and password. Both endpoints issue an HS256 JWT with a seven-day expiry. Configure `AUTH_JWT_SECRET` with at least 32 bytes. The token's `sub` is the database `User.id`; authorization loads the user's current role from PostgreSQL on each request, so changing a role takes effect immediately. Optional `AUTH_JWT_ISSUER` and `AUTH_JWT_AUDIENCE` values are enforced when configured.

Send the token on protected API requests in this header:

```http
Authorization: Bearer <JWT>
```

The browser UI stores the token in tab-scoped `sessionStorage` and clears it on sign out. Use HTTPS in deployment and apply normal XSS protections. Tokens cannot be revoked individually; they expire after seven days, and deleting a user makes their tokens invalid because the user lookup fails. Missing or invalid credentials return `401`; authenticated users without the required role receive `403`.

## Roles and permissions

| Role | Permissions |
| --- | --- |
| `STUDENT` | Discover published public or allowed exams, verify exam keys, submit attempts, and read own results. |
| `INSTRUCTOR` | Create and manage own exams and questions, enroll students in private exams, and read own reports and attempts. |
| `ADMIN` | Review all exams and users, manage roles and global settings, moderate exam status, and manage all instructor reports. |
| Public guest | Submit to a public exam with a name and email; cannot access private exams or results. |

Instructors can register directly. If an organization requires instructor approval or verified institutional identity, restrict self-service instructor registration at the deployment or identity-provider layer. Never accept caller-supplied user IDs or role claims as proof of identity.

## Instructor workflow

1. Sign in at `/login` with an `INSTRUCTOR` account.
2. On `/instructor`, create a private draft with a title, duration, optional open and close times, and optional exam access key. Times are sent as ISO timestamps. The server stores the key as an HMAC digest; it never returns the plaintext key.
3. Select the draft in **Invite students**. Paste one or more emails and/or registration numbers, separated by lines, commas, or semicolons. Submit to enroll the batch.
4. Add questions using the question authoring API, then have an administrator publish the exam. Students must match an allowed email or registration number. If the exam has a key, students also verify it through `/api/v0/student/exams/{examId}/verify-key` before fetching or submitting the exam.

The enrollment API also supports a single identity or structured batches:

```http
POST /api/v0/instructor/exams/{examId}/students
Authorization: Bearer <JWT>
Content-Type: application/json
```

```json
{
  "students": [
    { "email": "amina@example.com", "registrationNumber": "REG-204" },
    { "email": "jean@example.com" }
  ]
}
```

You can alternatively send `{ "email": "amina@example.com" }`, `{ "registrationNumber": "REG-204" }`, or arrays such as `{ "emails": ["amina@example.com"], "registrationNumbers": ["REG-204"] }`. Each entry needs an email, registration number, or both. The route accepts up to 1,000 entries, ignores duplicate identifiers in the submission, and skips entries already present for the exam. Only the exam owner and admins can enroll students; public exams return `409`.

## Admin workflow

Sign in with an `ADMIN` account and open `/admin`. The panel searches the user directory, changes a user's name, registration number, or role, deletes accounts, and updates `maxExamsPerMonth` (0 disables instructor exam creation). Admins cannot delete their own account or demote/delete the final administrator.

Deleting another user is permanent: Prisma cascades the deletion to exams they created and attempts they submitted. Their related questions and answers are also removed through the exam/attempt relations. Use deletion only when that data loss is intended; role changes are available for routine access changes.

## API endpoint reference

All paths below are relative to `/api/v0`.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/auth/register` | Create a student or instructor account and issue a JWT. |
| `POST` | `/auth/login` | Validate credentials and issue a JWT. |
| `GET`, `POST` | `/instructor/exams` | List owned exams or create an exam. |
| `PUT`, `DELETE` | `/instructor/exams/{examId}` | Update or remove an owned exam. |
| `POST` | `/instructor/exams/{examId}/students` | Enroll a single student or a batch in a private exam. |
| `GET` | `/instructor/exams/{examId}/reports` | Read marks, pending reviews, and grade distribution. |
| `GET` | `/student/exams` | Discover published exams available to the student. |
| `GET` | `/student/exams/{examId}` | Fetch authorized questions without answer keys. |
| `POST` | `/student/exams/{examId}/verify-key` | Verify a key and receive an exam-bound token. |
| `POST` | `/exams/{examId}/attempt` | Submit an exam attempt. |
| `GET` | `/attempts/{attemptId}` | Read an authorized attempt result. |
| `GET`, `PUT` | `/admin/settings` | Read or update platform limits. |
| `GET` | `/admin/users` | Search and paginate the account directory. |
| `PUT`, `PATCH`, `DELETE` | `/admin/users/{userId}` | Update a user or delete their account. |
| `GET` | `/admin/exams` | List system-wide exam metadata. |
| `PATCH` | `/admin/exams/{examId}` | Change exam publication status. |

The complete request, response, error, question, and attempt contracts are in the [API reference](../api-docs/README.md). The [database schema guide](./DATABASE_SCHEMA.md), [question type guide](./QUESTION_TYPES.md), [deployment guide](./DEPLOYMENT.md), and [security policy](../SECURITY.md) provide additional details.

## UI routes

| Route | Audience |
| --- | --- |
| `/` | Public landing page |
| `/login` | Students, instructors, administrators |
| `/register` | Students and instructors |
| `/student` | Students |
| `/instructor` | Instructors and administrators |
| `/admin` | Administrators |

The user interface is a client for the same `/api/v0` contract. API authorization remains authoritative; hiding or showing a client page does not grant server access.
