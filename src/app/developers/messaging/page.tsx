import type { Metadata } from "next";

import { Code, DocHeader, Note, Section } from "../_components";

export const metadata: Metadata = {
  title: "Messaging | VTH Developers",
  description: "Direct messaging and message request rules in VTH.",
  alternates: { canonical: "https://developers.vth.kr/messaging" },
};

export default function MessagingPage() {
  return (
    <>
      <DocHeader
        eyebrow="Core concepts"
        title="Messaging"
        description="VTH supports direct messages and message requests, with access determined by social relationships and recipient privacy settings."
      />

      <Section title="Direct vs request">
        <Code>{`Sender A -> Recipient B\n\nblocked either direction  -> prohibited\nfriends                   -> direct\nB follows A               -> direct\notherwise                  -> message request`}</Code>
        <p>Request privacy settings are evaluated only when the relationship does not already grant direct messaging.</p>
      </Section>

      <Section title="Conversation identity">
        <p>Conversation membership is tied to immutable user IDs. Changing a public username must not create a new conversation or break an existing one.</p>
      </Section>

      <Section title="Realtime chat">
        <p>Realtime chat uses a Durable Object-backed WebSocket path for active rooms. Session and room membership checks happen before realtime access is granted.</p>
      </Section>

      <Section title="Reliability">
        <Note>Messaging mutations should be idempotent where practical. Duplicate requests, retries, and relationship changes must not create duplicate rooms or duplicate state transitions.</Note>
      </Section>
    </>
  );
}
