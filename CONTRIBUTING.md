# Contributing to Ingeri Exam

Thanks for helping improve the assessment platform. Contributions may include API behavior, assessment data models, grading rules, documentation, and (if introduced) question component renderers.

## Development setup

Follow the [README setup instructions](./README.md#local-setup). Before submitting a change, run the applicable checks:

```bash
pnpm lint
pnpm exec tsc --noEmit
pnpm exec prisma validate
pnpm build
```

Keep changes focused and include or update API documentation when route behavior changes.

## Assessment features and question formats

- Preserve the existing `QuestionType` enum and document any proposed type additions in `docs/QUESTION_TYPES.md`.
- When adding or changing a question format, consider its authoring data, persisted relations, answer payload shape, validation, grading, result disclosure, and compatibility with existing attempts.
- Validate question and answer payloads at API boundaries. Reject malformed values with a clear JSON error and suitable HTTP status; never trust client-supplied correctness or points.
- Keep grading deterministic for automatically scored answers. For subjective answers, use an explicit review state rather than implying a verified automatic score.
- If adding a frontend question renderer in a future client, keep it aligned with the canonical API/data contract and make all supported answer states accessible by keyboard and assistive technology.
- Avoid exposing correct options, accepted answers, or grading keys to students before submission.

## API and code standards

- Put HTTP handlers in the appropriate `src/app/api/v0/` route directory and follow the Next.js App Router conventions already used in the repository.
- Keep authorization close to the route boundary and apply role checks to every protected operation.
- Use the existing shared API, authentication, and Prisma helpers where appropriate. Use transactions when a multi-record operation must be atomic.
- Keep TypeScript strict: use explicit input validation and avoid `any` and unchecked casts.
- Make database changes in `prisma/schema.prisma`; update schema documentation and migration/setup instructions when model behavior changes.
- Return consistent JSON responses and use meaningful HTTP status codes. Do not include secrets or sensitive answer keys in logs or error bodies.
- Follow the existing ESLint formatting and import conventions.

## Pull requests

1. Create a focused branch from the current default branch.
2. Explain the problem, the behavior changed, and any API or schema compatibility impact.
3. Include reproducible verification steps and sample requests for changed endpoints.
4. Update `api-docs/README.md`, `docs/QUESTION_TYPES.md`, or `docs/DATABASE_SCHEMA.md` when the corresponding contract changes.
5. Confirm the development checks above pass, and ensure no credentials, real student data, or generated artifacts are committed.

For security-sensitive issues, follow [SECURITY.md](./SECURITY.md) instead of opening a public issue with exploit details.
