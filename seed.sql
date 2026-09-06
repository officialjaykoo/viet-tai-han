-- Local seed: richer dataset for feed / sort / pagination testing.
-- Post/comment IDs are opaque YouTube-style tokens (not sequential).
-- Re-run safely: clears prior seed rows keyed by user_% / vote_% / known IDs.

DELETE FROM votes WHERE id LIKE 'vote_%';
DELETE FROM comments WHERE author_id LIKE 'user_%';
DELETE FROM posts WHERE author_id LIKE 'user_%';
DELETE FROM subscriptions WHERE user_id LIKE 'user_%';
DELETE FROM subreddit_moderators WHERE user_id LIKE 'user_%';
DELETE FROM user_activity WHERE user_id LIKE 'user_%';
DELETE FROM user_follows WHERE follower_id LIKE 'user_%' OR following_id LIKE 'user_%';
DELETE FROM user_achievements WHERE user_id LIKE 'user_%';
DELETE FROM ad_impressions WHERE campaign_id LIKE 'adcamp_%';
DELETE FROM ad_clicks WHERE campaign_id LIKE 'adcamp_%';
DELETE FROM ad_campaigns WHERE id LIKE 'adcamp_%';
DELETE FROM banned_words WHERE id LIKE 'bw_%';
DELETE FROM business_bookings
WHERE requester_id LIKE 'user_%'
   OR business_id IN (SELECT id FROM businesses WHERE owner_id LIKE 'user_%');
DELETE FROM business_verification_requests
WHERE requester_id LIKE 'user_%'
   OR business_id IN (SELECT id FROM businesses WHERE owner_id LIKE 'user_%');
DELETE FROM business_services
WHERE business_id IN (SELECT id FROM businesses WHERE owner_id LIKE 'user_%');
DELETE FROM businesses WHERE owner_id LIKE 'user_%';
DELETE FROM account WHERE userId LIKE 'user_%';
DELETE FROM subreddits WHERE id LIKE 'sub_%';
DELETE FROM "user" WHERE id LIKE 'user_%';

INSERT OR IGNORE INTO "user" (
  id, name, email, emailVerified, username,
  karma, postKarma, commentKarma, role, status, bio, isNsfw, preferredLanguage, createdAt
) VALUES
  ('user_alice', 'Alice', 'alice@example.local', 1, 'alice',
   0, 0, 0, 'admin', 'active', 'Building Việt tại Hàn on Cloudflare.', 0, 'vi', datetime('now', '-400 days')),
  ('user_bob', 'Bob', 'bob@example.local', 1, 'bob',
   0, 0, 0, 'user', 'active', 'Virtuoso enjoyer.', 0, 'vi', datetime('now', '-30 days')),
  ('user_carol', 'Carol', 'carol@example.local', 1, 'carol',
   0, 0, 0, 'moderator', 'active', 'Mods webdev.', 0, 'vi', datetime('now', '-120 days')),
  ('user_dave', 'Dave', 'dave@example.local', 1, 'dave',
   0, 0, 0, 'user', 'active', 'Edge runtime tinkerer.', 1, 'vi', datetime('now', '-14 days')),
  ('user_erin', 'Erin', 'erin@example.local', 1, 'erin',
   0, 0, 0, 'user', 'active', 'Writes about DX and tooling.', 0, 'vi', datetime('now', '-220 days')),
  ('user_frank', 'Frank', 'frank@example.local', 1, 'frank',
   0, 0, 0, 'user', 'active', NULL, 0, 'vi', datetime('now', '-3 days')),
  ('user_grace', 'Grace', 'grace@example.local', 1, 'grace',
   0, 0, 0, 'user', 'active', 'Comment thread archaeologist.', 0, 'vi', datetime('now', '-90 days')),
  ('user_henry', 'Henry', 'henry@example.local', 1, 'henry',
   0, 0, 0, 'user', 'active', 'Mostly shares links.', 0, 'vi', datetime('now', '-60 days')),
  ('user_ivy', 'Ivy', 'ivy@example.local', 1, 'ivy',
   0, 0, 0, 'user', 'active', 'Viết bằng tiếng Việt và tiếng Hàn.', 0, 'ko', datetime('now', '-45 days')),
  ('user_jake', 'Jake', 'jake@example.local', 1, 'jake',
   0, 0, 0, 'user', 'active', 'Gaming + CSS.', 0, 'vi', datetime('now', '-18 days')),
  ('user_kate', 'Kate', 'kate@example.local', 1, 'kate',
   0, 0, 0, 'user', 'active', NULL, 0, 'vi', datetime('now', '-7 days')),
  ('user_leo', 'Leo', 'leo@example.local', 1, 'leo',
   0, 0, 0, 'user', 'active', 'Photography hobbyist.', 0, 'vi', datetime('now', '-150 days')),
  ('user_mira', 'Mira', 'mira@example.local', 1, 'mira',
   0, 0, 0, 'user', 'active', 'Ask me anything about Workers.', 0, 'vi', datetime('now', '-80 days')),
  ('user_nate', 'Nate', 'nate@example.local', 1, 'nate',
   0, 0, 0, 'user', 'active', 'New here — testing the feed.', 0, 'vi', datetime('now', '-1 day'));

INSERT OR IGNORE INTO subreddits (id, name, title, description, created_by, subscriber_count) VALUES
  ('sub_cloudflare', 'cloudflare', 'Cloudflare', 'Workers, D1, Durable Objects, and the edge.', 'user_alice', 0),
  ('sub_programming', 'programming', 'Programming', 'Software engineering and CS discussion.', 'user_bob', 0),
  ('sub_webdev', 'webdev', 'Web Development', 'Front-end, back-end, and everything in between.', 'user_carol', 0),
  ('sub_gaming', 'gaming', 'Gaming', 'PC, console, indie, and everything in between.', 'user_jake', 0),
  ('sub_photography', 'photography', 'Photography', 'Cameras, light, and the decisive moment.', 'user_leo', 0),
  ('sub_askred', 'askvth', 'Hỏi Việt tại Hàn', 'Đặt câu hỏi và chia sẻ với cộng đồng.', 'user_mira', 0),
  ('sub_technology', 'technology', 'Technology', 'Gadgets, platforms, and industry news.', 'user_erin', 0);


