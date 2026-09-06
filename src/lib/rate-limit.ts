import { getDb, getEnv } from "@/lib/db";
import { syncAchievementsForEvent } from "@/lib/achievements";
import { AuthError } from "@/lib/session";
import { getSiteSetting } from "@/lib/settings";
import { createPublicId } from "@/lib/id";
import { appendReputationLedgerEntry } from "@/lib/monetization";

type RateLimitBindingName =
  | "EDGE_IP_RATE_LIMITER"
  | "TUNNEL_IP_RATE_LIMITER"
  | "EXPENSIVE_IP_RATE_LIMITER";

/**
 * Cheap colo-local Workers Rate Limit binding (no D1).
 * Returns null when the binding is unavailable (e.g. next-dev without proxy).
 */
async function bindingLimit(
  name: RateLimitBindingName,
  key: string
): Promise<boolean | null> {
  try {
    const env = (await getEnv()) as CloudflareEnv &
      Partial<Record<RateLimitBindingName, RateLimit>>;
    const limiter = env[name];
    if (!limiter?.limit) return null;
    const { success } = await limiter.limit({ key });
    return success;
  } catch {
    return null;
  }
}

/**
 * Sliding-window rate limit keyed by arbitrary subject (user:… / ip:…).
 * Prefers Workers Rate Limit bindings for IP keys (no D1 cost under flood).
 * Falls back to D1 for user-scoped / accurate product limits.
 */
export async function checkSubjectRateLimit(options: {
  subject: string;
  action: string;
  limit: number;
  windowSeconds: number;
}): Promise<{ allowed: boolean; remaining: number }> {
  if (options.limit <= 0) {
    return { allowed: false, remaining: 0 };
  }

  // IP flood checks: use edge binding when window ≈ 60s (binding periods are 10|60).
  if (
    options.subject.startsWith("ip:") &&
    (options.windowSeconds === 60 || options.windowSeconds === 10)
  ) {
    const ip = options.subject.slice(3);
    const bindingKey = `${options.action}:${ip}`;
    const which: RateLimitBindingName =
      options.action.startsWith("expensive") ||
      options.action.includes("search") ||
      options.action.includes("recommend") ||
      options.action.includes("challenge") ||
      options.action.includes("bot-check")
        ? "EXPENSIVE_IP_RATE_LIMITER"
        : options.action.startsWith("api:") || options.action.startsWith("read:")
          ? "TUNNEL_IP_RATE_LIMITER"
          : "EDGE_IP_RATE_LIMITER";

    const bound = await bindingLimit(which, bindingKey);
    if (bound === false) {
      return { allowed: false, remaining: 0 };
    }
    // If binding allows (or missing), still record soft D1 for user-facing accuracy
    // only when limit is tight — skip D1 for high IP flood ceilings to save cost.
    if (bound === true && options.limit >= 30) {
      return { allowed: true, remaining: options.limit };
    }
  }

  const db = await getDb();
  const windowStart = new Date(
    Date.now() - options.windowSeconds * 1000
  )
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");

  await db
    .prepare(
      `DELETE FROM security_rate_events
       WHERE subject = ? AND action = ? AND created_at < ?`
    )
    .bind(options.subject, options.action, windowStart)
    .run();

  const row = await db
    .prepare(
      `SELECT COUNT(*) AS c FROM security_rate_events
       WHERE subject = ? AND action = ? AND created_at >= ?`
    )
    .bind(options.subject, options.action, windowStart)
    .first<{ c: number }>();

  const count = Number(row?.c ?? 0);
  if (count >= options.limit) {
    return { allowed: false, remaining: 0 };
  }

  await db
    .prepare(
      `INSERT INTO security_rate_events (id, subject, action) VALUES (?, ?, ?)`
    )
    .bind(createPublicId(), options.subject, options.action)
    .run();

  return { allowed: true, remaining: Math.max(0, options.limit - count - 1) };
}

/** @deprecated Prefer checkSubjectRateLimit — kept for older call sites. */
export async function checkRateLimit(options: {
  userId: string;
  action: string;
  limit: number;
  windowSeconds: number;
}): Promise<{ allowed: boolean; remaining: number }> {
  return checkSubjectRateLimit({
    subject: `user:${options.userId}`,
    action: options.action,
    limit: options.limit,
    windowSeconds: options.windowSeconds,
  });
}

