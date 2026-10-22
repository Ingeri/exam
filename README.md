# Ingeri Exam Platform

Ingeri Exam is a headless assessment platform for authoring, administering, and grading online examinations. It provides a versioned JSON API built with the Next.js App Router; this repository does not require a frontend to use its API.

Product and organization information: [ingeritech.com](https://ingeritech.com).

## Technology

- **Next.js 16 App Router** for API route handlers
- **TypeScript** for application and API types
- **Tailwind CSS 4** is installed for styling if a client is added
- **Prisma ORM** for PostgreSQL data access
- **PostgreSQL** for users, exams, questions, attempts, and answers

## Features

- Ten question types: multiple choice, checkbox, drag-and-drop, short answer, long answer, dropdown, matching, fill-in, grid multiple choice, and grid checkbox
- Question configuration supports ordered options, matching pairs, grid rows and columns, and cloze blanks
- Role-aware API endpoints for students, instructors, and administrators
- Exam publication windows, optional access keys, public exams, and allowed-student lists
- Automated grading for supported objective formats, with answer and score records stored per attempt
- Instructor exam management and reports, plus administrative settings and oversight endpoints

See [API documentation](./api-docs/README.md) for routes, authentication, request bodies, and responses. Database entities and actual relations are described in [docs/DATABASE_SCHEMA.md](./docs/DATABASE_SCHEMA.md). The question formats are specified in [docs/QUESTION_TYPES.md](./docs/QUESTION_TYPES.md).

## Prerequisites

- Node.js 20 or newer
- pnpm 11 (the package manager declared by this repository)
- PostgreSQL
- A database connection URL in `DATABASE_URL`
- An `AUTH_SECRET` for signed API tokens

## Local setup

```bash
pnpm install
cp .env.example .env
```

Set `DATABASE_URL` in `.env` to your PostgreSQL connection string and set a strong `AUTH_JWT_SECRET` (at least 32 bytes). If `.env.example` is unavailable in your checkout, create `.env` with those variables. Then synchronize the development database and generate Prisma Client:

```bash
pnpm exec prisma db push
pnpm exec prisma generate
```

Start the API server:

```bash
pnpm dev
```

The local server listens at `http://localhost:3000`. Versioned API routes are under `/api/v0`; available endpoints and examples are documented in `api-docs/README.md`. For a production deployment, configure the same required secrets in the deployment environment and use the deployment's database migration process rather than a development database push.

## Development checks

```bash
pnpm lint
pnpm exec tsc --noEmit
pnpm exec prisma validate
pnpm build
```

## Contributing and security

Read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening a pull request. Report security concerns privately according to [SECURITY.md](./SECURITY.md).
