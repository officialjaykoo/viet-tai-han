import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "VTH Developers",
  description: "Developer guide for the VTH social and community platform.",
  alternates: {
    canonical: "https://developers.vth.kr/",
  },
};

const sections = [
  ["overview", "Overview"],
  ["architecture", "Architecture"],
  ["local-development", "Local development"],
  ["identity", "Identity & auth"],
  ["social-graph", "Social graph"],
  ["messaging", "Messaging"],
  ["api", "API"],
  ["security", "Security"],
  ["deployment", "Deployment"],
] as const;

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-xl border border-border bg-muted/50 p-4 font-mono text-sm leading-6">
      <code>{children}</code>
    </pre>
  );
}

export default function DevelopersPage() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-5">
          <a href="/" className="font-semibold tracking-tight">
            VTH <span className="text-muted-foreground">Developers</span>
          </a>
          <div className="flex items-center gap-4 text-sm">
            <a className="text-muted-foreground hover:text-foreground" href="https://vth.kr">
              vth.kr
            </a>
            <a
              className="text-muted-foreground hover:text-foreground"
              href="https://github.com/officialjaykoo/viet-tai-han"
              rel="noreferrer"
              target="_blank"
            >
              GitHub
            </a>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl grid-cols-1 md:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="hidden border-r border-border px-5 py-8 md:block">
          <nav className="sticky top-20 space-y-1 text-sm">
            {sections.map(([id, label]) => (
              <a
                key={id}
                href={`#${id}`}
                className="block rounded-md px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {label}
              </a>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 px-5 py-10 md:px-10 md:py-14">
          <div className="max-w-3xl">
            <section id="overview" className="scroll-mt-24">
              <p className="mb-3 text-sm font-medium text-muted-foreground">VTH Developer Platform</p>
              <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
                Build on VTH.
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
                VTH is a full-stack social and community platform with profiles, follows,
                friends, messaging, notifications, communities, content, search, marketplace,
                and recommendation features running on Cloudflare.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a
                  href="#local-development"
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
            </section>

            <section id="architecture" className="mt-16 scroll-mt-24">
              <h2 className="text-2xl font-semibold tracking-tight">Architecture</h2>
              <p className="mt-4 leading-7 text-muted-foreground">
                The application is built with Next.js and OpenNext on Cloudflare Workers.
                D1 stores relational data, R2 stores media, Durable Objects coordinate selected
                stateful workloads, and Workers AI / Vectorize support AI-assisted features.
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {[
                  ["Runtime", "Cloudflare Workers + OpenNext"],
                  ["Database", "Cloudflare D1"],
                  ["Media", "Cloudflare R2"],
                  ["Auth", "Better Auth"],
                  ["Frontend", "Next.js + React + TypeScript"],
                  ["Testing", "Vitest + Playwright"],
                ].map(([name, value]) => (
                  <div key={name} className="rounded-xl border border-border p-4">
                    <div className="text-sm font-medium">{name}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{value}</div>
                  </div>
                ))}
              </div>
            </section>

            <section id="local-development" className="mt-16 scroll-mt-24">
              <h2 className="text-2xl font-semibold tracking-tight">Local development</h2>
              <p className="mt-4 leading-7 text-muted-foreground">
                Node.js 22+ and npm are recommended. Social login requires provider credentials
                in your local environment.
              </p>
              <div className="mt-5">
                <Code>{`git clone https://github.com/officialjaykoo/viet-tai-han.git\ncd viet-tai-han\nnpm ci\ncp .dev.vars.example .dev.vars\nnpm run db:reset:local\nnpm run dev`}</Code>
              </div>
            </section>

            <section id="identity" className="mt-16 scroll-mt-24">
              <h2 className="text-2xl font-semibold tracking-tight">Identity & authentication</h2>
              <p className="mt-4 leading-7 text-muted-foreground">
                VTH uses social authentication. Internal relationships use immutable user IDs.
                Public usernames are mutable handles and must not be treated as canonical account
                identity.
              </p>
              <ul className="mt-4 list-disc space-y-2 pl-6 text-muted-foreground">
                <li>Canonical identity: <code className="font-mono text-foreground">user.id</code></li>
                <li>Public handle: <code className="font-mono text-foreground">@username</code></li>
                <li>Supported sign-in providers include Facebook, Kakao, and Zalo.</li>
                <li>Email is contact metadata, not the primary identity key.</li>
              </ul>
            </section>

            <section id="social-graph" className="mt-16 scroll-mt-24">
              <h2 className="text-2xl font-semibold tracking-tight">Social graph</h2>
              <p className="mt-4 leading-7 text-muted-foreground">
                Follow relationships are directional. Friendships are bidirectional after
                acceptance. Blocking overrides normal social interaction and is enforced by the
                server.
              </p>
              <Code>{`A follows B      A -> B\nA and B friends  A <-> B\nBlock            social actions prohibited`}</Code>
            </section>

            <section id="messaging" className="mt-16 scroll-mt-24">
              <h2 className="text-2xl font-semibold tracking-tight">Messaging</h2>
              <p className="mt-4 leading-7 text-muted-foreground">
                Direct-message access depends on the relationship between sender and recipient.
                Friends can message directly. A sender can also message directly when the
                recipient already follows that sender; otherwise the conversation begins as a
                message request, subject to recipient privacy settings.
              </p>
            </section>

            <section id="api" className="mt-16 scroll-mt-24">
              <h2 className="text-2xl font-semibold tracking-tight">API</h2>
              <p className="mt-4 leading-7 text-muted-foreground">
                The repository contains application APIs for social actions, content, messaging,
                notifications, search, settings, and other VTH features. The public integration
                surface is still evolving, so use the source code as the authoritative contract
                for now.
              </p>
              <Code>{`src/app/api/\nsrc/lib/\nsrc/worker.ts`}</Code>
            </section>

            <section id="security" className="mt-16 scroll-mt-24">
              <h2 className="text-2xl font-semibold tracking-tight">Security</h2>
              <p className="mt-4 leading-7 text-muted-foreground">
                Never commit production secrets. Authentication, authorization, block/privacy
                checks, rate limits, moderation, and abuse controls must be enforced server-side.
                See SECURITY.md in the repository for the current reporting policy.
              </p>
            </section>

            <section id="deployment" className="mt-16 scroll-mt-24 pb-20">
              <h2 className="text-2xl font-semibold tracking-tight">Deployment</h2>
              <p className="mt-4 leading-7 text-muted-foreground">
                The production application uses a Cloudflare Worker with D1, R2, Durable Objects,
                and related bindings. Apply database migrations before deploying a build that
                depends on them.
              </p>
              <div className="mt-5">
                <Code>{`npx wrangler d1 migrations apply vth-db --remote\nnpm run deploy`}</Code>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
