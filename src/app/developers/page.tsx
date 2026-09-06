import type { Metadata } from "next";

import { CardGrid, DocHeader, Note, Section } from "./_components";

export const metadata: Metadata = {
  title: "VTH Developers",
  description: "Developer documentation for the VTH social and community platform.",
  alternates: { canonical: "https://developers.vth.kr/" },
};

const guides = [
  ["Getting started", "Run the project locally and understand the basic repository workflow.", "/getting-started"],
  ["Architecture", "See how Next.js, Workers, D1, R2, Durable Objects, AI, and Vectorize fit together.", "/architecture"],
  ["Identity & auth", "Understand immutable user IDs, public usernames, social sign-in, and account linking.", "/identity"],
  ["Social graph", "Follow, friendship, blocking, and the relationship rules used across VTH.", "/social-graph"],
  ["Messaging", "Direct messages, message requests, relationship-based access, and realtime chat.", "/messaging"],
  ["API", "A high-level map of application APIs and the current status of the public integration surface.", "/api"],
  ["Security", "Server-side authorization, rate limits, secrets, moderation, and security reporting.", "/security"],
  ["Deployment", "Cloudflare bindings, migrations, build, and deployment basics.", "/deployment"],
] as const;

export default function DevelopersPage() {
  return (
    <>
      <DocHeader
        eyebrow="VTH Developer Platform"
        title="Build on VTH."
        description="VTH is a full-stack social and community platform with profiles, social relationships, messaging, notifications, community content, search, marketplace features, and Cloudflare-native infrastructure."
      />

      <div className="mt-8 flex flex-wrap gap-3">
        <a
          href="https://developers.vth.kr/getting-started"
          className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background"
        >
          Get started
        </a>
        <a
          href="https://github.com/officialjaykoo/viet-tai-han"
          target="_blank"
          rel="noreferrer"
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium"
        >
          View source
        </a>
      </div>

      <CardGrid items={guides} />

      <Section title="Core model">
        <p>
          VTH treats <code className="font-mono text-foreground">user.id</code> as the canonical account identity. Public usernames are mutable handles. Follow relationships are directional, friendships are bidirectional, and blocking overrides ordinary social actions.
        </p>
      </Section>

      <Section title="Documentation status">
        <Note>
          This guide is intentionally concise while the product is still evolving. The repository remains the authoritative source for implementation details, endpoint behavior, and database schema.
        </Note>
      </Section>
    </>
  );
}
