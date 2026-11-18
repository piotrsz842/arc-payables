import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Renders a tutor answer: real Markdown (bold, lists, headings, code), with
 * citations like [Quicksort pivot choice] turned into small source chips.
 * Safe by default: react-markdown never renders raw HTML from the text.
 */
export function AnswerMarkdown({ text }: { text: string }) {
  // [Title] not followed by "(" (that would be a real link) → a citation link we style as a chip.
  const withCitations = text.replace(/\[([^\]\n]{2,120})\](?!\()/g, (_m, title: string) => `[${title}](#cite)`);
  return (
    <div className="space-y-3 text-[15px] leading-relaxed">
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h3 className="pt-1 text-base font-bold">{children}</h3>,
          h2: ({ children }) => <h3 className="pt-1 text-base font-bold">{children}</h3>,
          h3: ({ children }) => <h3 className="pt-1 text-base font-bold">{children}</h3>,
          p: ({ children }) => <p>{children}</p>,
          ul: ({ children }) => <ul className="list-disc space-y-1 pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal space-y-1 pl-5">{children}</ol>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          code: ({ children }) => <code className="rounded bg-black/5 px-1 py-0.5 text-[13px]">{children}</code>,
          a: ({ href, children }) =>
            href === "#cite" ? (
              <span className="mx-0.5 inline-flex items-center rounded-full bg-brand-50 px-2 py-0.5 align-middle text-xs font-medium text-brand-700">
                {children}
              </span>
            ) : (
              <a href={href} className="text-brand-700 underline" target="_blank" rel="noreferrer">
                {children}
              </a>
            ),
        }}
      >
        {withCitations}
      </Markdown>
    </div>
  );
}
