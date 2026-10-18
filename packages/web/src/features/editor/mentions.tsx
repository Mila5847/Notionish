import { createReactInlineContentSpec } from "@blocknote/react";
import { AtSign, FileText } from "lucide-react";

export const UserMention = createReactInlineContentSpec(
  {
    type: "mention",
    propSchema: {
      userId: { default: "" },
      name: { default: "" },
    },
    content: "none",
  } as const,
  {
    render: (props) => (
      <span
        className="inline-flex items-center gap-0.5 rounded bg-primary/10 px-1 text-primary"
        data-user-id={props.inlineContent.props.userId}
      >
        <AtSign className="h-3 w-3" />
        {props.inlineContent.props.name || "user"}
      </span>
    ),
  },
);

export const PageMention = createReactInlineContentSpec(
  {
    type: "pagemention",
    propSchema: {
      pageId: { default: "" },
      title: { default: "" },
      icon: { default: "" },
    },
    content: "none",
  } as const,
  {
    render: (props) => (
      <a
        href={`#/page/${props.inlineContent.props.pageId}`}
        className="inline-flex items-center gap-0.5 rounded px-0.5 text-foreground underline decoration-muted-foreground/50 underline-offset-2 hover:bg-accent"
        data-page-id={props.inlineContent.props.pageId}
      >
        <span className="text-xs">
          {props.inlineContent.props.icon || <FileText className="inline h-3 w-3 text-muted-foreground" />}
        </span>
        <span>{props.inlineContent.props.title || "Untitled"}</span>
      </a>
    ),
  },
);
