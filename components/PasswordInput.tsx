"use client";
import { useState } from "react";

/**
 * Password field with a show/hide eye toggle. Works controlled (profile
 * page: value + onChange) and uncontrolled (the /signin server component's
 * plain form post: name only) — the toggle is the sole client behavior.
 */
export default function PasswordInput({
  name,
  value,
  onChange,
  placeholder,
  autoComplete,
  required,
  inputClassName,
  showLabel,
  hideLabel,
}: {
  name?: string;
  value?: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  inputClassName?: string;
  showLabel: string;
  hideLabel: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        name={name}
        {...(value !== undefined ? { value, onChange: (e) => onChange?.(e.target.value) } : {})}
        required={required}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className={`${inputClassName ?? "w-full rounded-lg border border-hairline bg-ink/4 px-3 py-2 text-sm focus:outline-none focus:border-accent/50"} pr-10`}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? hideLabel : showLabel}
        title={show ? hideLabel : showLabel}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted/70 hover:text-foreground transition-colors"
      >
        {show ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M3 3l18 18M10.6 10.7a2.5 2.5 0 0 0 3.5 3.5M7.4 7.5C5.2 8.8 3.6 10.8 2.5 12c1.8 2.6 5 6 9.5 6 1.7 0 3.2-.5 4.6-1.3M10 5.2c.6-.1 1.3-.2 2-.2 4.5 0 7.7 3.4 9.5 6-.5.8-1.3 1.8-2.3 2.7"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M2.5 12c1.8-2.6 5-6 9.5-6s7.7 3.4 9.5 6c-1.8 2.6-5 6-9.5 6s-7.7-3.4-9.5-6z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.8" />
          </svg>
        )}
      </button>
    </div>
  );
}
