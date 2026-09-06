# About Việt tại Hàn

**Việt tại Hàn (VTH)** is a full-stack social and community application designed to run primarily on Cloudflare.

Production deployment: **https://vth.kr**

## What VTH is

VTH combines a social graph with community and local-service features in one application:

- public profiles and mutable `@username` handles
- follows, friends, blocks, and presence
- direct messages and message requests
- notifications and browser push
- communities, posts, comments, and voting
- questions and answers
- marketplace listings
- local-business discovery
- personalized recommendations
- multilingual UI

The product model is closer to a Facebook/Instagram-style social layer than to the Reddit-style interaction model of the upstream codebase.

## Software architecture

VTH is implemented as a modern edge-first web application using:

- Next.js and React
- TypeScript
- Better Auth
- Cloudflare Workers + OpenNext
- D1 for relational data
- R2 for media
- Durable Objects where stateful coordination is useful
- Workers AI and Vectorize for AI-assisted features
- Turnstile and rate limiting for abuse controls
- browser Web Push via VAPID

The application keeps immutable internal user IDs separate from mutable public usernames. Social relationships, messaging, blocking, notifications, and moderation operate on internal IDs rather than public handles.

## Project lineage

This repository began as a fork of the MIT-licensed [`koval01/red`](https://github.com/koval01/red) project.

VTH has substantially changed the product model, authentication, identity, social relationships, messaging rules, localization, Cloudflare deployment, and community features.

The upstream MIT copyright notice is retained in [`LICENSE`](LICENSE).

## Product principles

### People-first identity

Internal relationships use immutable `user.id` values. Public usernames are handles that can change without changing account identity.

### Social relationships over karma gates

Reputation can be useful as a community signal, but it should not become the universal authorization mechanism for normal users.

### Explicit privacy rules

Follow, friend, block, direct-message, and message-request behavior should be predictable and enforced on the server.

### Retry-safe social actions

Follow, friend, block, messaging, notifications, and related state transitions should be idempotent and race-safe.

### Edge-first deployment

The application is designed around Cloudflare Workers, D1, R2, Durable Objects, Turnstile, and related services rather than a traditional long-running application server.

### Multilingual UI

The application supports multiple interface languages and is designed so localization is part of the product architecture rather than an afterthought.

## Development status

VTH is under active development.

The project is currently auditing and replacing assumptions inherited from the original Reddit-style implementation, especially around:

- social relationship state transitions
- privacy and blocking
- direct messaging
- notification delivery
- race conditions and retries
- Worker CPU/resource limits
- mobile usability
- moderation and abuse handling

This repository should be treated as actively evolving software rather than a finished, fully audited social-network platform.

## Independence

VTH is not affiliated with or endorsed by Meta, Facebook, Instagram, Reddit, Kakao, Zalo, or Cloudflare. References to those products describe integrations or product-design inspiration only.

## License

VTH is distributed under the MIT License. See [`LICENSE`](LICENSE).

## Suggested GitHub About metadata

**Description**

> Full-stack social and community platform with profiles, follows/friends, DMs, notifications, Q&A, marketplace, recommendations, and local-service discovery on Cloudflare.

**Website**

> https://vth.kr

**Suggested topics**

`social-network` · `community-platform` · `nextjs` · `cloudflare-workers` · `cloudflare-d1` · `cloudflare-r2` · `typescript` · `better-auth` · `web-push` · `open-next`
