# Security Policy

## Secrets

Never commit:

- `.dev.vars` / `.env*` (real `BETTER_AUTH_SECRET`, `TURNSTILE_SECRET_KEY`, API tokens)
- Cloudflare API tokens

Production secrets belong in `wrangler secret` only.

## Reporting

If you find a vulnerability in this demo app, open a private GitHub security advisory on the repository (or email the maintainer listed on the GitHub profile). Please do not file a public issue for exploitable bugs until a fix is available.
