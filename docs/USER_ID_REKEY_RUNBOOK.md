# VTH user ID rekey runbook

This runbook changes canonical Better Auth `user.id` values. It must be executed during a maintenance window and only after a verified D1 backup.

## Preconditions

- Deploy the code containing `generateUserId()` and `scripts/rekey-users.mjs`.
- Stop application writes or enable the maintenance gate.
- Confirm the operator has a fresh backup and the mapping artifact is stored securely.
- Do not delete `account` rows. OAuth provider linkage is preserved by updating `account.userId`.

## Production backup

Use a dated output path and retain it outside the repository:

```bash
npx wrangler d1 export DB --remote --output .tmp/vth-db-backup-YYYYMMDD-HHmm.sql
```

Record the user count and current dependency counts before mutation:

```bash
npm run id:rekey:remote:dry-run -- --mapping .tmp/vth-user-id-rekey-map.json
```

The dry run is read-only. It writes the old-to-new mapping and SQL plan under `.tmp/`.

## Production rekey

Review the mapping and SQL plan, then run the explicitly gated command:

```bash
npm run id:rekey:remote:apply -- \
  --mapping .tmp/vth-user-id-rekey-map.json \
  --confirm-production-rekey
```

The tool rejects remote mutation without `--confirm-production-rekey`. It updates all known user foreign keys, including `post_likes` and `comment_likes`, polymorphic user targets in `reports` and `moderation_actions`, denormalized friendship/DM pair keys, and `site_settings.updated_by`. It clears `session` and `verification`; `account` rows remain.

## Post-checks

```bash
npx wrangler d1 execute DB --remote --command "SELECT COUNT(*) AS users, SUM(CASE WHEN length(id)=16 AND id NOT GLOB '*[^0-9A-Za-z]*' THEN 1 ELSE 0 END) AS canonical_users FROM \"user\"; SELECT COUNT(*) AS sessions FROM session; SELECT COUNT(*) AS transient_auth_state FROM verification; PRAGMA foreign_key_check;" --json
```

Expected results:

- `users = canonical_users`
- `sessions = 0`
- `transient_auth_state = 0`
- `PRAGMA foreign_key_check` returns zero rows
- No old IDs remain in the mapping artifact
- `account` count is unchanged and every `account.userId` points to a current user
- usernames, roles, status, content ownership, relationships, and OAuth provider linkage are unchanged

## External stores

- Durable Object socket tags are ephemeral and are recreated from current IDs.
- R2 media keys do not contain user IDs.
- Workers AI에는 사용자 ID 기반 영구 상태를 저장하지 않는다. 일반 배포 후 번역 작업은 D1 상태에 따라 재시도된다.
- Cache entries and serialized edge payloads should be invalidated by the normal deploy/isolate lifecycle; do not copy old session cookies forward.

## Local verification

```bash
npm run db:reset:local
npm run id:rekey:local
npm run id:rekey:local:apply
```

`id:rekey:local:apply` verifies user ID shape, old-ID absence, and `PRAGMA foreign_key_check` automatically. The mapping artifact is local-only and ignored by Git.
