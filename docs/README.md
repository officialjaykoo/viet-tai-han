# VTH Documentation

This directory contains the active product, architecture, data, testing, feature-contract, and operations documentation for Việt tại Hàn.

## Primary canonical documents

These five documents are the first source of truth for future development and AI coding agents.

1. [`PRODUCT.md`](PRODUCT.md) — what VTH is, who it serves, core journeys, product principles, non-goals, and feature-priority rules.
2. [`ROADMAP.md`](ROADMAP.md) — current phase, Bug12 quality convergence, Bug13 best-of-7 audit, Bug14 D1 consolidation, and later launch priorities.
3. [`ARCHITECTURE.md`](ARCHITECTURE.md) — deployed runtime boundaries, canonical state ownership, identity, security, messaging, content, and convergence rules.
4. [`VTH_DATABASE.md`](VTH_DATABASE.md) — canonical D1 ownership, counter invariants, migration policy, legacy objects, and consolidation strategy.
5. [`VTH_TESTING.md`](VTH_TESTING.md) — lint/CI/test-layer responsibilities, DB integrity checks, critical browser journeys, and anti-flake policy.

If a feature-specific document conflicts with one of the primary five, update the conflict rather than maintaining two truths.

## Supporting feature contracts

- [`VTH_CONTENT_FEED.md`](VTH_CONTENT_FEED.md) — deeper public post/feed ranking, pagination, visibility, block-interaction and retry contract.
- [`VTH_REALTIME_DM.md`](VTH_REALTIME_DM.md) — deeper direct-message request, persistence, realtime delivery, ordering, blocking, retry and recovery contract.

These documents may be more implementation-specific than the primary five but remain active contracts.

## Operations and dangerous procedures

- [`CLOUDFLARE_VTH_KR_SETUP.md`](CLOUDFLARE_VTH_KR_SETUP.md) — production Cloudflare resources, configuration, migrations, deployment, smoke checks, backup and rollback.
- [`USER_ID_REKEY_RUNBOOK.md`](USER_ID_REKEY_RUNBOOK.md) — dangerous user-ID rekey procedure. Do not execute without maintenance window, backup, dry-run and explicit production confirmation.
- [`../SECURITY.md`](../SECURITY.md) — vulnerability reporting and security policy.

## Documentation rules

### Current truth vs implementation history

```text
PRODUCT / ROADMAP / ARCHITECTURE / VTH_DATABASE / VTH_TESTING
= current canonical direction

feature contracts / runbooks
= detailed current behavior or operation

Git history / old bug instructions
= implementation history
```

Do not turn canonical documents into Bug completion reports. Historical labels such as “Bug10 fixed X” or donor-comparison notes belong in Git history unless they are required to understand the current contract.

### Update discipline

A code change must update documentation when it changes any of the following:

- product goal/non-goal
- canonical implementation ownership
- persistent data ownership/schema
- identity/block/moderation semantics
- feed/recommendation behavior
- DM authority/recovery behavior
- quality/CI requirements
- production deployment/secret/binding requirements

### External-project references

RED, Clonagram, Discourse, Lemmy, Apache Answer, Bluesky, GoToSocial and other projects may be used as references or donor sources. Their architecture is not automatically VTH architecture. Adopted patterns must be absorbed into the canonical VTH contracts above.

## Before a major development phase

Before Bug13 or another broad architecture pass, read at minimum:

```text
PRODUCT.md
ROADMAP.md
ARCHITECTURE.md
VTH_DATABASE.md
VTH_TESTING.md
```

Then read the relevant feature contract/runbook for the domain being changed.
