import type { Metadata } from "next";

import { Code, DocHeader, Note, Section } from "../_components";

export const metadata: Metadata = {
  title: "API | VTH Developers",
  description: "High-level API guide for VTH.",
  alternates: { canonical: "https://developers.vth.kr/api" },
};

export default function ApiPage() {
  return (
    <>
      <DocHeader
        eyebrow="Reference"
        title="API"
        description="VTH exposes application APIs for social actions, content, messaging, notifications, settings, search, and related product features."
      />

      <Section title="Current status">
        <p>The public integration surface is still evolving. For now, the repository is the authoritative contract for routes, validation, permissions, and response shapes.</p>
        <Code>{`src/app/api/\nsrc/lib/\nsrc/worker.ts`}</Code>
      </Section>

      <Section title="Common API areas">
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            ["Users", "Profiles, settings, relationships"],
            ["Social", "Follow, friend, block"],
            ["Messaging", "Rooms, requests, messages"],
            ["Content", "Posts, comments, communities"],
            ["Notifications", "Notification state and unread counts"],
            ["Discovery", "Search and recommendations"],
          ].map(([name, value]) => (
            <div key={name} className="rounded-xl border border-border p-4">
              <div className="text-sm font-medium text-foreground">{name}</div>
              <div className="mt-1 text-sm">{value}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Authentication and authorization">
        <p>Do not assume that a valid session is sufficient for every action. Relationship rules, ownership checks, moderation state, and block/privacy rules are enforced at the application layer.</p>
      </Section>

      <Section title="Internal interfaces">
        <Note>Not every route in the repository is a supported public integration API. Internal transport, security, and infrastructure endpoints should not be treated as stable external contracts.</Note>
      </Section>
    </>
  );
}
