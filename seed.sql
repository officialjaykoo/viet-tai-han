-- Local seed: richer dataset for feed / sort / pagination testing.
-- Post/comment IDs are opaque YouTube-style tokens (not sequential).
-- Re-run safely on an un-rekeyed local DB; production never runs this seed.

DELETE FROM votes WHERE id LIKE 'vote_%';
DELETE FROM comment_likes
WHERE user_id IN (SELECT id FROM "user" WHERE email LIKE '%@example.local')
   OR comment_id IN (
     SELECT id FROM comments
     WHERE author_id IN (SELECT id FROM "user" WHERE email LIKE '%@example.local')
        OR post_id IN (
          SELECT id FROM posts
          WHERE author_id IN (
            SELECT id FROM "user" WHERE email LIKE '%@example.local'
          )
        )
   );
DELETE FROM post_likes
WHERE user_id IN (SELECT id FROM "user" WHERE email LIKE '%@example.local')
   OR post_id IN (
     SELECT id FROM posts
     WHERE author_id IN (SELECT id FROM "user" WHERE email LIKE '%@example.local')
   );
DELETE FROM comments
WHERE author_id IN (SELECT id FROM "user" WHERE email LIKE '%@example.local');
DELETE FROM answers
WHERE author_id IN (SELECT id FROM "user" WHERE email LIKE '%@example.local')
   OR question_id IN (
     SELECT id FROM questions
     WHERE author_id IN (SELECT id FROM "user" WHERE email LIKE '%@example.local')
   );
DELETE FROM questions
WHERE author_id IN (SELECT id FROM "user" WHERE email LIKE '%@example.local');
DELETE FROM listings
WHERE seller_id IN (SELECT id FROM "user" WHERE email LIKE '%@example.local');
DELETE FROM posts
WHERE author_id IN (SELECT id FROM "user" WHERE email LIKE '%@example.local');
DELETE FROM subscriptions
WHERE user_id IN (SELECT id FROM "user" WHERE email LIKE '%@example.local');
DELETE FROM subreddit_moderators
WHERE user_id IN (SELECT id FROM "user" WHERE email LIKE '%@example.local');
DELETE FROM user_activity
WHERE user_id IN (SELECT id FROM "user" WHERE email LIKE '%@example.local');
DELETE FROM user_follows
WHERE follower_id IN (SELECT id FROM "user" WHERE email LIKE '%@example.local')
   OR following_id IN (SELECT id FROM "user" WHERE email LIKE '%@example.local');
DELETE FROM user_achievements
WHERE user_id IN (SELECT id FROM "user" WHERE email LIKE '%@example.local');
DELETE FROM ad_impressions WHERE campaign_id LIKE 'adcamp_%';
DELETE FROM ad_clicks WHERE campaign_id LIKE 'adcamp_%';
DELETE FROM ad_campaigns WHERE id LIKE 'adcamp_%';
DELETE FROM banned_words WHERE id LIKE 'bw_%';
DELETE FROM business_bookings
WHERE requester_id IN (SELECT id FROM "user" WHERE email LIKE '%@example.local')
   OR business_id IN (
     SELECT id FROM businesses
     WHERE owner_id IN (SELECT id FROM "user" WHERE email LIKE '%@example.local')
   );
DELETE FROM business_verification_requests
WHERE requester_id IN (SELECT id FROM "user" WHERE email LIKE '%@example.local')
   OR business_id IN (
     SELECT id FROM businesses
     WHERE owner_id IN (SELECT id FROM "user" WHERE email LIKE '%@example.local')
   );
DELETE FROM business_services
WHERE business_id IN (
  SELECT id FROM businesses
  WHERE owner_id IN (SELECT id FROM "user" WHERE email LIKE '%@example.local')
);
DELETE FROM businesses
WHERE owner_id IN (SELECT id FROM "user" WHERE email LIKE '%@example.local');
DELETE FROM account
WHERE userId IN (SELECT id FROM "user" WHERE email LIKE '%@example.local');
DELETE FROM subreddits WHERE id LIKE 'sub_%';
DELETE FROM "user" WHERE email LIKE '%@example.local';

INSERT OR IGNORE INTO "user" (
  id, name, email, emailVerified, username,
  karma, postKarma, commentKarma, role, status, bio, isNsfw, preferredLanguage, createdAt
) VALUES
  ('7Kp3nZ8QaM2wX5Rc', 'Alice', 'alice@example.local', 1, 'alice',
   0, 0, 0, 'admin', 'active', 'Building Việt tại Hàn on Cloudflare.', 0, 'vi', datetime('now', '-400 days')),
  ('2Vt9Lm4Qx7Nc1RsA', 'Bob', 'bob@example.local', 1, 'bob',
   0, 0, 0, 'user', 'active', 'Virtuoso enjoyer.', 0, 'vi', datetime('now', '-30 days')),
  ('H6sP0dK3wZ8mB2yQ', 'Carol', 'carol@example.local', 1, 'carol',
   0, 0, 0, 'moderator', 'active', 'Mods webdev.', 0, 'vi', datetime('now', '-120 days')),
  ('9Aa4Cc7Ee1Gg3IiK', 'Dave', 'dave@example.local', 1, 'dave',
   0, 0, 0, 'user', 'active', 'Edge runtime tinkerer.', 1, 'vi', datetime('now', '-14 days')),
  ('L2nR5tY8uW1qE4oP', 'Erin', 'erin@example.local', 1, 'erin',
   0, 0, 0, 'user', 'active', 'Writes about DX and tooling.', 0, 'vi', datetime('now', '-220 days')),
  ('B7vD0fH3jL6zX9cM', 'Frank', 'frank@example.local', 1, 'frank',
   0, 0, 0, 'user', 'active', NULL, 0, 'vi', datetime('now', '-3 days')),
  ('Q4sN7kT0mV3xA6pR', 'Grace', 'grace@example.local', 1, 'grace',
   0, 0, 0, 'user', 'active', 'Comment thread archaeologist.', 0, 'vi', datetime('now', '-90 days')),
  ('E8rU1iO4aS7dF0gH', 'Henry', 'henry@example.local', 1, 'henry',
   0, 0, 0, 'user', 'active', 'Mostly shares links.', 0, 'vi', datetime('now', '-60 days')),
  ('W3yC6bN9hK2lP5vX', 'Ivy', 'ivy@example.local', 1, 'ivy',
   0, 0, 0, 'user', 'active', 'Viết bằng tiếng Việt và tiếng Hàn.', 0, 'ko', datetime('now', '-45 days')),
  ('M0qR3tY6uI9oA2sD', 'Jake', 'jake@example.local', 1, 'jake',
   0, 0, 0, 'user', 'active', 'Gaming + CSS.', 0, 'vi', datetime('now', '-18 days')),
  ('Z5xV8nB1mK4pH7cQ', 'Kate', 'kate@example.local', 1, 'kate',
   0, 0, 0, 'user', 'active', NULL, 0, 'vi', datetime('now', '-7 days')),
  ('F2gJ5lS8dO1wE4rT', 'Leo', 'leo@example.local', 1, 'leo',
   0, 0, 0, 'user', 'active', 'Photography hobbyist.', 0, 'vi', datetime('now', '-150 days')),
  ('A9cD2fG5hJ8kL1zX', 'Mira', 'mira@example.local', 1, 'mira',
   0, 0, 0, 'user', 'active', 'Ask me anything about Workers.', 0, 'vi', datetime('now', '-80 days')),
  ('P6qW9eR2tY5uI8oA', 'Nate', 'nate@example.local', 1, 'nate',
   0, 0, 0, 'user', 'active', 'New here — testing the feed.', 0, 'vi', datetime('now', '-1 day'));

INSERT OR IGNORE INTO subreddits (id, name, title, description, created_by, subscriber_count) VALUES
  ('sub_cloudflare', 'cloudflare', 'Cloudflare', 'Workers, D1, Durable Objects, and the edge.', '7Kp3nZ8QaM2wX5Rc', 0),
  ('sub_programming', 'programming', 'Programming', 'Software engineering and CS discussion.', '2Vt9Lm4Qx7Nc1RsA', 0),
  ('sub_webdev', 'webdev', 'Web Development', 'Front-end, back-end, and everything in between.', 'H6sP0dK3wZ8mB2yQ', 0),
  ('sub_gaming', 'gaming', 'Gaming', 'PC, console, indie, and everything in between.', 'M0qR3tY6uI9oA2sD', 0),
  ('sub_photography', 'photography', 'Photography', 'Cameras, light, and the decisive moment.', 'F2gJ5lS8dO1wE4rT', 0),
  ('sub_askred', 'askvth', 'Hỏi Việt tại Hàn', 'Đặt câu hỏi và chia sẻ với cộng đồng.', 'A9cD2fG5hJ8kL1zX', 0),
  ('sub_technology', 'technology', 'Technology', 'Gadgets, platforms, and industry news.', 'L2nR5tY8uW1qE4oP', 0);


