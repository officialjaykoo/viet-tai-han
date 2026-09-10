#!/usr/bin/env node

import { randomBytes } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const USER_ID_LENGTH = 16;
const REJECTION_LIMIT = 248;
const DEFAULT_MAPPING_PATH = ".tmp/user-id-rekey-map.json";
const TABLES = [
  ["account", "userId"],
  ["answers", "author_id"],
  ["api_keys", "user_id"],
  ["banned_words", "created_by"],
  ["business_bookings", "requester_id"],
  ["business_verification_requests", "requester_id"],
  ["business_verification_requests", "reviewed_by"],
  ["businesses", "owner_id"],
  ["chat_message_reports", "reporter_id"],
  ["chat_message_reports", "reviewed_by"],
  ["chat_messages", "sender_id"],
  ["chat_requests", "from_user_id"],
  ["chat_requests", "to_user_id"],
  ["chat_room_members", "user_id"],
  ["chat_room_reports", "reporter_id"],
  ["chat_room_reports", "reported_user_id"],
  ["chat_room_reports", "reviewed_by"],
  ["chat_rooms", "created_by"],
  ["comments", "author_id"],
  ["comment_likes", "user_id"],
  ["hidden_posts", "user_id"],
  ["listing_reports", "reporter_id"],
  ["listing_reports", "reviewed_by"],
  ["listing_saves", "user_id"],
  ["listings", "seller_id"],
  ["moderation_actions", "actor_id"],
  ["moderation_actions", "target_user_id"],
  ["notifications", "user_id"],
  ["notifications", "actor_id"],
  ["posts", "author_id"],
  ["post_likes", "user_id"],
  ["push_subscriptions", "user_id"],
  ["questions", "author_id"],
  ["rate_limits", "user_id"],
  ["reports", "reporter_id"],
  ["subreddit_moderators", "user_id"],
  ["subreddits", "created_by"],
  ["subscriptions", "user_id"],
  ["unread_fanout", "user_id"],
  ["user_activity", "user_id"],
  ["user_blocks", "blocker_id"],
  ["user_blocks", "blocked_id"],
  ["user_follows", "follower_id"],
  ["user_follows", "following_id"],
  ["user_friendships", "requester_id"],
  ["user_friendships", "addressee_id"],
  ["user_presence", "user_id"],
  ["user_warnings", "user_id"],
  ["user_warnings", "issued_by"],
  ["username_history", "userId"],
  ["vote_events", "user_id"],
  ["votes", "user_id"],
  ["site_settings", "updated_by"],
];

function parseArgs() {
  const args = new Set(process.argv.slice(2));
  const valueFor = (name, fallback) => {
    const index = process.argv.indexOf(name);
    return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
  };
  if (args.has("--help")) {
    console.log(`Usage: node scripts/rekey-users.mjs [--local|--remote] [--dry-run|--apply] [--mapping PATH]\n\nRemote mutation additionally requires --confirm-production-rekey. Dry-run is the default.`);
    process.exit(0);
  }
  const remote = args.has("--remote");
  const apply = args.has("--apply");
  if (remote && apply && !args.has("--confirm-production-rekey")) {
    throw new Error("Remote mutation requires --confirm-production-rekey");
  }
  return {
    remote,
    apply,
    mappingPath: valueFor("--mapping", DEFAULT_MAPPING_PATH),
  };
}

function escapeSql(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function generateBase62Id() {
  let id = "";
  while (id.length < USER_ID_LENGTH) {
    const bytes = randomBytes(Math.max(16, USER_ID_LENGTH - id.length));
    for (const byte of bytes) {
      if (byte >= REJECTION_LIMIT) continue;
      id += BASE62[byte % BASE62.length];
      if (id.length === USER_ID_LENGTH) break;
    }
  }
  return id;
}

function parseWranglerJson(output) {
  const lines = output.split(/\r?\n/);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (!lines[index].trim().startsWith("[")) continue;
    try {
      return JSON.parse(lines.slice(index).join("\n"));
    } catch {
      // Keep looking in case a log line also starts with '['.
    }
  }
  throw new Error(`Could not parse Wrangler JSON output:\n${output}`);
}

