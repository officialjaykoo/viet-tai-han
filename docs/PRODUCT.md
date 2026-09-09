# VTH Product Contract

**Status:** Canonical  
**Product:** Việt tại Hàn (VTH)  
**Audience:** product, engineering, operations, future AI coding agents  
**Rule:** when implementation choices conflict with this document, the product intent in this document wins unless it is explicitly revised.

## 1. Mission

Việt tại Hàn is a Vietnamese-first community and social platform for people living in Korea or preparing for life in Korea.

The product exists to make practical life in Korea easier by combining information, trusted community participation, persistent social identity, direct relationships, local commerce, and service discovery in one place.

VTH is not trying to be a generic global social network. It is a focused product for the Korea–Vietnam community.

## 2. Primary users

Primary users include:

- Vietnamese residents in Korea
- international students
- workers and job seekers
- marriage migrants and families
- long-term residents
- newcomers preparing to move to Korea

Secondary users include:

- Koreans who interact with the Vietnamese community
- legitimate businesses and service providers serving Vietnamese residents
- community moderators and trusted local contributors

The product must remain useful to a new arrival with little local knowledge and to a long-term resident who wants durable relationships and local information.

## 3. Problems VTH should solve

### 3.1 Repeated life questions

Users repeatedly need answers about housing, visas, work, education, healthcare, transportation, banking, mobile service, government procedures, family life, and local customs.

VTH should turn repeated questions into searchable community knowledge rather than forcing the same information to disappear inside chat streams.

### 3.2 Fragmented communities

Useful information and relationships are scattered across social networks, group chats, local pages, and personal contacts. VTH should provide a durable public community layer where posts, Q&A, people, and local resources remain discoverable.

### 3.3 Weak connection between information and people

VTH is not only a forum. A useful answer, post, listing, or business should lead naturally to the person or organization behind it when appropriate.

Profiles, follows, friendships, blocks, presence, and 1:1 messaging exist to connect public participation with persistent social identity.

### 3.4 Local commerce and services

Users need a practical place to discover second-hand goods, relevant services, Vietnamese-friendly businesses, and local providers. Marketplace and business discovery are part of the core product, not unrelated add-ons.

## 4. Product pillars

### 4.1 Community

Users can discover, join, and participate in topic or locality-oriented communities. Community posts remain a primary public-content surface.

### 4.2 Social identity

A VTH account represents a persistent person. The immutable internal identity is distinct from the public username. Public profile, follow, friend, block, presence, and messaging are product-level concepts.

### 4.3 Q&A knowledge

Questions and accepted answers create durable, searchable knowledge. Q&A should favor clarity, answer quality, and long-term usefulness over chat-like ephemerality.

### 4.4 Marketplace

Users can create and discover local listings, save useful listings, report abuse, and connect to the seller through the existing social/messaging model.

### 4.5 Local businesses and services

Users can discover businesses and services relevant to Vietnamese residents in Korea. Business records, verification, booking/contact flows, and reports must remain separate from ordinary personal profiles where their lifecycle differs.

### 4.6 Direct relationships and messaging

Public discovery should be able to become a safe private relationship. VTH supports 1:1 messaging with request, block, moderation, unread, and realtime reliability controls.

### 4.7 Multilingual access

Vietnamese is the primary user experience. Korean support and translation exist to reduce language friction, not to make the product language-neutral at the cost of Vietnamese usability.

## 5. Core user journeys

### Journey A — New user

```text
Facebook / Kakao / Zalo
→ authenticated VTH identity
→ username/onboarding
→ language/preferences
→ discover communities/people/content
→ Home
```

A new user should not need an email/password VTH account.

### Journey B — Ask and learn

```text
Search
→ existing post/Q&A/business/listing if relevant
→ ask a new question if needed
→ community answers
→ accepted answer / durable knowledge
```

### Journey C — Discover a person

```text
Home / Popular / Community / Search / Q&A
→ content
→ author profile
→ follow/friend when useful
→ 1:1 message when allowed
```

### Journey D — Local transaction

```text
Marketplace
→ listing
→ seller profile
→ save/report/message
→ transaction outside or through agreed contact flow
```

VTH is not a payment escrow system unless that is explicitly added in a future product decision.

### Journey E — Find a service

```text
Business discovery
→ business detail
→ trust/verification information
→ contact or booking action
```

## 6. Product principles

