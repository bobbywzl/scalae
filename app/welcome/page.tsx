"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckIcon, PlusIcon, ScaleIcon, XIcon } from "@/components/icons";
import { useT } from "@/components/PrefsProvider";
import { api, localizeError } from "@/components/util";
import type { TKey } from "@/lib/i18n/dictionaries";
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

const PHASES: { key: string; labelKey: TKey; steps: Step[] }[] = [
  { key: "you", labelKey: "onboarding.phaseYou", steps: ["name", "age", "country"] },
  { key: "interests", labelKey: "onboarding.phaseInterests", steps: ["industries", "companies"] },
  { key: "desks", labelKey: "onboarding.phaseDesks", steps: ["confirm", "creating"] },
];

// `label` is the canonical (stored/POSTed) value; `labelKey` is what the UI shows.
const INDUSTRIES: { label: string; labelKey: TKey; symbols: [string, string][] }[] = [
  { label: "Semiconductors", labelKey: "onboarding.indSemis", symbols: [["TSM", "TSMC"], ["ASML", "ASML"], ["NVDA", "NVIDIA"]] },
  { label: "Software & internet", labelKey: "onboarding.indSoftware", symbols: [["MSFT", "Microsoft"], ["GOOGL", "Alphabet"], ["META", "Meta"]] },
  { label: "Consumer & retail", labelKey: "onboarding.indConsumer", symbols: [["COST", "Costco"], ["WMT", "Walmart"], ["PG", "Procter & Gamble"]] },
  { label: "Banks & payments", labelKey: "onboarding.indBanks", symbols: [["V", "Visa"], ["MA", "Mastercard"], ["JPM", "JPMorgan"]] },
  { label: "Energy", labelKey: "onboarding.indEnergy", symbols: [["XOM", "ExxonMobil"], ["CVX", "Chevron"], ["SHEL", "Shell"]] },
  { label: "Healthcare", labelKey: "onboarding.indHealthcare", symbols: [["JNJ", "Johnson & Johnson"], ["NVO", "Novo Nordisk"], ["UNH", "UnitedHealth"]] },
  { label: "Industrials", labelKey: "onboarding.indIndustrials", symbols: [["CAT", "Caterpillar"], ["UNP", "Union Pacific"], ["HON", "Honeywell"]] },
  { label: "Autos & mobility", labelKey: "onboarding.indAutos", symbols: [["TM", "Toyota"], ["TSLA", "Tesla"], ["RACE", "Ferrari"]] },
  { label: "Luxury & brands", labelKey: "onboarding.indLuxury", symbols: [["MC.PA", "LVMH"], ["RMS.PA", "Hermès"], ["NKE", "Nike"]] },
  { label: "Real estate", labelKey: "onboarding.indRealEstate", symbols: [["PLD", "Prologis"], ["O", "Realty Income"], ["AMT", "American Tower"]] },
];

const COUNTRY_KEYS: TKey[] = [
  "onboarding.countryUS", "onboarding.countryCanada", "onboarding.countryUK", "onboarding.countryGermany",
  "onboarding.countryFrance", "onboarding.countryNetherlands", "onboarding.countrySwitzerland",
  "onboarding.countrySweden", "onboarding.countrySpain", "onboarding.countryItaly", "onboarding.countryJapan",
  "onboarding.countryChina", "onboarding.countryHongKong", "onboarding.countryTaiwan", "onboarding.countrySouthKorea",
  "onboarding.countrySingapore", "onboarding.countryIndia", "onboarding.countryAustralia", "onboarding.countryNZ",
  "onboarding.countryBrazil", "onboarding.countryMexico", "onboarding.countryUAE", "onboarding.countrySouthAfrica",
];

const MAX_DESKS = 6;

