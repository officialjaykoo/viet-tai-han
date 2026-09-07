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
        <p>Realtime chat uses a Durable Object-backed WebSocket path for active rooms. Session and room membership checks happen before realtime access is granted. A message is committed to D1 before the live event is attempted; the broadcast, push notification, and unread fanout run after the write, and a WebSocket failure never turns a successful D1 write into a failed send.</p>
      </Section>

      <Section title="History and recovery">
        <p>Room history loads the latest page first. Signed before and after cursors provide older-history pagination and reconnect catch-up without exposing mutable database cursors. The browser reconciles D1, HTTP, and live responses by server message ID or the sender&apos;s non-null clientMessageId, then orders them by the server timestamp and message ID tuple.</p>
      </Section>

      <Section title="Read state">
        <p>Loading history is read-only. The client explicitly marks the latest visible message as read only while the viewport is at the bottom. Unread counts are calculated from the persisted per-room read boundary; the fanout table is only a derived cache.</p>
      </Section>

      <Section title="Reliability">
        <Note>Every client send should include a stable clientMessageId. The sender sees an optimistic bubble immediately with sending, sent, or failed state; a failed bubble remains available for retry with the same ID. Retries return the original canonical message instead of inserting another row. Duplicate request acceptance is idempotent, while conflicting actions remain errors.</Note>
      </Section>
    </>
  );
}
