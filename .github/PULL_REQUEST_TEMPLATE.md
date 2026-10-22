## Summary

Describe the problem and the changes made.

## Change type

- [ ] Bug fix
- [ ] Assessment feature
- [ ] API or schema change
- [ ] Documentation or CI change

## Question types affected and tested

Mark the types covered by this change and describe what you verified. Use `N/A` when the change does not affect question behavior.

- [ ] MULTIPLE_CHOICE
- [ ] CHECKBOX
- [ ] DRAG_DROP
- [ ] SHORT_ANSWER
- [ ] LONG_ANSWER
- [ ] DROPDOWN
- [ ] MATCH
- [ ] FILL_IN
- [ ] GRID_MULTIPLE
- [ ] GRID_CHECKBOX

Verification details:

## API, schema, and grading impact

Describe changed routes, request/response contracts, persisted data, validation, grading, and compatibility with existing exams or attempts.

## Checks

- [ ] `pnpm lint`
- [ ] `pnpm exec tsc --noEmit`
- [ ] `pnpm exec prisma validate` (when schema or Prisma behavior changes)
- [ ] `pnpm build`
- [ ] Updated relevant API and technical documentation
- [ ] No secrets, real student records, or production exam content are included
