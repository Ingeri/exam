# Ingeri Exam Platform

Ingeri Exam is an online examination platform for authoring, administering, and grading assessments. It includes a role-based browser experience and a versioned JSON API built with the Next.js App Router.

Product and organization information: [ingeritech.com](https://ingeritech.com).

## Technology

- **Next.js 16 App Router** for pages and API route handlers
- **TypeScript** for application and API types
- **Tailwind CSS 4** for responsive browser views
- **Prisma ORM** for PostgreSQL data access
- **PostgreSQL** for users, exams, questions, attempts, and answers
- **bcryptjs** for password hashing and signed JWT bearer tokens for API authentication

## Features

- Ten question types: multiple choice, checkbox, drag-and-drop, short answer, long answer, dropdown, matching, fill-in, grid multiple choice, and grid checkbox
- Question configuration supports ordered options, matching pairs, grid rows and columns, and cloze blanks
- Role-aware API endpoints for students, instructors, and administrators
- Student and instructor registration, login, and role-specific workspaces
- Exam publication windows, optional access keys, public exams, and allowed-student lists
- Single and bulk enrollment for private exams, plus admin user and system-limit controls
- Automated grading for supported objective formats, with answer and score records stored per attempt
- Instructor exam management and reports, plus administrative settings and oversight endpoints

Start with the [Platform Guide](./docs/PLATFORM_GUIDE.md) for setup, roles, browser workflows, and the route overview. See the [API reference](./api-docs/README.md) for authentication, request bodies, and responses. Database entities and relations are described in [docs/DATABASE_SCHEMA.md](./docs/DATABASE_SCHEMA.md), and question formats are specified in [docs/QUESTION_TYPES.md](./docs/QUESTION_TYPES.md).

## Prerequisites

- Node.js 20 or newer
- pnpm 11 (the package manager declared by this repository)
- PostgreSQL
- A database connection URL in `DATABASE_URL`
- An `AUTH_JWT_SECRET` (at least 32 bytes) for signed API tokens

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

Start the app and browser interface:

```bash
pnpm dev
```

The local app listens at `http://localhost:3000`. Register at `/register`, sign in at `/login`, or call the versioned API under `/api/v0`. For a production deployment, configure the same required secrets in the deployment environment and use the deployment's database migration process rather than a development database push.

## Development checks

```bash
pnpm lint
pnpm exec tsc --noEmit
pnpm exec prisma validate
pnpm build
```

## Contributing and security

Read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening a pull request. Report security concerns privately according to [SECURITY.md](./SECURITY.md).
