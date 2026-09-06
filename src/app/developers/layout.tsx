import type { ReactNode } from "react";

const navigation = [
  ["/", "Overview"],
  ["/getting-started", "Getting started"],
  ["/architecture", "Architecture"],
  ["/identity", "Identity & auth"],
  ["/social-graph", "Social graph"],
  ["/messaging", "Messaging"],
  ["/api", "API"],
  ["/security", "Security"],
  ["/deployment", "Deployment"],
] as const;

const developerUrl = (path: string) => `https://developers.vth.kr${path}`;

export default function DeveloperLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-5">
          <a href={developerUrl("/")} className="font-semibold tracking-tight">
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
        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto border-t border-border px-3 py-2 text-sm md:hidden">
          {navigation.map(([href, label]) => (
            <a
              key={href}
              href={developerUrl(href)}
              className="shrink-0 rounded-md px-3 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {label}
            </a>
          ))}
        </nav>
      </header>

      <div className="mx-auto grid max-w-7xl grid-cols-1 md:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="hidden min-h-[calc(100dvh-3.5rem)] border-r border-border px-5 py-8 md:block">
          <nav className="sticky top-20 space-y-1 text-sm">
            <div className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Guide
            </div>
            {navigation.map(([href, label]) => (
              <a
                key={href}
                href={developerUrl(href)}
                className="block rounded-md px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {label}
              </a>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 px-5 py-10 md:px-10 md:py-14">
          <div className="max-w-3xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
