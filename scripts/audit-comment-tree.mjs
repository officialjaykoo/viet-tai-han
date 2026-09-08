#!/usr/bin/env node

import { execFileSync } from "node:child_process";

function parseArgs() {
  const args = new Set(process.argv.slice(2));
  if (args.has("--help")) {
    console.log(
      "Usage: node scripts/audit-comment-tree.mjs [--local|--remote] [--strict]"
    );
    process.exit(0);
  }
  return {
    remote: args.has("--remote"),
    strict: args.has("--strict"),
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

const options = parseArgs();
const rows = query(
  options,
  `SELECT 'orphan_comments' AS check_name, COUNT(*) AS count
     FROM comments c
     LEFT JOIN comments p ON p.id = c.parent_id
    WHERE c.parent_id IS NOT NULL AND p.id IS NULL
   UNION ALL
   SELECT 'deleted_or_removed_parent_with_active_child' AS check_name,
          COUNT(*) AS count
     FROM comments child
     INNER JOIN comments parent ON parent.id = child.parent_id
    WHERE (parent.is_deleted = 1 OR parent.is_removed = 1)
      AND child.is_deleted = 0
      AND child.is_removed = 0
   UNION ALL
   SELECT 'comments_depth_over_2' AS check_name, COUNT(*) AS count
     FROM comments
    WHERE depth > 2
   UNION ALL
   SELECT 'comments_parent_fk_cascade' AS check_name,
          CASE WHEN lower(sql) LIKE '%parent_id%on delete cascade%'
               THEN 1 ELSE 0 END AS count
     FROM sqlite_master
    WHERE type = 'table' AND name = 'comments'`
);

const counts = Object.fromEntries(
  rows.map((row) => [row.check_name, Number(row.count ?? 0)])
);
console.log(
  JSON.stringify(
    {
      target: options.remote ? "remote" : "local",
      counts,
      note: "Depth over 2 is legacy data and is not repaired by this migration.",
    },
    null,
    2
  )
);

if (
  options.strict &&
  (counts.orphan_comments > 0 ||
    counts.deleted_or_removed_parent_with_active_child > 0)
) {
  process.exitCode = 2;
}
