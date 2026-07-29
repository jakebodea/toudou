import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils.ts";

const markdownComponents: Components = {
  a: ({ href, children }) => (
    <a
      href={href}
      onClick={(event) => {
        event.stopPropagation();
      }}
      rel="noopener noreferrer"
      target="_blank"
    >
      {children}
    </a>
  ),
  input: (props) => (
    <input
      {...props}
      onClick={(event) => {
        event.stopPropagation();
      }}
    />
  ),
};

interface CaptureMarkdownProps {
  children: string;
  className?: string;
  done?: boolean;
}

export function CaptureMarkdown({
  children,
  className,
  done = false,
}: CaptureMarkdownProps) {
  return (
    <div
      className={cn(
        "typeset typeset-capture",
        done &&
          "text-muted-foreground [&_:where(p,li,h1,h2,h3,h4,h5,h6,td,th,blockquote)]:line-through [&_:where(p,li,h1,h2,h3,h4,h5,h6,td,th,blockquote)]:decoration-foreground/15",
        className
      )}
    >
      <ReactMarkdown
        components={markdownComponents}
        remarkPlugins={[remarkGfm]}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