-- Posts (~48): mixed ages, scores, link posts, NSFW, locked — enough for 2+ pages
INSERT OR IGNORE INTO posts (
  id, subreddit_id, author_id, title, body, url, is_nsfw, is_locked,
  upvotes, downvotes, score, comment_count, created_at
) VALUES
  ('k7Qm2xR9pLw', 'sub_cloudflare', 'user_alice',
   'Building a community platform for Việt tại Hàn on Cloudflare',
   'D1 for persistence, Durable Objects for vote buffering, R2 for media, OpenNext for Next.js on Workers.',
   NULL, 0, 0, 0, 0, 0, 0, datetime('now', '-2 hours')),
  ('n3Vt8cY1hKs', 'sub_programming', 'user_bob',
   'Virtualized infinite scroll without jank',
   'react-virtuoso has been solid for long feeds and nested comment threads.',
   NULL, 0, 0, 0, 0, 0, 0, datetime('now', '-5 hours')),
  ('b6Hj4mN0qXd', 'sub_webdev', 'user_carol',
   'Shadcn + Tailwind on the edge',
   'Neutral Luma preset, Lucide icons, and a community-first feed layout.',
   NULL, 0, 0, 0, 0, 0, 0, datetime('now', '-8 hours')),
  ('z2Fp5wL8rTc', 'sub_cloudflare', 'user_dave',
   'Batching writes from Durable Objects to D1',
   'Alarms + in-memory counters keep upvote spikes race-free.',
   NULL, 0, 0, 0, 0, 0, 0, datetime('now', '-1 day')),
  ('q1Aa2Bb3Cc4', 'sub_askred', 'user_mira',
   'What is your underrated Cloudflare product?',
   'I keep rediscovering Queues. What else should I be using?',
   NULL, 0, 0, 0, 0, 0, 0, datetime('now', '-25 minutes')),
  ('d5Ee6Ff7Gg8', 'sub_gaming', 'user_jake',
   'Finished a cozy farming sim at 2am again',
   'No spoilers — just recommend your favorite low-stakes games.',
   NULL, 0, 0, 0, 0, 0, 0, datetime('now', '-40 minutes')),
  ('h9Hh0Ii1Jj2', 'sub_webdev', 'user_grace',
   'CSS anchor positioning is finally usable',
   'Popovers without JS positioning libraries feels like cheating.',
   NULL, 0, 0, 0, 0, 0, 0, datetime('now', '-55 minutes')),
  ('k3Kk4Ll5Mm6', 'sub_technology', 'user_erin',
   'Browser vendors quietly shipping useful APIs',
   'View Transitions, Popover, and Scheduled Tasks deserve more hype.',
   NULL, 0, 0, 0, 0, 0, 0, datetime('now', '-70 minutes')),
  ('n7Nn8Oo9Pp0', 'sub_cloudflare', 'user_frank',
   'First Worker deployed — what should I learn next?',
   'I got hello-world working. D1? Durable Objects? Hyperdrive?',
   NULL, 0, 0, 0, 0, 0, 0, datetime('now', '-90 minutes')),
  ('q1Qq2Rr3Ss4', 'sub_photography', 'user_leo',
   'Golden hour on a rainy sidewalk',
   'Reflections made the street look twice as long. Shot on a 35mm.',
   NULL, 0, 0, 0, 0, 0, 0, datetime('now', '-130 minutes')),
  ('t5Tt6Uu7Vv8', 'sub_programming', 'user_erin',
   'Typed SQL without an ORM',
   'Kysely on D1 has been enough for this project. Curious what you use.',
   NULL, 0, 0, 0, 0, 0, 0, datetime('now', '-3 hours')),
  ('w9Ww0Xx1Yy2', 'sub_webdev', 'user_kate',
   'Dark mode that does not look like a purple dungeon',
   'Started from OKLCH tokens and resisted the glow tax.',
   NULL, 0, 0, 0, 0, 0, 0, datetime('now', '-4 hours')),
  ('z3Zz4Aa5Bb6', 'sub_askred', 'user_nate',
   'How do you discover communities on a new community platform?',
   'Search? Popular? Asking friends? Genuinely curious.',
   NULL, 0, 0, 0, 0, 0, 0, datetime('now', '-6 hours')),
  ('c7Cc8Dd9Ee0', 'sub_gaming', 'user_bob',
   'Controller support on the web is underrated',
   'Gamepad API + a small deadzone helper goes a long way.',
   NULL, 0, 0, 0, 0, 0, 0, datetime('now', '-7 hours')),
  ('f1Ff2Gg3Hh4', 'sub_cloudflare', 'user_mira',
   'Wrangler local D1 + migrations workflow tips',
   'db:reset:local has saved me more than once. Share your scripts.',
   NULL, 0, 0, 0, 0, 0, 0, datetime('now', '-9 hours')),
  ('i5Ii6Jj7Kk8', 'sub_technology', 'user_henry',
   'Interesting read on edge caching strategies',
   NULL, 'https://blog.cloudflare.com/', 0, 0, 0, 0, 0, 0, datetime('now', '-10 hours')),
  ('l9Ll0Mm1Nn2', 'sub_programming', 'user_grace',
   'When is a comment thread too nested?',
   'We cap depth at 12. Feels generous until someone actually uses it.',
   NULL, 0, 0, 0, 0, 0, 0, datetime('now', '-11 hours')),
  ('o3Oo4Pp5Qq6', 'sub_webdev', 'user_alice',
   'Server Components and forms that still feel snappy',
   'Transitions + optimistic votes made the feed feel alive.',
   NULL, 0, 0, 0, 0, 0, 0, datetime('now', '-12 hours')),
  ('r7Rr8Ss9Tt0', 'sub_photography', 'user_leo',
   'ISO 6400 grain can be a feature',
   'Stopped chasing clean shadows and leaned into texture.',
   NULL, 0, 0, 0, 0, 0, 0, datetime('now', '-14 hours')),
  ('u1Uu2Vv3Ww4', 'sub_askred', 'user_ivy',
   'Какой у вас любимый крайний кейс на Workers?',
   'Интересны странные прод-истории: лимиты, изоляты, неожиданные победы.',
   NULL, 0, 0, 0, 0, 0, 0, datetime('now', '-15 hours')),
  ('x5Xx6Yy7Zz8', 'sub_cloudflare', 'user_carol',
   'Turnstile vs homemade bot traps',
   'We layered honeypots + attestation first. Curious how far that goes.',
   NULL, 0, 0, 0, 0, 0, 0, datetime('now', '-18 hours')),
  ('a9Aa0Bb1Cc2', 'sub_programming', 'user_dave',
   'Protobuf envelopes for mutating APIs',
   'Not security theater alone — just raising the floor for scrapers.',
   NULL, 0, 0, 0, 0, 0, 0, datetime('now', '-20 hours')),
  ('d3Dd4Ee5Ff6', 'sub_gaming', 'user_jake',
   'Best indie soundtrack of the year?',
   'Looking for albums I can loop while coding.',
   NULL, 0, 0, 0, 0, 0, 0, datetime('now', '-22 hours')),
  ('g7Gg8Hh9Ii0', 'sub_technology', 'user_erin',
   'Laptop battery life claims vs reality',
   'Marketing numbers vs a rainy commute with 40 tabs open.',
   NULL, 0, 0, 0, 0, 0, 0, datetime('now', '-26 hours')),
  ('j1Jj2Kk3Ll4', 'sub_webdev', 'user_frank',
   'Why does every design system invent Button again?',
   'Not complaining — just tired of renaming variants.',
   NULL, 0, 0, 0, 0, 0, 0, datetime('now', '-28 hours')),
  ('m5Mm6Nn7Oo8', 'sub_askred', 'user_grace',
   'Favorite keyboard shortcut in your editor?',
   'Mine is multi-cursor select. Life-changing.',
   NULL, 0, 0, 0, 0, 0, 0, datetime('now', '-30 hours')),
  ('p9Pp0Qq1Rr2', 'sub_cloudflare', 'user_henry',
   'Docs worth bookmarking',
   NULL, 'https://developers.cloudflare.com/workers/', 0, 0, 0, 0, 0, 0, datetime('now', '-32 hours')),
  ('s3Ss4Tt5Uu6', 'sub_programming', 'user_kate',
   'Testing SQLite edge cases in CI',
   'Local D1 + Vitest has been surprisingly pleasant.',
   NULL, 0, 0, 0, 0, 0, 0, datetime('now', '-36 hours')),
  ('v7Vv8Ww9Xx0', 'sub_photography', 'user_leo',
   'Street portraits with consent',
   'Ask first, shoot second. Better photos and better karma IRL.',
   NULL, 0, 0, 0, 0, 0, 0, datetime('now', '-40 hours')),
  ('y1Yy2Zz3Aa4', 'sub_gaming', 'user_nate',
   'Co-op games that respect your calendar',
   'Drop-in sessions only — no 40-hour campaigns.',
   NULL, 0, 0, 0, 0, 0, 0, datetime('now', '-2 days')),
  ('b5Bb6Cc7Dd8', 'sub_webdev', 'user_carol',
   'Accessibility audits before polish',
   'Keyboard paths and contrast beat another gradient.',
   NULL, 0, 0, 0, 0, 0, 0, datetime('now', '-3 days')),
  ('e9Ee0Ff1Gg2', 'sub_programming', 'user_bob',
   'Error budgets for side projects',
   'Ship, observe, then decide what to harden.',
   NULL, 0, 0, 0, 0, 0, 0, datetime('now', '-78 hours')),
  ('h3Hh4Ii5Jj6', 'sub_cloudflare', 'user_alice',
   'R2 media pipeline notes',
   'Signed uploads, object keys, and a tiny image processor Worker.',
   NULL, 0, 0, 0, 0, 0, 0, datetime('now', '-4 days')),
  ('k7Kk8Ll9Mm0', 'sub_technology', 'user_mira',
   'Open-source forks that actually help',
   'Looking for examples where the fork became the product.',
   NULL, 0, 0, 0, 0, 0, 0, datetime('now', '-104 hours')),
  ('n1Nn2Oo3Pp4', 'sub_askred', 'user_erin',
   'What made you stay on a social site?',
   'For me: one community that felt alive.',
   NULL, 0, 0, 0, 0, 0, 0, datetime('now', '-5 days')),
  ('q5Qq6Rr7Ss8', 'sub_gaming', 'user_jake',
   'Speedrunning tutorials without spoilers',
   'Harder than it sounds. Share techniques.',
   NULL, 0, 0, 0, 0, 0, 0, datetime('now', '-124 hours')),
  ('t9Tt0Uu1Vv2', 'sub_photography', 'user_leo',
   'Editing color without crushing skin tones',
   'HSL vs curves — still arguing with myself.',
   NULL, 0, 0, 0, 0, 0, 0, datetime('now', '-6 days')),
  ('w3Ww4Xx5Yy6', 'sub_webdev', 'user_grace',
   'Infinite scroll and the back button',
   'Session history + cursor tokens. Easy to get wrong.',
   NULL, 0, 0, 0, 0, 0, 0, datetime('now', '-154 hours')),
  ('z7Zz8Aa9Bb0', 'sub_programming', 'user_henry',
   'Classic paper worth rereading',
   NULL, 'https://dl.acm.org/', 0, 0, 0, 0, 0, 0, datetime('now', '-7 days')),
  ('c1Cc2Dd3Ee4', 'sub_cloudflare', 'user_dave',
   'NSFW tag testing post',
   'Marked NSFW so blur / filter behavior can be verified in the feed.',
   NULL, 1, 0, 0, 0, 0, 0, datetime('now', '-170 hours')),
  ('f5Ff6Gg7Hh8', 'sub_askred', 'user_frank',
   'Locked thread example',
   'Mods locked this for testing the locked UI state.',
   NULL, 0, 1, 0, 0, 0, 0, datetime('now', '-8 days')),
  ('i9Ii0Jj1Kk2', 'sub_technology', 'user_kate',
   'Newsletter that is actually short',
   NULL, 'https://example.com/newsletter', 0, 0, 0, 0, 0, 0, datetime('now', '-197 hours')),
  ('l3Ll4Mm5Nn6', 'sub_webdev', 'user_ivy',
   'Локализация: cookie vs профиль',
   'Если язык в cookie и в профиле расходятся — кто побеждает?',
   NULL, 0, 0, 0, 0, 0, 0, datetime('now', '-9 days')),
  ('o7Oo8Pp9Qq0', 'sub_programming', 'user_alice',
   'Easter egg: shoutout to laefye',
   'If you see this, the laefye achievement path is working.',
   NULL, 0, 0, 0, 0, 0, 0, datetime('now', '-219 hours')),
  ('r1Rr2Ss3Tt4', 'sub_gaming', 'user_mira',
   'Controller layouts for left-handed players',
   'Remapping guides welcome.',
   NULL, 0, 0, 0, 0, 0, 0, datetime('now', '-10 days')),
  ('u5Uu6Vv7Ww8', 'sub_cloudflare', 'user_bob',
   'Durable Object hibernation gotchas',
   'State in memory vs storage — write it down before you forget.',
   NULL, 0, 0, 0, 0, 0, 0, datetime('now', '-11 days')),
  ('x9Xx0Yy1Zz2', 'sub_photography', 'user_leo',
   'Tripod alternatives for travel',
   'Clamp + mini legs covered 80% of my shots last month.',
   NULL, 0, 0, 0, 0, 0, 0, datetime('now', '-12 days')),
  ('a3Aa4Bb5Cc6', 'sub_technology', 'user_erin',
   'Quiet quitting SaaS subscriptions',
   'Audit day: cancelled four, kept two. Feels good.',
   NULL, 0, 0, 0, 0, 0, 0, datetime('now', '-13 days')),
  ('d7Dd8Ee9Ff0', 'sub_askred', 'user_nate',
   'Introduce yourself — seed account edition',
   'Hi, I am Nate. Here to stress-test pagination.',
   NULL, 0, 0, 0, 0, 0, 0, datetime('now', '-14 days'));


