import type { Metadata } from "next";

import { Code, DocHeader, Note, Section } from "../_components";

export const metadata: Metadata = {
  title: "Deployment | VTH Developers",
  description: "Cloudflare deployment basics for VTH.",
  alternates: { canonical: "https://developers.vth.kr/deployment" },
};

export default function DeploymentPage() {
  return (
    <>
      <DocHeader
        eyebrow="Operations"
        title="Deployment"
        description="VTH deploys as a Cloudflare Worker with application bindings for D1, R2, Durable Objects, Workers AI, and related services."
      />

      <Section title="Build and deploy">
        <Code>{`npm run preview\nnpm test\nnpm run deploy`}</Code>
        <p>The deploy script builds the OpenNext output and publishes the Worker configuration.</p>
      </Section>

      <Section title="Database migrations">
        <p>
          Apply required D1 migrations before deploying application code that depends on the new schema. For production, create and retain a backup, inspect the pending migration list, and apply migrations as an operator-run step:
        </p>
        <Code>{`npx wrangler d1 export vth-db --remote --output="backup-YYYYMMDD-HHmm.sql"
npx wrangler d1 migrations list vth-db --remote
npx wrangler d1 migrations apply vth-db --remote`}</Code>
        <Note>
          This application does not run production D1 migrations automatically. Do not run <code className="font-mono text-foreground">seed.sql</code> against production.
        </Note>
      </Section>

      <Section title="Bindings">
        <p>The Worker configuration defines the application database, media bucket, Durable Objects, Workers AI, rate limit bindings, environment variables, and custom domains.</p>
      </Section>

      <Section title="Environments">
        <Note>
          Do not reuse production secrets or production resource identifiers for an unrelated deployment. A separate environment should provision and reference its own Cloudflare resources.
        </Note>
      </Section>

      <Section title="Developer documentation domain">
        <p><code className="font-mono text-foreground">developers.vth.kr</code> is routed to the same Worker and served through the developer documentation route tree.</p>
      </Section>
    </>
  );
}
