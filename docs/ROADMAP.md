# VTH Roadmap

**Status:** Canonical planning document
**Current phase:** Quality convergence before broader feature expansion
**Last reviewed:** 2026-09-09

This roadmap records direction and sequencing. It is not a changelog. Completed implementation details belong in Git history and feature contracts.

## 1. Direction

VTH is moving through four broad stages:

```text
Foundation
→ Correctness and convergence
→ Production-quality hardening
→ Product growth and launch maturity
```

The immediate objective is not to add as many features as possible. The objective is to make the existing core stable enough that new features do not multiply maintenance cost.

## 2. Completed foundation

### Platform foundation — DONE

Established:

- Next.js/OpenNext on Cloudflare Workers
- D1 canonical persistent state
- R2 media storage
- Better Auth
- Cloudflare ingress/security foundation
- communities, posts, comments, search and moderation

### Identity and social graph — DONE / HARDENED

Established:

- immutable `user.id` as canonical identity
- mutable public `username`
- social-only provider model
- profile/settings separation
- follow/friend/block semantics
- server relationship projection
- conditional write boundaries

### Realtime direct messaging — DONE / HARDENED

Established:

- one canonical D1 message history
- HTTP canonical writes
- Durable Object/WebSocket realtime fanout only
- request/accept/decline/cancel lifecycle
- idempotent `clientMessageId`
- signed catch-up/history cursors
- monotonic read boundary
- block/ban socket revocation
- bounded live dedupe with selective canonical reconciliation
- uncertain-send recovery
- cross-tab unread convergence

Detailed contract: [`VTH_REALTIME_DM.md`](VTH_REALTIME_DM.md).

### Public content convergence — DONE / HARDENED

Established:

- one canonical post projection
- one public-content visibility predicate
- strict content mutation payload parsing
- canonical positive-like model (`post_likes`, `comment_likes`)
- actual Popular engagement ordering
- signed sort-consistent Popular cursor
- bilateral block guards at final positive-interaction writes
- content-notification block guards
- request-ID conflict semantics
- counter audit and public-content indexes

Detailed contract: [`VTH_CONTENT_FEED.md`](VTH_CONTENT_FEED.md).

## 3. CURRENT — Bug12: production-quality convergence

Goal: move the project from a strong implementation to a repository that can be trusted as a repeatable production baseline.

### 3.1 Lint and CI recovery

Target:

- `npm run lint` exits 0 without weakening rules
- typecheck/tests/build remain green
- main CI becomes a trustworthy hard gate
- no broad `eslint-disable` or source ignores used to hide correctness problems

### 3.2 D1 legacy audit

Target:

- canonical reaction/data ownership remains explicit
- runtime legacy references are reduced
- counter drift and FK integrity are machine-checkable
- safe dead indexes/objects are identified with evidence
- destructive cleanup is deferred unless production evidence is sufficient

### 3.3 Critical browser E2E

Target user journeys:

- authentication/session
- post create/like/comment/reload
- block behavior
- two-user DM request/accept/realtime/read
- Q&A ask/answer/accept
- marketplace create/browse/save where applicable

Target quality:

- deterministic setup
- no arbitrary sleep-based flake masking
- critical Chromium suite repeatedly passes

See [`VTH_TESTING.md`](VTH_TESTING.md).

## 4. NEXT — Bug13: Best-of-7 audit and VTH convergence

Bug13 is a cross-project best-practices audit, not seven feature imports.

Reference pool:

| Project | Primary value to inspect |
| --- | --- |
| RED | Cloudflare-native simplicity, edge-first cost control |
| Clonagram | consumer social UX, focused component/action organization |
| Discourse | long-term maintenance, migration discipline, CI quality gates |
| Lemmy | feed/ranking/aggregate/index evolution |
| Apache Answer | Q&A state, permissions, service/repository test matrices |
| Bluesky | moderation, block/mute/social semantics at real-network scale |
| GoToSocial | privacy, strict interaction policy, small operational surface |

### Bug13 process

```text
Phase A  — audit current VTH after Bug12
Phase B  — inspect strongest relevant patterns in all seven projects
Phase C  — score candidates by impact, complexity, risk and fit
Phase D  — implement only high-value candidates by VTH domain
Phase E  — remove displaced/duplicate paths
Phase F  — run full regression and complexity review
```

### Candidate scoring

Prefer candidates with:

```text
Impact >= 4/5
Complexity <= 3/5
Risk manageable
Clear VTH core-journey benefit
```

There is no requirement to adopt one thing from each project.

### Bug13 success criteria

- VTH gains demonstrably better behavior or engineering practice
- no second architecture is introduced
- no permanent donor-specific adapter remains without necessity
- canonical implementation count stays the same or decreases
- new dependencies/infrastructure are avoided unless strongly justified
### Bug13 implementation status