function wranglerArgs(options, extra) {
  return [
    "wrangler",
    "d1",
    "execute",
    "DB",
    options.remote ? "--remote" : "--local",
    ...extra,
    "--json",
  ];
}

function runWrangler(options, extra) {
  const executable = process.platform === "win32" ? "npx.cmd" : "npx";
  const args = wranglerArgs(options, extra);
  const commandIndex = args.indexOf("--command");
  if (commandIndex >= 0 && args[commandIndex + 1]) {
    args[commandIndex + 1] = `"${args[commandIndex + 1].replaceAll('"', '\\"')}"`;
  }
  const output = execFileSync(executable, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    shell: process.platform === "win32",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return parseWranglerJson(output);
}

function query(options, sql) {
  const response = runWrangler(options, ["--command", sql]);
  return response.flatMap((batch) => batch.results ?? []);
}

function executeFile(options, path) {
  return runWrangler(options, ["--file", path]);
}

function readUsers(options) {
  return query(
    options,
    'SELECT id, username, name, role, status FROM "user" ORDER BY id'
  );
}

function tableCounts(options) {
  const uniqueTables = [...new Set(TABLES.map(([table]) => table))];
  const statements = uniqueTables.map(
    (table) => `SELECT ${escapeSql(table)} AS table_name, COUNT(*) AS row_count FROM "${table}"`
  );
  return query(options, statements.join("; "));
}

function buildMapping(options, users, mappingPath) {
  const legacyUsers = users.filter(
    (user) =>
      user.id.length !== USER_ID_LENGTH ||
      /[^0-9A-Za-z]/.test(user.id)
  );
  const legacyIds = legacyUsers.map((user) => user.id).sort();

  if (existsSync(mappingPath)) {
    const saved = JSON.parse(readFileSync(mappingPath, "utf8"));
    if (saved.target !== (options.remote ? "remote" : "local")) {
      throw new Error(`Mapping target mismatch: expected ${options.remote ? "remote" : "local"}`);
    }
    const savedIds = (saved.mappings ?? [])
      .map(({ oldId }) => oldId)
      .sort();
    if (savedIds.join("\n") === legacyIds.join("\n")) return saved;
    if (options.apply) {
      throw new Error("Mapping artifact does not match current legacy users; run a fresh dry-run");
    }
  }

  const existingIds = new Set(users.map((user) => user.id));
  const mappings = legacyUsers.map((user) => {
    let newId;
    do {
      newId = generateBase62Id();
    } while (existingIds.has(newId));
    existingIds.add(newId);
    return { oldId: user.id, newId };
  });
  const saved = {
    generatedAt: new Date().toISOString(),
    target: options.remote ? "remote" : "local",
    usersBefore: users.length,
    mappings,
  };
  mkdirSync(resolve(mappingPath, ".."), { recursive: true });
  writeFileSync(mappingPath, `${JSON.stringify(saved, null, 2)}\n`, "utf8");
  return saved;
}

function buildSql(mapping) {
  const values = mapping.mappings
    .map(({ oldId, newId }) => `(${escapeSql(oldId)}, ${escapeSql(newId)})`)
    .join(",\n  ");
  if (!values) return "-- No legacy user IDs require rekeying.\n";

  const mapTable = `CREATE TABLE IF NOT EXISTS vth_user_id_rekey_map (old_id TEXT PRIMARY KEY, new_id TEXT NOT NULL UNIQUE);\nDELETE FROM vth_user_id_rekey_map;\nINSERT INTO vth_user_id_rekey_map (old_id, new_id) VALUES\n  ${values};`;
  const updates = TABLES.map(
    ([table, column]) =>
      `UPDATE "${table}" SET "${column}" = (SELECT new_id FROM vth_user_id_rekey_map WHERE old_id = "${column}") WHERE "${column}" IN (SELECT old_id FROM vth_user_id_rekey_map);`
  ).join("\n");
  return `PRAGMA foreign_keys = ON;
PRAGMA defer_foreign_keys = ON;
${mapTable}

-- Sessions and transient OAuth state are intentionally invalidated.
DELETE FROM "session";
DELETE FROM "verification";

${updates}

-- Rebuild denormalized identity pair keys after member IDs change.
UPDATE chat_rooms
SET pair_key = (
  SELECT MIN(user_id) || ':' || MAX(user_id)
  FROM chat_room_members
  WHERE room_id = chat_rooms.id
)
WHERE EXISTS (SELECT 1 FROM chat_room_members WHERE room_id = chat_rooms.id);
UPDATE user_friendships
SET pair_key = MIN(requester_id, addressee_id) || ':' || MAX(requester_id, addressee_id);

-- Polymorphic user targets have no foreign key and must be updated explicitly.
UPDATE reports
SET target_id = (SELECT new_id FROM vth_user_id_rekey_map WHERE old_id = reports.target_id)
WHERE target_type = 'user'
  AND target_id IN (SELECT old_id FROM vth_user_id_rekey_map);
UPDATE moderation_actions
SET target_id = (SELECT new_id FROM vth_user_id_rekey_map WHERE old_id = moderation_actions.target_id)
WHERE target_type = 'user'
  AND target_id IN (SELECT old_id FROM vth_user_id_rekey_map);

UPDATE "user"
SET id = (SELECT new_id FROM vth_user_id_rekey_map WHERE old_id = "user".id)
WHERE id IN (SELECT old_id FROM vth_user_id_rekey_map);

DROP TABLE vth_user_id_rekey_map;
`;
}

function printSummary(options, users, mapping, counts) {
  const legacy = users.filter(
    (user) => user.id.length !== USER_ID_LENGTH || /[^0-9A-Za-z]/.test(user.id)
  );
  console.log(JSON.stringify({
    target: options.remote ? "remote" : "local",
    mode: options.apply ? "apply" : "dry-run",
    usersBefore: users.length,
    legacyUsers: legacy.length,
    mappings: mapping.mappings.length,
    mappingPath: mapping.path,
    dependencyCounts: counts,
  }, null, 2));
}

function verify(options, mapping) {
  const users = readUsers(options);
  const invalid = users.filter(
    (user) => user.id.length !== USER_ID_LENGTH || /[^0-9A-Za-z]/.test(user.id)
  );
  const remainingOldIds = users.filter((user) =>
    mapping.mappings.some(({ oldId }) => oldId === user.id)
  );
  const foreignKeys = query(options, "PRAGMA foreign_key_check");
  const result = {
    usersAfter: users.length,
    invalidUserIds: invalid.map((user) => user.id),
    oldIdsRemaining: remainingOldIds.map((user) => user.id),
    foreignKeyViolations: foreignKeys,
  };
  console.log(JSON.stringify(result, null, 2));
  if (
    invalid.length > 0 ||
    remainingOldIds.length > 0 ||
    foreignKeys.length > 0
  ) {
    throw new Error("Post-rekey integrity verification failed");
  }
}

function main() {
  const options = parseArgs();
  const mappingPath = resolve(options.mappingPath);
  const initialUsers = readUsers(options);
  const counts = tableCounts(options);
  const mapping = buildMapping(options, initialUsers, mappingPath);
  mapping.path = mappingPath;
  printSummary(options, initialUsers, mapping, counts);

  const sqlPath = resolve(
    mappingPath.replace(/\.json$/i, ".sql")
  );
  writeFileSync(sqlPath, buildSql(mapping), "utf8");
  console.log(`SQL plan: ${sqlPath}`);

  if (!options.apply) {
    console.log("No database mutation performed.");
    return;
  }
  if (mapping.mappings.length === 0) {
    console.log("No legacy user IDs require rekeying.");
    return;
  }

  const currentUsers = readUsers(options);
  const currentIds = new Set(currentUsers.map((user) => user.id));
  for (const { oldId, newId } of mapping.mappings) {
    if (!currentIds.has(oldId)) {
      throw new Error(`Mapping source user is missing: ${oldId}`);
    }
    if (currentIds.has(newId)) {
      throw new Error(`Mapping target already exists: ${newId}`);
    }
  }
  executeFile(options, sqlPath);
  verify(options, mapping);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
