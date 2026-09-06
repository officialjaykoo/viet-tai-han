import type { Metadata } from "next";

import { Code, DocHeader, Section } from "../_components";

export const metadata: Metadata = {
  title: "Architecture | VTH Developers",
  description: "VTH application architecture and Cloudflare services.",
  alternates: { canonical: "https://developers.vth.kr/architecture" },
};

export default function ArchitecturePage() {
  return (
    <>
      <DocHeader
        eyebrow="Platform"
        title="Architecture"
        description="VTH runs as a Next.js application on Cloudflare Workers with D1, R2, Durable Objects, and selected AI services."
      />

      <Section title="Application stack">
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            ["Runtime", "Cloudflare Workers + OpenNext"],
            ["Application", "Next.js + React + TypeScript"],
            ["Database", "Cloudflare D1"],
            ["Media", "Cloudflare R2"],
            ["Stateful coordination", "Durable Objects"],
            ["Authentication", "Better Auth"],
            ["AI", "Workers AI + Vectorize"],
            ["Testing", "Vitest + Playwright"],
          ].map(([name, value]) => (
            <div key={name} className="rounded-xl border border-border p-4">
              <div className="text-sm font-medium text-foreground">{name}</div>
              <div className="mt-1 text-sm">{value}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Request path">
        <Code>{`Browser\n  -> Cloudflare Worker\n  -> OpenNext / Next.js\n  -> D1 / R2 / Durable Objects / AI as needed`}</Code>
        <p>Edge rate limits run before expensive application work. The custom Worker entry also handles selected infrastructure concerns such as realtime chat routing.</p>
      </Section>

      <Section title="Repository map">
        <Code>{`src/app/          routes and API handlers\nsrc/components/   UI components\nsrc/lib/          domain and data logic\nsrc/worker.ts     Cloudflare Worker entry\nsrc/workers/      Durable Object classes\nmigrations/       D1 schema migrations\npublic/           static assets and service worker`}</Code>
      </Section>
    </>
  );
}
