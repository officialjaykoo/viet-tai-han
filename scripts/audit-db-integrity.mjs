#!/usr/bin/env node

import { execFileSync } from "node:child_process";

function parseArgs() {
  const args = new Set(process.argv.slice(2));
  if (args.has("--help")) {
    console.log(
      "Usage: node scripts/audit-db-integrity.mjs [--local|--remote] [--strict] [--schema]"
    );
    process.exit(0);
  }
  return {
    remote: args.has("--remote"),
    strict: args.has("--strict"),
    schema: args.has("--schema"),
  };
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

function query(options, sql) {
  const executable = process.platform === "win32" ? "npx.cmd" : "npx";
  const args = [
    "wrangler",
    "d1",
    "execute",
    "DB",
    options.remote ? "--remote" : "--local",
    "--command",
    sql.replace(/\s+/g, " ").trim(),
    "--json",
  ];
  const commandIndex = args.indexOf("--command");
  args[commandIndex + 1] = `"${args[commandIndex + 1].replaceAll('"', '\\"')}"`;
  const output = execFileSync(executable, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
    shell: process.platform === "win32",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return parseWranglerJson(output).flatMap((batch) => batch.results ?? []);
}

function countMap(rows) {
  return Object.fromEntries(
    rows.map((row) => [row.check_name, Number(row.count ?? 0)])
  );
}

const options = parseArgs();
const tableRows = query(
  options,
  "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'"
);
const tables = new Set(tableRows.map((row) => String(row.name)));
const columns = new Map();
for (const table of ["posts", "comments", "questions", "subreddits"]) {
  if (!tables.has(table)) continue;
  const rows = query(options, `PRAGMA table_info('${table}')`);
  columns.set(table, new Set(rows.map((row) => String(row.name))));
}

let schema;
if (options.schema) {
  const schemaTables = [...tables].sort().map((table) => ({
    name: table,
    definition:
      query(
        options,
        `SELECT sql FROM sqlite_master WHERE type = 'table' AND name = '${table.replaceAll("'", "''")}'`
      )[0]?.sql ?? null,
    columns: query(options, `PRAGMA table_info('${table}')`),
    foreignKeys: query(options, `PRAGMA foreign_key_list('${table}')`),
  }));
  const schemaIndexes = query(
    options,
    "SELECT name, tbl_name, sql FROM sqlite_master WHERE type = 'index' AND sql IS NOT NULL ORDER BY name"
  );
  schema = { tables: schemaTables, indexes: schemaIndexes };
}

const foreignKeyRows = query(options, "PRAGMA foreign_key_check");
const counterRows = query(
  options,
  `SELECT 'post_like_drift' AS check_name, COUNT(*) AS count
     FROM posts p
    WHERE p.like_count != (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id)
   UNION ALL
   SELECT 'comment_like_drift' AS check_name, COUNT(*) AS count
     FROM comments c
    WHERE c.like_count != (SELECT COUNT(*) FROM comment_likes cl WHERE cl.comment_id = c.id)
   UNION ALL
   SELECT 'post_comment_drift' AS check_name, COUNT(*) AS count
     FROM posts p
    WHERE p.comment_count != (
      SELECT COUNT(*) FROM comments c
       WHERE c.post_id = p.id
         AND c.is_deleted = 0 AND c.is_removed = 0 AND c.is_shadow_hidden = 0
    )
   UNION ALL
   SELECT 'question_answer_drift' AS check_name, COUNT(*) AS count
     FROM questions q
    WHERE q.answer_count != (
      SELECT COUNT(*) FROM answers a
       WHERE a.question_id = q.id
         AND a.is_removed = 0 AND a.is_shadow_hidden = 0
    )
   UNION ALL
   SELECT 'subscriber_drift' AS check_name, COUNT(*) AS count
     FROM subreddits s
    WHERE s.subscriber_count != (
      SELECT COUNT(*) FROM subscriptions sub
       WHERE sub.subreddit_id = s.id
    )`
);
const orphanRows = query(
  options,
  `SELECT 'comments_parent' AS check_name, COUNT(*) AS count
     FROM comments c
     LEFT JOIN comments p ON p.id = c.parent_id
    WHERE c.parent_id IS NOT NULL AND p.id IS NULL
   UNION ALL
   SELECT 'post_likes_post' AS check_name, COUNT(*) AS count
     FROM post_likes pl
     LEFT JOIN posts p ON p.id = pl.post_id
    WHERE p.id IS NULL
   UNION ALL
   SELECT 'comment_likes_comment' AS check_name, COUNT(*) AS count
     FROM comment_likes cl
     LEFT JOIN comments c ON c.id = cl.comment_id
    WHERE c.id IS NULL
   UNION ALL
   SELECT 'subscriptions_user' AS check_name, COUNT(*) AS count
     FROM subscriptions s
     LEFT JOIN "user" u ON u.id = s.user_id
    WHERE u.id IS NULL
   UNION ALL
   SELECT 'subscriptions_subreddit' AS check_name, COUNT(*) AS count
     FROM subscriptions s
     LEFT JOIN subreddits sr ON sr.id = s.subreddit_id
    WHERE sr.id IS NULL`
);

const legacyRows = {};
if (tables.has("votes")) {
  legacyRows.votes = Number(
    query(options, "SELECT COUNT(*) AS count FROM votes")[0]?.count ?? 0
  );
}
for (const [table, column] of [
  ["posts", "score"],
  ["posts", "hot_score"],
  ["comments", "score"],
]) {
  if (!columns.get(table)?.has(column)) continue;
  legacyRows[`${table}.${column}_nonzero`] = Number(
    query(
      options,
      `SELECT COUNT(*) AS count FROM ${table} WHERE ${column} != 0`
    )[0]?.count ?? 0
  );
}

const counts = {
  counterDrift: countMap(counterRows),
  orphans: countMap(orphanRows),
  legacyRows,
};
const hasFailures =
  foreignKeyRows.length > 0 ||
  Object.values(counts.counterDrift).some((count) => count > 0) ||
  Object.values(counts.orphans).some((count) => count > 0);

console.log(
  JSON.stringify(
    {
      target: options.remote ? "remote" : "local",
      readOnly: true,
      foreignKeyCheck: {
        count: foreignKeyRows.length,
        rows: foreignKeyRows,
      },
      ...counts,
      ...(schema ? { schema } : {}),
      note: "Legacy score and vote rows are reported, never rewritten or deleted.",
    },
    null,
    2
  )
);

if (options.strict && hasFailures) process.exitCode = 2;