-- Posts (~48): mixed ages, likes, link posts, NSFW, locked — enough for 2+ pages
INSERT OR IGNORE INTO posts (
  id, subreddit_id, author_id, title, body, url, is_nsfw, is_locked,
  like_count, comment_count, created_at
) VALUES
  ('k7Qm2xR9pLw', 'sub_cloudflare', '7Kp3nZ8QaM2wX5Rc',
   'Building a community platform for Việt tại Hàn on Cloudflare',
   'D1 for persistence, Durable Objects for realtime chat, R2 for media, OpenNext for Next.js on Workers.',
   NULL, 0, 0, 0, 0, datetime('now', '-2 hours')),
  ('n3Vt8cY1hKs', 'sub_programming', '2Vt9Lm4Qx7Nc1RsA',
   'Virtualized infinite scroll without jank',
   'react-virtuoso has been solid for long feeds and nested comment threads.',
   NULL, 0, 0, 0, 0, datetime('now', '-5 hours')),
  ('b6Hj4mN0qXd', 'sub_webdev', 'H6sP0dK3wZ8mB2yQ',
   'Shadcn + Tailwind on the edge',
   'Neutral Luma preset, Lucide icons, and a community-first feed layout.',
   NULL, 0, 0, 0, 0, datetime('now', '-8 hours')),
  ('z2Fp5wL8rTc', 'sub_cloudflare', '9Aa4Cc7Ee1Gg3IiK',
   'Batching writes from Durable Objects to D1',
   'Realtime chat fanout stays in Durable Objects; D1 remains the source of truth.',
   NULL, 0, 0, 0, 0, datetime('now', '-1 day')),
  ('q1Aa2Bb3Cc4', 'sub_askred', 'A9cD2fG5hJ8kL1zX',
   'What is your underrated Cloudflare product?',
   'I keep rediscovering Queues. What else should I be using?',
   NULL, 0, 0, 0, 0, datetime('now', '-25 minutes')),
  ('d5Ee6Ff7Gg8', 'sub_gaming', 'M0qR3tY6uI9oA2sD',
   'Finished a cozy farming sim at 2am again',
   'No spoilers — just recommend your favorite low-stakes games.',
   NULL, 0, 0, 0, 0, datetime('now', '-40 minutes')),
  ('h9Hh0Ii1Jj2', 'sub_webdev', 'Q4sN7kT0mV3xA6pR',
   'CSS anchor positioning is finally usable',
   'Popovers without JS positioning libraries feels like cheating.',
   NULL, 0, 0, 0, 0, datetime('now', '-55 minutes')),
  ('k3Kk4Ll5Mm6', 'sub_technology', 'L2nR5tY8uW1qE4oP',
   'Browser vendors quietly shipping useful APIs',
   'View Transitions, Popover, and Scheduled Tasks deserve more hype.',
   NULL, 0, 0, 0, 0, datetime('now', '-70 minutes')),
  ('n7Nn8Oo9Pp0', 'sub_cloudflare', 'B7vD0fH3jL6zX9cM',
   'First Worker deployed — what should I learn next?',
   'I got hello-world working. D1? Durable Objects? Hyperdrive?',
   NULL, 0, 0, 0, 0, datetime('now', '-90 minutes')),
  ('q1Qq2Rr3Ss4', 'sub_photography', 'F2gJ5lS8dO1wE4rT',
   'Golden hour on a rainy sidewalk',
   'Reflections made the street look twice as long. Shot on a 35mm.',
   NULL, 0, 0, 0, 0, datetime('now', '-130 minutes')),
  ('t5Tt6Uu7Vv8', 'sub_programming', 'L2nR5tY8uW1qE4oP',
   'Typed SQL without an ORM',
   'Kysely on D1 has been enough for this project. Curious what you use.',
   NULL, 0, 0, 0, 0, datetime('now', '-3 hours')),
  ('w9Ww0Xx1Yy2', 'sub_webdev', 'Z5xV8nB1mK4pH7cQ',
   'Dark mode that does not look like a purple dungeon',
   'Started from OKLCH tokens and resisted the glow tax.',
   NULL, 0, 0, 0, 0, datetime('now', '-4 hours')),
  ('z3Zz4Aa5Bb6', 'sub_askred', 'P6qW9eR2tY5uI8oA',
   'How do you discover communities on a new community platform?',
   'Search? Popular? Asking friends? Genuinely curious.',
   NULL, 0, 0, 0, 0, datetime('now', '-6 hours')),
  ('c7Cc8Dd9Ee0', 'sub_gaming', '2Vt9Lm4Qx7Nc1RsA',
   'Controller support on the web is underrated',
   'Gamepad API + a small deadzone helper goes a long way.',
   NULL, 0, 0, 0, 0, datetime('now', '-7 hours')),
  ('f1Ff2Gg3Hh4', 'sub_cloudflare', 'A9cD2fG5hJ8kL1zX',
   'Wrangler local D1 + migrations workflow tips',
   'db:reset:local has saved me more than once. Share your scripts.',
   NULL, 0, 0, 0, 0, datetime('now', '-9 hours')),
  ('i5Ii6Jj7Kk8', 'sub_technology', 'E8rU1iO4aS7dF0gH',
   'Interesting read on edge caching strategies',
   NULL, 'https://blog.cloudflare.com/', 0, 0, 0, 0, datetime('now', '-10 hours')),
  ('l9Ll0Mm1Nn2', 'sub_programming', 'Q4sN7kT0mV3xA6pR',
   'When is a comment thread too nested?',
   'We cap depth at 12. Feels generous until someone actually uses it.',
   NULL, 0, 0, 0, 0, datetime('now', '-11 hours')),
  ('o3Oo4Pp5Qq6', 'sub_webdev', '7Kp3nZ8QaM2wX5Rc',
   'Server Components and forms that still feel snappy',
   'Transitions + optimistic likes made the feed feel alive.',
   NULL, 0, 0, 0, 0, datetime('now', '-12 hours')),
  ('r7Rr8Ss9Tt0', 'sub_photography', 'F2gJ5lS8dO1wE4rT',
   'ISO 6400 grain can be a feature',
   'Stopped chasing clean shadows and leaned into texture.',
   NULL, 0, 0, 0, 0, datetime('now', '-14 hours')),
  ('u1Uu2Vv3Ww4', 'sub_askred', 'W3yC6bN9hK2lP5vX',
   'Какой у вас любимый крайний кейс на Workers?',
   'Интересны странные прод-истории: лимиты, изоляты, неожиданные победы.',
   NULL, 0, 0, 0, 0, datetime('now', '-15 hours')),
  ('x5Xx6Yy7Zz8', 'sub_cloudflare', 'H6sP0dK3wZ8mB2yQ',
   'Turnstile vs homemade bot traps',
   'We layered honeypots + attestation first. Curious how far that goes.',
   NULL, 0, 0, 0, 0, datetime('now', '-18 hours')),
  ('a9Aa0Bb1Cc2', 'sub_programming', '9Aa4Cc7Ee1Gg3IiK',
   'Protobuf envelopes for mutating APIs',
   'Not security theater alone — just raising the floor for scrapers.',
   NULL, 0, 0, 0, 0, datetime('now', '-20 hours')),
  ('d3Dd4Ee5Ff6', 'sub_gaming', 'M0qR3tY6uI9oA2sD',
   'Best indie soundtrack of the year?',
   'Looking for albums I can loop while coding.',
   NULL, 0, 0, 0, 0, datetime('now', '-22 hours')),
  ('g7Gg8Hh9Ii0', 'sub_technology', 'L2nR5tY8uW1qE4oP',
   'Laptop battery life claims vs reality',
   'Marketing numbers vs a rainy commute with 40 tabs open.',
   NULL, 0, 0, 0, 0, datetime('now', '-26 hours')),
  ('j1Jj2Kk3Ll4', 'sub_webdev', 'B7vD0fH3jL6zX9cM',
   'Why does every design system invent Button again?',
   'Not complaining — just tired of renaming variants.',
   NULL, 0, 0, 0, 0, datetime('now', '-28 hours')),
  ('m5Mm6Nn7Oo8', 'sub_askred', 'Q4sN7kT0mV3xA6pR',
   'Favorite keyboard shortcut in your editor?',
   'Mine is multi-cursor select. Life-changing.',
   NULL, 0, 0, 0, 0, datetime('now', '-30 hours')),
  ('p9Pp0Qq1Rr2', 'sub_cloudflare', 'E8rU1iO4aS7dF0gH',
   'Docs worth bookmarking',
   NULL, 'https://developers.cloudflare.com/workers/', 0, 0, 0, 0, datetime('now', '-32 hours')),
  ('s3Ss4Tt5Uu6', 'sub_programming', 'Z5xV8nB1mK4pH7cQ',
   'Testing SQLite edge cases in CI',
   'Local D1 + Vitest has been surprisingly pleasant.',
   NULL, 0, 0, 0, 0, datetime('now', '-36 hours')),
  ('v7Vv8Ww9Xx0', 'sub_photography', 'F2gJ5lS8dO1wE4rT',
   'Street portraits with consent',
   'Ask first, shoot second. Better photos and better karma IRL.',
   NULL, 0, 0, 0, 0, datetime('now', '-40 hours')),
  ('y1Yy2Zz3Aa4', 'sub_gaming', 'P6qW9eR2tY5uI8oA',
   'Co-op games that respect your calendar',
   'Drop-in sessions only — no 40-hour campaigns.',
   NULL, 0, 0, 0, 0, datetime('now', '-2 days')),
  ('b5Bb6Cc7Dd8', 'sub_webdev', 'H6sP0dK3wZ8mB2yQ',
   'Accessibility audits before polish',
   'Keyboard paths and contrast beat another gradient.',
   NULL, 0, 0, 0, 0, datetime('now', '-3 days')),
  ('e9Ee0Ff1Gg2', 'sub_programming', '2Vt9Lm4Qx7Nc1RsA',
   'Error budgets for side projects',
   'Ship, observe, then decide what to harden.',
   NULL, 0, 0, 0, 0, datetime('now', '-78 hours')),
  ('h3Hh4Ii5Jj6', 'sub_cloudflare', '7Kp3nZ8QaM2wX5Rc',
   'R2 media pipeline notes',
   'Signed uploads, object keys, and a tiny image processor Worker.',
   NULL, 0, 0, 0, 0, datetime('now', '-4 days')),
  ('k7Kk8Ll9Mm0', 'sub_technology', 'A9cD2fG5hJ8kL1zX',
   'Open-source forks that actually help',
   'Looking for examples where the fork became the product.',
   NULL, 0, 0, 0, 0, datetime('now', '-104 hours')),
  ('n1Nn2Oo3Pp4', 'sub_askred', 'L2nR5tY8uW1qE4oP',
   'What made you stay on a social site?',
   'For me: one community that felt alive.',
   NULL, 0, 0, 0, 0, datetime('now', '-5 days')),
  ('q5Qq6Rr7Ss8', 'sub_gaming', 'M0qR3tY6uI9oA2sD',
   'Speedrunning tutorials without spoilers',
   'Harder than it sounds. Share techniques.',
   NULL, 0, 0, 0, 0, datetime('now', '-124 hours')),
  ('t9Tt0Uu1Vv2', 'sub_photography', 'F2gJ5lS8dO1wE4rT',
   'Editing color without crushing skin tones',
   'HSL vs curves — still arguing with myself.',
   NULL, 0, 0, 0, 0, datetime('now', '-6 days')),
  ('w3Ww4Xx5Yy6', 'sub_webdev', 'Q4sN7kT0mV3xA6pR',
   'Infinite scroll and the back button',
   'Session history + cursor tokens. Easy to get wrong.',
   NULL, 0, 0, 0, 0, datetime('now', '-154 hours')),
  ('z7Zz8Aa9Bb0', 'sub_programming', 'E8rU1iO4aS7dF0gH',
   'Classic paper worth rereading',
   NULL, 'https://dl.acm.org/', 0, 0, 0, 0, datetime('now', '-7 days')),
  ('c1Cc2Dd3Ee4', 'sub_cloudflare', '9Aa4Cc7Ee1Gg3IiK',
   'NSFW tag testing post',
   'Marked NSFW so blur / filter behavior can be verified in the feed.',
   NULL, 1, 0, 0, 0, datetime('now', '-170 hours')),
  ('f5Ff6Gg7Hh8', 'sub_askred', 'B7vD0fH3jL6zX9cM',
   'Locked thread example',
   'Mods locked this for testing the locked UI state.',
   NULL, 0, 1, 0, 0, datetime('now', '-8 days')),
  ('i9Ii0Jj1Kk2', 'sub_technology', 'Z5xV8nB1mK4pH7cQ',
   'Newsletter that is actually short',
   NULL, 'https://example.com/newsletter', 0, 0, 0, 0, datetime('now', '-197 hours')),
  ('l3Ll4Mm5Nn6', 'sub_webdev', 'W3yC6bN9hK2lP5vX',
   'Локализация: cookie vs профиль',
   'Если язык в cookie и в профиле расходятся — кто побеждает?',
   NULL, 0, 0, 0, 0, datetime('now', '-9 days')),
  ('o7Oo8Pp9Qq0', 'sub_programming', '7Kp3nZ8QaM2wX5Rc',
   'Easter egg: shoutout to laefye',
   'If you see this, the laefye achievement path is working.',
   NULL, 0, 0, 0, 0, datetime('now', '-219 hours')),
  ('r1Rr2Ss3Tt4', 'sub_gaming', 'A9cD2fG5hJ8kL1zX',
   'Controller layouts for left-handed players',
   'Remapping guides welcome.',
   NULL, 0, 0, 0, 0, datetime('now', '-10 days')),
  ('u5Uu6Vv7Ww8', 'sub_cloudflare', '2Vt9Lm4Qx7Nc1RsA',
   'Durable Object hibernation gotchas',
   'State in memory vs storage — write it down before you forget.',
   NULL, 0, 0, 0, 0, datetime('now', '-11 days')),
  ('x9Xx0Yy1Zz2', 'sub_photography', 'F2gJ5lS8dO1wE4rT',
   'Tripod alternatives for travel',
   'Clamp + mini legs covered 80% of my shots last month.',
   NULL, 0, 0, 0, 0, datetime('now', '-12 days')),
  ('a3Aa4Bb5Cc6', 'sub_technology', 'L2nR5tY8uW1qE4oP',
   'Quiet quitting SaaS subscriptions',
   'Audit day: cancelled four, kept two. Feels good.',
   NULL, 0, 0, 0, 0, datetime('now', '-13 days')),
  ('d7Dd8Ee9Ff0', 'sub_askred', 'P6qW9eR2tY5uI8oA',
   'Introduce yourself — seed account edition',
   'Hi, I am Nate. Here to stress-test pagination.',
   NULL, 0, 0, 0, 0, datetime('now', '-14 days'));


