# Changelog

Notable changes to Ingeri Exam are recorded here. This file follows the general structure of [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). No published release tags are recorded in this changelog yet.

## [Unreleased]

### Added

- Initial platform baseline: Next.js App Router API built with TypeScript, Prisma, and PostgreSQL.
- Versioned `/api/v0` route surface for student, instructor, and administrator workflows.
- Ten question formats: multiple choice, checkbox, drag-drop, short answer, long answer, dropdown, match, fill-in, grid multiple choice, and grid checkbox.
- Exam scheduling and access controls, student allowlists, guest submissions for public exams, and automated grading with manual-review flags for long answers.
- Repository guides for API usage, question formats, data models, security, and contribution practices.
- GitHub Actions checks for linting, TypeScript, Prisma schema validation, and application build.

### Changed

- Not applicable; this section will record updates to existing functionality.

### Fixed

- Not applicable; this section will record user-visible or operational fixes.

## Release process

For each release, move the relevant entries from `Unreleased` into a versioned heading such as `## [0.1.0] - YYYY-MM-DD`. Keep entries concise and describe changes that matter to API consumers and operators. Link breaking API or schema changes to their migration or compatibility guidance.
