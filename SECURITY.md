# Security Policy

Việt tại Hàn (VTH) is an actively developed social/community application deployed at `vth.kr`.

Security reports are welcome. Please do **not** disclose exploitable vulnerabilities publicly before they have been reviewed and fixed.

## Supported code

Security fixes are made against the current `main` branch and the production deployment derived from it.

Older forks, local deployments, and third-party instances may have different configuration and are not maintained by the VTH project.

## Reporting a vulnerability

Preferred method:

1. Open the repository's **Security** tab.
2. Use **Report a vulnerability** / a private GitHub Security Advisory when available.
3. Include enough information to reproduce the issue safely.

If private vulnerability reporting is unavailable, contact the repository owner privately through the contact information on the GitHub profile.

Do not open a public issue containing:

- authentication bypasses
- session/token leakage
- OAuth weaknesses
- authorization or IDOR vulnerabilities
- private-message disclosure
- account takeover paths
- secret material
- exploitable injection or remote-code-execution issues
- abuse techniques that would materially endanger production users

A useful report should include:

- affected route or feature
- preconditions
- reproduction steps
- expected vs. actual behavior
- impact
- browser/runtime details when relevant
- a minimal proof of concept, without accessing data that is not yours

## Scope

High-priority security areas include:

- Facebook, Kakao, and Zalo OAuth/account linking
- session and onboarding authorization
- mutable usernames vs. immutable `user.id` identity
- follow/friend/block privacy rules
- direct messages and message requests
- message/report moderation access
- notifications and browser push
- media uploads and R2 access
- Cloudflare Worker/API authorization
- D1 query authorization and object ownership
- Turnstile, rate limiting, and abuse controls
- internal/sealed API routes
- billing/webhook signature verification when enabled

## Secrets

Never commit real secrets or production credentials.

Examples include:

- `.dev.vars` and production `.env*` files
- `BETTER_AUTH_SECRET`
- `TURNSTILE_SECRET_KEY`
- `FACEBOOK_CLIENT_SECRET`
- `KAKAO_CLIENT_SECRET`
- `ZALO_APP_SECRET`
- `VAPID_PRIVATE_KEY`
- billing/webhook secrets
- Cloudflare API tokens
- personal API keys or bearer tokens

Production secrets should be stored using Cloudflare Worker secrets or another appropriate secret-management system.

Public identifiers such as OAuth client IDs, Turnstile site keys, and VAPID public keys are not equivalent to private secrets, but they should still be managed deliberately and kept separate from private credentials.

## Responsible testing

When testing `vth.kr`:

- use accounts you control
- do not access another user's private data
- do not perform denial-of-service or resource-exhaustion testing against production
- do not send spam or automated abuse to real users
- do not attempt destructive database or storage actions
- stop once the security impact is demonstrated

For load, race-condition, or Worker resource-limit testing, use a local or isolated preview environment whenever possible.

## Deployment security expectations

Operators of their own VTH fork are responsible for:

- registering correct OAuth redirect URIs
- keeping all provider secrets private
- applying D1 migrations
- configuring Cloudflare bindings correctly
- using HTTPS in production
- configuring Turnstile/rate limits appropriately
- protecting admin access
- rotating leaked keys immediately
- reviewing Cloudflare Worker logs without logging sensitive payloads

## Disclosure

After a report is confirmed, the project will aim to reproduce it, assess impact, prepare a fix, and coordinate disclosure when practical.

There is no bug-bounty program unless explicitly announced by the repository owner.

## License and warranty

The project is distributed under the MIT License and is provided without warranty. See [`LICENSE`](LICENSE).