INSERT OR IGNORE INTO comments (
  id, post_id, author_id, parent_id, body, like_count, depth, created_at
) VALUES
  ('a9Cs1vB4dGe', 'k7Qm2xR9pLw', '2Vt9Lm4Qx7Nc1RsA', NULL, 'Love the D1 write path. How are you keeping chat fan-out separate?', 0, 0, datetime('now', '-105 minutes')),
  ('m4Xu7kP2sRf', 'k7Qm2xR9pLw', '7Kp3nZ8QaM2wX5Rc', 'a9Cs1vB4dGe', 'D1 stays canonical; realtime delivery is a separate concern.', 0, 1, datetime('now', '-80 minutes')),
  ('w8Ln0yH5tJq', 'k7Qm2xR9pLw', 'H6sP0dK3wZ8mB2yQ', 'm4Xu7kP2sRf', 'That split keeps retries and hibernation easier to reason about.', 0, 2, datetime('now', '-55 minutes')),
  ('cmtA01alice1', 'k7Qm2xR9pLw', 'A9cD2fG5hJ8kL1zX', NULL, 'OpenNext on Workers still surprises people. Nice write-up.', 0, 0, datetime('now', '-50 minutes')),
  ('cmtA02grace1', 'k7Qm2xR9pLw', 'Q4sN7kT0mV3xA6pR', 'cmtA01alice1', 'Same — the mental model click was R2 + D1 together.', 0, 1, datetime('now', '-40 minutes')),
  ('cmtA03frank1', 'k7Qm2xR9pLw', 'B7vD0fH3jL6zX9cM', NULL, 'Bookmarking this for my first serious Worker.', 0, 0, datetime('now', '-30 minutes')),
  ('e1Rd6gM3cVb', 'n3Vt8cY1hKs', '9Aa4Cc7Ee1Gg3IiK', NULL, 'Virtuoso + stable keys fixed our scroll jump issues overnight.', 0, 0, datetime('now', '-4 hours')),
  ('cmtB01kate01', 'n3Vt8cY1hKs', 'Z5xV8nB1mK4pH7cQ', NULL, 'Did you measure INP before/after?', 0, 0, datetime('now', '-210 minutes')),
  ('cmtB02bob001', 'n3Vt8cY1hKs', '2Vt9Lm4Qx7Nc1RsA', 'cmtB01kate01', 'Not formally yet — subjectively night and day on long threads.', 0, 1, datetime('now', '-3 hours')),
  ('p5Tk9jF7uWs', 'z2Fp5wL8rTc', '7Kp3nZ8QaM2wX5Rc', NULL, 'Also worth persisting pending deltas in DO storage so eviction mid-batch is safe.', 0, 0, datetime('now', '-20 hours')),
  ('y2Hq4nS8iZo', 'z2Fp5wL8rTc', '2Vt9Lm4Qx7Nc1RsA', 'p5Tk9jF7uWs', 'Agreed — memory alone is not enough if the isolate gets hibernated.', 0, 1, datetime('now', '-19 hours')),
  ('cmtC01erin01', 'z2Fp5wL8rTc', 'L2nR5tY8uW1qE4oP', NULL, 'Alarm coalescing is the unsung hero here.', 0, 0, datetime('now', '-18 hours')),
  ('cmtD01alice1', 'q1Aa2Bb3Cc4', '7Kp3nZ8QaM2wX5Rc', NULL, 'Durable Objects for coordination, Queues for fan-out. Underrated combo.', 0, 0, datetime('now', '-20 minutes')),
  ('cmtD02dave01', 'q1Aa2Bb3Cc4', '9Aa4Cc7Ee1Gg3IiK', NULL, 'Hyperdrive when you still need Postgres.', 0, 0, datetime('now', '-15 minutes')),
  ('cmtD03henry1', 'q1Aa2Bb3Cc4', 'E8rU1iO4aS7dF0gH', 'cmtD01alice1', 'Plus Workers AI for small translation jobs — we use it here.', 0, 1, datetime('now', '-10 minutes')),
  ('cmtD04ivy001', 'q1Aa2Bb3Cc4', 'W3yC6bN9hK2lP5vX', NULL, 'D1 activity signals are enough for a useful first recommendation pass.', 0, 0, datetime('now', '-8 minutes')),
  ('cmtE01grace1', 'd5Ee6Ff7Gg8', 'Q4sN7kT0mV3xA6pR', NULL, 'Stardew still wins. Also try Spiritfarer.', 0, 0, datetime('now', '-35 minutes')),
  ('cmtE02jake01', 'd5Ee6Ff7Gg8', 'M0qR3tY6uI9oA2sD', 'cmtE01grace1', 'Spiritfarer wrecked me emotionally. 10/10.', 0, 1, datetime('now', '-28 minutes')),
  ('cmtE03nate01', 'd5Ee6Ff7Gg8', 'P6qW9eR2tY5uI8oA', NULL, 'Unpacking is short and perfect.', 0, 0, datetime('now', '-22 minutes')),
  ('cmtF01carol1', 'h9Hh0Ii1Jj2', 'H6sP0dK3wZ8mB2yQ', NULL, 'Floating UI can retire for a lot of cases now.', 0, 0, datetime('now', '-45 minutes')),
  ('cmtF02kate01', 'h9Hh0Ii1Jj2', 'Z5xV8nB1mK4pH7cQ', 'cmtF01carol1', 'Safari support is what I was waiting for.', 0, 1, datetime('now', '-35 minutes')),
  ('cmtG01mira01', 'n7Nn8Oo9Pp0', 'A9cD2fG5hJ8kL1zX', NULL, 'D1 next, then DO when you need coordination.', 0, 0, datetime('now', '-80 minutes')),
  ('cmtG02alice1', 'n7Nn8Oo9Pp0', '7Kp3nZ8QaM2wX5Rc', 'cmtG01mira01', 'And read the limits page twice.', 0, 1, datetime('now', '-70 minutes')),
  ('cmtG03frank1', 'n7Nn8Oo9Pp0', 'B7vD0fH3jL6zX9cM', 'cmtG02alice1', 'Will do. Thanks!', 0, 2, datetime('now', '-60 minutes')),
  ('cmtH01bob001', 't5Tt6Uu7Vv8', '2Vt9Lm4Qx7Nc1RsA', NULL, 'Kysely + D1 adapter has been great for us too.', 0, 0, datetime('now', '-160 minutes')),
  ('cmtH02erin01', 't5Tt6Uu7Vv8', 'L2nR5tY8uW1qE4oP', 'cmtH01bob001', 'Raw SQL for analytics, Kysely for CRUD.', 0, 1, datetime('now', '-140 minutes')),
  ('cmtI01mira01', 'z3Zz4Aa5Bb6', 'A9cD2fG5hJ8kL1zX', NULL, 'Popular first, then subscribe aggressively.', 0, 0, datetime('now', '-5 hours')),
  ('cmtI02nate01', 'z3Zz4Aa5Bb6', 'P6qW9eR2tY5uI8oA', 'cmtI01mira01', 'That is what I am doing tonight.', 0, 1, datetime('now', '-285 minutes')),
  ('cmtI03grace1', 'z3Zz4Aa5Bb6', 'Q4sN7kT0mV3xA6pR', NULL, 'Search for niche interests beats the homepage.', 0, 0, datetime('now', '-270 minutes')),
  ('cmtJ01grace1', 'l9Ll0Mm1Nn2', 'Q4sN7kT0mV3xA6pR', NULL, 'Depth 0 — the root.', 0, 0, datetime('now', '-10 hours')),
  ('cmtJ02bob001', 'l9Ll0Mm1Nn2', '2Vt9Lm4Qx7Nc1RsA', 'cmtJ01grace1', 'Depth 1.', 0, 1, datetime('now', '-590 minutes')),
  ('cmtJ03carol1', 'l9Ll0Mm1Nn2', 'H6sP0dK3wZ8mB2yQ', 'cmtJ02bob001', 'Depth 2.', 0, 2, datetime('now', '-580 minutes')),
  ('cmtJ04dave01', 'l9Ll0Mm1Nn2', '9Aa4Cc7Ee1Gg3IiK', 'cmtJ03carol1', 'Depth 3 — getting spicy.', 0, 3, datetime('now', '-570 minutes')),
  ('cmtJ05erin01', 'l9Ll0Mm1Nn2', 'L2nR5tY8uW1qE4oP', 'cmtJ04dave01', 'Depth 4 — still fine.', 0, 4, datetime('now', '-560 minutes')),
  ('cmtJ06kate01', 'l9Ll0Mm1Nn2', 'Z5xV8nB1mK4pH7cQ', 'cmtJ05erin01', 'Depth 5 — mobile users sweat.', 0, 5, datetime('now', '-550 minutes')),
  ('cmtK01alice1', 'x5Xx6Yy7Zz8', '7Kp3nZ8QaM2wX5Rc', NULL, 'Parser traps catch lazy bots; Turnstile catches the rest.', 0, 0, datetime('now', '-17 hours')),
  ('cmtK02carol1', 'x5Xx6Yy7Zz8', 'H6sP0dK3wZ8mB2yQ', 'cmtK01alice1', 'Layered defense is the point.', 0, 1, datetime('now', '-16 hours')),
  ('cmtL01dave01', 'a9Aa0Bb1Cc2', '2Vt9Lm4Qx7Nc1RsA', NULL, 'Signed payloads raised the bar for drive-by scrapers.', 0, 0, datetime('now', '-19 hours')),
  ('cmtM01jake01', 'd3Dd4Ee5Ff6', 'Q4sN7kT0mV3xA6pR', NULL, 'Celeste OST on loop while shipping features.', 0, 0, datetime('now', '-21 hours')),
  ('cmtM02leo001', 'd3Dd4Ee5Ff6', 'F2gJ5lS8dO1wE4rT', NULL, 'Outer Wilds. Instantly.', 0, 0, datetime('now', '-1230 minutes')),
  ('cmtN01alice1', 'm5Mm6Nn7Oo8', '7Kp3nZ8QaM2wX5Rc', NULL, 'Cmd+D / Ctrl+D for multi-select. Forever.', 0, 0, datetime('now', '-29 hours')),
  ('cmtN02erin01', 'm5Mm6Nn7Oo8', 'L2nR5tY8uW1qE4oP', NULL, 'Vim easymotion spoiled me for life.', 0, 0, datetime('now', '-28 hours')),
  ('cmtO01ivy001', 'u1Uu2Vv3Ww4', 'A9cD2fG5hJ8kL1zX', NULL, 'У нас был кейс с холодным стартом изолята на всплеске трафика.', 0, 0, datetime('now', '-14 hours')),
  ('cmtO02alice1', 'u1Uu2Vv3Ww4', '7Kp3nZ8QaM2wX5Rc', 'cmtO01ivy001', 'Классика. Кешируй то, что можно, и мериь.', 0, 1, datetime('now', '-810 minutes')),
  ('cmtP01bob001', 'o7Oo8Pp9Qq0', '2Vt9Lm4Qx7Nc1RsA', NULL, 'Nice easter egg.', 0, 0, datetime('now', '-217 hours')),
  ('cmtP02grace1', 'o7Oo8Pp9Qq0', 'Q4sN7kT0mV3xA6pR', NULL, 'Mentioning laefye in a comment too, for science.', 0, 0, datetime('now', '-216 hours')),
  ('cmtQ01carol1', 'b5Bb6Cc7Dd8', '2Vt9Lm4Qx7Nc1RsA', NULL, 'Contrast first, gradients never.', 0, 0, datetime('now', '-68 hours')),
  ('cmtR01mira01', 'h3Hh4Ii5Jj6', 'A9cD2fG5hJ8kL1zX', NULL, 'R2 key prefixes by user id have been tidy for us.', 0, 0, datetime('now', '-84 hours')),
  ('cmtS01jake01', 'n1Nn2Oo3Pp4', 'M0qR3tY6uI9oA2sD', NULL, 'One good community > ten empty ones.', 0, 0, datetime('now', '-102 hours')),
  ('cmtT01leo001', 'w3Ww4Xx5Yy6', 'F2gJ5lS8dO1wE4rT', NULL, 'Cursor tokens + scroll restoration is the combo.', 0, 0, datetime('now', '-6 days')),
  ('cmtU01nate01', 'd7Dd8Ee9Ff0', 'Z5xV8nB1mK4pH7cQ', NULL, 'Welcome Nate — scroll far, young padawan.', 0, 0, datetime('now', '-13 days')),
  ('cmtV01henry1', 'i5Ii6Jj7Kk8', '7Kp3nZ8QaM2wX5Rc', NULL, 'Solid link.', 0, 0, datetime('now', '-9 hours')),
  ('cmtW01frank1', 'j1Jj2Kk3Ll4', 'Q4sN7kT0mV3xA6pR', NULL, 'Because Button is never just a button.', 0, 0, datetime('now', '-27 hours')),
  ('cmtX01dave01', 'c1Cc2Dd3Ee4', 'H6sP0dK3wZ8mB2yQ', NULL, 'Checking NSFW blur on this one.', 0, 0, datetime('now', '-7 days'));