1. **Vietnamese-first.** Vietnamese UX has priority; Korean support should improve access without displacing it.
2. **Mobile-first, desktop-complete.** Core journeys must work well on common mobile widths and remain efficient on desktop.
3. **Public knowledge should remain discoverable.** Community information should not become unnecessarily private or ephemeral.
4. **Identity is persistent; handles are mutable.** `user.id` is identity. `username` is a public handle.
5. **Block is an interaction barrier, not automatic public-content erasure.** A block prevents new positive interaction and contact; ordinary public content may still be directly readable unless moderation says otherwise.
6. **Server truth before client convenience.** Optimistic UI may improve responsiveness but may never become the authority for durable state.
7. **Simple infrastructure before clever infrastructure.** Add new infrastructure only when the existing Cloudflare/D1 design cannot reasonably satisfy a measured requirement.
8. **Features must justify maintenance cost.** A visually attractive or fashionable feature is not automatically valuable to VTH.
9. **Abuse controls are part of the feature.** A social feature is incomplete if its block, report, moderation, rate-limit, and retry behavior are undefined.
10. **One canonical implementation per responsibility.** External-source patterns may be adopted, but parallel RED/VTH/Clonagram/other implementations must not remain in production.
11. **Recoverable projections, canonical rows.** Counters, unread badges, previews, ranks, caches, and live events are derived from canonical records.
12. **Operational simplicity matters.** The project is expected to remain maintainable by a small team with AI-assisted development.

## 7. Trust and safety contract

VTH should make normal participation easy while making abuse expensive and reversible.

Required principles:

- authentication and authorization are server-side concerns
- active/banned/shadow/moderation state is enforced at authoritative boundaries
- block checks apply bilaterally where a new positive relationship or contact is created
- reporting remains available when interaction is otherwise blocked
- moderation-hidden content is not exposed through alternate public surfaces such as detail, redirects, analytics, or search
- notification and push fanout must not bypass current block/moderation state
- retries must not duplicate canonical writes or user-visible side effects

## 8. Current product scope

Current VTH scope includes:

- social-only authentication
- onboarding and profile management
- communities
- posts, comments, likes, search, Home, Popular, Recommended
- follow, friend, block, presence
- 1:1 realtime direct messaging and message requests
- notifications and browser push
- Q&A and accepted answers
- marketplace listings, saves, alerts, and reports
- business profiles, verification/report/booking support
- multilingual content/translation support
- admin and moderation surfaces
- developer documentation/API foundations

This list describes the current product family, not a promise that every surface is equally mature.

## 9. Explicit non-goals for the current stage

VTH is not currently trying to become:

- an Instagram clone
- a Reddit clone
- a Facebook clone
- a TikTok/Reels platform
- a generic worldwide social network
- an ActivityPub server
- an AT Protocol implementation
- a group-chat/calling platform
- an end-to-end payment or escrow platform
- an AI-first social network

The current architecture intentionally does not require:

- federation
- microservices
- Redis or Kafka
- a graph database
- Vector DB / embedding infrastructure for ordinary recommendations
- a separate recommendation service
- a generic repository/DAO abstraction
- Supabase compatibility

A non-goal can change later, but only through an explicit product and architecture decision.

## 10. Feature prioritization

New work should be scored against the following questions:

| Question | Weight |
| --- | --- |
| Does it improve a core VTH journey? | Very high |
| Does it improve safety, correctness, or trust? | Very high |
| Does it reduce maintenance/operational cost? | High |
| Does it improve Vietnamese/mobile usability? | High |
| Is there evidence users need it? | High |
| Can the existing architecture support it simply? | High |
| Does it add a new permanent subsystem/dependency? | Negative unless justified |
| Does it duplicate an existing capability? | Strong negative |

A feature with low user impact and high architecture cost should normally be rejected or deferred.

## 11. Open-source reference policy

VTH may learn from and adapt proven patterns from RED, Clonagram, Discourse, Lemmy, Apache Answer, Bluesky, GoToSocial, or other projects.

The goal is not source loyalty and not equal adoption from each project.

For every candidate pattern:

```text
VTH problem
→ external pattern
→ compare correctness / simplicity / maintenance / fit
→ adopt only if better
→ translate into VTH-native types, D1 semantics, identity, security, and naming
→ remove the displaced VTH/legacy path
```

An external project is a reference or donor, not a second architecture living beside VTH.

## 12. Product quality bar

VTH is ready to expand only when core flows are both useful and trustworthy.

The standing quality bar is:

- canonical data ownership is documented
- migrations are forward-only and reproducible
- lint/typecheck/tests/build gates are green
- critical user journeys have browser coverage
- core write paths are idempotent or explicitly non-retriable
- block/moderation behavior is defined for each social interaction
- no known duplicate canonical implementation remains for the same responsibility
- production operations, backup, and recovery remain understandable to a small team

## 13. Decision rule

When choosing between a new feature and making an existing core journey more reliable, prefer reliability until the core journey is demonstrably stable.

When choosing between a clever architecture and a simpler architecture that meets the same requirement, prefer the simpler architecture.

When an external project has a better solution, use it. When VTH is already stronger, keep VTH. The final result must still look like one coherent system.