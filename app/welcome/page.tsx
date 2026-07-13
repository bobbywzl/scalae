"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/components/util";
import type { SearchHit } from "@/lib/market";

/**
 * First-run onboarding — a guided intake chat (release-edu style): who you
 * are, where you invest from, which industries and companies you care about.
 * Ends with your first desks already open, so the dashboard is alive on
 * arrival. Deterministic script (no tokens spent), chat-shaped so it reads
 * like the analyst introducing itself.
 */

type Step = "name" | "age" | "country" | "industries" | "companies" | "confirm" | "creating";

interface Bubble {
  id: number;
  role: "assistant" | "user";
  text: string;
}

const PHASES: { key: string; label: string; steps: Step[] }[] = [
  { key: "you", label: "About you", steps: ["name", "age", "country"] },
  { key: "interests", label: "Interests", steps: ["industries", "companies"] },
  { key: "desks", label: "Your desks", steps: ["confirm", "creating"] },
];

const INDUSTRIES: { label: string; symbols: [string, string][] }[] = [
  { label: "Semiconductors", symbols: [["TSM", "TSMC"], ["ASML", "ASML"], ["NVDA", "NVIDIA"]] },
  { label: "Software & internet", symbols: [["MSFT", "Microsoft"], ["GOOGL", "Alphabet"], ["META", "Meta"]] },
  { label: "Consumer & retail", symbols: [["COST", "Costco"], ["WMT", "Walmart"], ["PG", "Procter & Gamble"]] },
  { label: "Banks & payments", symbols: [["V", "Visa"], ["MA", "Mastercard"], ["JPM", "JPMorgan"]] },
  { label: "Energy", symbols: [["XOM", "ExxonMobil"], ["CVX", "Chevron"], ["SHEL", "Shell"]] },
  { label: "Healthcare", symbols: [["JNJ", "Johnson & Johnson"], ["NVO", "Novo Nordisk"], ["UNH", "UnitedHealth"]] },
  { label: "Industrials", symbols: [["CAT", "Caterpillar"], ["UNP", "Union Pacific"], ["HON", "Honeywell"]] },
  { label: "Autos & mobility", symbols: [["TM", "Toyota"], ["TSLA", "Tesla"], ["RACE", "Ferrari"]] },
  { label: "Luxury & brands", symbols: [["MC.PA", "LVMH"], ["RMS.PA", "Hermès"], ["NKE", "Nike"]] },
  { label: "Real estate", symbols: [["PLD", "Prologis"], ["O", "Realty Income"], ["AMT", "American Tower"]] },
];

const COUNTRIES = [
  "United States", "Canada", "United Kingdom", "Germany", "France", "Netherlands", "Switzerland",
  "Sweden", "Spain", "Italy", "Japan", "China", "Hong Kong", "Taiwan", "South Korea", "Singapore",
  "India", "Australia", "New Zealand", "Brazil", "Mexico", "United Arab Emirates", "South Africa",
];

const MAX_DESKS = 6;

