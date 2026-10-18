import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import {
  BlockNoteSchema,
  defaultBlockSpecs,
  defaultInlineContentSpecs,
  filterSuggestionItems,
  PartialBlock,
} from "@blocknote/core";
import { EmailBlock } from "./emailBlock";
import { CodeBlockOverlays } from "./CodeBlockOverlays";
import { useCreateBlockNote, SuggestionMenuController } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import { getSlashItems } from "./slashMenu";
import { UserMention, PageMention } from "./mentions";
import { api } from "@/lib/api";
import type { Member, PageFull, PageSummary } from "@/lib/types";

interface Props {
  page: PageFull;
  workspaceId: string;
  editable: boolean;
  theme: "light" | "dark";
  onUploadFile: (file: File) => Promise<string>;
  onSelectPage: (id: string) => void;
}

function extractText(blocks: PartialBlock[]): string {
  const out: string[] = [];
  const walk = (b: any) => {
    if (Array.isArray(b?.content)) {
      for (const inline of b.content) {
        if (typeof inline === "string") out.push(inline);
        else if (inline?.type === "text") out.push(inline.text ?? "");
        else if (inline?.type === "mention") out.push("@" + (inline.props?.name ?? ""));
        else if (inline?.type === "pagemention") out.push(inline.props?.title ?? "");
        else if (inline?.type === "link" && Array.isArray(inline.content)) {
          for (const c of inline.content) if (c?.type === "text") out.push(c.text ?? "");
        }
      }
    }
    if (Array.isArray(b?.children)) for (const c of b.children) walk(c);
  };
  for (const b of blocks) walk(b);
  return out.join(" ").trim();
}

function blocksToRows(topBlocks: PartialBlock[]) {
  const rows: Array<{
    id: string;
    type: string;
    content: unknown;
    textContent: string;
    position: string;
    parentBlockId: string | null;
  }> = [];

  const walk = (blocks: PartialBlock[], parentId: string | null) => {
    let counter = 0;
    for (const b of blocks) {
      const id = (b as any).id ?? crypto.randomUUID();
      const pos = String.fromCharCode(97 + Math.floor(counter / 26)) + String(counter % 26).padStart(2, "0");
      rows.push({
        id,
        type: b.type ?? "paragraph",
        content: b,
        textContent: extractText([b]).slice(0, 8000),
        position: pos,
        parentBlockId: parentId,
      });
      if (Array.isArray((b as any).children) && (b as any).children.length) {
        walk((b as any).children, id);
      }
      counter += 1;
    }
  };
  walk(topBlocks, null);
  return rows;
}

const schema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    email: EmailBlock,
  },
  inlineContentSpecs: {
    ...defaultInlineContentSpecs,
    mention: UserMention,
    pagemention: PageMention,
  },
});

export interface EditorHandle {
  insertBlockAtStart: () => void;
  focusFirstBlock: () => void;
}

const KNOWN_TYPES = new Set([
  "paragraph",
  "heading",
  "bulletListItem",
  "numberedListItem",
  "checkListItem",
  "codeBlock",
  "quote",
  "table",
  "image",
  "video",
  "audio",
  "file",
  "email",
  "toggleListItem",
]);

function normalizeBlock(b: any): any {
  if (!b || typeof b !== "object") return b;
  const mapped: any = {
    ...b,
    type: KNOWN_TYPES.has(b.type) ? b.type : "paragraph",
    props: b.props ? { ...b.props } : undefined,
    children: Array.isArray(b.children) ? b.children.map(normalizeBlock) : b.children,
  };
  if (mapped.props && "open" in mapped.props) delete mapped.props.open;
  return mapped;
}

