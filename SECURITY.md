# Security and academic integrity

Ingeri Exam handles assessment content, access credentials, submissions, and results. Treat exam answer keys and student records as sensitive data.

## Current safeguards

- Versioned API routes enforce role checks for protected student, instructor, and administrator operations.
- API bearer tokens are signed with HS256, checked for expiration and signature using a timing-safe comparison, and resolved against the current user record. Configure `AUTH_JWT_SECRET` as a high-entropy secret of at least 32 bytes. Optional issuer and audience checks are available through `AUTH_JWT_ISSUER` and `AUTH_JWT_AUDIENCE`.
- Exam access keys can be stored as HMAC-SHA256 digests using `EXAM_KEY_SECRET` (or `AUTH_JWT_SECRET`) and compared using timing-safe equality. Avoid storing plaintext access keys.
- Exam access can be restricted by publication status, time window, access key, and allowed-student identity.

These controls are implementation measures, not a guarantee that all deployments or exams are cheat-proof. Instructors should choose appropriate proctoring and identity checks for their exam context.

## Academic integrity and API use

- Do not expose answer keys, accepted answers, or correctness flags in student-facing exam responses before submission.
- Grade using server-side question data; ignore client-supplied scores and correctness claims.
- Keep review and grading records auditable, and restrict them to authorized roles.
- Use HTTPS in deployed environments and keep bearer tokens out of URLs, browser storage that is accessible to injected scripts, logs, analytics, and support tickets.
- Keep secrets in environment secret stores. Never commit `.env` files or production credentials.
- Apply appropriate retention and access controls to personally identifiable information and assessment records.
- Consider rate limits, replay protection, logging, monitoring, and proctoring controls as part of each production deployment's threat model.

## Session and token handling

Bearer tokens are signed but are not encrypted. Keep token lifetimes short and use TLS. Rotating `AUTH_JWT_SECRET` invalidates all tokens signed with the previous secret; the current schema has no per-user token revocation field or session store. Deleting a user also invalidates their tokens but cascades to that user's exams and attempts, so do not use account deletion as a routine token-revocation mechanism. The current implementation validates expiry and optional issuer/audience claims; deployments should additionally apply operational safeguards such as rate limiting and monitoring at the edge.

## Vulnerability reporting

Please do not publish exploit details, student data, or credentials in public issues. Report suspected vulnerabilities privately through the contact channel published on [ingeritech.com](https://ingeritech.com), and include:

- A concise description and affected route or component
- Steps to reproduce using a test account and non-production data
- Potential impact and any suggested mitigation
- A way to contact you for follow-up

Allow the maintainers reasonable time to investigate and prepare a fix before disclosing technical details publicly. Do not access, alter, or retain data belonging to other users while researching a report.