INSERT OR IGNORE INTO questions (
  id, subreddit_id, author_id, title, body, answer_count, accepted_answer_id,
  created_at
) VALUES
  (
    'question_housing_01',
    'sub_askred',
    'A9cD2fG5hJ8kL1zX',
    'Hàn Quốc thuê nhà cần chuẩn bị giấy tờ gì?',
    'Mình sắp chuyển đến Seoul và muốn biết những giấy tờ, khoản đặt cọc và lưu ý quan trọng khi thuê phòng lần đầu.',
    2,
    'answer_housing_01',
    datetime('now', '-3 hours')
  ),
  (
    'question_phone_01',
    'sub_askred',
    'P6qW9eR2tY5uI8oA',
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
    '7Kp3nZ8QaM2wX5Rc',
    '계약 전에 외국인등록증, 여권과 소득 또는 재직 증빙을 준비하세요. 보증금과 중개수수료는 계약서에서 금액과 반환 조건을 확인하고, 입주 전 상태를 사진으로 남기는 것이 안전합니다.',
    1,
    datetime('now', '-2 hours')
  ),
  (
    'answer_housing_02',
    'question_housing_01',
    'W3yC6bN9hK2lP5vX',
    '계약서에 관리비 포함 항목과 계약 해지 조건도 꼭 적어 달라고 하세요. 모르는 조항은 서명 전에 통역이나 행정복지센터에 확인하는 편이 좋습니다.',
    0,
    datetime('now', '-80 minutes')
  ),
  (
    'answer_phone_01',
    'question_phone_01',
    'A9cD2fG5hJ8kL1zX',
    '공항 편의점이나 통신사 매장에서 여권으로 개통할 수 있습니다. 체류 기간과 데이터 사용량을 먼저 정하면 선불 요금제를 비교하기 쉽습니다.',
    0,
    datetime('now', '-45 minutes')
  );