const EditorImpl = forwardRef<EditorHandle, Props>(function Editor({ page, workspaceId, editable, theme, onUploadFile, onSelectPage }, ref) {
  const initialContent = useMemo<PartialBlock[]>(() => {
    if (!page.blocks.length) return [{ type: "paragraph" }];
    const topBlocks = page.blocks
      .filter((b) => !b.parentBlockId)
      .sort((a, b) => a.position.localeCompare(b.position));
    return topBlocks.map((b) => {
      const c = b.content as PartialBlock;
      return normalizeBlock({ ...(c as any), id: b.id });
    });
  }, [page.id]);

  const editor = useCreateBlockNote({
    schema,
    initialContent: initialContent as any,
    uploadFile: async (file) => onUploadFile(file),
  });

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSerialized = useRef<string>("");

  const scheduleSave = useCallback(() => {
    if (!editable) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const doc = editor.document as PartialBlock[];
      const rows = blocksToRows(doc);
      const serialized = JSON.stringify(rows);
      if (serialized === lastSerialized.current) return;
      lastSerialized.current = serialized;
      try {
        await api.put(`/pages/${page.id}/blocks`, { blocks: rows });
      } catch (e) {
        console.error("Save failed", e);
      }
    }, 600);
  }, [editor, page.id, editable]);

  useEffect(() => {
    const unsub = editor.onChange(() => scheduleSave());
    return () => {
      unsub?.();
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [editor, scheduleSave]);

  useEffect(() => {
    const shell = document.querySelector<HTMLElement>(".editor-shell");
    if (!shell) return;

    const onKey = (e: KeyboardEvent) => {
      if (!editable) return;
      if (!(e.key === "Enter" || e.key === "Tab")) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "Tab" && e.shiftKey) {
        try {
          const cur = editor.getTextCursorPosition();
          if (cur?.block?.type === "email") return;
          e.preventDefault();
          e.stopPropagation();
          editor.unnestBlock();
        } catch {}
        return;
      }

      let cursor;
      try {
        cursor = editor.getTextCursorPosition();
      } catch {
        return;
      }

      if (cursor.block.type === "email") {
        e.preventDefault();
        e.stopPropagation();
        try {
          const tt = (editor as any)._tiptapEditor;
          if (e.key === "Enter") {
            const ok = tt?.chain?.().focus().insertContent({ type: "hardBreak" }).run();
            if (!ok) tt?.chain?.().focus().insertContent("\n").run();
          } else if (e.key === "Tab") {
            tt?.chain?.().focus().insertContent("  ").run();
          }
        } catch {}
        return;
      }

      if (e.key !== "Enter" || e.shiftKey) return;

      if (cursor.block.type === "toggleListItem") {
        const content = (cursor.block as any).content;
        const hasContent = Array.isArray(content) && content.length > 0;
        if (!hasContent) return;

        e.preventDefault();
        e.stopPropagation();
        try {
          const [inserted] = editor.insertBlocks(
            [{ type: "paragraph" }],
            cursor.block,
            "after",
          );
          if (!inserted) return;
          requestAnimationFrame(() => {
            try {
              editor.setTextCursorPosition(inserted, "start");
              editor.nestBlock();
            } catch {}
          });
        } catch {}
      }
    };

    shell.addEventListener("keydown", onKey, true);
    return () => shell.removeEventListener("keydown", onKey, true);
  }, [editor, editable]);

  useEffect(() => {
    const shell = document.querySelector<HTMLElement>(".editor-shell");
    if (!shell) return;
    if (!editable) return;

    const findAdjacentToggle = (blockId: string): { toggleId: string } | null => {
      const walk = (blocks: any[], parentIsToggle: boolean): { toggleId: string } | null => {
        for (let i = 0; i < blocks.length; i += 1) {
          const b = blocks[i];
          if (b.id === blockId) {
            if (i > 0 && blocks[i - 1].type === "toggleListItem") {
              return { toggleId: blocks[i - 1].id };
            }
            return null;
          }
          if (Array.isArray(b.children) && b.children.length) {
            const res = walk(b.children, b.type === "toggleListItem");
            if (res) return res;
          }
        }
        return null;
      };
      return walk(editor.document as any[], false);
    };

    const onDrop = () => {
      requestAnimationFrame(() => {
        try {
          const cursor = editor.getTextCursorPosition();
          if (!cursor?.block) return;
          const info = findAdjacentToggle(cursor.block.id);
          if (!info) return;
          editor.nestBlock();
        } catch {}
      });
    };

    shell.addEventListener("drop", onDrop, false);
    return () => shell.removeEventListener("drop", onDrop, false);
  }, [editor, editable]);

  useImperativeHandle(
    ref,
    () => ({
      insertBlockAtStart: () => {
        const doc = editor.document as any[];
        const first = doc[0];
        if (!first) return;
        const inserted = editor.insertBlocks(
          [{ type: "paragraph" }],
          first,
          "before",
        );
        const newBlock = inserted[0];
        if (newBlock) {
          editor.setTextCursorPosition(newBlock, "start");
          editor.focus();
        }
      },
      focusFirstBlock: () => {
        const doc = editor.document as any[];
        const first = doc[0];
        if (first) {
          editor.setTextCursorPosition(first, "start");
          editor.focus();
        }
      },
    }),
    [editor],
  );

  useEffect(() => {
    const shell = document.querySelector<HTMLElement>(".editor-shell");
    if (!shell) return;

    const looksLikeNotion = (html: string) =>
      /data-block-id|notion\.so|data-content-editable-leaf|"notion-/.test(html);

    const sanitize = (html: string): string => {
      const doc = new DOMParser().parseFromString(html, "text/html");
      doc.querySelectorAll("script, style, meta, link").forEach((n) => n.remove());
      doc.querySelectorAll<HTMLElement>("*").forEach((el) => {
        for (const attr of Array.from(el.attributes)) {
          const name = attr.name;
          if (name.startsWith("data-") || name.startsWith("aria-") || name === "class" || name === "style" || name === "id") {
            el.removeAttribute(name);
          }
        }
      });
      return doc.body.innerHTML;
    };

    const isRichHtml = (html: string) =>
      looksLikeNotion(html) ||
      /<(div|span|table|pre|h[1-6]|ul|ol|blockquote|section|article)[\s>]/i.test(html) ||
      /data-\w+=|style=|class=/.test(html);

    const handlePaste = async (e: ClipboardEvent) => {
      if (!editable) return;
      let cursor;
      try {
        cursor = editor.getTextCursorPosition();
      } catch {
        return;
      }

      if (cursor.block.type === "email") {
        const text = e.clipboardData?.getData("text/plain") ?? "";
        if (!text) return;
        e.preventDefault();
        e.stopPropagation();
        try {
          const tt = (editor as any)._tiptapEditor;
          const lines = text.replace(/\r\n?/g, "\n").split("\n");
          const nodes: any[] = [];
          lines.forEach((line, i) => {
            if (i > 0) nodes.push({ type: "hardBreak" });
            if (line.length > 0) nodes.push({ type: "text", text: line });
          });
          tt?.chain?.().focus().insertContent(nodes).run();
        } catch {}
        return;
      }

      if (cursor.block.type === "codeBlock") return;
      const html = e.clipboardData?.getData("text/html");
      const text = e.clipboardData?.getData("text/plain");
      if (!html && !text) return;

      const needsSafePath = html ? isRichHtml(html) : false;
      if (!needsSafePath) return;

      e.preventDefault();
      e.stopPropagation();

      try {
        let blocks: any[] = [];
        if (text && text.trim().length > 0) {
          try {
            blocks = await editor.tryParseMarkdownToBlocks(text);
          } catch {}
        }
        if ((!blocks || blocks.length === 0) && html) {
          try {
            blocks = await editor.tryParseHTMLToBlocks(sanitize(html));
          } catch {}
        }
        if ((!blocks || blocks.length === 0) && text) {
          blocks = text.split(/\n\n+/).map((chunk) => ({
            type: "paragraph",
            content: chunk.trim(),
          })) as any[];
        }
        if (!blocks || blocks.length === 0) return;

        const cursor = editor.getTextCursorPosition();
        editor.insertBlocks(blocks as any, cursor.block, "after");
      } catch (err) {
        console.error("Paste failed", err);
      }
    };

    shell.addEventListener("paste", handlePaste, true);
    return () => shell.removeEventListener("paste", handlePaste, true);
  }, [editor, editable]);



  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest("[data-page-id]");
      if (target) {
        const id = target.getAttribute("data-page-id");
        if (id) {
          e.preventDefault();
          onSelectPage(id);
        }
      }
    };
    const el = document.querySelector(".editor-shell");
    el?.addEventListener("click", onClick as EventListener);
    return () => el?.removeEventListener("click", onClick as EventListener);
  }, [onSelectPage, page.id]);

  const getMentionItems = async (query: string) => {
    const members = await api.get<Member[]>(`/workspaces/${workspaceId}/members`);
    const q = query.toLowerCase();
    return members
      .filter((m) => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q))
      .slice(0, 8)
      .map((m) => ({
        title: m.name,
        subtext: m.email,
        onItemClick: () => {
          editor.insertInlineContent([
            {
              type: "mention",
              props: { userId: m.userId, name: m.name },
            } as any,
            " ",
          ]);
        },
      }));
  };

  const getPageItems = async (query: string) => {
    const pages = await api.get<PageSummary[]>(`/workspaces/${workspaceId}/pages`);
    const q = query.toLowerCase();
    return pages
      .filter((p) => (p.title || "Untitled").toLowerCase().includes(q))
      .slice(0, 8)
      .map((p) => ({
        title: p.title || "Untitled",
        icon: <span className="text-base">{p.icon ?? "📄"}</span>,
        onItemClick: () => {
          editor.insertInlineContent([
            {
              type: "pagemention",
              props: { pageId: p.id, title: p.title || "Untitled", icon: p.icon ?? "" },
            } as any,
            " ",
          ]);
        },
      }));
  };

  const [shellEl, setShellEl] = useState<HTMLElement | null>(null);

  return (
    <div className="editor-shell" ref={setShellEl}>
      <BlockNoteView editor={editor} editable={editable} theme={theme} slashMenu={false}>
        <SuggestionMenuController
          triggerCharacter="/"
          getItems={async (query) => filterSuggestionItems(getSlashItems(editor as any), query)}
        />
        <SuggestionMenuController
          triggerCharacter="@"
          getItems={async (query) => getMentionItems(query)}
        />
        <SuggestionMenuController
          triggerCharacter="["
          getItems={async (query) => getPageItems(query)}
        />
      </BlockNoteView>
      <CodeBlockOverlays editor={editor as any} shell={shellEl} />
    </div>
  );
});

export const Editor = memo(EditorImpl, (prev, next) => {
  return (
    prev.page.id === next.page.id &&
    prev.workspaceId === next.workspaceId &&
    prev.editable === next.editable &&
    prev.theme === next.theme
  );
});