Bug13 is implemented as VTH-native convergence, not donor-code import:

- **ADOPT:** GoToSocial's explicit separation of public visibility, interaction permission, and viewer attention preference.
- **ADAPT:** private idempotent post saves, private user mutes, Popular `day|week|month|all` windows, canonical Q&A filters, and one admin review-queue read model over existing report tables.
- **VTH-ALREADY-STRONGER:** D1 canonical visibility, positive-like counters, signed cursors, bilateral block guards, and the Bug10/11 runtime boundaries.
- **REJECT/DEFER:** RED-style infrastructure expansion, donor-specific adapters, federation, scoped mute modes, generic `reviewables` storage, hot-rank jobs, and stored popularity scores.

The current production dataset has three public posts (one from today, three this week, three this month), so Popular defaults to **all time** until volume makes a narrower default more useful. Existing ranking remains `like_count + comment_count * 3`; no score column, cache, queue, Worker, or Durable Object was added.

## 5. NEXT — Bug14: D1 schema consolidation and legacy retirement

Bug14 occurs after Bug13 so that physical DB cleanup reflects the architecture VTH actually keeps.

### Goals

- re-audit every legacy DB object after Bug13
- remove safe dead indexes first
- eliminate remaining runtime dependencies on obsolete reaction/ranking structures
- decide the final status of `votes`, legacy score fields, `hot_score`, and related indexes
- strengthen useful constraints where evidence supports it
- verify clean-install and upgrade migration paths
- keep applied migrations immutable
- leave `VTH_DATABASE.md` sufficient to understand current canonical data ownership without reading every historical migration

### Non-goal

Bug14 does not exist to make the migration directory aesthetically short. Migration history may remain long if current runtime/schema is clean and reproducible.

A migration squash/baseline reset is only worth considering much later if fresh bootstrap, tooling compatibility, or migration count becomes a measurable problem.

## 6. AFTER Bug14 — Launch and product maturity

Once Bug12–14 are complete, priority shifts from internal reconstruction to user value and production learning.

Likely workstreams:

### 6.1 Product UX convergence

- simplify onboarding
- improve discovery and empty states
- improve Vietnamese copy and mobile ergonomics
- reduce friction from public content → profile → relationship → DM
- improve marketplace/business trust cues

### 6.2 Content seeding and community quality

- useful initial Q&A
- practical Korea-living guides/posts
- locality/topic community structure
- moderation rules and moderator tooling
- high-quality business/service records

### 6.3 Production observability

Add only what is justified by real operation:

- actionable error reporting
- latency/error-rate tracking
- D1 query/cost observations
- notification/DM delivery diagnostics
- abuse/rate-limit signals

Avoid observability infrastructure that costs more to maintain than the failures it helps detect.

### 6.4 Real-user feedback

Once core flows are stable, real usage should dominate prioritization over speculative architecture work.

Track practical failure modes:

- onboarding abandonment
- failed social login
- empty search/Q&A results
- interaction/report/block friction
- DM request confusion
- marketplace/business trust issues
- slow or expensive queries

## 7. Deferred ideas

Do not schedule these without evidence:

- Reels/TikTok-style video feed
- Stories
- federation
- group chat/calls
- vector/embedding recommendation stack
- ML recommender
- microservices
- generic event bus/queue architecture
- separate search service
- payment escrow

They may become valid later, but current product goals do not justify their maintenance cost.

## 8. Standing engineering gates

Every roadmap phase must preserve:

1. D1 canonical truth.
2. Immutable `user.id` relationship identity.
3. Forward-only migration history.
4. Final-write authorization for important state transitions.
5. Retry/idempotency semantics where transport can be uncertain.
6. One canonical implementation per responsibility.
7. No silent increase in permanent adapters or infrastructure.
8. Lint, typecheck, tests, E2E and build gates appropriate to the changed domain.
9. Documentation updated to current truth, not historical implementation narrative.

## 9. Documentation checkpoint before Bug13

The following five documents are the primary source of truth and must be current before Bug13 implementation begins:

- [`PRODUCT.md`](PRODUCT.md)
- [`ROADMAP.md`](ROADMAP.md)
- [`ARCHITECTURE.md`](ARCHITECTURE.md)
- [`VTH_DATABASE.md`](VTH_DATABASE.md)
- [`VTH_TESTING.md`](VTH_TESTING.md)

Feature/runbook documents may contain deeper operational detail but may not contradict the primary five.

## 10. Definition of progress

Progress is not measured by number of features or commits.

VTH is progressing when it has:

```text
more useful core journeys
+ fewer correctness gaps
+ fewer duplicate implementation paths
+ clearer canonical data ownership
+ stronger repeatable tests
+ lower maintenance burden per feature
```
