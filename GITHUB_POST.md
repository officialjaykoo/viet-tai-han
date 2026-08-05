# GitHub posting kit

Paste-ready text for publishing this repo. Not required in the repository tree —
delete this file before the first commit if you prefer a cleaner root.

---

## Repository description (About sidebar)

```
Reddit-style community app that runs entirely on Cloudflare — Workers, D1, R2, Durable Objects, Vectorize, Workers AI, Turnstile. Built with Cursor.
```

## Topics / tags

```
cloudflare workers d1 r2 durable-objects vectorize workers-ai turnstile nextjs opennext better-auth cursor
```

## Short release / README blurb

**red** is an open-source Reddit clone that never leaves Cloudflare’s network.

Workers + OpenNext host the Next.js UI and APIs. D1 is the database. R2 stores media. Durable Objects aggregate votes. Vectorize + Workers AI power recommendations and translation. Turnstile and Workers Rate Limiting handle bots and floods — before SSR can burn CPU.

It was built primarily with Cursor (AI pair-programming), with human direction on architecture. This repo is source and deploy docs only — no hosted demo. Clone it, create your bindings, `npm run deploy`.

---

## Longer “Show HN / Discord / blog” summary

I built **red**, a full Reddit-style community platform that runs exclusively on Cloudflare.

The point wasn’t another toy Worker hello-world. It was to see whether Cloudflare’s stack is mature enough for a real product surface: auth, feeds, votes, comments, DMs, media, search, recommendations, ads, moderation, i18n, and bot defense — without a classic app server or a database host somewhere else.

**What’s on Cloudflare**

- Workers + OpenNext (Next.js at the edge)
- D1 (SQL)
- R2 (media)
- Durable Objects (per-post vote aggregation)
- Vectorize + Workers AI (embeddings, recommendations, translation)
- Turnstile + Workers Rate Limiting (humans + cheap flood gates)
- Workers Logs for observability

**How it was built**

Almost all of the implementation was written by an AI coding agent in Cursor. I steered product and architecture (single Worker instead of a separate DO script, sealed Protobuf tunnel, edge rate limits before OpenNext, Turnstile in-process instead of a side Worker, etc.). The repo is meant to be an honest artifact of that workflow — readable code, tests, and deploy instructions.

There is no live demo attached to this release; the Cloudflare footprint was torn down after validation. Fork it and deploy your own with the README checklist.
