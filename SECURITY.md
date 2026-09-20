# Security Policy

## Reporting a vulnerability

Please do not publish sensitive security details in a public issue. Contact the project maintainer privately through the contact method associated with the GitHub repository.

Include a description, reproduction steps, affected component, relevant evidence, and a suggested mitigation if known.

## Secrets

Never commit:

- API keys
- Access tokens
- Passwords
- Private signing keys
- Android keystores
- `.env` files containing secrets

If a secret is accidentally committed, revoke or rotate it immediately and remove it from repository history as appropriate.