export default function WelcomePage() {
  const router = useRouter();
  const { t, lang } = useT();
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

  // Chat-log lists joined per language convention.
  const listJoin = lang === "zh" ? "、" : ", ";
  const industryLabel = (label: string) => {
    const ind = INDUSTRIES.find((i) => i.label === label);
    return ind ? t(ind.labelKey) : label;
  };

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

  // Guard + opening lines. `started` keeps a language switch mid-chat (t in
  // deps) from re-running the guard and re-saying the intro.
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
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
        started.current = true;
        setGuardChecked(true);
        if (me.user?.name) setName(me.user.name);
        say(t("onboarding.introFull"));
        setTimeout(() => assistant(t("onboarding.askName")), 350);
      } catch {
        if (!cancelled) {
          started.current = true;
          setGuardChecked(true);
          say(t("onboarding.introShort"));
          setTimeout(() => assistant(t("onboarding.askName")), 350);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, say, assistant, t]);

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
    assistant(t("onboarding.askAge", { name: v.split(/\s+/)[0] }));
  }

  function submitAge(skip = false) {
    if (!skip && age && (Number(age) <= 0 || Number(age) >= 120)) return;
    say(skip || !age ? t("onboarding.sayPreferNot") : age, "user");
    if (skip) setAge("");
    setStep("country");
    assistant(t("onboarding.askCountry"));
  }

  function submitCountry(skip = false) {
    say(skip || !country.trim() ? t("onboarding.saySkip") : country.trim(), "user");
    if (skip) setCountry("");
    setStep("industries");
    assistant(t("onboarding.askIndustries"));
  }

  function submitIndustries() {
    say(
      industries.length
        ? industries.map(industryLabel).join(listJoin)
        : t("onboarding.sayNoPreference"),
      "user"
    );
    setStep("companies");
    assistant(t("onboarding.askCompanies"));
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
    say(
      picked.length ? picked.map((p) => p.symbol).join(listJoin) : t("onboarding.saySuggest"),
      "user"
    );
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
        ? t("onboarding.confirmSome", { n: MAX_DESKS })
        : t("onboarding.confirmNone")
    );
  }

  function toggleDesk(symbol: string) {
    setNote("");
    setDesks((ds) => {
      const on = ds.filter((d) => d.on).length;
      return ds.map((d) => {
        if (d.symbol !== symbol) return d;
        if (!d.on && on >= MAX_DESKS) {
          setNote(t("onboarding.capNote", { n: MAX_DESKS }));
          return d;
        }
        return { ...d, on: !d.on };
      });
    });
  }

  async function createDesks() {
    const chosen = desks.filter((d) => d.on).map((d) => d.symbol);
    say(
      chosen.length
        ? chosen.length > 1
          ? t("onboarding.sayOpenDesksMany", { n: chosen.length, syms: chosen.join(listJoin) })
          : t("onboarding.sayOpenDesks", { n: chosen.length, syms: chosen.join(listJoin) })
        : t("onboarding.sayGoDashboard"),
      "user"
    );
    setStep("creating");
    assistant(chosen.length ? t("onboarding.creatingDesks") : t("onboarding.creatingDashboard"));
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
        say(t("onboarding.couldntResolve", { syms: res.failed.join(listJoin) }));
      }
      try {
        sessionStorage.removeItem("scalae_splash"); // let the greeting welcome them in
      } catch {
        /* fine */
      }
      router.replace("/");
    } catch (e) {
      setStep("confirm");
      say(e instanceof Error ? localizeError(e.message, t) : t("onboarding.genericErr"));
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
        <ScaleIcon className="h-6 w-6 pulse-soft" />
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col">
      {/* Header: brand + phase dots + skip */}
      <header className="border-b border-hairline bg-card px-5 py-3 flex items-center justify-between gap-4">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <ScaleIcon className="h-4 w-4" /> Scalae
        </span>
        <nav className="flex items-center gap-3" aria-label={t("onboarding.setupProgress")}>
          {PHASES.map((p, i) => (
            <span key={p.key} className="flex items-center gap-1.5 text-[0.6875rem]">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  i < phaseIndex ? "bg-gain" : i === phaseIndex ? "bg-accent pulse-soft" : "bg-ink/20"
                }`}
              />
              <span className={i === phaseIndex ? "text-foreground font-medium" : "text-muted"}>
                {t(p.labelKey)}
              </span>
            </span>
          ))}
        </nav>
        <button onClick={skipAll} className="text-[0.6875rem] text-muted hover:text-foreground transition-colors">
          {t("onboarding.skipSetup")}
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
                  <span className="h-1.5 w-1.5 rounded-full bg-ink/40 pulse-soft" />
                  <span className="h-1.5 w-1.5 rounded-full bg-ink/40 pulse-soft" style={{ animationDelay: "0.2s" }} />
                  <span className="h-1.5 w-1.5 rounded-full bg-ink/40 pulse-soft" style={{ animationDelay: "0.4s" }} />
                </span>
              </div>
            </div>
          )}

          {/* Desk confirmation chips live in the stream, like a rich message */}
          {step === "confirm" && !typing && desks.length > 0 && (
            <div className="bubble-in rounded-2xl bg-card border border-hairline px-4 py-3.5 space-y-2.5">
              <p className="text-[0.625rem] uppercase tracking-wider text-muted font-semibold">
                {t("onboarding.firstDesksTitle")} · {deskCount}/{MAX_DESKS}
              </p>
              <div className="flex flex-wrap gap-2">
                {desks.map((d) => (
                  <button
                    key={d.symbol}
                    onClick={() => toggleDesk(d.symbol)}
                    className={`rounded-lg border px-2.5 py-1.5 text-[0.6875rem] font-medium transition-colors ${
                      d.on
                        ? "border-accent/60 bg-accent/12 text-foreground"
                        : "border-hairline bg-ink/4 text-muted hover:text-foreground"
                    }`}
                    title={d.name}
                  >
                    <span className="inline-flex items-center gap-1">
                      {d.on ? <CheckIcon className="h-3 w-3" /> : <PlusIcon className="h-3 w-3" />}
                      {d.symbol}
                    </span>
                    <span className="ml-1 opacity-70">{d.name}</span>
                  </button>
                ))}
              </div>
              {note && <p className="text-[0.6875rem] text-warn">{note}</p>}
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
                placeholder={t("onboarding.namePh")}
                autoFocus
                maxLength={60}
                className="flex-1 bg-background border border-hairline rounded-xl px-4 py-2.5 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/40"
              />
              <button
                type="submit"
                disabled={!name.trim()}
                className="rounded-xl bg-accent text-black px-4 py-2.5 text-sm font-semibold hover:bg-accent/90 transition-colors disabled:opacity-50"
              >
                {t("onboarding.continueBtn")}
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
                placeholder={t("onboarding.agePh")}
                inputMode="numeric"
                autoFocus
                className="w-28 bg-background border border-hairline rounded-xl px-4 py-2.5 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/40"
              />
              <button
                type="submit"
                disabled={!age || Number(age) <= 0 || Number(age) >= 120}
                className="rounded-xl bg-accent text-black px-4 py-2.5 text-sm font-semibold hover:bg-accent/90 transition-colors disabled:opacity-50"
              >
                {t("onboarding.continueBtn")}
              </button>
              <button
                type="button"
                onClick={() => submitAge(true)}
                className="rounded-xl border border-hairline px-4 py-2.5 text-sm text-muted hover:text-foreground transition-colors"
              >
                {t("onboarding.preferNotBtn")}
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
                placeholder={t("onboarding.countryPh")}
                list="countries"
                autoFocus
                maxLength={60}
                className="flex-1 bg-background border border-hairline rounded-xl px-4 py-2.5 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/40"
              />
              <datalist id="countries">
                {COUNTRY_KEYS.map((k) => (
                  <option key={k} value={t(k)} />
                ))}
              </datalist>
              <button
                type="submit"
                disabled={!country.trim()}
                className="rounded-xl bg-accent text-black px-4 py-2.5 text-sm font-semibold hover:bg-accent/90 transition-colors disabled:opacity-50"
              >
                {t("onboarding.continueBtn")}
              </button>
              <button
                type="button"
                onClick={() => submitCountry(true)}
                className="rounded-xl border border-hairline px-4 py-2.5 text-sm text-muted hover:text-foreground transition-colors"
              >
                {t("onboarding.skipBtn")}
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
                    className={`rounded-lg border px-2.5 py-1.5 text-[0.6875rem] font-medium transition-colors ${
                      industries.includes(i.label)
                        ? "border-accent/60 bg-accent/12 text-foreground"
                        : "border-hairline bg-ink/4 text-muted hover:text-foreground"
                    }`}
                  >
                    <span className="inline-flex items-center gap-1">
                      {industries.includes(i.label) && <CheckIcon className="h-3 w-3" />}
                      {t(i.labelKey)}
                    </span>
                  </button>
                ))}
              </div>
              <button
                onClick={submitIndustries}
                className="w-full rounded-xl bg-accent text-black px-4 py-2.5 text-sm font-semibold hover:bg-accent/90 transition-colors"
              >
                {industries.length
                  ? t("onboarding.continueWithSelected", { n: industries.length })
                  : t("onboarding.noPreferenceContinue")}
              </button>
            </div>
          )}

          {step === "companies" && (
            <div className="space-y-3">
              {picked.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {picked.map((p) => (
                    <span key={p.symbol} className="inline-flex items-center gap-1.5 rounded-lg bg-accent/12 border border-accent/40 px-2 py-1 text-[0.6875rem] font-medium">
                      {p.symbol} <span className="text-muted">{p.name}</span>
                      <button onClick={() => setPicked((xs) => xs.filter((x) => x.symbol !== p.symbol))} className="text-muted hover:text-loss">
                        <XIcon className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="relative">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("onboarding.searchPh")}
                  autoFocus
                  className="w-full bg-background border border-hairline rounded-xl px-4 py-2.5 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/40"
                />
                {hits.length > 0 && (
                  <ul className="absolute bottom-full mb-2 w-full rounded-xl bg-card border border-hairline overflow-hidden shadow-xl z-10">
                    {hits.map((h) => (
                      <li key={h.symbol}>
                        <button
                          onClick={() => addCompany(h)}
                          className="w-full text-left px-4 py-2.5 text-xs hover:bg-ink/5 transition-colors flex items-center justify-between gap-3"
                        >
                          <span className="font-semibold">{h.symbol}</span>
                          <span className="text-muted truncate flex-1">{h.name}</span>
                          <span className="text-muted/60 text-[0.625rem]">{h.exchange}</span>
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
                {picked.length
                  ? picked.length > 1
                    ? t("onboarding.continueWithCompaniesMany", { n: picked.length })
                    : t("onboarding.continueWithCompanies", { n: picked.length })
                  : t("onboarding.suggestFromIndustries")}
              </button>
            </div>
          )}

          {step === "confirm" && (
            <button
              onClick={createDesks}
              className="w-full rounded-xl bg-accent text-black px-4 py-2.5 text-sm font-semibold hover:bg-accent/90 transition-colors"
            >
              {deskCount > 0
                ? deskCount > 1
                  ? t("onboarding.openNDesksMany", { n: deskCount })
                  : t("onboarding.openNDesks", { n: deskCount })
                : t("onboarding.goDashboard")}
            </button>
          )}

          {step === "creating" && (
            <p className="text-center text-sm text-muted pulse-soft py-1.5">{t("onboarding.settingUpDesks")}</p>
          )}

          <p className="mt-3 text-center text-[0.625rem] text-muted/60">
            {t("common.notAdvice")} {t("onboarding.profilePrivate")}
          </p>
        </div>
      </div>
    </main>
  );
}