INSERT OR IGNORE INTO listings (
  id, seller_id, kind, category, title, body, price, location, status
) VALUES
  (
    'listing_bicycle_01',
    'A9cD2fG5hJ8kL1zX',
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
    'P6qW9eR2tY5uI8oA',
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
    'W3yC6bN9hK2lP5vX',
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
    'A9cD2fG5hJ8kL1zX',
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
    'W3yC6bN9hK2lP5vX',
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
  ('7Kp3nZ8QaM2wX5Rc', 'sub_cloudflare'),
  ('7Kp3nZ8QaM2wX5Rc', 'sub_programming'),
  ('7Kp3nZ8QaM2wX5Rc', 'sub_webdev'),
  ('7Kp3nZ8QaM2wX5Rc', 'sub_askred'),
  ('7Kp3nZ8QaM2wX5Rc', 'sub_technology'),
  ('2Vt9Lm4Qx7Nc1RsA', 'sub_programming'),
  ('2Vt9Lm4Qx7Nc1RsA', 'sub_webdev'),
  ('2Vt9Lm4Qx7Nc1RsA', 'sub_gaming'),
  ('H6sP0dK3wZ8mB2yQ', 'sub_webdev'),
  ('H6sP0dK3wZ8mB2yQ', 'sub_cloudflare'),
  ('9Aa4Cc7Ee1Gg3IiK', 'sub_cloudflare'),
  ('9Aa4Cc7Ee1Gg3IiK', 'sub_programming'),
  ('L2nR5tY8uW1qE4oP', 'sub_technology'),
  ('L2nR5tY8uW1qE4oP', 'sub_programming'),
  ('L2nR5tY8uW1qE4oP', 'sub_askred'),
  ('B7vD0fH3jL6zX9cM', 'sub_cloudflare'),
  ('B7vD0fH3jL6zX9cM', 'sub_askred'),
  ('Q4sN7kT0mV3xA6pR', 'sub_webdev'),
  ('Q4sN7kT0mV3xA6pR', 'sub_programming'),
  ('Q4sN7kT0mV3xA6pR', 'sub_askred'),
  ('E8rU1iO4aS7dF0gH', 'sub_technology'),
  ('E8rU1iO4aS7dF0gH', 'sub_cloudflare'),
  ('W3yC6bN9hK2lP5vX', 'sub_askred'),
  ('W3yC6bN9hK2lP5vX', 'sub_webdev'),
  ('M0qR3tY6uI9oA2sD', 'sub_gaming'),
  ('M0qR3tY6uI9oA2sD', 'sub_webdev'),
  ('Z5xV8nB1mK4pH7cQ', 'sub_webdev'),
  ('Z5xV8nB1mK4pH7cQ', 'sub_programming'),
  ('F2gJ5lS8dO1wE4rT', 'sub_photography'),
  ('F2gJ5lS8dO1wE4rT', 'sub_askred'),
  ('A9cD2fG5hJ8kL1zX', 'sub_cloudflare'),
  ('A9cD2fG5hJ8kL1zX', 'sub_askred'),
  ('A9cD2fG5hJ8kL1zX', 'sub_technology'),
  ('P6qW9eR2tY5uI8oA', 'sub_askred'),
  ('P6qW9eR2tY5uI8oA', 'sub_gaming'),
  ('P6qW9eR2tY5uI8oA', 'sub_cloudflare');

UPDATE subreddits
SET subscriber_count = (
  SELECT COUNT(*) FROM subscriptions WHERE subscriptions.subreddit_id = subreddits.id
);

INSERT OR IGNORE INTO subreddit_moderators (subreddit_id, user_id) VALUES
  ('sub_cloudflare', '7Kp3nZ8QaM2wX5Rc'),
  ('sub_webdev', 'H6sP0dK3wZ8mB2yQ'),
  ('sub_programming', '2Vt9Lm4Qx7Nc1RsA'),
  ('sub_gaming', 'M0qR3tY6uI9oA2sD'),
  ('sub_photography', 'F2gJ5lS8dO1wE4rT'),
  ('sub_askred', 'A9cD2fG5hJ8kL1zX'),
  ('sub_technology', 'L2nR5tY8uW1qE4oP');

INSERT OR IGNORE INTO user_follows (follower_id, following_id) VALUES
  ('2Vt9Lm4Qx7Nc1RsA', '7Kp3nZ8QaM2wX5Rc'),
  ('H6sP0dK3wZ8mB2yQ', '7Kp3nZ8QaM2wX5Rc'),
  ('Q4sN7kT0mV3xA6pR', '7Kp3nZ8QaM2wX5Rc'),
  ('A9cD2fG5hJ8kL1zX', '7Kp3nZ8QaM2wX5Rc'),
  ('B7vD0fH3jL6zX9cM', 'A9cD2fG5hJ8kL1zX'),
  ('P6qW9eR2tY5uI8oA', 'M0qR3tY6uI9oA2sD'),
  ('Z5xV8nB1mK4pH7cQ', 'H6sP0dK3wZ8mB2yQ'),
  ('W3yC6bN9hK2lP5vX', 'L2nR5tY8uW1qE4oP'),
  ('E8rU1iO4aS7dF0gH', '2Vt9Lm4Qx7Nc1RsA'),
  ('F2gJ5lS8dO1wE4rT', 'Q4sN7kT0mV3xA6pR');

INSERT OR IGNORE INTO votes (id, user_id, target_type, target_id, value, voter_karma_at_vote, weight) VALUES
  ('vote_p1_bob', '2Vt9Lm4Qx7Nc1RsA', 'post', 'k7Qm2xR9pLw', 1, 0, 1),
  ('vote_p1_carol', 'H6sP0dK3wZ8mB2yQ', 'post', 'k7Qm2xR9pLw', 1, 0, 1),
  ('vote_p1_dave', '9Aa4Cc7Ee1Gg3IiK', 'post', 'k7Qm2xR9pLw', 1, 0, 1),
  ('vote_p1_mira', 'A9cD2fG5hJ8kL1zX', 'post', 'k7Qm2xR9pLw', 1, 0, 1),
  ('vote_p1_grace', 'Q4sN7kT0mV3xA6pR', 'post', 'k7Qm2xR9pLw', 1, 0, 1),
  ('vote_p1_erin', 'L2nR5tY8uW1qE4oP', 'post', 'k7Qm2xR9pLw', 1, 0, 1),
  ('vote_p2_alice', '7Kp3nZ8QaM2wX5Rc', 'post', 'n3Vt8cY1hKs', 1, 0, 1),
  ('vote_p2_carol', 'H6sP0dK3wZ8mB2yQ', 'post', 'n3Vt8cY1hKs', 1, 0, 1),
  ('vote_p2_kate', 'Z5xV8nB1mK4pH7cQ', 'post', 'n3Vt8cY1hKs', 1, 0, 1),
  ('vote_p3_bob', '2Vt9Lm4Qx7Nc1RsA', 'post', 'b6Hj4mN0qXd', 1, 0, 1),
  ('vote_p3_dave', '9Aa4Cc7Ee1Gg3IiK', 'post', 'b6Hj4mN0qXd', -1, 0, 0.4),
  ('vote_p3_grace', 'Q4sN7kT0mV3xA6pR', 'post', 'b6Hj4mN0qXd', 1, 0, 1),
  ('vote_p4_alice', '7Kp3nZ8QaM2wX5Rc', 'post', 'z2Fp5wL8rTc', 1, 0, 1),
  ('vote_p4_bob', '2Vt9Lm4Qx7Nc1RsA', 'post', 'z2Fp5wL8rTc', 1, 0, 1),
  ('vote_p4_carol', 'H6sP0dK3wZ8mB2yQ', 'post', 'z2Fp5wL8rTc', 1, 0, 1),
  ('vote_p4_erin', 'L2nR5tY8uW1qE4oP', 'post', 'z2Fp5wL8rTc', 1, 0, 1),
  ('vote_q1_alice', '7Kp3nZ8QaM2wX5Rc', 'post', 'q1Aa2Bb3Cc4', 1, 0, 1),
  ('vote_q1_bob', '2Vt9Lm4Qx7Nc1RsA', 'post', 'q1Aa2Bb3Cc4', 1, 0, 1),
  ('vote_q1_carol', 'H6sP0dK3wZ8mB2yQ', 'post', 'q1Aa2Bb3Cc4', 1, 0, 1),
  ('vote_q1_dave', '9Aa4Cc7Ee1Gg3IiK', 'post', 'q1Aa2Bb3Cc4', 1, 0, 1),
  ('vote_q1_erin', 'L2nR5tY8uW1qE4oP', 'post', 'q1Aa2Bb3Cc4', 1, 0, 1),
  ('vote_q1_frank', 'B7vD0fH3jL6zX9cM', 'post', 'q1Aa2Bb3Cc4', 1, 0, 1),
  ('vote_q1_grace', 'Q4sN7kT0mV3xA6pR', 'post', 'q1Aa2Bb3Cc4', 1, 0, 1),
  ('vote_q1_henry', 'E8rU1iO4aS7dF0gH', 'post', 'q1Aa2Bb3Cc4', 1, 0, 1),
  ('vote_d5_grace', 'Q4sN7kT0mV3xA6pR', 'post', 'd5Ee6Ff7Gg8', 1, 0, 1),
  ('vote_d5_nate', 'P6qW9eR2tY5uI8oA', 'post', 'd5Ee6Ff7Gg8', 1, 0, 1),
  ('vote_d5_kate', 'Z5xV8nB1mK4pH7cQ', 'post', 'd5Ee6Ff7Gg8', 1, 0, 1),
  ('vote_d5_leo', 'F2gJ5lS8dO1wE4rT', 'post', 'd5Ee6Ff7Gg8', 1, 0, 1),
  ('vote_h9_carol', 'H6sP0dK3wZ8mB2yQ', 'post', 'h9Hh0Ii1Jj2', 1, 0, 1),
  ('vote_h9_kate', 'Z5xV8nB1mK4pH7cQ', 'post', 'h9Hh0Ii1Jj2', 1, 0, 1),
  ('vote_h9_bob', '2Vt9Lm4Qx7Nc1RsA', 'post', 'h9Hh0Ii1Jj2', 1, 0, 1),
  ('vote_h9_alice', '7Kp3nZ8QaM2wX5Rc', 'post', 'h9Hh0Ii1Jj2', 1, 0, 1),
  ('vote_h9_mira', 'A9cD2fG5hJ8kL1zX', 'post', 'h9Hh0Ii1Jj2', 1, 0, 1),
  ('vote_k3_henry', 'E8rU1iO4aS7dF0gH', 'post', 'k3Kk4Ll5Mm6', 1, 0, 1),
  ('vote_k3_erin', '7Kp3nZ8QaM2wX5Rc', 'post', 'k3Kk4Ll5Mm6', 1, 0, 1),
  ('vote_k3_mira', 'A9cD2fG5hJ8kL1zX', 'post', 'k3Kk4Ll5Mm6', 1, 0, 1),
  ('vote_n7_mira', 'A9cD2fG5hJ8kL1zX', 'post', 'n7Nn8Oo9Pp0', 1, 0, 1),
  ('vote_n7_alice', '7Kp3nZ8QaM2wX5Rc', 'post', 'n7Nn8Oo9Pp0', 1, 0, 1),
  ('vote_n7_dave', '9Aa4Cc7Ee1Gg3IiK', 'post', 'n7Nn8Oo9Pp0', 1, 0, 1),
  ('vote_o3_bob', '2Vt9Lm4Qx7Nc1RsA', 'post', 'o3Oo4Pp5Qq6', 1, 0, 1),
  ('vote_o3_carol', 'H6sP0dK3wZ8mB2yQ', 'post', 'o3Oo4Pp5Qq6', 1, 0, 1),
  ('vote_o3_dave', '9Aa4Cc7Ee1Gg3IiK', 'post', 'o3Oo4Pp5Qq6', 1, 0, 1),
  ('vote_o3_erin', 'L2nR5tY8uW1qE4oP', 'post', 'o3Oo4Pp5Qq6', 1, 0, 1),
  ('vote_o3_grace', 'Q4sN7kT0mV3xA6pR', 'post', 'o3Oo4Pp5Qq6', 1, 0, 1),
  ('vote_o3_henry', 'E8rU1iO4aS7dF0gH', 'post', 'o3Oo4Pp5Qq6', 1, 0, 1),
  ('vote_o3_mira', 'A9cD2fG5hJ8kL1zX', 'post', 'o3Oo4Pp5Qq6', 1, 0, 1),
  ('vote_h3_bob', '2Vt9Lm4Qx7Nc1RsA', 'post', 'h3Hh4Ii5Jj6', 1, 0, 1),
  ('vote_h3_carol', 'H6sP0dK3wZ8mB2yQ', 'post', 'h3Hh4Ii5Jj6', 1, 0, 1),
  ('vote_h3_dave', '9Aa4Cc7Ee1Gg3IiK', 'post', 'h3Hh4Ii5Jj6', 1, 0, 1),
  ('vote_h3_erin', 'L2nR5tY8uW1qE4oP', 'post', 'h3Hh4Ii5Jj6', 1, 0, 1),
  ('vote_h3_frank', 'B7vD0fH3jL6zX9cM', 'post', 'h3Hh4Ii5Jj6', 1, 0, 1),
  ('vote_h3_grace', 'Q4sN7kT0mV3xA6pR', 'post', 'h3Hh4Ii5Jj6', 1, 0, 1),
  ('vote_h3_henry', 'E8rU1iO4aS7dF0gH', 'post', 'h3Hh4Ii5Jj6', 1, 0, 1),
  ('vote_h3_ivy', 'W3yC6bN9hK2lP5vX', 'post', 'h3Hh4Ii5Jj6', 1, 0, 1),
  ('vote_h3_jake', 'M0qR3tY6uI9oA2sD', 'post', 'h3Hh4Ii5Jj6', 1, 0, 1),
  ('vote_h3_kate', 'Z5xV8nB1mK4pH7cQ', 'post', 'h3Hh4Ii5Jj6', 1, 0, 1),
  ('vote_b5_alice', '7Kp3nZ8QaM2wX5Rc', 'post', 'b5Bb6Cc7Dd8', 1, 0, 1),
  ('vote_b5_bob', '2Vt9Lm4Qx7Nc1RsA', 'post', 'b5Bb6Cc7Dd8', 1, 0, 1),
  ('vote_b5_dave', '9Aa4Cc7Ee1Gg3IiK', 'post', 'b5Bb6Cc7Dd8', 1, 0, 1),
  ('vote_b5_erin', 'L2nR5tY8uW1qE4oP', 'post', 'b5Bb6Cc7Dd8', 1, 0, 1),
  ('vote_b5_grace', 'Q4sN7kT0mV3xA6pR', 'post', 'b5Bb6Cc7Dd8', 1, 0, 1),
  ('vote_j1_bob', '2Vt9Lm4Qx7Nc1RsA', 'post', 'j1Jj2Kk3Ll4', -1, 0, 0.4),
  ('vote_j1_carol', 'H6sP0dK3wZ8mB2yQ', 'post', 'j1Jj2Kk3Ll4', 1, 0, 1),
  ('vote_j1_dave', '9Aa4Cc7Ee1Gg3IiK', 'post', 'j1Jj2Kk3Ll4', -1, 0, 0.4),
  ('vote_c1nsfw_a', '7Kp3nZ8QaM2wX5Rc', 'post', 'c1Cc2Dd3Ee4', 1, 0, 1),
  ('vote_c1nsfw_b', '2Vt9Lm4Qx7Nc1RsA', 'post', 'c1Cc2Dd3Ee4', -1, 0, 0.4),
  ('vote_i5_alice', '7Kp3nZ8QaM2wX5Rc', 'post', 'i5Ii6Jj7Kk8', 1, 0, 1),
  ('vote_i5_mira', 'A9cD2fG5hJ8kL1zX', 'post', 'i5Ii6Jj7Kk8', 1, 0, 1),
  ('vote_p9_bob', '2Vt9Lm4Qx7Nc1RsA', 'post', 'p9Pp0Qq1Rr2', 1, 0, 1),
  ('vote_p9_dave', '9Aa4Cc7Ee1Gg3IiK', 'post', 'p9Pp0Qq1Rr2', 1, 0, 1),
  ('vote_t5_bob', '2Vt9Lm4Qx7Nc1RsA', 'post', 't5Tt6Uu7Vv8', 1, 0, 1),
  ('vote_t5_alice', '7Kp3nZ8QaM2wX5Rc', 'post', 't5Tt6Uu7Vv8', 1, 0, 1),
  ('vote_t5_grace', 'Q4sN7kT0mV3xA6pR', 'post', 't5Tt6Uu7Vv8', 1, 0, 1),
  ('vote_l9_bob', '2Vt9Lm4Qx7Nc1RsA', 'post', 'l9Ll0Mm1Nn2', 1, 0, 1),
  ('vote_l9_carol', 'H6sP0dK3wZ8mB2yQ', 'post', 'l9Ll0Mm1Nn2', 1, 0, 1),
  ('vote_l9_dave', '9Aa4Cc7Ee1Gg3IiK', 'post', 'l9Ll0Mm1Nn2', 1, 0, 1),
  ('vote_l9_erin', 'L2nR5tY8uW1qE4oP', 'post', 'l9Ll0Mm1Nn2', 1, 0, 1),
  ('vote_x5_alice', '7Kp3nZ8QaM2wX5Rc', 'post', 'x5Xx6Yy7Zz8', 1, 0, 1),
  ('vote_x5_bob', '2Vt9Lm4Qx7Nc1RsA', 'post', 'x5Xx6Yy7Zz8', 1, 0, 1),
  ('vote_x5_dave', '9Aa4Cc7Ee1Gg3IiK', 'post', 'x5Xx6Yy7Zz8', 1, 0, 1),
  ('vote_u5_alice', '7Kp3nZ8QaM2wX5Rc', 'post', 'u5Uu6Vv7Ww8', 1, 0, 1),
  ('vote_u5_carol', 'H6sP0dK3wZ8mB2yQ', 'post', 'u5Uu6Vv7Ww8', 1, 0, 1),
  ('vote_u5_mira', 'A9cD2fG5hJ8kL1zX', 'post', 'u5Uu6Vv7Ww8', 1, 0, 1),
  ('vote_u5_erin', 'L2nR5tY8uW1qE4oP', 'post', 'u5Uu6Vv7Ww8', 1, 0, 1),
  ('vote_u5_henry', 'E8rU1iO4aS7dF0gH', 'post', 'u5Uu6Vv7Ww8', 1, 0, 1),
  ('vote_o7_bob', '2Vt9Lm4Qx7Nc1RsA', 'post', 'o7Oo8Pp9Qq0', 1, 0, 1),
  ('vote_o7_grace', 'Q4sN7kT0mV3xA6pR', 'post', 'o7Oo8Pp9Qq0', 1, 0, 1),
  ('vote_cm1_alice', '7Kp3nZ8QaM2wX5Rc', 'comment', 'a9Cs1vB4dGe', 1, 0, 1),
  ('vote_cm1_carol', 'H6sP0dK3wZ8mB2yQ', 'comment', 'a9Cs1vB4dGe', 1, 0, 1),
  ('vote_cm1_mira', 'A9cD2fG5hJ8kL1zX', 'comment', 'a9Cs1vB4dGe', 1, 0, 1),
  ('vote_cm2_bob', '2Vt9Lm4Qx7Nc1RsA', 'comment', 'm4Xu7kP2sRf', 1, 0, 1),
  ('vote_cm5_bob', '2Vt9Lm4Qx7Nc1RsA', 'comment', 'p5Tk9jF7uWs', 1, 0, 1),
  ('vote_cm5_dave', '9Aa4Cc7Ee1Gg3IiK', 'comment', 'p5Tk9jF7uWs', 1, 0, 1),
  ('vote_cd1_bob', '2Vt9Lm4Qx7Nc1RsA', 'comment', 'cmtD01alice1', 1, 0, 1),
  ('vote_cd1_erin', 'L2nR5tY8uW1qE4oP', 'comment', 'cmtD01alice1', 1, 0, 1),
  ('vote_cd1_frank', 'B7vD0fH3jL6zX9cM', 'comment', 'cmtD01alice1', 1, 0, 1),
  ('vote_ce1_jake', 'M0qR3tY6uI9oA2sD', 'comment', 'cmtE01grace1', 1, 0, 1),
  ('vote_ce1_nate', 'P6qW9eR2tY5uI8oA', 'comment', 'cmtE01grace1', 1, 0, 1),
  ('vote_cj1_bob', '2Vt9Lm4Qx7Nc1RsA', 'comment', 'cmtJ01grace1', 1, 0, 1),
  ('vote_cj1_carol', 'H6sP0dK3wZ8mB2yQ', 'comment', 'cmtJ01grace1', 1, 0, 1);

-- Canonical positive reactions; legacy votes above remain only as fixture history.
INSERT OR IGNORE INTO post_likes (post_id, user_id, created_at)
SELECT target_id, user_id, created_at
FROM votes
WHERE target_type = 'post' AND value = 1;

INSERT OR IGNORE INTO comment_likes (comment_id, user_id, created_at)
SELECT target_id, user_id, created_at
FROM votes
WHERE target_type = 'comment' AND value = 1;

UPDATE posts
SET like_count = (
  SELECT COUNT(*) FROM post_likes WHERE post_likes.post_id = posts.id
);

UPDATE comments
SET like_count = (
  SELECT COUNT(*) FROM comment_likes WHERE comment_likes.comment_id = comments.id
);


-- Keep the old vote rows only as a migration/rollback fixture. The app reads
-- post_likes, comment_likes, and like_count; it does not derive reputation here.
UPDATE posts
SET comment_count = (
  SELECT COUNT(*) FROM comments
  WHERE comments.post_id = posts.id
    AND comments.is_removed = 0
    AND comments.is_shadow_hidden = 0
    AND comments.is_deleted = 0
);



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
    '7Kp3nZ8QaM2wX5Rc'
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
    '7Kp3nZ8QaM2wX5Rc'
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
    '7Kp3nZ8QaM2wX5Rc'
  );

