"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const CITE_RX = /^\[\d{1,3}\]$/;

function textOf(children: React.ReactNode): string {
  if (typeof children === "string") return children;
  if (Array.isArray(children)) return children.map(textOf).join("");
  return "";
}

export function Markdown({ children }: { children: string }) {
  return (
    <div className="md text-[#e8e8ed]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ children: kids, ...props }) => {
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
