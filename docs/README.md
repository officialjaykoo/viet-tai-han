# Documentation

This directory contains the active VTH architecture and operations contract.

- [`ARCHITECTURE.md`](ARCHITECTURE.md) — current runtime boundaries, data ownership, security ingress, and invariants.
- [`CLOUDFLARE_VTH_KR_SETUP.md`](CLOUDFLARE_VTH_KR_SETUP.md) — production resources, configuration, deployment, smoke checks, backup, and rollback.
- [`VTH_REALTIME_DM.md`](VTH_REALTIME_DM.md) — direct-message request, persistence, realtime delivery, blocking, ordering, and retry rules.
- [`USER_ID_REKEY_RUNBOOK.md`](USER_ID_REKEY_RUNBOOK.md) — dangerous one-off user ID rekey procedure and integrity verification.
- [`../SECURITY.md`](../SECURITY.md) — vulnerability reporting and security policy.

Historical implementation plans and reuse audits are intentionally not active documentation; use Git history when historical context is needed. New behavior must be reflected in the current architecture, operational runbook, or feature-specific contract instead.