INSERT OR IGNORE INTO banned_words (id, word, severity, created_by) VALUES
  ('bw_001', 'spamlink', 'block', '7Kp3nZ8QaM2wX5Rc'),
  ('bw_002', 'shadownuke', 'shadow', '7Kp3nZ8QaM2wX5Rc');

INSERT OR IGNORE INTO user_activity (user_id, subreddit_id, score) VALUES
  ('7Kp3nZ8QaM2wX5Rc', 'sub_cloudflare', 12),
  ('2Vt9Lm4Qx7Nc1RsA', 'sub_programming', 8),
  ('H6sP0dK3wZ8mB2yQ', 'sub_webdev', 7),
  ('9Aa4Cc7Ee1Gg3IiK', 'sub_cloudflare', 5),
  ('L2nR5tY8uW1qE4oP', 'sub_technology', 6),
  ('B7vD0fH3jL6zX9cM', 'sub_cloudflare', 2),
  ('Q4sN7kT0mV3xA6pR', 'sub_webdev', 9),
  ('E8rU1iO4aS7dF0gH', 'sub_technology', 4),
  ('W3yC6bN9hK2lP5vX', 'sub_askred', 3),
  ('M0qR3tY6uI9oA2sD', 'sub_gaming', 6),
  ('Z5xV8nB1mK4pH7cQ', 'sub_webdev', 3),
  ('F2gJ5lS8dO1wE4rT', 'sub_photography', 5),
  ('A9cD2fG5hJ8kL1zX', 'sub_askred', 8),
  ('P6qW9eR2tY5uI8oA', 'sub_askred', 2);

