"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useT } from "./PrefsProvider";

const CITE_RX = /^\[\d{1,3}\]$/;
const SIGNAL_HREF = "#sig:";

function textOf(children: React.ReactNode): string {
  if (typeof children === "string") return children;
  if (Array.isArray(children)) return children.map(textOf).join("");
  return "";
}

export function Markdown({
  children,
  onOpenSignal,
}: {
  children: string;
  /** Enables inline signal chips: links with href "#sig:<id>" become buttons. */
  onOpenSignal?: (id: string) => void;
}) {
  const { t } = useT();
  return (
    <div className="md text-emph">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ children: kids, ...props }) => {
            // Signal chips ("[name](#sig:<id>)") open the signal detail inline.
            if (props.href?.startsWith(SIGNAL_HREF)) {
              const id = props.href.slice(SIGNAL_HREF.length);
              return (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    onOpenSignal?.(id);
                  }}
                  title={t("chat.openSignal")}
                  className="align-baseline text-[0.82em] font-medium text-emph hover:text-accent rounded-md border border-hairline bg-ink/5 hover:bg-ink/10 px-1.5 py-px mx-px transition-colors"
                >
                  ⧉ {kids}
                </button>
              );
            }
            // Citation links ("[37]") render as compact superscript chips.
            if (CITE_RX.test(textOf(kids))) {
              return (
                <a
                  {...props}
                  target="_blank"
                  rel="noreferrer"
                  className="!no-underline align-super text-[0.7em] font-semibold text-accent/90 hover:text-accent rounded bg-accent/10 hover:bg-accent/20 px-1 py-px mx-px transition-colors"
                >
                  {textOf(kids).slice(1, -1)}
                </a>
              );
            }
            return (
              <a {...props} target="_blank" rel="noreferrer">
                {kids}
              </a>
            );
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
