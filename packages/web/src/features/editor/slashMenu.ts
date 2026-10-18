import type { BlockNoteEditor } from "@blocknote/core";
import { getDefaultReactSlashMenuItems } from "@blocknote/react";
import type { DefaultReactSuggestionItem } from "@blocknote/react";
import { createElement } from "react";
import { Mail } from "lucide-react";

const extraAliases: Record<string, string[]> = {
  "Check List": ["todo", "to-do", "task"],
  "Toggle List": ["toggle", "nested", "collapse", "fold", "expand"],
};

export function getSlashItems(editor: BlockNoteEditor): DefaultReactSuggestionItem[] {
  const items = getDefaultReactSlashMenuItems(editor) as any as (DefaultReactSuggestionItem & {
    aliases?: string[];
    title: string;
  })[];

  const withAliases = items.map((item) => {
    const extras = extraAliases[item.title];
    if (!extras) return item;
    return { ...item, aliases: [...(item.aliases ?? []), ...extras] };
  });

  const emailItem: DefaultReactSuggestionItem & { aliases: string[] } = {
    title: "Email",
    subtext: "Boxed monospace block for email-like text",
    aliases: ["email", "mail", "message", "letter"],
    group: "Advanced",
    icon: createElement(Mail, { size: 18 }),
    onItemClick: () => {
      const cursor = editor.getTextCursorPosition();
      editor.updateBlock(cursor.block, { type: "email" as any } as any);
    },
  } as any;

  return [...withAliases, emailItem];
}
