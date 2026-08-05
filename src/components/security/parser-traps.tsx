"use client";

import {
  useEffect,
  useRef,
  type FormEvent,
  type ReactNode,
} from "react";

import {
  BOT_FIELD,
  HONEYPOT_NAMES,
  type BotAttestation,
  type HoneypotName,
  evaluateAttestation,
} from "@/lib/security/bot-signals";

type Tracker = {
  t0: number;
  moves: number;
  keys: number;
  focuses: number;
  scrolls: number;
  trusted: boolean;
};

function detectWebdriver(): boolean {
  if (typeof navigator === "undefined") return true;
  const nav = navigator as Navigator & {
    webdriver?: boolean;
  };
  if (nav.webdriver) return true;
  try {
    if (
      (navigator as Navigator & { languages?: string[] }).languages?.length === 0
    ) {
      return true;
    }
  } catch {
    return true;
  }
  return false;
}

function createTracker(): Tracker {
  return {
    t0: Date.now(),
    moves: 0,
    keys: 0,
    focuses: 0,
    scrolls: 0,
    trusted: false,
  };
}

/**
 * Hidden honeypots + decoy markup that naive HTML parsers / autofill bots trip over.
 * Also tracks lightweight interaction signals for attestation.
 */
export function useBotGuard() {
  const tracker = useRef<Tracker>(createTracker());
  const trapRefs = useRef<Partial<Record<HoneypotName, HTMLInputElement | null>>>(
    {}
  );

  useEffect(() => {
    tracker.current = createTracker();
    const t = tracker.current;

    const onMove = (e: Event) => {
      t.moves += 1;
      if ((e as MouseEvent).isTrusted) t.trusted = true;
    };
    const onKey = (e: Event) => {
      t.keys += 1;
      if ((e as KeyboardEvent).isTrusted) t.trusted = true;
    };
    const onFocus = (e: Event) => {
      t.focuses += 1;
      if ((e as FocusEvent).isTrusted) t.trusted = true;
    };
    const onScroll = (e: Event) => {
      t.scrolls += 1;
      if ((e as Event).isTrusted) t.trusted = true;
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("keydown", onKey, { passive: true });
    window.addEventListener("focusin", onFocus, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("focusin", onFocus);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  function readTraps(): Partial<Record<HoneypotName, string>> {
    const out: Partial<Record<HoneypotName, string>> = {};
    for (const name of HONEYPOT_NAMES) {
      out[name] = trapRefs.current[name]?.value ?? "";
    }
    return out;
  }

  function buildAttestation(): BotAttestation {
    const t = tracker.current;
    const ts = Date.now();
    return {
      v: 1,
      t0: t.t0,
      ts,
      dwellMs: Math.max(0, ts - t.t0),
      moves: t.moves,
      keys: t.keys,
      focuses: t.focuses,
      scrolls: t.scrolls,
      trusted: t.trusted,
      webdriver: detectWebdriver(),
      traps: readTraps(),
    };
  }

  /** Returns null when the user looks human; otherwise a generic reject reason. */
  function assertHuman(): string | null {
    const result = evaluateAttestation(buildAttestation());
    return result.ok ? null : (result.reason ?? "Rejected");
  }

  function attachToPayload<T extends Record<string, unknown>>(
    payload: T
  ): T & { [BOT_FIELD]: BotAttestation } {
    return { ...payload, [BOT_FIELD]: buildAttestation() };
  }

  function setTrapRef(name: HoneypotName, el: HTMLInputElement | null) {
    trapRefs.current[name] = el;
  }

  return {
    assertHuman,
    buildAttestation,
    attachToPayload,
    setTrapRef,
    /** Call on intentional user submit to mark a trusted gesture. */
    markTrusted: (event?: FormEvent | Event) => {
      if (!event || ("isTrusted" in event && event.isTrusted)) {
        tracker.current.trusted = true;
      }
    },
  };
}

/** Invisible honeypot fields + HTML comment decoys for scrapers. */
export function ParserTraps({
  setTrapRef,
}: {
  setTrapRef: (name: HoneypotName, el: HTMLInputElement | null) => void;
}) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute -left-[9999px] h-0 w-0 overflow-hidden opacity-0"
      // Keep in tab order off: tabindex -1 on inputs
    >
      {/* parser-trap: decoy account form for naive bots */}
      <div className="red-trap-decoy">
        <label>
          Website
          <input
            ref={(el) => setTrapRef("website", el)}
            type="text"
            name="website"
            form="_red_trap"
            tabIndex={-1}
            autoComplete="off"
            defaultValue=""
          />
        </label>
        <label>
          URL
          <input
            ref={(el) => setTrapRef("url", el)}
            type="url"
            name="url"
            form="_red_trap"
            tabIndex={-1}
            autoComplete="off"
            defaultValue=""
          />
        </label>
        <label>
          Company
          <input
            ref={(el) => setTrapRef("company", el)}
            type="text"
            name="company"
            form="_red_trap"
            tabIndex={-1}
            autoComplete="organization"
            defaultValue=""
          />
        </label>
        <label>
          Phone
          <input
            ref={(el) => setTrapRef("phone", el)}
            type="tel"
            name="phone"
            form="_red_trap"
            tabIndex={-1}
            autoComplete="off"
            defaultValue=""
          />
        </label>
        <label>
          Fax
          <input
            ref={(el) => setTrapRef("fax", el)}
            type="text"
            name="fax"
            form="_red_trap"
            tabIndex={-1}
            autoComplete="off"
            defaultValue=""
          />
        </label>
        <label>
          Confirm email
          <input
            ref={(el) => setTrapRef("contact_email_2", el)}
            type="email"
            name="contact_email_2"
            form="_red_trap"
            tabIndex={-1}
            autoComplete="off"
            defaultValue=""
          />
        </label>
      </div>
      {/*
        <form action="/api/register-legacy" method="post">
          <input name="email" />
          <input name="password" />
          <button type="submit">Create account</button>
        </form>
      */}
    </div>
  );
}

export function withParserTraps(
  children: ReactNode,
  setTrapRef: (name: HoneypotName, el: HTMLInputElement | null) => void
) {
  return (
    <div className="relative">
      <ParserTraps setTrapRef={setTrapRef} />
      {children}
    </div>
  );
}
