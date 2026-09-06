import type { ReactNode } from "react";

export function DocHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <header>
      <p className="text-sm font-medium text-muted-foreground">{eyebrow}</p>
      <h1 className="mt-2 text-4xl font-bold tracking-tight md:text-5xl">{title}</h1>
      <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">{description}</p>
    </header>
  );
}

export function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-12">
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      <div className="mt-4 space-y-4 leading-7 text-muted-foreground">{children}</div>
    </section>
  );
}

export function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-xl border border-border bg-muted/50 p-4 font-mono text-sm leading-6 text-foreground">
      <code>{children}</code>
    </pre>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm leading-6 text-muted-foreground">
      {children}
    </div>
  );
}

export function CardGrid({
  items,
}: {
  items: readonly (readonly [string, string, string])[];
}) {
  return (
    <div className="mt-8 grid gap-3 sm:grid-cols-2">
      {items.map(([title, text, href]) => (
        <a
          key={href}
          href={`https://developers.vth.kr${href}`}
          className="rounded-xl border border-border p-5 transition-colors hover:bg-muted/40"
        >
          <div className="font-medium">{title}</div>
          <div className="mt-2 text-sm leading-6 text-muted-foreground">{text}</div>
        </a>
      ))}
    </div>
  );
}
