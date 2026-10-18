import { createReactBlockSpec } from "@blocknote/react";
import { Mail } from "lucide-react";

export const EmailBlock = createReactBlockSpec(
  {
    type: "email",
    propSchema: {},
    content: "inline",
  } as const,
  {
    render: (props) => (
      <div className="w-full rounded-md border border-border bg-muted/40 p-3">
        <div
          contentEditable={false}
          className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground"
        >
          <Mail className="h-3.5 w-3.5" />
          Email
        </div>
        <div
          ref={props.contentRef}
          className="min-h-[24px] block whitespace-pre-wrap font-mono text-[13px] leading-relaxed outline-none"
        />
      </div>
    ),
  },
);
