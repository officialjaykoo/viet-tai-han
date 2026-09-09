# VTH Testing and Quality Contract

**Status:** Canonical  
**Purpose:** define what each test layer proves, what CI must gate, and how critical VTH journeys are validated without creating brittle test infrastructure.

## 1. Quality philosophy

VTH uses layered verification because no single test type can prove production correctness.

```text
lint/typecheck
→ unit
→ Worker/integration
→ browser E2E
→ build/migration checks
→ production smoke/observation
```

Each layer should test the narrowest useful responsibility.

Do not duplicate every invariant at every layer.

## 2. Required local quality gates

The standing command set is:

```bash
npm run lint
npm run typecheck
npm test
npm run test:integration
npm run test:e2e:chromium
npm run build
npm run build:worker
npm run db:reset:local
```

A changed-file lint pass is not a substitute for a green full lint baseline.

The repository should not normalize a permanently red quality gate.

## 3. CI contract

Main/pull-request CI should independently gate at least:

- install from lockfile
- lint
- TypeScript typecheck
- unit/Worker tests
- critical Chromium E2E
- Worker production build

Database integrity/migration audit should be part of CI when it is deterministic and fast enough. If it becomes expensive, split it into a dedicated migration job rather than removing the check.

A CI retry may diagnose transient failure but must not be used to accept a consistently flaky first attempt.

## 4. Lint policy

Lint is a correctness/maintainability gate, not a cosmetic report.

Do not make lint green by:

- globally disabling core rules
- ignoring application source directories
- broad `eslint-disable-file`
- mass `eslint-disable-next-line`
- removing Next core-web-vitals/TypeScript rules
- changing the lint script to always succeed

React hook/purity errors should be treated as potential state/correctness problems first.

Safe cleanup includes:

- unused imports/variables
- `prefer-const`
- real dependency-array corrections
- removal of duplicated derived state
- moving render-time side effects/impure work to appropriate boundaries

## 5. Unit tests

Unit tests should cover deterministic pure or near-pure behavior such as:

- parsers and payload normalization
- cursor encoding/validation context
- idempotency/merge precedence helpers
- tuple ordering
- bounded dedupe/reconciliation signals
- relationship state projections
- formatting/validation helpers
- retry policy that does not require real network/browser state

Unit tests should not mock an entire product journey when integration or E2E is the clearer proof.

## 6. Worker tests

Worker-runtime tests are responsible for Cloudflare-specific behavior and authoritative server boundaries that are difficult to prove in ordinary Node unit tests.

Examples:

- Worker ingress/auth routing
- Durable Object WebSocket authorization
- room broadcast authorization
- block/ban terminal revoke
- delayed/stale broadcast barriers
- Cloudflare binding behavior
- API behavior that depends on D1/Worker execution semantics

Use actual Worker/D1 test facilities where practical instead of mocking away the property being tested.

## 7. Integration tests

Integration tests should prove domain state transitions across D1 and server logic.

Priority areas:

- canonical post/comment/like writes
- bilateral block guards
- request-ID replay/conflict behavior
- content moderation visibility
- notification/push eligibility
- Q&A state transitions and count invariants
- marketplace/business ownership/state changes
- friendship/follow/block transitions
- DM request/message/read state
- counter reconciliation

Race-sensitive rules should be tested at the final write boundary where possible, not only as precheck unit tests.

## 8. Database integrity tests

A reusable DB audit should verify current canonical relations rather than historical assumptions.

Target checks:

```text
PRAGMA foreign_key_check
post like counter drift
comment like counter drift
post comment counter drift
question answer counter drift
subscriber counter drift
comment parent/orphan integrity
legacy reaction row counts/status
important index/query-plan expectations
```

### Clean-install migration test

```text
empty local D1
→ apply all migrations
→ seed development data
→ run integrity audit
```

### Upgrade migration test

When a new persistent migration is added, rehearse:

```text
previous production-shaped schema/data
→ apply only new forward migration(s)
→ run integrity audit
```

Applied migration history is never rewritten to make a test easier.

## 9. Browser E2E purpose

E2E exists to prove real browser wiring across UI, session, API, server state, and navigation.

It should not reproduce every unit/integration edge case.

Critical E2E should answer:

> Can a real signed-in browser complete the core VTH journey and observe canonical state after reload/reconnect?

## 10. Authentication in E2E

Do not make CI depend on live Facebook/Kakao/Zalo provider UI.

Real provider OAuth is unsuitable for deterministic CI because it introduces:

- provider UI changes
- captcha/bot defense
- network/service dependency
- rate limits
- external secrets/account state

Use the test-only seeded social-session mechanism for browser E2E.

Requirements:

- it is enabled only in explicit E2E/test environment
- production fails closed
- only allowlisted deterministic seed identities can be used
- it cannot become arbitrary production impersonation

Real provider login is validated separately through controlled production/manual smoke when provider configuration changes.

## 11. Multi-user E2E

Social, block, DM and Q&A journeys often require two independent users.

Use independent browser contexts, for example:

```text
Alice context
Bob context
```

Do not switch cookies inside one context to simulate simultaneous people.

Prefer a generic deterministic helper such as `loginAsSeedUser` if multiple users are needed. Do not create test-only feature APIs for every normal action.

## 12. Critical journey matrix

### Auth/session

Verify:

- protected experience redirects/behaves correctly signed out
- seeded social account establishes a session
- signed-in shell is visible
- logout removes the effective session
- OAuth callback errors are sanitized from URL/user-visible secret material
- configured social provider buttons render

### Public content

Verify:

```text
create post
→ detail
→ like
→ comment
→ reload
→ canonical like/comment state remains
→ unlike where applicable
```

