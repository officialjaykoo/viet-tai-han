import type { Metadata } from "next";

import { Code, DocHeader, Note, Section } from "../_components";

export const metadata: Metadata = {
  title: "Getting Started | VTH Developers",
  description: "Local development basics for VTH.",
  alternates: { canonical: "https://developers.vth.kr/getting-started" },
};

export default function GettingStartedPage() {
  return (
    <>
      <DocHeader
        eyebrow="Guide"
        title="Getting started"
        description="Clone the repository, prepare a local Cloudflare environment, run D1 migrations, and start the Next.js development server."
      />

      <Section title="Requirements">
        <ul className="list-disc space-y-2 pl-6">
          <li>Node.js 22 or newer</li>
          <li>npm</li>
          <li>A Cloudflare account for remote Cloudflare services</li>
          <li>Provider credentials when testing social login</li>
        </ul>
      </Section>

      <Section title="Install and run">
        <Code>{`git clone https://github.com/officialjaykoo/viet-tai-han.git\ncd viet-tai-han\nnpm ci\ncp .dev.vars.example .dev.vars\nnpm run db:reset:local\nnpm run dev`}</Code>
        <p>Open <code className="font-mono text-foreground">http://localhost:3000</code> after the development server starts.</p>
      </Section>

      <Section title="Useful commands">
        <Code>{`npm run dev\nnpm run preview\nnpm test\nnpm run test:e2e:chromium\nnpm run db:migrate:local`}</Code>
      </Section>

      <Section title="Local secrets">
        <Note>
          Keep real credentials in local secret files or Cloudflare Worker secrets. Never commit production secrets, OAuth client secrets, VAPID private keys, or Cloudflare API credentials.
        </Note>
      </Section>
    </>
  );
}
