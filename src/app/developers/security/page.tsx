import type { Metadata } from "next";

import { Code, DocHeader, Note, Section } from "../_components";

export const metadata: Metadata = {
  title: "Security | VTH Developers",
  description: "Security guidance for VTH development and integrations.",
  alternates: { canonical: "https://developers.vth.kr/security" },
};

export default function SecurityPage() {
  return (
    <>
      <DocHeader
        eyebrow="Platform"
        title="Security"
        description="VTH relies on server-side authorization, relationship checks, rate limits, moderation controls, and careful secret handling."
      />

      <Section title="Server-side enforcement">
        <p>UI state is not an authorization boundary. Sensitive actions must validate the authenticated user, target resource, ownership, account status, and relevant social/privacy rules on the server.</p>
      </Section>

      <Section title="Secrets">
        <Code>{`BETTER_AUTH_SECRET\nTURNSTILE_SECRET_KEY\nOAuth client secrets\nVAPID private key\nCloudflare API credentials\nwebhook secrets`}</Code>
        <p>Production secrets belong in Cloudflare Worker secrets or another appropriate secret store. Do not commit them to the repository.</p>
      </Section>

      <Section title="Abuse controls">
        <p>VTH uses multiple layers rather than a single reputation gate: account state, server-side relationship rules, rate limits, moderation, blocking, and behavioral controls.</p>
      </Section>

      <Section title="Reporting vulnerabilities">
        <Note>
          Do not publish exploitable security issues in a public issue before a fix is available. Follow the repository security policy in <code className="font-mono text-foreground">SECURITY.md</code>.
        </Note>
      </Section>
    </>
  );
}