INSERT OR IGNORE INTO comments (
  id, post_id, author_id, parent_id, body, upvotes, downvotes, score, depth, created_at
) VALUES
  ('a9Cs1vB4dGe', 'k7Qm2xR9pLw', 'user_bob', NULL, 'Love the DO flush pattern. How often are you syncing back to D1?', 0, 0, 0, 0, datetime('now', '-105 minutes')),
  ('m4Xu7kP2sRf', 'k7Qm2xR9pLw', 'user_alice', 'a9Cs1vB4dGe', 'Defaulting to ~5s after the first dirty write, with coalescing if more votes arrive.', 0, 0, 0, 1, datetime('now', '-80 minutes')),
  ('w8Ln0yH5tJq', 'k7Qm2xR9pLw', 'user_carol', 'm4Xu7kP2sRf', 'That matches what we do for inventory counters. Idempotent alarms are key.', 0, 0, 0, 2, datetime('now', '-55 minutes')),
  ('cmtA01alice1', 'k7Qm2xR9pLw', 'user_mira', NULL, 'OpenNext on Workers still surprises people. Nice write-up.', 0, 0, 0, 0, datetime('now', '-50 minutes')),
  ('cmtA02grace1', 'k7Qm2xR9pLw', 'user_grace', 'cmtA01alice1', 'Same — the mental model click was R2 + D1 together.', 0, 0, 0, 1, datetime('now', '-40 minutes')),
  ('cmtA03frank1', 'k7Qm2xR9pLw', 'user_frank', NULL, 'Bookmarking this for my first serious Worker.', 0, 0, 0, 0, datetime('now', '-30 minutes')),
  ('e1Rd6gM3cVb', 'n3Vt8cY1hKs', 'user_dave', NULL, 'Virtuoso + stable keys fixed our scroll jump issues overnight.', 0, 0, 0, 0, datetime('now', '-4 hours')),
  ('cmtB01kate01', 'n3Vt8cY1hKs', 'user_kate', NULL, 'Did you measure INP before/after?', 0, 0, 0, 0, datetime('now', '-210 minutes')),
  ('cmtB02bob001', 'n3Vt8cY1hKs', 'user_bob', 'cmtB01kate01', 'Not formally yet — subjectively night and day on long threads.', 0, 0, 0, 1, datetime('now', '-3 hours')),
  ('p5Tk9jF7uWs', 'z2Fp5wL8rTc', 'user_alice', NULL, 'Also worth persisting pending deltas in DO storage so eviction mid-batch is safe.', 0, 0, 0, 0, datetime('now', '-20 hours')),
  ('y2Hq4nS8iZo', 'z2Fp5wL8rTc', 'user_bob', 'p5Tk9jF7uWs', 'Agreed — memory alone is not enough if the isolate gets hibernated.', 0, 0, 0, 1, datetime('now', '-19 hours')),
  ('cmtC01erin01', 'z2Fp5wL8rTc', 'user_erin', NULL, 'Alarm coalescing is the unsung hero here.', 0, 0, 0, 0, datetime('now', '-18 hours')),
  ('cmtD01alice1', 'q1Aa2Bb3Cc4', 'user_alice', NULL, 'Durable Objects for coordination, Queues for fan-out. Underrated combo.', 0, 0, 0, 0, datetime('now', '-20 minutes')),
  ('cmtD02dave01', 'q1Aa2Bb3Cc4', 'user_dave', NULL, 'Hyperdrive when you still need Postgres.', 0, 0, 0, 0, datetime('now', '-15 minutes')),
  ('cmtD03henry1', 'q1Aa2Bb3Cc4', 'user_henry', 'cmtD01alice1', 'Plus Workers AI for small translation jobs — we use it here.', 0, 0, 0, 1, datetime('now', '-10 minutes')),
  ('cmtD04ivy001', 'q1Aa2Bb3Cc4', 'user_ivy', NULL, 'Vectorize для рекомендаций постов — тоже недооценено.', 0, 0, 0, 0, datetime('now', '-8 minutes')),
  ('cmtE01grace1', 'd5Ee6Ff7Gg8', 'user_grace', NULL, 'Stardew still wins. Also try Spiritfarer.', 0, 0, 0, 0, datetime('now', '-35 minutes')),
  ('cmtE02jake01', 'd5Ee6Ff7Gg8', 'user_jake', 'cmtE01grace1', 'Spiritfarer wrecked me emotionally. 10/10.', 0, 0, 0, 1, datetime('now', '-28 minutes')),
  ('cmtE03nate01', 'd5Ee6Ff7Gg8', 'user_nate', NULL, 'Unpacking is short and perfect.', 0, 0, 0, 0, datetime('now', '-22 minutes')),
  ('cmtF01carol1', 'h9Hh0Ii1Jj2', 'user_carol', NULL, 'Floating UI can retire for a lot of cases now.', 0, 0, 0, 0, datetime('now', '-45 minutes')),
  ('cmtF02kate01', 'h9Hh0Ii1Jj2', 'user_kate', 'cmtF01carol1', 'Safari support is what I was waiting for.', 0, 0, 0, 1, datetime('now', '-35 minutes')),
  ('cmtG01mira01', 'n7Nn8Oo9Pp0', 'user_mira', NULL, 'D1 next, then DO when you need coordination.', 0, 0, 0, 0, datetime('now', '-80 minutes')),
  ('cmtG02alice1', 'n7Nn8Oo9Pp0', 'user_alice', 'cmtG01mira01', 'And read the limits page twice.', 0, 0, 0, 1, datetime('now', '-70 minutes')),
  ('cmtG03frank1', 'n7Nn8Oo9Pp0', 'user_frank', 'cmtG02alice1', 'Will do. Thanks!', 0, 0, 0, 2, datetime('now', '-60 minutes')),
  ('cmtH01bob001', 't5Tt6Uu7Vv8', 'user_bob', NULL, 'Kysely + D1 adapter has been great for us too.', 0, 0, 0, 0, datetime('now', '-160 minutes')),
  ('cmtH02erin01', 't5Tt6Uu7Vv8', 'user_erin', 'cmtH01bob001', 'Raw SQL for analytics, Kysely for CRUD.', 0, 0, 0, 1, datetime('now', '-140 minutes')),
  ('cmtI01mira01', 'z3Zz4Aa5Bb6', 'user_mira', NULL, 'Popular first, then subscribe aggressively.', 0, 0, 0, 0, datetime('now', '-5 hours')),
  ('cmtI02nate01', 'z3Zz4Aa5Bb6', 'user_nate', 'cmtI01mira01', 'That is what I am doing tonight.', 0, 0, 0, 1, datetime('now', '-285 minutes')),
  ('cmtI03grace1', 'z3Zz4Aa5Bb6', 'user_grace', NULL, 'Search for niche interests beats the homepage.', 0, 0, 0, 0, datetime('now', '-270 minutes')),
  ('cmtJ01grace1', 'l9Ll0Mm1Nn2', 'user_grace', NULL, 'Depth 0 — the root.', 0, 0, 0, 0, datetime('now', '-10 hours')),
  ('cmtJ02bob001', 'l9Ll0Mm1Nn2', 'user_bob', 'cmtJ01grace1', 'Depth 1.', 0, 0, 0, 1, datetime('now', '-590 minutes')),
  ('cmtJ03carol1', 'l9Ll0Mm1Nn2', 'user_carol', 'cmtJ02bob001', 'Depth 2.', 0, 0, 0, 2, datetime('now', '-580 minutes')),
  ('cmtJ04dave01', 'l9Ll0Mm1Nn2', 'user_dave', 'cmtJ03carol1', 'Depth 3 — getting spicy.', 0, 0, 0, 3, datetime('now', '-570 minutes')),
  ('cmtJ05erin01', 'l9Ll0Mm1Nn2', 'user_erin', 'cmtJ04dave01', 'Depth 4 — still fine.', 0, 0, 0, 4, datetime('now', '-560 minutes')),
  ('cmtJ06kate01', 'l9Ll0Mm1Nn2', 'user_kate', 'cmtJ05erin01', 'Depth 5 — mobile users sweat.', 0, 0, 0, 5, datetime('now', '-550 minutes')),
  ('cmtK01alice1', 'x5Xx6Yy7Zz8', 'user_alice', NULL, 'Parser traps catch lazy bots; Turnstile catches the rest.', 0, 0, 0, 0, datetime('now', '-17 hours')),
  ('cmtK02carol1', 'x5Xx6Yy7Zz8', 'user_carol', 'cmtK01alice1', 'Layered defense is the point.', 0, 0, 0, 1, datetime('now', '-16 hours')),
  ('cmtL01dave01', 'a9Aa0Bb1Cc2', 'user_bob', NULL, 'Signed payloads raised the bar for drive-by scrapers.', 0, 0, 0, 0, datetime('now', '-19 hours')),
  ('cmtM01jake01', 'd3Dd4Ee5Ff6', 'user_grace', NULL, 'Celeste OST on loop while shipping features.', 0, 0, 0, 0, datetime('now', '-21 hours')),
  ('cmtM02leo001', 'd3Dd4Ee5Ff6', 'user_leo', NULL, 'Outer Wilds. Instantly.', 0, 0, 0, 0, datetime('now', '-1230 minutes')),
  ('cmtN01alice1', 'm5Mm6Nn7Oo8', 'user_alice', NULL, 'Cmd+D / Ctrl+D for multi-select. Forever.', 0, 0, 0, 0, datetime('now', '-29 hours')),
  ('cmtN02erin01', 'm5Mm6Nn7Oo8', 'user_erin', NULL, 'Vim easymotion spoiled me for life.', 0, 0, 0, 0, datetime('now', '-28 hours')),
  ('cmtO01ivy001', 'u1Uu2Vv3Ww4', 'user_mira', NULL, 'У нас был кейс с холодным стартом изолята на всплеске трафика.', 0, 0, 0, 0, datetime('now', '-14 hours')),
  ('cmtO02alice1', 'u1Uu2Vv3Ww4', 'user_alice', 'cmtO01ivy001', 'Классика. Кешируй то, что можно, и мериь.', 0, 0, 0, 1, datetime('now', '-810 minutes')),
  ('cmtP01bob001', 'o7Oo8Pp9Qq0', 'user_bob', NULL, 'Nice easter egg.', 0, 0, 0, 0, datetime('now', '-217 hours')),
  ('cmtP02grace1', 'o7Oo8Pp9Qq0', 'user_grace', NULL, 'Mentioning laefye in a comment too, for science.', 0, 0, 0, 0, datetime('now', '-216 hours')),
  ('cmtQ01carol1', 'b5Bb6Cc7Dd8', 'user_bob', NULL, 'Contrast first, gradients never.', 0, 0, 0, 0, datetime('now', '-68 hours')),
  ('cmtR01mira01', 'h3Hh4Ii5Jj6', 'user_mira', NULL, 'R2 key prefixes by user id have been tidy for us.', 0, 0, 0, 0, datetime('now', '-84 hours')),
  ('cmtS01jake01', 'n1Nn2Oo3Pp4', 'user_jake', NULL, 'One good community > ten empty ones.', 0, 0, 0, 0, datetime('now', '-102 hours')),
  ('cmtT01leo001', 'w3Ww4Xx5Yy6', 'user_leo', NULL, 'Cursor tokens + scroll restoration is the combo.', 0, 0, 0, 0, datetime('now', '-6 days')),
  ('cmtU01nate01', 'd7Dd8Ee9Ff0', 'user_kate', NULL, 'Welcome Nate — scroll far, young padawan.', 0, 0, 0, 0, datetime('now', '-13 days')),
  ('cmtV01henry1', 'i5Ii6Jj7Kk8', 'user_alice', NULL, 'Solid link.', 0, 0, 0, 0, datetime('now', '-9 hours')),
  ('cmtW01frank1', 'j1Jj2Kk3Ll4', 'user_grace', NULL, 'Because Button is never just a button.', 0, 0, 0, 0, datetime('now', '-27 hours')),
  ('cmtX01dave01', 'c1Cc2Dd3Ee4', 'user_carol', NULL, 'Checking NSFW blur on this one.', 0, 0, 0, 0, datetime('now', '-7 days'));