async function settingInt(key: string, fallback: number): Promise<number> {
  const raw = await getSiteSetting(key, String(fallback));
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

type CreateKind =
  | "post"
  | "comment"
  | "vote"
  | "dm_request"
  | "dm_message"
  | "dm_report"
  | "question"
  | "answer"
  | "listing"
  | "business"
  | "business_verification"
  | "booking";

const CREATE_DEFAULTS: Record<
  CreateKind,
  { hourKey: string; hour: number; burstKey: string; burst: number }
> = {
  post: {
    hourKey: "max_posts_per_hour",
    hour: 5,
    burstKey: "max_posts_burst_per_min",
    burst: 2,
  },
  comment: {
    hourKey: "max_comments_per_hour",
    hour: 15,
    burstKey: "max_comments_burst_per_min",
    burst: 4,
  },
  vote: {
    hourKey: "max_votes_per_hour",
    hour: 60,
    burstKey: "max_votes_burst_per_min",
    burst: 12,
  },
  dm_request: {
    hourKey: "max_dm_requests_per_hour",
    hour: 3,
    burstKey: "max_dm_requests_burst_per_min",
    burst: 1,
  },
  dm_message: {
    hourKey: "max_dm_messages_per_hour",
    hour: 30,
    burstKey: "max_dm_messages_burst_per_min",
    burst: 8,
  },
  dm_report: {
    hourKey: "max_dm_reports_per_hour",
    hour: 20,
    burstKey: "max_dm_reports_burst_per_min",
    burst: 5,
  },
  question: {
    hourKey: "max_questions_per_hour",
    hour: 5,
    burstKey: "max_questions_burst_per_min",
    burst: 2,
  },
  answer: {
    hourKey: "max_answers_per_hour",
    hour: 30,
    burstKey: "max_answers_burst_per_min",
    burst: 6,
  },
  listing: {
    hourKey: "max_listings_per_hour",
    hour: 10,
    burstKey: "max_listings_burst_per_min",
    burst: 3,
  },
  business: {
    hourKey: "max_businesses_per_hour",
    hour: 3,
    burstKey: "max_businesses_burst_per_min",
    burst: 1,
  },
  business_verification: {
    hourKey: "max_business_verification_per_hour",
    hour: 3,
    burstKey: "max_business_verification_burst_per_min",
    burst: 1,
  },
  booking: {
    hourKey: "max_booking_requests_per_hour",
    hour: 10,
    burstKey: "max_booking_requests_burst_per_min",
    burst: 3,
  },
};

export async function enforceCreateRateLimit(
  userId: string,
  kind: CreateKind
) {
  const cfg = CREATE_DEFAULTS[kind];
  const hourLimit = await settingInt(cfg.hourKey, cfg.hour);
  const burstLimit = await settingInt(cfg.burstKey, cfg.burst);
  const subject = `user:${userId}`;

  const burst = await checkSubjectRateLimit({
    subject,
    action: `${kind}:burst`,
    limit: burstLimit,
    windowSeconds: 60,
  });
  if (!burst.allowed) {
    throw new AuthError("You're doing that too fast. Slow down.", 429);
  }

  const hour = await checkSubjectRateLimit({
    subject,
    action: kind,
    limit: hourLimit,
    windowSeconds: 3600,
  });
  if (!hour.allowed) {
    throw new AuthError("You're doing that too often. Try again later.", 429);
  }
}

/** Global mutating API caps (per user + per IP). */
export async function enforceApiMutateRateLimit(input: {
  userId?: string | null;
  ip: string;
}) {
  const perMin = await settingInt("max_api_mutate_per_min", 30);
  const perHour = await settingInt("max_api_mutate_per_hour", 120);
  const ipMin = await settingInt("max_api_mutate_ip_per_min", 40);
  const ipHour = await settingInt("max_api_mutate_ip_per_hour", 180);

  const ipSubject = `ip:${input.ip}`;
  for (const check of [
    { subject: ipSubject, action: "api:burst", limit: ipMin, window: 60 },
    { subject: ipSubject, action: "api:hour", limit: ipHour, window: 3600 },
  ]) {
    const result = await checkSubjectRateLimit({
      subject: check.subject,
      action: check.action,
      limit: check.limit,
      windowSeconds: check.window,
    });
    if (!result.allowed) {
      throw new AuthError("Too many requests from this network.", 429);
    }
  }

  if (input.userId) {
    const userSubject = `user:${input.userId}`;
    for (const check of [
      { action: "api:burst", limit: perMin, window: 60 },
      { action: "api:hour", limit: perHour, window: 3600 },
    ]) {
      const result = await checkSubjectRateLimit({
        subject: userSubject,
        action: check.action,
        limit: check.limit,
        windowSeconds: check.window,
      });
      if (!result.allowed) {
        throw new AuthError("Too many API requests. Try again later.", 429);
      }
    }
  }
}

/** Signed GET/HEAD via /i/api — stop feed/search scrapers after ATK mint. */
export async function enforceApiReadRateLimit(input: { ip: string }) {
  const ipMin = await settingInt("max_api_read_ip_per_min", 90);
  const result = await checkSubjectRateLimit({
    subject: `ip:${input.ip}`,
    action: "read:burst",
    limit: ipMin,
    windowSeconds: 60,
  });
  if (!result.allowed) {
    throw new AuthError("Too many requests from this network.", 429);
  }
}

/** AI / search / challenge — keep Workers AI + Vectorize bills bounded. */
export async function enforceExpensiveIpRateLimit(
  ip: string,
  action = "expensive:burst"
) {
  const limit = await settingInt("max_expensive_ip_per_min", 20);
  const result = await checkSubjectRateLimit({
    subject: `ip:${ip}`,
    action,
    limit,
    windowSeconds: 60,
  });
  if (!result.allowed) {
    throw new AuthError("Too many requests from this network.", 429);
  }
}

export async function bumpUserActivity(
  userId: string,
  subredditId: string,
  delta = 1
) {
  const db = await getDb();
  await db
    .prepare(
      `INSERT INTO user_activity (user_id, subreddit_id, score, last_at)
       VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(user_id, subreddit_id) DO UPDATE SET
         score = score + excluded.score,
         last_at = datetime('now')`
    )
    .bind(userId, subredditId, delta)
    .run();
}

export async function adjustAuthorKarma(
  authorId: string,
  kind: "post" | "comment",
  delta: number
) {
  if (delta === 0) return;
  await appendReputationLedgerEntry({
    userId: authorId,
    eventType: "vote_received",
    amount: delta,
    kind,
    sourceType: "vote",
  });

  syncAchievementsForEvent(authorId, "karma_changed");
}
