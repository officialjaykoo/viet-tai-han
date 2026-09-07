# GitHub posting kit

Paste-ready text for publishing this repo. Not required in the repository tree —
delete this file before the first commit if you prefer a cleaner root.

---

## Repository description (About sidebar)

```
Việt tại Hàn social and community platform on Cloudflare — Workers, D1, R2, Durable Objects, Workers AI translation, Turnstile.
```

## Topics / tags

```
cloudflare workers d1 r2 durable-objects workers-ai turnstile nextjs opennext better-auth
```

## Short release / README blurb

**Việt tại Hàn (VTH)** is a social and community platform for Vietnamese and Korean users.

Workers + OpenNext host the Next.js UI and APIs. D1 is the source of truth for posts, comments, likes, messaging, discovery, marketplace, and business features. R2 stores media. Durable Objects handle realtime chat delivery only. Workers AI is limited to content translation. Turnstile and Workers Rate Limiting handle bot and flood controls.

This repository contains source and deploy documentation only — no hosted demo. Clone it, configure your bindings, and run `npm run deploy`.

---

## Longer “Show HN / Discord / blog” summary

I built **Việt tại Hàn (VTH)**, a social and community platform that runs on Cloudflare.

The product combines relationship-first social features with Vietnamese community content, messaging, discovery, search, marketplace, local business profiles, and moderation. The backend keeps core writes and reads boring: D1 is canonical, R2 stores media, and Durable Objects are reserved for realtime chat delivery.

**What’s on Cloudflare**

- Workers + OpenNext (Next.js at the edge)
- D1 (canonical SQL state for content, likes, relationships, and messaging)
- R2 (media)
- Durable Objects (realtime chat room fanout)
- Workers AI (content translation only)
- Turnstile + Workers Rate Limiting (bot and flood controls)
- Workers Logs for observability

**How it was built**

The repository keeps the application source, migrations, tests, and deployment checklist together. Likes use one D1 row per user-target pair, feed discovery is D1-based, and retried user-created writes accept an idempotency key so a network retry does not duplicate rows or notifications.

There is no live demo attached to this release; deploy with the resource and secret checklist in the README.