Existing coverage should be reused rather than duplicated.

### Block

Two-user browser scenario should verify at least the user-observable contract:

```text
Alice blocks Bob
→ Bob public content remains directly readable where policy allows
→ new positive interaction is denied
→ new DM/request is denied
```

Deep final-write race behavior belongs in integration/Worker tests.

### Direct messaging

Browser E2E should verify wiring, not every Bug-level race:

```text
Alice starts/request DM with Bob
→ Bob sees request
→ Bob accepts
→ Alice sends
→ Bob receives through realtime path
→ read/unread UI converges
```

Do not replace realtime validation with polling just to make the test easy.

Bounded dedupe, uncertain-send retry, catch-up ordering and revoke internals remain unit/integration/Worker responsibilities.

### Q&A

```text
Alice asks
→ Bob answers
→ Alice sees answer
→ Alice accepts
→ reload preserves accepted state/count
```

Permission/race edge cases belong primarily in integration tests.

### Marketplace

At minimum:

```text
Alice creates listing
→ listing appears
→ detail opens
→ Bob can browse
```

If save is a primary supported action, verify save + reload persistence.

### Core browse/mobile smoke

At minimum verify key shell accessibility/no catastrophic overflow for:

- Home/Popular
- Profile
- Messages
- Settings

Responsive E2E should catch wiring/layout breakage, not attempt pixel-perfect visual regression unless a dedicated visual system is introduced later.

## 13. E2E flake policy

Do not fix flake with arbitrary sleeps such as repeated fixed `waitForTimeout` calls.

Prefer:

- locator visibility/state expectations
- URL expectations
- response/event waits
- `expect.poll`
- explicit realtime/UI state
- canonical reload checks

An intentional product constraint such as anti-bot minimum dwell is different from arbitrary sleep and may be encapsulated in a named helper.

## 14. Locator policy

Prefer, in order:

1. role
2. label/accessibility name
3. stable test ID where semantic selectors are insufficient
4. CSS implementation detail only as a last resort

Tests should survive harmless DOM refactors.

## 15. Test isolation

Persistent state changes such as:

- block/unblock
- friendship/follow
- message request
- accepted answer
- saved listing

must not leak unpredictably into later tests.

Use the simplest suitable isolation strategy:

- unique deterministic fixture
- unique generated content ID/title
- explicit cleanup
- fresh seeded user/context

A test failure should not poison unrelated later scenarios.

## 16. Test data

Generated content can use a unique suffix such as timestamp/random ID to avoid collisions, but assertions must not depend on wall-clock ordering unless ordering itself is the behavior under test.

Seed data should reflect current canonical schema. Tests must not force production to retain legacy tables/columns solely for fixture convenience.

## 17. Playwright execution policy

Current browser configuration includes multiple desktop/mobile projects, while the production CI gate prioritizes Chromium critical coverage.

It is acceptable to stabilize Chromium first.

Do not require a full five-browser certification suite for every small change unless the product has reached a stage where that cost is justified.

When hardening a critical E2E journey, use a repeated run such as:

```bash
npx playwright test --project=chromium-desktop --repeat-each=3
```

or an equivalent critical subset.

Target:

```text
3 clean first-attempt passes
```

A retry-only pass must be reported as flake, not silently counted as success.

## 18. Build verification

`npm run build` validates the Next.js application build.

`npm run build:worker` validates the deployable OpenNext/Cloudflare Worker bundle and is required for Worker/DO routing confidence.

For realtime/Worker-specific changes, the Worker build is the more relevant deployment artifact and may not be replaced by a plain Next build.

## 19. Production smoke

After deployment, perform low-risk smoke checks on core public surfaces such as:

- `/`
- `/?feed=popular`
- `/login`
- `/questions`
- `/marketplace`
- `/messages` access boundary

Do not use production automation to bypass normal authentication or mutate real user data merely to satisfy a smoke checklist.

Provider-specific manual smoke is warranted after OAuth configuration changes.

## 20. Test ownership by invariant

| Invariant | Primary test layer |
| --- | --- |
| parser/payload shape | unit + API/integration |
| D1 conditional state transition | integration/Worker |
| cursor signature/context | unit + integration |
| block final-write race | integration/Worker |
| DO socket authorization/revoke | Worker |
| browser navigation/form/reload wiring | E2E |
| realtime user-visible DM flow | E2E + Worker |
| migration reproducibility | DB/CI |
| counter drift | DB/CI |
| responsive shell catastrophic regression | E2E |

## 21. External-project testing references

VTH may adapt mature testing practices from projects such as Discourse, Apache Answer, Lemmy, Bluesky, GoToSocial, RED or Clonagram.

Adopt the testing principle, not the donor project's framework stack by default.

Examples:

- Discourse: independent lint/migration quality gates
- Apache Answer: explicit Q&A/service state matrices
- Lemmy: schema/ranking/index evolution tests
- Bluesky/GoToSocial: moderation/block behavior at social-network boundaries
- Clonagram: consumer interaction E2E ideas
- RED: Cloudflare-native Worker/D1 deployment checks

No external test framework should be introduced unless it solves a concrete VTH gap better than the existing Vitest/Cloudflare/Playwright stack.

## 22. Definition of green

A production-quality VTH change is green when the relevant gates are green on the first meaningful attempt and no correctness rule was weakened to obtain the result.

The standing target is:

```text
lint 0 errors
+ typecheck pass
+ unit/Worker pass
+ integration pass
+ critical Chromium E2E pass
+ clean migration/integrity pass when DB is affected
+ Worker build pass
+ appropriate production smoke
```
