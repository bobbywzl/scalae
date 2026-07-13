"use client";

import { useEffect, useState } from "react";

/**
 * The opening moment: a professional, time-aware greeting with the Scalae
 * mark, held for ~2.4s and then faded into the dashboard. Shown once per
 * browser session (sessionStorage-gated) so in-app navigation never replays
 * it. The greeting upgrades in place if the signed-in name arrives while the
 * splash is still up.
 */

const HOLD_MS = 2400;
const FADE_MS = 650;

export function greetingFor(hour: number, name?: string | null): { title: string; sub: string } {
  const first = name?.trim().split(/\s+/)[0];
  const to = (t: string) => (first ? `${t}, ${first}.` : `${t}.`);
  if (hour >= 5 && hour < 12) {
    return { title: to("Good morning"), sub: "The desks have the overnight tape covered." };
  }
  if (hour >= 12 && hour < 17) {
    return { title: to("Good afternoon"), sub: "Everything is weighed and ready for you." };
  }
  if (hour >= 17 && hour < 22) {
    return { title: to("Good evening"), sub: "Your desks are ready for review." };
  }
  return { title: to("Welcome back"), sub: "The market sleeps — the weighing machine doesn't." };
}

export function WelcomeSplash({ name, onDone }: { name?: string | null; onDone: () => void }) {
  const [fading, setFading] = useState(false);
  // Derived every render — the greeting upgrades in place the moment the
  // signed-in name arrives (client-only component, so no hydration risk).
  const { title, sub } = greetingFor(new Date().getHours(), name);

  useEffect(() => {
    const hold = setTimeout(() => setFading(true), HOLD_MS);
    const done = setTimeout(onDone, HOLD_MS + FADE_MS);
    return () => {
      clearTimeout(hold);
      clearTimeout(done);
    };
  }, [onDone]);

  return (
    <div
      aria-hidden
      className={`fixed inset-0 z-50 flex items-center justify-center bg-background transition-opacity motion-reduce:transition-none ${
        fading ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
      style={{ transitionDuration: `${FADE_MS}ms` }}
    >
      <div className="text-center px-6 splash-rise motion-reduce:animate-none">
        <p className="text-5xl mb-4" aria-hidden>
          ⚖️
        </p>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{title}</h1>
        <p className="text-muted text-sm mt-2">{sub}</p>
      </div>
    </div>
  );
}
