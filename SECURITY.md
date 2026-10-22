# Security Policy

## Supported Versions
We take the security of our examination platform and API endpoints (`/api/v0`) seriously. Only the latest version of the main branch receives security updates.

| Version | Supported |
| ------- | --------- |
| 1.x.x   | ✅        |

## Reporting a Vulnerability
If you discover a security vulnerability—such as an authorization bypass, data exposure on instructor/student endpoints, or rate-limiting flaw—please report it responsibly.

* **Do not** open a public GitHub issue for security vulnerabilities.
* Instead, send details directly to the project maintainer or repository owner.
* Please include a description of the vulnerability, steps to reproduce, and potential impact. We will review and respond promptly.

## API Security Best Practices
* **Environment Variables:** Never commit `.env` files containing production `DATABASE_URL` or secret keys.
* **Access Control:** Ensure your deployment environment enforces proper authentication middleware and blocks unauthorized access to authoring and reporting routes.