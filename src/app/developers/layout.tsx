import Image from "next/image";
import type { ReactNode } from "react";
import { DeveloperNav } from "./_navigation";

const developerUrl = (path: string) => `https://developers.vth.kr${path}`;

export default function DeveloperLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-5">
          <a
            href={developerUrl("/")}
            className="flex min-w-0 items-center gap-2 rounded-md font-semibold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <Image
              src="/vth-logo.png"
              alt=""
              width={22}
              height={22}
              className="size-[22px] shrink-0 rounded-md object-cover"
            />
            <span className="truncate">
              VTH <span className="text-muted-foreground">Developers</span>
            </span>
          </a>
          <div className="flex shrink-0 items-center gap-1 text-sm">
            <a
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              href="https://vth.kr"
            >
              <Image
                src="/vth-logo.png"
                alt=""
                width={17}
                height={17}
                className="size-[17px] rounded-sm object-cover"
              />
              <span>vth.kr</span>
            </a>
            <a
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              href="https://github.com/officialjaykoo/viet-tai-han"
              aria-label="Open VTH on GitHub"
              rel="noreferrer"
              target="_blank"
            >
              <svg
                aria-hidden="true"
                className="size-4 fill-current"
                viewBox="0 0 16 16"
              >
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.65 7.65 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8" />
              </svg>
              <span className="hidden sm:inline">GitHub</span>
            </a>
          </div>
        </div>
        <DeveloperNav mobile />
      </header>

      <div className="mx-auto grid max-w-7xl grid-cols-1 md:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="hidden min-h-[calc(100dvh-3.5rem)] border-r border-border px-5 py-8 md:block">
          <DeveloperNav />
        </aside>

        <main className="min-w-0 px-5 py-10 md:px-10 md:py-14">
          <div className="max-w-3xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
