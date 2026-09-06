import type { Metadata } from "next";

import { Code, DocHeader, Note, Section } from "../_components";

export const metadata: Metadata = {
  title: "Social Graph | VTH Developers",
  description: "Follow, friendship, and block relationships in VTH.",
  alternates: { canonical: "https://developers.vth.kr/social-graph" },
};

export default function SocialGraphPage() {
  return (
    <>
      <DocHeader
        eyebrow="Core concepts"
        title="Social graph"
        description="VTH combines directional follows, bidirectional friendships, and server-enforced blocking rules."
      />

      <Section title="Relationship types">
        <Code>{`Follow      A -> B\nFriendship  A <-> B\nBlock       overrides ordinary social actions`}</Code>
        <p>A follow is directional. A friendship becomes bidirectional after acceptance. Blocking takes precedence over normal follow, friend, profile-action, and messaging flows.</p>
      </Section>

      <Section title="Follow">
        <p>Following is lightweight and directional. It can influence discovery, notifications, and message access rules, but it does not automatically create a friendship.</p>
      </Section>

      <Section title="Friendship">
        <p>Friendships use a request and acceptance flow. Once accepted, both users are considered friends until the relationship is removed or invalidated by another relationship state such as blocking.</p>
      </Section>

      <Section title="Blocking">
        <p>Blocking is enforced on the server and should be checked in both directions for social actions. A blocked relationship must not rely on UI hiding alone.</p>
        <Note>When adding a new social feature, audit how it behaves for no relationship, one-way follow, mutual follow, friends, blocked-by-me, and blocked-by-them states.</Note>
      </Section>
    </>
  );
}