INSERT OR IGNORE INTO questions (
  id, subreddit_id, author_id, title, body, answer_count, accepted_answer_id,
  created_at
) VALUES
  (
    'question_housing_01',
    'sub_askred',
    'user_mira',
    'Hàn Quốc thuê nhà cần chuẩn bị giấy tờ gì?',
    'Mình sắp chuyển đến Seoul và muốn biết những giấy tờ, khoản đặt cọc và lưu ý quan trọng khi thuê phòng lần đầu.',
    2,
    'answer_housing_01',
    datetime('now', '-3 hours')
  ),
  (
    'question_phone_01',
    'sub_askred',
    'user_nate',
    '한국에서 선불 유심을 어디서 개통할 수 있나요?',
    '처음 한국에 도착한 뒤 바로 사용할 수 있는 선불 유심과 개통 장소를 추천해 주세요.',
    1,
    NULL,
    datetime('now', '-90 minutes')
  );

INSERT OR IGNORE INTO answers (
  id, question_id, author_id, body, is_accepted, created_at
) VALUES
  (
    'answer_housing_01',
    'question_housing_01',
    'user_alice',
    '계약 전에 외국인등록증, 여권과 소득 또는 재직 증빙을 준비하세요. 보증금과 중개수수료는 계약서에서 금액과 반환 조건을 확인하고, 입주 전 상태를 사진으로 남기는 것이 안전합니다.',
    1,
    datetime('now', '-2 hours')
  ),
  (
    'answer_housing_02',
    'question_housing_01',
    'user_ivy',
    '계약서에 관리비 포함 항목과 계약 해지 조건도 꼭 적어 달라고 하세요. 모르는 조항은 서명 전에 통역이나 행정복지센터에 확인하는 편이 좋습니다.',
    0,
    datetime('now', '-80 minutes')
  ),
  (
    'answer_phone_01',
    'question_phone_01',
    'user_mira',
    '공항 편의점이나 통신사 매장에서 여권으로 개통할 수 있습니다. 체류 기간과 데이터 사용량을 먼저 정하면 선불 요금제를 비교하기 쉽습니다.',
    0,
    datetime('now', '-45 minutes')
  );