UPDATE "user" SET createdAt = datetime('now', '-400 days'), isNsfw = 0, preferredLanguage = 'vi' WHERE id = '7Kp3nZ8QaM2wX5Rc';
UPDATE "user" SET createdAt = datetime('now', '-30 days'), isNsfw = 0 WHERE id = '2Vt9Lm4Qx7Nc1RsA';
UPDATE "user" SET createdAt = datetime('now', '-120 days'), isNsfw = 0 WHERE id = 'H6sP0dK3wZ8mB2yQ';
UPDATE "user" SET createdAt = datetime('now', '-14 days'), isNsfw = 1 WHERE id = '9Aa4Cc7Ee1Gg3IiK';
UPDATE "user" SET createdAt = datetime('now', '-220 days'), isNsfw = 0 WHERE id = 'L2nR5tY8uW1qE4oP';
UPDATE "user" SET createdAt = datetime('now', '-3 days'), isNsfw = 0 WHERE id = 'B7vD0fH3jL6zX9cM';
UPDATE "user" SET createdAt = datetime('now', '-90 days'), isNsfw = 0 WHERE id = 'Q4sN7kT0mV3xA6pR';
UPDATE "user" SET createdAt = datetime('now', '-60 days'), isNsfw = 0 WHERE id = 'E8rU1iO4aS7dF0gH';
UPDATE "user" SET createdAt = datetime('now', '-45 days'), isNsfw = 0, preferredLanguage = 'ko' WHERE id = 'W3yC6bN9hK2lP5vX';
UPDATE "user" SET createdAt = datetime('now', '-18 days'), isNsfw = 0 WHERE id = 'M0qR3tY6uI9oA2sD';
UPDATE "user" SET createdAt = datetime('now', '-7 days'), isNsfw = 0 WHERE id = 'Z5xV8nB1mK4pH7cQ';
UPDATE "user" SET createdAt = datetime('now', '-150 days'), isNsfw = 0 WHERE id = 'F2gJ5lS8dO1wE4rT';
UPDATE "user" SET createdAt = datetime('now', '-80 days'), isNsfw = 0 WHERE id = 'A9cD2fG5hJ8kL1zX';
UPDATE "user" SET createdAt = datetime('now', '-1 day'), isNsfw = 0 WHERE id = 'P6qW9eR2tY5uI8oA';

