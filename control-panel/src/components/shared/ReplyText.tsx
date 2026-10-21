import Markdown from "react-markdown";

// Renders a front desk reply. The prompt asks the model for **bold** and "- " bullets.
// FLOW: reply text -> react-markdown -> React elements
// 1. react-markdown builds React elements and never touches dangerouslySetInnerHTML, so a
//    reply cannot inject markup into a parent's screen
// 2. no rehype-raw and no HTML plugin: raw HTML in model output stays inert
// 3. every element is mapped below, because the defaults carry no styling and a preschool
//    reply should not suddenly render an <h1>

interface ReplyTextProps {
  text: string;
}

export function ReplyText({ text }: ReplyTextProps): React.JSX.Element {
  return (
    <div className="text-sm leading-relaxed text-foreground">
      <Markdown
        components={{
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          ul: ({ children }) => (
            <ul className="mb-2 flex list-disc flex-col gap-1 pl-5 last:mb-0">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-2 flex list-decimal flex-col gap-1 pl-5 last:mb-0">{children}</ol>
          ),
          li: ({ children }) => <li>{children}</li>,
          // A reply is not a document. Anything structural reads back as plain text.
          h1: ({ children }) => <p className="mb-2 font-semibold last:mb-0">{children}</p>,
          h2: ({ children }) => <p className="mb-2 font-semibold last:mb-0">{children}</p>,
          h3: ({ children }) => <p className="mb-2 font-semibold last:mb-0">{children}</p>,
          em: ({ children }) => <em className="italic">{children}</em>,
          code: ({ children }) => <span>{children}</span>,
          // The front desk never links out; a link in model output is not followed.
          a: ({ children }) => <span>{children}</span>,
        }}
      >
        {text}
      </Markdown>
    </div>
  );
}