INSERT OR IGNORE INTO listings (
  id, seller_id, kind, category, title, body, price, location, status
) VALUES
  (
    'listing_bicycle_01',
    'user_mira',
    'market',
    'Đồ gia dụng',
    'Xe đạp gấp nhẹ, đã bảo dưỡng',
    'Xe đạp gấp phù hợp đi làm trong thành phố. Có thể xem tình trạng trực tiếp tại khu vực Seoul.',
    '120000 KRW',
    'Seoul, Mapo-gu',
    'active'
  ),
  (
    'listing_restaurant_job_01',
    'user_nate',
    'job',
    'Nhà hàng',
    'Cần nhân viên phục vụ cuối tuần',
    'Quán ăn Việt cần người hỗ trợ ca cuối tuần. Ưu tiên người có thể giao tiếp tiếng Hàn cơ bản và làm việc đúng giờ.',
    'Thỏa thuận',
    'Seoul, Gwanak-gu',
    'active'
  ),
  (
    'listing_translation_01',
    'user_ivy',
    'service',
    'Biên dịch',
    'Nhận hỗ trợ dịch hồ sơ Việt–Hàn',
    'Hỗ trợ đọc và dịch nội dung hồ sơ thông dụng. Vui lòng mô tả loại giấy tờ và thời hạn cần xử lý khi nhắn tin.',
    'Giá thỏa thuận',
    'Incheon',
    'closed'
  );
INSERT OR IGNORE INTO businesses (
  id, owner_id, slug, name, description, category, address, location,
  phone, website_url, latitude, longitude, opening_hours, status, verification_status
) VALUES
  (
    'business_saigon_kitchen_01',
    'user_mira',
    'saigon-kitchen-seoul',
    'Saigon Kitchen Seoul',
    'Món Việt gia đình tại Seoul với thực đơn dễ gọi và hỗ trợ bằng tiếng Việt.',
    'Ẩm thực',
    'Seoul, Mapo-gu, World Cup buk-ro 12',
    'Seoul, Mapo-gu',
    '02-1234-5678',
    'https://example.com/saigon-kitchen',
    37.5665,
    126.9780,
    'Thứ 2–Thứ 7 11:00–21:00',
    'active',
    'verified'
  ),
  (
    'business_hanviet_translation_01',
    'user_ivy',
    'hanviet-translation-incheon',
    'HanViet Translation',
    'Hỗ trợ biên dịch Việt–Hàn cho hồ sơ hành chính và giao tiếp hằng ngày.',
    'Dịch vụ hành chính',
    'Incheon, Namdong-gu, Arts Center-daero 88',
    'Incheon, Namdong-gu',
    '032-2345-6789',
    NULL,
    37.4475,
    126.7314,
    'Thứ 2–Thứ 6 09:00–18:00',
    'active',
    'verified'
  );

INSERT OR IGNORE INTO business_services (
  id, business_id, name, description, price, duration_minutes
) VALUES
  (
    'business_service_kitchen_01',
    'business_saigon_kitchen_01',
    'Bữa trưa Việt',
    'Set cơm Việt và món gọi thêm tại quán.',
    '12000 KRW',
    60
  ),
  (
    'business_service_translation_01',
    'business_hanviet_translation_01',
    'Biên dịch hồ sơ Việt–Hàn',
    'Kiểm tra và dịch giấy tờ thông dụng theo lịch hẹn.',
    'Từ 30000 KRW',
    60
  );


INSERT OR IGNORE INTO subscriptions (user_id, subreddit_id) VALUES
  ('user_alice', 'sub_cloudflare'),
  ('user_alice', 'sub_programming'),
  ('user_alice', 'sub_webdev'),
  ('user_alice', 'sub_askred'),
  ('user_alice', 'sub_technology'),
  ('user_bob', 'sub_programming'),
  ('user_bob', 'sub_webdev'),
  ('user_bob', 'sub_gaming'),
  ('user_carol', 'sub_webdev'),
  ('user_carol', 'sub_cloudflare'),
  ('user_dave', 'sub_cloudflare'),
  ('user_dave', 'sub_programming'),
  ('user_erin', 'sub_technology'),
  ('user_erin', 'sub_programming'),
  ('user_erin', 'sub_askred'),
  ('user_frank', 'sub_cloudflare'),
  ('user_frank', 'sub_askred'),
  ('user_grace', 'sub_webdev'),
  ('user_grace', 'sub_programming'),
  ('user_grace', 'sub_askred'),
  ('user_henry', 'sub_technology'),
  ('user_henry', 'sub_cloudflare'),
  ('user_ivy', 'sub_askred'),
  ('user_ivy', 'sub_webdev'),
  ('user_jake', 'sub_gaming'),
  ('user_jake', 'sub_webdev'),
  ('user_kate', 'sub_webdev'),
  ('user_kate', 'sub_programming'),
  ('user_leo', 'sub_photography'),
  ('user_leo', 'sub_askred'),
  ('user_mira', 'sub_cloudflare'),
  ('user_mira', 'sub_askred'),
  ('user_mira', 'sub_technology'),
  ('user_nate', 'sub_askred'),
  ('user_nate', 'sub_gaming'),
  ('user_nate', 'sub_cloudflare');

