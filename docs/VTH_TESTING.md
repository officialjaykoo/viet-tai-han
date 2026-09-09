# VTH testing contract

This document defines the Bug12 verification gates for the current Worker deployment.

## Required gates

Run these commands from a clean local D1 state. Keep the order because browser tests and builds exercise the generated Worker artifacts:

```bash
npm run lint
npm run typecheck
npm test
npm run test:integration
npm run test:e2e:chromium
npm run build
npm run build:worker
npm run db:reset:local
npm run db:audit:local
```

`npm run lint` must finish with zero errors and zero warnings. `typecheck`, unit tests, integration tests, both builds, and the local D1 reset must complete successfully.

## Database audit

The default audit is read-only and checks:

- `PRAGMA foreign_key_check`
- drift between `post_likes`, `comment_likes`, `question_answers`, `subscribers` and their canonical counters
- orphaned likes, comments, answers, subscriptions, and chat-room members
- legacy `votes`, `posts.score`, `posts.hot_score`, and `comments.score` row counts

Use the full schema inventory when reviewing DDL:

```bash
node scripts/audit-db-integrity.mjs --local --schema
node scripts/audit-db-integrity.mjs --remote --strict
node scripts/audit-db-integrity.mjs --remote --schema
```

Remote audit commands are read-only. Never rewrite an applied migration or execute a remote destructive command from the audit script. Migration `0043_remove_legacy_feed_indexes.sql` is the forward-only cleanup for the five proven dead feed/tree indexes. Legacy vote and score/hot-score data stays retained when the audit finds rows.

## Browser fixtures and critical journeys

The E2E session endpoint is available only when the explicit test bypass is enabled. It accepts only the seeded `alice` and `bob` accounts; unknown usernames are rejected. Production must not enable the bypass.

Use separate Chromium browser contexts for Alice and Bob. The critical suite covers:

- existing authenticated browse and mobile smoke coverage
- `/?feed=popular` canonical Popular rendering
- Alice asks, Bob answers, Alice accepts the answer
- Alice creates a marketplace listing; Bob browses and opens its detail page
- Alice blocks Bob while public post detail remains readable; Alice like/comment writes are denied, Bob's positive interaction and DM request are denied
- deployed DM request/accept/reply through the rendered WebSocket path

The DM WebSocket journey is skipped by local runs without `PLAYWRIGHT_BASE_URL` because the local Next dev server does not provide the `CHAT_ROOM` Durable Object binding. Run it only in a dedicated deployed test environment with the explicit E2E test configuration; production remains fail-closed.

No new test may use arbitrary sleeps. Use locator assertions, `expect.poll`, load-state assertions, or the existing intentional `warmBotGuard` dwell. Playwright remains single-worker with one CI retry, as configured in `playwright.config.ts`.

Run the critical subset three times before release:

```bash
npx playwright test --project=chromium-desktop --repeat-each=3 \
  tests/e2e/critical-flows.spec.ts -g "popular|Alice asks|Alice creates|blocking"
```

A flaky result is a release failure until reproduced, explained, and fixed. Record the exact pass/fail/skip counts and any environmental warnings; do not hide them with test retries or rule suppression.

## Release smoke

After deployment, smoke the deployed URL in Chromium without mutating production data:

- `/`
- `/?feed=popular`
- `/login`
- `/questions`
- `/marketplace`
- `/messages`

Then run the read-only remote audit again. If a deployed test environment is configured, run the DM WebSocket journey with `PLAYWRIGHT_BASE_URL`; otherwise record that the Durable Object journey was not run rather than weakening the production gate.