export default function WelcomePage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("name");
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [typing, setTyping] = useState(false);
  const [guardChecked, setGuardChecked] = useState(false);
  const nextId = useRef(1);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Collected profile
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [country, setCountry] = useState("");
  const [industries, setIndustries] = useState<string[]>([]);
  const [picked, setPicked] = useState<{ symbol: string; name: string }[]>([]);
  const [desks, setDesks] = useState<{ symbol: string; name: string; on: boolean }[]>([]);

  // Companies search
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [note, setNote] = useState("");

  const say = useCallback((text: string, role: "assistant" | "user" = "assistant") => {
    setBubbles((b) => [...b, { id: nextId.current++, role, text }]);
  }, []);

  /** Assistant speaks after a short "typing" beat — the chat feel. */
  const assistant = useCallback(
    (text: string, then?: () => void) => {
      setTyping(true);
      setTimeout(() => {
        setTyping(false);
        say(text);
        then?.();
      }, 550);
    },
    [say]
  );

  // Guard + opening lines.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [{ onboarded }, me] = await Promise.all([
          api<{ onboarded: boolean }>("/api/onboarding"),
          api<{ user: { name: string } | null }>("/api/auth/me").catch(() => ({ user: null })),
        ]);
        if (cancelled) return;
        if (onboarded) {
          router.replace("/");
          return;
        }
        setGuardChecked(true);
        if (me.user?.name) setName(me.user.name);
        say("Welcome to Scalae — your daily intelligence desk for the businesses you own or watch. Let's set up your desk in under a minute.");
        setTimeout(() => assistant("First things first: what should I call you?"), 350);
      } catch {
        if (!cancelled) {
          setGuardChecked(true);
          say("Welcome to Scalae. Let's set up your desk in under a minute.");
          setTimeout(() => assistant("First things first: what should I call you?"), 350);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, say, assistant]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [bubbles, typing, step, desks]);

  // ---- step handlers ----

  function submitName(e: React.FormEvent) {
    e.preventDefault();
    const v = name.trim();
    if (!v) return;
    say(v, "user");
    setStep("age");
    assistant(`Good to meet you, ${v.split(/\s+/)[0]}. How old are you? (This stays private — it helps calibrate horizon, nothing else.)`);
  }

  function submitAge(skip = false) {
    if (!skip && age && (Number(age) <= 0 || Number(age) >= 120)) return;
    say(skip || !age ? "I'd rather not say" : age, "user");
    if (skip) setAge("");
    setStep("country");
    assistant("Where do you invest from? Markets and tax treatment differ by home base.");
  }

  function submitCountry(skip = false) {
    say(skip || !country.trim() ? "Skip" : country.trim(), "user");
    if (skip) setCountry("");
    setStep("industries");
    assistant("Which industries do you want on your radar? Pick a few — they seed my suggestions.");
  }

  function submitIndustries() {
    say(industries.length ? industries.join(", ") : "No strong preference", "user");
    setStep("companies");
    assistant("Any specific companies you already follow? Search and add them — or continue and I'll suggest from your industries.");
  }

  function toggleIndustry(label: string) {
    setIndustries((xs) => (xs.includes(label) ? xs.filter((x) => x !== label) : [...xs, label]));
  }

  // Debounced company search against the real ticker universe. All setState
  // happens inside the timeout callback (never synchronously in the effect).
  useEffect(() => {
    const term = step === "companies" ? query.trim() : "";
    const t = setTimeout(
      async () => {
        if (!term) {
          setHits([]);
          return;
        }
        try {
          const { hits } = await api<{ hits: SearchHit[] }>(`/api/search?q=${encodeURIComponent(term)}`);
          setHits(hits.slice(0, 5));
        } catch {
          setHits([]);
        }
      },
      term ? 250 : 0
    );
    return () => clearTimeout(t);
  }, [query, step]);

  function addCompany(h: SearchHit) {
    if (!picked.some((p) => p.symbol === h.symbol)) {
      setPicked((p) => [...p, { symbol: h.symbol, name: h.name }]);
    }
    setQuery("");
    setHits([]);
  }

  function submitCompanies() {
    say(picked.length ? picked.map((p) => p.symbol).join(", ") : "Suggest for me", "user");
    // Seed the desk list: explicit picks first, then industry suggestions.
    const suggestions = INDUSTRIES.filter((i) => industries.includes(i.label))
      .flatMap((i) => i.symbols)
      .map(([symbol, coName]) => ({ symbol, name: coName }))
      .filter((s) => !picked.some((p) => p.symbol === s.symbol));
    const dedupedSuggestions = suggestions.filter(
      (s, i) => suggestions.findIndex((x) => x.symbol === s.symbol) === i
    );
    const seeded = [
      ...picked.map((p) => ({ ...p, on: true })),
      ...dedupedSuggestions.map((s) => ({ ...s, on: false })),
    ];
    // Preselect up to the cap.
    let on = seeded.filter((d) => d.on).length;
    for (const d of seeded) {
      if (!d.on && on < MAX_DESKS) {
        d.on = true;
        on++;
      }
    }
    setDesks(seeded);
    setStep("confirm");
    assistant(
      seeded.length
        ? `Here's what I'd open first. Each desk researches the business daily — start with up to ${MAX_DESKS} and add more anytime.`
        : "No desks picked yet — search above or go straight to the dashboard and add tickers there anytime."
    );
  }

  function toggleDesk(symbol: string) {
    setNote("");
    setDesks((ds) => {
      const on = ds.filter((d) => d.on).length;
      return ds.map((d) => {
        if (d.symbol !== symbol) return d;
        if (!d.on && on >= MAX_DESKS) {
          setNote(`Up to ${MAX_DESKS} to start — token spend scales per desk. You can add more later.`);
          return d;
        }
        return { ...d, on: !d.on };
      });
    });
  }

  async function createDesks() {
    const chosen = desks.filter((d) => d.on).map((d) => d.symbol);
    say(chosen.length ? `Open ${chosen.length} desk${chosen.length > 1 ? "s" : ""}: ${chosen.join(", ")}` : "Take me to the dashboard", "user");
    setStep("creating");
    assistant(chosen.length ? "Opening your desks — each will greet you with an onboarding chat to sharpen what we watch…" : "Setting up your dashboard…");
    try {
      const res = await api<{ created: string[]; failed: string[] }>("/api/onboarding", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          age: age ? Number(age) : undefined,
          country: country.trim() || undefined,
          industries,
          symbols: chosen,
        }),
      });
      if (res.failed.length) {
        say(`Couldn't resolve: ${res.failed.join(", ")} — add them from the dashboard later.`);
      }
      try {
        sessionStorage.removeItem("scalae_splash"); // let the greeting welcome them in
      } catch {
        /* fine */
      }
      router.replace("/");
    } catch (e) {
      setStep("confirm");
      say(e instanceof Error ? e.message : "Something went wrong — try again.");
    }
  }

  async function skipAll() {
    try {
      await api("/api/onboarding", { method: "POST", body: JSON.stringify({ skip: true }) });
    } catch {
      /* still leave */
    }
    router.replace("/");
  }

  const phaseIndex = PHASES.findIndex((p) => p.steps.includes(step));
  const deskCount = desks.filter((d) => d.on).length;

  if (!guardChecked) {
    return (
      <main className="min-h-screen flex items-center justify-center text-muted text-sm">
        <span className="pulse-soft">⚖️</span>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col">
      {/* Header: brand + phase dots + skip */}
      <header className="border-b border-hairline bg-card px-5 py-3 flex items-center justify-between gap-4">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <span aria-hidden>⚖️</span> Scalae
        </span>
        <nav className="flex items-center gap-3" aria-label="Setup progress">
          {PHASES.map((p, i) => (
            <span key={p.key} className="flex items-center gap-1.5 text-[11px]">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  i < phaseIndex ? "bg-gain" : i === phaseIndex ? "bg-accent pulse-soft" : "bg-white/20"
                }`}
              />
              <span className={i === phaseIndex ? "text-foreground font-medium" : "text-muted"}>{p.label}</span>
            </span>
          ))}
        </nav>
        <button onClick={skipAll} className="text-[11px] text-muted hover:text-foreground transition-colors">
          Skip setup →
        </button>
      </header>

      {/* Conversation */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-xl px-5 py-6 space-y-3">
          {bubbles.map((b) => (
            <div key={b.id} className={`bubble-in flex ${b.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  b.role === "user"
                    ? "bg-accent text-black rounded-br-md"
                    : "bg-card border border-hairline rounded-bl-md"
                }`}
              >
                {b.text}
              </div>
            </div>
          ))}
          {typing && (
            <div className="bubble-in flex justify-start">
              <div className="rounded-2xl rounded-bl-md bg-card border border-hairline px-4 py-3">
                <span className="flex gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-white/40 pulse-soft" />
                  <span className="h-1.5 w-1.5 rounded-full bg-white/40 pulse-soft" style={{ animationDelay: "0.2s" }} />
                  <span className="h-1.5 w-1.5 rounded-full bg-white/40 pulse-soft" style={{ animationDelay: "0.4s" }} />
                </span>
              </div>
            </div>
          )}

          {/* Desk confirmation chips live in the stream, like a rich message */}
          {step === "confirm" && !typing && desks.length > 0 && (
            <div className="bubble-in rounded-2xl bg-card border border-hairline px-4 py-3.5 space-y-2.5">
              <p className="text-[10px] uppercase tracking-wider text-muted font-semibold">
                Your first desks · {deskCount}/{MAX_DESKS}
              </p>
              <div className="flex flex-wrap gap-2">
                {desks.map((d) => (
                  <button
                    key={d.symbol}
                    onClick={() => toggleDesk(d.symbol)}
                    className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                      d.on
                        ? "border-accent/60 bg-accent/12 text-foreground"
                        : "border-hairline bg-white/4 text-muted hover:text-foreground"
                    }`}
                    title={d.name}
                  >
                    {d.on ? "✓ " : "+ "}
                    {d.symbol}
                    <span className="ml-1 opacity-70">{d.name}</span>
                  </button>
                ))}
              </div>
              {note && <p className="text-[11px] text-warn">{note}</p>}
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Composer — morphs per step */}
      <div className="border-t border-hairline bg-card">
        <div className="mx-auto w-full max-w-xl px-5 py-4">
          {step === "name" && (
            <form onSubmit={submitName} className="flex gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                autoFocus
                maxLength={60}
                className="flex-1 bg-background border border-hairline rounded-xl px-4 py-2.5 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/40"
              />
              <button
                type="submit"
                disabled={!name.trim()}
                className="rounded-xl bg-accent text-black px-4 py-2.5 text-sm font-semibold hover:bg-accent/90 transition-colors disabled:opacity-50"
              >
                Continue
              </button>
            </form>
          )}

          {step === "age" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitAge();
              }}
              className="flex gap-2"
            >
              <input
                value={age}
                onChange={(e) => setAge(e.target.value.replace(/\D/g, "").slice(0, 3))}
                placeholder="Age"
                inputMode="numeric"
                autoFocus
                className="w-28 bg-background border border-hairline rounded-xl px-4 py-2.5 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/40"
              />
              <button
                type="submit"
                disabled={!age || Number(age) <= 0 || Number(age) >= 120}
                className="rounded-xl bg-accent text-black px-4 py-2.5 text-sm font-semibold hover:bg-accent/90 transition-colors disabled:opacity-50"
              >
                Continue
              </button>
              <button
                type="button"
                onClick={() => submitAge(true)}
                className="rounded-xl border border-hairline px-4 py-2.5 text-sm text-muted hover:text-foreground transition-colors"
              >
                Prefer not to say
              </button>
            </form>
          )}

          {step === "country" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitCountry();
              }}
              className="flex gap-2"
            >
              <input
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="Country"
                list="countries"
                autoFocus
                maxLength={60}
                className="flex-1 bg-background border border-hairline rounded-xl px-4 py-2.5 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/40"
              />
              <datalist id="countries">
                {COUNTRIES.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
              <button
                type="submit"
                disabled={!country.trim()}
                className="rounded-xl bg-accent text-black px-4 py-2.5 text-sm font-semibold hover:bg-accent/90 transition-colors disabled:opacity-50"
              >
                Continue
              </button>
              <button
                type="button"
                onClick={() => submitCountry(true)}
                className="rounded-xl border border-hairline px-4 py-2.5 text-sm text-muted hover:text-foreground transition-colors"
              >
                Skip
              </button>
            </form>
          )}

          {step === "industries" && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {INDUSTRIES.map((i) => (
                  <button
                    key={i.label}
                    onClick={() => toggleIndustry(i.label)}
                    className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                      industries.includes(i.label)
                        ? "border-accent/60 bg-accent/12 text-foreground"
                        : "border-hairline bg-white/4 text-muted hover:text-foreground"
                    }`}
                  >
                    {industries.includes(i.label) ? "✓ " : ""}
                    {i.label}
                  </button>
                ))}
              </div>
              <button
                onClick={submitIndustries}
                className="w-full rounded-xl bg-accent text-black px-4 py-2.5 text-sm font-semibold hover:bg-accent/90 transition-colors"
              >
                {industries.length ? `Continue with ${industries.length} selected` : "No preference — continue"}
              </button>
            </div>
          )}

          {step === "companies" && (
            <div className="space-y-3">
              {picked.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {picked.map((p) => (
                    <span key={p.symbol} className="inline-flex items-center gap-1.5 rounded-lg bg-accent/12 border border-accent/40 px-2 py-1 text-[11px] font-medium">
                      {p.symbol} <span className="text-muted">{p.name}</span>
                      <button onClick={() => setPicked((xs) => xs.filter((x) => x.symbol !== p.symbol))} className="text-muted hover:text-loss">
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="relative">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search a company or ticker — Costco, TSMC, 7203.T…"
                  autoFocus
                  className="w-full bg-background border border-hairline rounded-xl px-4 py-2.5 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/40"
                />
                {hits.length > 0 && (
                  <ul className="absolute bottom-full mb-2 w-full rounded-xl bg-card border border-hairline overflow-hidden shadow-xl z-10">
                    {hits.map((h) => (
                      <li key={h.symbol}>
                        <button
                          onClick={() => addCompany(h)}
                          className="w-full text-left px-4 py-2.5 text-xs hover:bg-white/5 transition-colors flex items-center justify-between gap-3"
                        >
                          <span className="font-semibold">{h.symbol}</span>
                          <span className="text-muted truncate flex-1">{h.name}</span>
                          <span className="text-muted/60 text-[10px]">{h.exchange}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <button
                onClick={submitCompanies}
                className="w-full rounded-xl bg-accent text-black px-4 py-2.5 text-sm font-semibold hover:bg-accent/90 transition-colors"
              >
                {picked.length ? `Continue with ${picked.length} compan${picked.length > 1 ? "ies" : "y"}` : "Suggest from my industries"}
              </button>
            </div>
          )}

          {step === "confirm" && (
            <button
              onClick={createDesks}
              className="w-full rounded-xl bg-accent text-black px-4 py-2.5 text-sm font-semibold hover:bg-accent/90 transition-colors"
            >
              {deskCount > 0 ? `Open ${deskCount} desk${deskCount > 1 ? "s" : ""} →` : "Go to my dashboard →"}
            </button>
          )}

          {step === "creating" && (
            <p className="text-center text-sm text-muted pulse-soft py-1.5">Setting up your desks…</p>
          )}

          <p className="mt-3 text-center text-[10px] text-muted/60">
            Educational research tool — not investment advice. Your profile stays in your account.
          </p>
        </div>
      </div>
    </main>
  );
}