UPDATE subreddits
SET subscriber_count = (
  SELECT COUNT(*) FROM subscriptions WHERE subscriptions.subreddit_id = subreddits.id
);

INSERT OR IGNORE INTO subreddit_moderators (subreddit_id, user_id) VALUES
  ('sub_cloudflare', 'user_alice'),
  ('sub_webdev', 'user_carol'),
  ('sub_programming', 'user_bob'),
  ('sub_gaming', 'user_jake'),
  ('sub_photography', 'user_leo'),
  ('sub_askred', 'user_mira'),
  ('sub_technology', 'user_erin');

INSERT OR IGNORE INTO user_follows (follower_id, following_id) VALUES
  ('user_bob', 'user_alice'),
  ('user_carol', 'user_alice'),
  ('user_grace', 'user_alice'),
  ('user_mira', 'user_alice'),
  ('user_frank', 'user_mira'),
  ('user_nate', 'user_jake'),
  ('user_kate', 'user_carol'),
  ('user_ivy', 'user_erin'),
  ('user_henry', 'user_bob'),
  ('user_leo', 'user_grace');

INSERT OR IGNORE INTO votes (id, user_id, target_type, target_id, value, voter_karma_at_vote, weight) VALUES
  ('vote_p1_bob', 'user_bob', 'post', 'k7Qm2xR9pLw', 1, 0, 1),
  ('vote_p1_carol', 'user_carol', 'post', 'k7Qm2xR9pLw', 1, 0, 1),
  ('vote_p1_dave', 'user_dave', 'post', 'k7Qm2xR9pLw', 1, 0, 1),
  ('vote_p1_mira', 'user_mira', 'post', 'k7Qm2xR9pLw', 1, 0, 1),
  ('vote_p1_grace', 'user_grace', 'post', 'k7Qm2xR9pLw', 1, 0, 1),
  ('vote_p1_erin', 'user_erin', 'post', 'k7Qm2xR9pLw', 1, 0, 1),
  ('vote_p2_alice', 'user_alice', 'post', 'n3Vt8cY1hKs', 1, 0, 1),
  ('vote_p2_carol', 'user_carol', 'post', 'n3Vt8cY1hKs', 1, 0, 1),
  ('vote_p2_kate', 'user_kate', 'post', 'n3Vt8cY1hKs', 1, 0, 1),
  ('vote_p3_bob', 'user_bob', 'post', 'b6Hj4mN0qXd', 1, 0, 1),
  ('vote_p3_dave', 'user_dave', 'post', 'b6Hj4mN0qXd', -1, 0, 0.4),
  ('vote_p3_grace', 'user_grace', 'post', 'b6Hj4mN0qXd', 1, 0, 1),
  ('vote_p4_alice', 'user_alice', 'post', 'z2Fp5wL8rTc', 1, 0, 1),
  ('vote_p4_bob', 'user_bob', 'post', 'z2Fp5wL8rTc', 1, 0, 1),
  ('vote_p4_carol', 'user_carol', 'post', 'z2Fp5wL8rTc', 1, 0, 1),
  ('vote_p4_erin', 'user_erin', 'post', 'z2Fp5wL8rTc', 1, 0, 1),
  ('vote_q1_alice', 'user_alice', 'post', 'q1Aa2Bb3Cc4', 1, 0, 1),
  ('vote_q1_bob', 'user_bob', 'post', 'q1Aa2Bb3Cc4', 1, 0, 1),
  ('vote_q1_carol', 'user_carol', 'post', 'q1Aa2Bb3Cc4', 1, 0, 1),
  ('vote_q1_dave', 'user_dave', 'post', 'q1Aa2Bb3Cc4', 1, 0, 1),
  ('vote_q1_erin', 'user_erin', 'post', 'q1Aa2Bb3Cc4', 1, 0, 1),
  ('vote_q1_frank', 'user_frank', 'post', 'q1Aa2Bb3Cc4', 1, 0, 1),
  ('vote_q1_grace', 'user_grace', 'post', 'q1Aa2Bb3Cc4', 1, 0, 1),
  ('vote_q1_henry', 'user_henry', 'post', 'q1Aa2Bb3Cc4', 1, 0, 1),
  ('vote_d5_grace', 'user_grace', 'post', 'd5Ee6Ff7Gg8', 1, 0, 1),
  ('vote_d5_nate', 'user_nate', 'post', 'd5Ee6Ff7Gg8', 1, 0, 1),
  ('vote_d5_kate', 'user_kate', 'post', 'd5Ee6Ff7Gg8', 1, 0, 1),
  ('vote_d5_leo', 'user_leo', 'post', 'd5Ee6Ff7Gg8', 1, 0, 1),
  ('vote_h9_carol', 'user_carol', 'post', 'h9Hh0Ii1Jj2', 1, 0, 1),
  ('vote_h9_kate', 'user_kate', 'post', 'h9Hh0Ii1Jj2', 1, 0, 1),
  ('vote_h9_bob', 'user_bob', 'post', 'h9Hh0Ii1Jj2', 1, 0, 1),
  ('vote_h9_alice', 'user_alice', 'post', 'h9Hh0Ii1Jj2', 1, 0, 1),
  ('vote_h9_mira', 'user_mira', 'post', 'h9Hh0Ii1Jj2', 1, 0, 1),
  ('vote_k3_henry', 'user_henry', 'post', 'k3Kk4Ll5Mm6', 1, 0, 1),
  ('vote_k3_erin', 'user_alice', 'post', 'k3Kk4Ll5Mm6', 1, 0, 1),
  ('vote_k3_mira', 'user_mira', 'post', 'k3Kk4Ll5Mm6', 1, 0, 1),
  ('vote_n7_mira', 'user_mira', 'post', 'n7Nn8Oo9Pp0', 1, 0, 1),
  ('vote_n7_alice', 'user_alice', 'post', 'n7Nn8Oo9Pp0', 1, 0, 1),
  ('vote_n7_dave', 'user_dave', 'post', 'n7Nn8Oo9Pp0', 1, 0, 1),
  ('vote_o3_bob', 'user_bob', 'post', 'o3Oo4Pp5Qq6', 1, 0, 1),
  ('vote_o3_carol', 'user_carol', 'post', 'o3Oo4Pp5Qq6', 1, 0, 1),
  ('vote_o3_dave', 'user_dave', 'post', 'o3Oo4Pp5Qq6', 1, 0, 1),
  ('vote_o3_erin', 'user_erin', 'post', 'o3Oo4Pp5Qq6', 1, 0, 1),
  ('vote_o3_grace', 'user_grace', 'post', 'o3Oo4Pp5Qq6', 1, 0, 1),
  ('vote_o3_henry', 'user_henry', 'post', 'o3Oo4Pp5Qq6', 1, 0, 1),
  ('vote_o3_mira', 'user_mira', 'post', 'o3Oo4Pp5Qq6', 1, 0, 1),
  ('vote_h3_bob', 'user_bob', 'post', 'h3Hh4Ii5Jj6', 1, 0, 1),
  ('vote_h3_carol', 'user_carol', 'post', 'h3Hh4Ii5Jj6', 1, 0, 1),
  ('vote_h3_dave', 'user_dave', 'post', 'h3Hh4Ii5Jj6', 1, 0, 1),
  ('vote_h3_erin', 'user_erin', 'post', 'h3Hh4Ii5Jj6', 1, 0, 1),
  ('vote_h3_frank', 'user_frank', 'post', 'h3Hh4Ii5Jj6', 1, 0, 1),
  ('vote_h3_grace', 'user_grace', 'post', 'h3Hh4Ii5Jj6', 1, 0, 1),
  ('vote_h3_henry', 'user_henry', 'post', 'h3Hh4Ii5Jj6', 1, 0, 1),
  ('vote_h3_ivy', 'user_ivy', 'post', 'h3Hh4Ii5Jj6', 1, 0, 1),
  ('vote_h3_jake', 'user_jake', 'post', 'h3Hh4Ii5Jj6', 1, 0, 1),
  ('vote_h3_kate', 'user_kate', 'post', 'h3Hh4Ii5Jj6', 1, 0, 1),
  ('vote_b5_alice', 'user_alice', 'post', 'b5Bb6Cc7Dd8', 1, 0, 1),
  ('vote_b5_bob', 'user_bob', 'post', 'b5Bb6Cc7Dd8', 1, 0, 1),
  ('vote_b5_dave', 'user_dave', 'post', 'b5Bb6Cc7Dd8', 1, 0, 1),
  ('vote_b5_erin', 'user_erin', 'post', 'b5Bb6Cc7Dd8', 1, 0, 1),
  ('vote_b5_grace', 'user_grace', 'post', 'b5Bb6Cc7Dd8', 1, 0, 1),
  ('vote_j1_bob', 'user_bob', 'post', 'j1Jj2Kk3Ll4', -1, 0, 0.4),
  ('vote_j1_carol', 'user_carol', 'post', 'j1Jj2Kk3Ll4', 1, 0, 1),
  ('vote_j1_dave', 'user_dave', 'post', 'j1Jj2Kk3Ll4', -1, 0, 0.4),
  ('vote_c1nsfw_a', 'user_alice', 'post', 'c1Cc2Dd3Ee4', 1, 0, 1),
  ('vote_c1nsfw_b', 'user_bob', 'post', 'c1Cc2Dd3Ee4', -1, 0, 0.4),
  ('vote_i5_alice', 'user_alice', 'post', 'i5Ii6Jj7Kk8', 1, 0, 1),
  ('vote_i5_mira', 'user_mira', 'post', 'i5Ii6Jj7Kk8', 1, 0, 1),
  ('vote_p9_bob', 'user_bob', 'post', 'p9Pp0Qq1Rr2', 1, 0, 1),
  ('vote_p9_dave', 'user_dave', 'post', 'p9Pp0Qq1Rr2', 1, 0, 1),
  ('vote_t5_bob', 'user_bob', 'post', 't5Tt6Uu7Vv8', 1, 0, 1),
  ('vote_t5_alice', 'user_alice', 'post', 't5Tt6Uu7Vv8', 1, 0, 1),
  ('vote_t5_grace', 'user_grace', 'post', 't5Tt6Uu7Vv8', 1, 0, 1),
  ('vote_l9_bob', 'user_bob', 'post', 'l9Ll0Mm1Nn2', 1, 0, 1),
  ('vote_l9_carol', 'user_carol', 'post', 'l9Ll0Mm1Nn2', 1, 0, 1),
  ('vote_l9_dave', 'user_dave', 'post', 'l9Ll0Mm1Nn2', 1, 0, 1),
  ('vote_l9_erin', 'user_erin', 'post', 'l9Ll0Mm1Nn2', 1, 0, 1),
  ('vote_x5_alice', 'user_alice', 'post', 'x5Xx6Yy7Zz8', 1, 0, 1),
  ('vote_x5_bob', 'user_bob', 'post', 'x5Xx6Yy7Zz8', 1, 0, 1),
  ('vote_x5_dave', 'user_dave', 'post', 'x5Xx6Yy7Zz8', 1, 0, 1),
  ('vote_u5_alice', 'user_alice', 'post', 'u5Uu6Vv7Ww8', 1, 0, 1),
  ('vote_u5_carol', 'user_carol', 'post', 'u5Uu6Vv7Ww8', 1, 0, 1),
  ('vote_u5_mira', 'user_mira', 'post', 'u5Uu6Vv7Ww8', 1, 0, 1),
  ('vote_u5_erin', 'user_erin', 'post', 'u5Uu6Vv7Ww8', 1, 0, 1),
  ('vote_u5_henry', 'user_henry', 'post', 'u5Uu6Vv7Ww8', 1, 0, 1),
  ('vote_o7_bob', 'user_bob', 'post', 'o7Oo8Pp9Qq0', 1, 0, 1),
  ('vote_o7_grace', 'user_grace', 'post', 'o7Oo8Pp9Qq0', 1, 0, 1),
  ('vote_cm1_alice', 'user_alice', 'comment', 'a9Cs1vB4dGe', 1, 0, 1),
  ('vote_cm1_carol', 'user_carol', 'comment', 'a9Cs1vB4dGe', 1, 0, 1),
  ('vote_cm1_mira', 'user_mira', 'comment', 'a9Cs1vB4dGe', 1, 0, 1),
  ('vote_cm2_bob', 'user_bob', 'comment', 'm4Xu7kP2sRf', 1, 0, 1),
  ('vote_cm5_bob', 'user_bob', 'comment', 'p5Tk9jF7uWs', 1, 0, 1),
  ('vote_cm5_dave', 'user_dave', 'comment', 'p5Tk9jF7uWs', 1, 0, 1),
  ('vote_cd1_bob', 'user_bob', 'comment', 'cmtD01alice1', 1, 0, 1),
  ('vote_cd1_erin', 'user_erin', 'comment', 'cmtD01alice1', 1, 0, 1),
  ('vote_cd1_frank', 'user_frank', 'comment', 'cmtD01alice1', 1, 0, 1),
  ('vote_ce1_jake', 'user_jake', 'comment', 'cmtE01grace1', 1, 0, 1),
  ('vote_ce1_nate', 'user_nate', 'comment', 'cmtE01grace1', 1, 0, 1),
  ('vote_cj1_bob', 'user_bob', 'comment', 'cmtJ01grace1', 1, 0, 1),
  ('vote_cj1_carol', 'user_carol', 'comment', 'cmtJ01grace1', 1, 0, 1);


