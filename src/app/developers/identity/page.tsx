import type { Metadata } from "next";

import { Code, DocHeader, Note, Section } from "../_components";

export const metadata: Metadata = {
  title: "Identity & Auth | VTH Developers",
  description: "Identity and authentication concepts in VTH.",
  alternates: { canonical: "https://developers.vth.kr/identity" },
};

export default function IdentityPage() {
  return (
    <>
      <DocHeader
        eyebrow="Core concepts"
        title="Identity & authentication"
        description="VTH separates immutable account identity from public profile handles and uses social sign-in for account entry."
      />

      <Section title="Canonical identity">
        <Code>{`user.id       immutable internal identity\n@username     mutable public handle\nprovider ID   external login identity`}</Code>
        <p>Internal relationships, messages, friendships, follows, and authorization should use <code className="font-mono text-foreground">user.id</code>, never the username as the permanent key.</p>
      </Section>

      <Section title="Social sign-in">
        <p>VTH currently supports social authentication through Better Auth, including Facebook, Kakao, and Zalo integrations.</p>
        <p>New accounts complete onboarding after social sign-in. A provider account maps to a VTH user record; provider email data is treated as contact metadata rather than the canonical account identity.</p>
      </Section>

      <Section title="Usernames">
        <p>Public usernames are intended for profile URLs and visible <code className="font-mono text-foreground">@handles</code>. They can change without changing the underlying account.</p>
        <Note>Code that needs a durable relationship must store the user ID. Resolve a username to a user ID at the boundary, then use the ID internally.</Note>
      </Section>

      <Section title="Account linking">
        <p>Multiple social providers can be explicitly linked to one signed-in VTH account. Automatic merging by matching email addresses is not the identity model.</p>
      </Section>
    </>
  );
}