INSERT OR IGNORE INTO user_achievements (user_id, achievement_id, level) VALUES
  ('7Kp3nZ8QaM2wX5Rc', 'ach_admin', 1),
  ('7Kp3nZ8QaM2wX5Rc', 'ach_veteran', 1),
  ('7Kp3nZ8QaM2wX5Rc', 'ach_first_post', 1),
  ('7Kp3nZ8QaM2wX5Rc', 'ach_first_comment', 1),
  ('7Kp3nZ8QaM2wX5Rc', 'ach_community', 1),
  ('7Kp3nZ8QaM2wX5Rc', 'ach_laefye', 1),
  ('7Kp3nZ8QaM2wX5Rc', 'ach_verified_start', 1),
  ('H6sP0dK3wZ8mB2yQ', 'ach_moderator', 1),
  ('H6sP0dK3wZ8mB2yQ', 'ach_first_post', 1),
  ('H6sP0dK3wZ8mB2yQ', 'ach_first_comment', 1),
  ('H6sP0dK3wZ8mB2yQ', 'ach_verified_start', 1),
  ('2Vt9Lm4Qx7Nc1RsA', 'ach_first_post', 1),
  ('2Vt9Lm4Qx7Nc1RsA', 'ach_first_comment', 1),
  ('2Vt9Lm4Qx7Nc1RsA', 'ach_verified_start', 1),
  ('9Aa4Cc7Ee1Gg3IiK', 'ach_nsfw', 1),
  ('9Aa4Cc7Ee1Gg3IiK', 'ach_first_post', 1),
  ('9Aa4Cc7Ee1Gg3IiK', 'ach_first_comment', 1),
  ('9Aa4Cc7Ee1Gg3IiK', 'ach_verified_start', 1),
  ('L2nR5tY8uW1qE4oP', 'ach_first_post', 1),
  ('L2nR5tY8uW1qE4oP', 'ach_first_comment', 1),
  ('L2nR5tY8uW1qE4oP', 'ach_verified_start', 1),
  ('L2nR5tY8uW1qE4oP', 'ach_community', 1),
  ('B7vD0fH3jL6zX9cM', 'ach_first_post', 1),
  ('B7vD0fH3jL6zX9cM', 'ach_first_comment', 1),
  ('B7vD0fH3jL6zX9cM', 'ach_verified_start', 1),
  ('Q4sN7kT0mV3xA6pR', 'ach_first_post', 1),
  ('Q4sN7kT0mV3xA6pR', 'ach_first_comment', 1),
  ('Q4sN7kT0mV3xA6pR', 'ach_verified_start', 1),
  ('Q4sN7kT0mV3xA6pR', 'ach_laefye', 1),
  ('E8rU1iO4aS7dF0gH', 'ach_first_post', 1),
  ('E8rU1iO4aS7dF0gH', 'ach_verified_start', 1),
  ('W3yC6bN9hK2lP5vX', 'ach_first_post', 1),
  ('W3yC6bN9hK2lP5vX', 'ach_first_comment', 1),
  ('W3yC6bN9hK2lP5vX', 'ach_verified_start', 1),
  ('M0qR3tY6uI9oA2sD', 'ach_first_post', 1),
  ('M0qR3tY6uI9oA2sD', 'ach_first_comment', 1),
  ('M0qR3tY6uI9oA2sD', 'ach_verified_start', 1),
  ('M0qR3tY6uI9oA2sD', 'ach_community', 1),
  ('Z5xV8nB1mK4pH7cQ', 'ach_first_post', 1),
  ('Z5xV8nB1mK4pH7cQ', 'ach_first_comment', 1),
  ('Z5xV8nB1mK4pH7cQ', 'ach_verified_start', 1),
  ('F2gJ5lS8dO1wE4rT', 'ach_first_post', 1),
  ('F2gJ5lS8dO1wE4rT', 'ach_first_comment', 1),
  ('F2gJ5lS8dO1wE4rT', 'ach_verified_start', 1),
  ('F2gJ5lS8dO1wE4rT', 'ach_community', 1),
  ('A9cD2fG5hJ8kL1zX', 'ach_first_post', 1),
  ('A9cD2fG5hJ8kL1zX', 'ach_first_comment', 1),
  ('A9cD2fG5hJ8kL1zX', 'ach_verified_start', 1),
  ('A9cD2fG5hJ8kL1zX', 'ach_community', 1),
  ('P6qW9eR2tY5uI8oA', 'ach_first_post', 1),
  ('P6qW9eR2tY5uI8oA', 'ach_first_comment', 1),
  ('P6qW9eR2tY5uI8oA', 'ach_verified_start', 1);

-- Local fixtures represent completed profile setup.
UPDATE "user" SET onboardingComplete = 1 WHERE email LIKE '%@example.local';

-- Dev social identity for E2E session setup (no credential account).
INSERT OR IGNORE INTO account (
  id, accountId, providerId, userId, createdAt, updatedAt
) VALUES (
  'acc_alice_facebook',
  'e2e_alice',
  'facebook',
  '7Kp3nZ8QaM2wX5Rc',
  datetime('now'),
  datetime('now')
);