UPDATE posts
SET
  upvotes = (
    SELECT COUNT(*) FROM votes
    WHERE votes.target_type = 'post' AND votes.target_id = posts.id AND votes.value = 1
  ),
  downvotes = (
    SELECT COUNT(*) FROM votes
    WHERE votes.target_type = 'post' AND votes.target_id = posts.id AND votes.value = -1
  ),
  score = (
    SELECT COALESCE(SUM(votes.value), 0) FROM votes
    WHERE votes.target_type = 'post' AND votes.target_id = posts.id
  ),
  comment_count = (
    SELECT COUNT(*) FROM comments
    WHERE comments.post_id = posts.id
      AND comments.is_removed = 0
      AND comments.is_shadow_hidden = 0
      AND comments.is_deleted = 0
  );

UPDATE comments
SET
  upvotes = (
    SELECT COUNT(*) FROM votes
    WHERE votes.target_type = 'comment' AND votes.target_id = comments.id AND votes.value = 1
  ),
  downvotes = (
    SELECT COUNT(*) FROM votes
    WHERE votes.target_type = 'comment' AND votes.target_id = comments.id AND votes.value = -1
  ),
  score = (
    SELECT COALESCE(SUM(votes.value), 0) FROM votes
    WHERE votes.target_type = 'comment' AND votes.target_id = comments.id
  );

UPDATE posts
SET hot_score = (
  CASE
    WHEN score >= 0 THEN ln(1.0 + (CAST(score AS REAL) / 100.0))
    ELSE -ln(1.0 + (ABS(CAST(score AS REAL)) / 100.0))
  END
) / (((julianday('now') - julianday(created_at)) * 24.0) + 2.0);

