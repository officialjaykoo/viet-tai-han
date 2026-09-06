# About Việt tại Hàn

**Việt tại Hàn (VTH)** is an independent social and community platform for Vietnamese people living in Korea.

Production site: **https://vth.kr**

## What VTH is

VTH combines social-network relationships with practical community tools:

- public profiles and mutable `@username` handles
- follows, friends, blocks, and presence
- direct messages and message requests
- notifications and browser push
- communities, posts, comments, and voting
- questions and answers
- marketplace listings
- local-business discovery
- personalized recommendations
- multilingual UI for Vietnamese, Korean, English, and Russian

The product direction is closer to a Facebook/Instagram-style social graph than to the Reddit-style interaction model of the upstream codebase.

## Who it is for

The primary audience is Vietnamese residents in Korea who need one place to:

- ask practical questions
- find people and communities
- communicate privately
- discover local services and businesses
- buy and sell items
- share useful local information

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

### Multilingual by default

Vietnamese and Korean are central to the product, while English and Russian are also supported in the UI.

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

> Social and community platform for Vietnamese people in Korea — profiles, follows/friends, DMs, Q&A, marketplace and local businesses on Cloudflare.

**Website**

> https://vth.kr

**Suggested topics**

`vietnamese` · `korea` · `social-network` · `community` · `nextjs` · `cloudflare-workers` · `cloudflare-d1` · `cloudflare-r2` · `typescript` · `better-auth`
