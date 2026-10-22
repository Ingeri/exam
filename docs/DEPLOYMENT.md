# Deployment guide

This guide covers local PostgreSQL setup and production deployment of the Ingeri Exam API. The application uses Next.js App Router route handlers and Prisma with PostgreSQL. Its versioned API is rooted at `/api/v0`.

## 1. Provision PostgreSQL

Create a PostgreSQL database and an application role with only the permissions the app needs. Keep a separate migration-capable credential if your database provider supports it. In production, enable TLS and backups, and use a connection endpoint suitable for the target runtime. A pooled URL can be useful for serverless runtime connections, but Prisma migrations need a direct, DDL-capable connection.

The Prisma CLI reads `DATABASE_URL` from `prisma7.config.ts`. The runtime Prisma adapter also reads `DATABASE_URL`.

## 2. Configure local environment

```bash
pnpm install
cp .env.example .env
```

Edit `.env` and set:

- `DATABASE_URL` to the PostgreSQL URL for the development database.
- `AUTH_JWT_SECRET` to a cryptographically random secret of at least 32 bytes. Keep it stable across app instances. Rotating it invalidates existing tokens.
- Optionally `EXAM_KEY_SECRET` to a separate random secret of at least 32 bytes. Keep it stable while exams using those keys remain active. If unset, the app falls back to `AUTH_JWT_SECRET`.
- Optionally `AUTH_JWT_ISSUER` and `AUTH_JWT_AUDIENCE` to values that your identity provider includes in issued tokens.
- Optionally `NEXT_PUBLIC_APP_URL` to the origin of the consuming client. This repository does not currently read this value.

`NEXTAUTH_SECRET` is not used: this project has no NextAuth.js integration. API authentication expects bearer JWTs issued by a trusted external identity provider; it does not implement a login or token-issuance route.

## 3. Create and apply Prisma migrations

Validate the schema and generate the client:

```bash
pnpm exec prisma validate
pnpm exec prisma generate
```

This checkout currently contains no `prisma/migrations` history. For a new, empty development database, create and apply the initial migration:

```bash
pnpm exec prisma migrate dev --name init
```

Review and commit the generated `prisma/migrations` directory with the schema change. Later schema changes should each be created and tested in development with `prisma migrate dev --name <descriptive_name>`. Production applies the committed migration history using:

```bash
pnpm exec prisma migrate deploy
```

Do not run `migrate dev` against production. If a database already has tables created with `prisma db push` or another process, do not apply an initial migration blindly: back up the database and follow Prisma's [baselining guide](https://www.prisma.io/docs/orm/prisma-migrate/workflows/baselining) before using `migrate deploy`. Use a direct, migration-capable `DATABASE_URL` in CI for migration steps.

For local-only sample data, run:

```bash
pnpm exec prisma db seed
```

The current seed script creates a sample instructor and exam and replaces its previous sample exam when rerun. Use it only in development or a disposable test database; it is not a production user-provisioning process.

## 4. Verify locally

```bash
pnpm lint
pnpm exec tsc --noEmit
pnpm exec prisma validate
pnpm build
pnpm start
```

Configure an external identity provider to issue HS256 bearer tokens for pre-provisioned `User` records. Tokens use the database user's ID as the `sub` claim. Provision the initial administrator through a trusted operations process. Do not trust caller-supplied user IDs or roles.

## 5. Configure a Vercel project

1. Import this GitHub repository into Vercel and configure the project as a Next.js application. Configure production and preview environment variables in the Vercel project settings, including `DATABASE_URL`, `AUTH_JWT_SECRET`, and any optional issuer, audience, or exam-key secret values.
2. Install and authenticate the Vercel CLI, then link the repository to the intended Vercel project:

   ```bash
   npm install --global vercel
   vercel login
   vercel link
   ```

3. Retrieve the organization and project IDs from `.vercel/project.json` and create a GitHub `production` environment with these secrets:
   - `VERCEL_TOKEN`
   - `VERCEL_ORG_ID`
   - `VERCEL_PROJECT_ID`
   - `DATABASE_URL` when the repository contains migrations (use the production migration-capable direct connection URL)
4. Review the environment protection rules and restrict who can approve or modify production deployments.
5. Ensure only one system owns production deployments. If using this repository's GitHub Action, disable Vercel's automatic production deployment from Git pushes to avoid deploying the same commit twice.

The GitHub workflow at `.github/workflows/deploy.yml` runs on pushes to `main` and manual dispatch. It checks linting, TypeScript, and Prisma schema validity, pulls production Vercel configuration, applies committed migrations when a migration directory exists, builds production artifacts, and deploys them. Its Vercel token and project IDs are GitHub environment secrets; application runtime variables must also be configured in Vercel. The repository currently has no migration history, so the workflow will not run a production migration until migrations are committed.

Vercel's [GitHub Actions guide](https://vercel.com/docs/git/vercel-for-github) documents the `vercel pull`, `vercel build`, and `vercel deploy --prebuilt` flow used here. Prisma documents production migration application with [`prisma migrate deploy`](https://www.prisma.io/docs/orm/prisma-migrate/workflows/development-and-production#production-and-testing-environments).

## 6. Production checks

- Confirm the deployed API is reachable at `/api/v0` and exercise authenticated routes using a non-production test account.
- Check Vercel function and database logs after deployment. Do not log bearer tokens, exam keys, or student answer content.
- Confirm scheduled exams use the intended UTC timestamps. The API enforces `opensAt` and `closesAt`; `durationMinutes` is returned to clients but there is not currently a server-side attempt-start countdown.
- Confirm backups and restore procedures before deploying schema changes. Prefer backward-compatible migrations and deploy schema changes before code that depends on them.
- Use a trusted identity provider and configure rate limiting, TLS, monitoring, and access controls appropriate to your deployment.

See [SECURITY.md](../SECURITY.md) for secret handling and [API_REFERENCE.md](./API_REFERENCE.md) for route behavior.