UPDATE "user"
SET
  postKarma = (
    SELECT COALESCE(SUM(v.value), 0)
    FROM votes v
    INNER JOIN posts p ON p.id = v.target_id AND v.target_type = 'post'
    WHERE p.author_id = "user".id AND v.user_id != "user".id
  ),
  commentKarma = (
    SELECT COALESCE(SUM(v.value), 0)
    FROM votes v
    INNER JOIN comments c ON c.id = v.target_id AND v.target_type = 'comment'
    WHERE c.author_id = "user".id AND v.user_id != "user".id
  );

UPDATE "user"
SET karma = MAX(0, postKarma + commentKarma);



INSERT OR IGNORE INTO ad_campaigns (
  id, name, status, placement, body, image_key, target_url, weight, created_by
) VALUES
  (
    'adcamp_workers',
    'Ship on the edge with Workers',
    'active',
    'feed_inline',
    'Deploy globally in seconds. D1, R2, and Durable Objects included.',
    NULL,
    'https://developers.cloudflare.com/workers/',
    3,
    'user_alice'
  ),
  (
    'adcamp_pages',
    'Build your next app on Pages',
    'active',
    'feed_inline',
    'Git-connected previews and Workers integration for full-stack sites.',
    NULL,
    'https://developers.cloudflare.com/pages/',
    2,
    'user_alice'
  ),
  (
    'adcamp_footer',
    'Việt tại Hàn · open source on Cloudflare',
    'active',
    'post_footer',
    'A community-first feed running entirely at the edge.',
    NULL,
    'https://developers.cloudflare.com/',
    1,
    'user_alice'
  );

INSERT OR IGNORE INTO banned_words (id, word, severity, created_by) VALUES
  ('bw_001', 'spamlink', 'block', 'user_alice'),
  ('bw_002', 'shadownuke', 'shadow', 'user_alice');

INSERT OR IGNORE INTO user_activity (user_id, subreddit_id, score) VALUES
  ('user_alice', 'sub_cloudflare', 12),
  ('user_bob', 'sub_programming', 8),
  ('user_carol', 'sub_webdev', 7),
  ('user_dave', 'sub_cloudflare', 5),
  ('user_erin', 'sub_technology', 6),
  ('user_frank', 'sub_cloudflare', 2),
  ('user_grace', 'sub_webdev', 9),
  ('user_henry', 'sub_technology', 4),
  ('user_ivy', 'sub_askred', 3),
  ('user_jake', 'sub_gaming', 6),
  ('user_kate', 'sub_webdev', 3),
  ('user_leo', 'sub_photography', 5),
  ('user_mira', 'sub_askred', 8),
  ('user_nate', 'sub_askred', 2);

UPDATE "user" SET createdAt = datetime('now', '-400 days'), isNsfw = 0, preferredLanguage = 'vi' WHERE id = 'user_alice';
UPDATE "user" SET createdAt = datetime('now', '-30 days'), isNsfw = 0 WHERE id = 'user_bob';
UPDATE "user" SET createdAt = datetime('now', '-120 days'), isNsfw = 0 WHERE id = 'user_carol';
UPDATE "user" SET createdAt = datetime('now', '-14 days'), isNsfw = 1 WHERE id = 'user_dave';
UPDATE "user" SET createdAt = datetime('now', '-220 days'), isNsfw = 0 WHERE id = 'user_erin';
UPDATE "user" SET createdAt = datetime('now', '-3 days'), isNsfw = 0 WHERE id = 'user_frank';
UPDATE "user" SET createdAt = datetime('now', '-90 days'), isNsfw = 0 WHERE id = 'user_grace';
UPDATE "user" SET createdAt = datetime('now', '-60 days'), isNsfw = 0 WHERE id = 'user_henry';
UPDATE "user" SET createdAt = datetime('now', '-45 days'), isNsfw = 0, preferredLanguage = 'ko' WHERE id = 'user_ivy';
UPDATE "user" SET createdAt = datetime('now', '-18 days'), isNsfw = 0 WHERE id = 'user_jake';
UPDATE "user" SET createdAt = datetime('now', '-7 days'), isNsfw = 0 WHERE id = 'user_kate';
UPDATE "user" SET createdAt = datetime('now', '-150 days'), isNsfw = 0 WHERE id = 'user_leo';
UPDATE "user" SET createdAt = datetime('now', '-80 days'), isNsfw = 0 WHERE id = 'user_mira';
UPDATE "user" SET createdAt = datetime('now', '-1 day'), isNsfw = 0 WHERE id = 'user_nate';

INSERT OR IGNORE INTO user_achievements (user_id, achievement_id, level) VALUES
  ('user_alice', 'ach_admin', 1),
  ('user_alice', 'ach_veteran', 1),
  ('user_alice', 'ach_first_post', 1),
  ('user_alice', 'ach_first_comment', 1),
  ('user_alice', 'ach_community', 1),
  ('user_alice', 'ach_laefye', 1),
  ('user_alice', 'ach_verified_start', 1),
  ('user_carol', 'ach_moderator', 1),
  ('user_carol', 'ach_first_post', 1),
  ('user_carol', 'ach_first_comment', 1),
  ('user_carol', 'ach_verified_start', 1),
  ('user_bob', 'ach_first_post', 1),
  ('user_bob', 'ach_first_comment', 1),
  ('user_bob', 'ach_verified_start', 1),
  ('user_dave', 'ach_nsfw', 1),
  ('user_dave', 'ach_first_post', 1),
  ('user_dave', 'ach_first_comment', 1),
  ('user_dave', 'ach_verified_start', 1),
  ('user_erin', 'ach_first_post', 1),
  ('user_erin', 'ach_first_comment', 1),
  ('user_erin', 'ach_verified_start', 1),
  ('user_erin', 'ach_community', 1),
  ('user_frank', 'ach_first_post', 1),
  ('user_frank', 'ach_first_comment', 1),
  ('user_frank', 'ach_verified_start', 1),
  ('user_grace', 'ach_first_post', 1),
  ('user_grace', 'ach_first_comment', 1),
  ('user_grace', 'ach_verified_start', 1),
  ('user_grace', 'ach_laefye', 1),
  ('user_henry', 'ach_first_post', 1),
  ('user_henry', 'ach_verified_start', 1),
  ('user_ivy', 'ach_first_post', 1),
  ('user_ivy', 'ach_first_comment', 1),
  ('user_ivy', 'ach_verified_start', 1),
  ('user_jake', 'ach_first_post', 1),
  ('user_jake', 'ach_first_comment', 1),
  ('user_jake', 'ach_verified_start', 1),
  ('user_jake', 'ach_community', 1),
  ('user_kate', 'ach_first_post', 1),
  ('user_kate', 'ach_first_comment', 1),
  ('user_kate', 'ach_verified_start', 1),
  ('user_leo', 'ach_first_post', 1),
  ('user_leo', 'ach_first_comment', 1),
  ('user_leo', 'ach_verified_start', 1),
  ('user_leo', 'ach_community', 1),
  ('user_mira', 'ach_first_post', 1),
  ('user_mira', 'ach_first_comment', 1),
  ('user_mira', 'ach_verified_start', 1),
  ('user_mira', 'ach_community', 1),
  ('user_nate', 'ach_first_post', 1),
  ('user_nate', 'ach_first_comment', 1),
  ('user_nate', 'ach_verified_start', 1);

-- Local fixtures represent completed profile setup.
UPDATE "user" SET onboardingComplete = 1 WHERE id LIKE 'user_%';

-- Dev social identity for E2E session setup (no credential account).
INSERT OR IGNORE INTO account (
  id, accountId, providerId, userId, createdAt, updatedAt
) VALUES (
  'acc_alice_facebook',
  'e2e_alice',
  'facebook',
  'user_alice',
  datetime('now'),
  datetime('now')
);
