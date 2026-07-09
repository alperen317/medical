import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

/**
 * buildIntakeMarkdown çıktısını uygulamanın kart/tablo diliyle render eder.
 * Salt görüntüleme amaçlı — LLM yorumu içermez, veri neyse odur.
 */
export function IntakeMarkdownView({ markdown }: { markdown: string }) {
  return (
    <div className="space-y-1">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h2: ({ children }) => (
            <h3 className="text-sm font-semibold pt-4 first:pt-0 pb-2 border-b mb-2.5">{children}</h3>
          ),
          p: ({ children }) => <p className="text-sm text-muted-foreground mb-2.5">{children}</p>,
          em: ({ children }) => <span className="text-xs not-italic">{children}</span>,
          table: ({ children }) => (
            <div className="rounded-md border overflow-hidden mb-2.5">
              <table className="w-full">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-muted/40">{children}</thead>,
          th: ({ children }) => (
            <th className="px-3 py-1.5 text-left text-[11px] font-medium text-muted-foreground">{children}</th>
          ),
          tbody: ({ children }) => <tbody className="divide-y">{children}</tbody>,
          td: ({ children }) => <td className="px-3 py-1.5 text-sm align-top">{children}</td>,
          ul: ({ children }) => <ul className="space-y-1.5 mb-2.5">{children}</ul>,
          li: ({ children }) => (
            <li className="text-sm rounded-md border bg-card px-3 py-1.5">{children}</li>
          ),
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              {children}
            </a>
          ),
          strong: ({ children }) => <strong className="font-medium text-foreground">{children}</strong>,
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  )
}
