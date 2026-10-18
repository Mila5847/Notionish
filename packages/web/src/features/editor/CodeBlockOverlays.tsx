import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, WrapText } from "lucide-react";
import type { BlockNoteEditor } from "@blocknote/core";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown";
import { cn } from "@/lib/cn";

const LANGUAGES = [
  "text", "javascript", "typescript", "jsx", "tsx", "python", "go", "rust",
  "java", "csharp", "cpp", "c", "swift", "kotlin", "ruby", "php",
  "html", "css", "scss", "json", "yaml", "toml", "xml", "markdown",
  "bash", "shell", "sql", "graphql", "dockerfile", "nginx",
];

interface Props {
  editor: BlockNoteEditor;
  shell: HTMLElement | null;
}

interface Slot {
  container: HTMLElement;
  host: HTMLElement;
  code: HTMLElement;
  blockId: string;
  language: string;
}

function findBlockId(el: HTMLElement): string | null {
  let cur: HTMLElement | null = el;
  while (cur) {
    const id = cur.getAttribute("data-id");
    if (id) return id;
    cur = cur.parentElement;
  }
  return null;
}

function detectLanguage(code: HTMLElement): string {
  const cls = code.className.split(" ").find((c) => c.startsWith("language-"));
  if (cls) return cls.replace("language-", "");
  const contentEl = code.closest<HTMLElement>("[data-content-type='codeBlock']");
  const attr = contentEl?.getAttribute("data-language");
  return attr ?? "text";
}

function computeSlots(shell: HTMLElement): Slot[] {
  const codes = Array.from(
    shell.querySelectorAll<HTMLElement>("pre > code.bn-inline-content"),
  );
  const next: Slot[] = [];
  for (const code of codes) {
    const host = code.closest<HTMLElement>(".bn-block-outer");
    if (!host) continue;
    const blockId = findBlockId(host) ?? code.textContent?.slice(0, 8) ?? "unknown";

    let container = document.querySelector<HTMLElement>(
      `.code-toolbar-mount[data-for="${blockId}"]`,
    );
    if (!container) {
      container = document.createElement("div");
      container.className = "code-toolbar-mount";
      container.setAttribute("data-for", blockId);
      container.contentEditable = "false";
      Object.assign(container.style, {
        position: "fixed",
        zIndex: "1000",
        pointerEvents: "auto",
      });
      document.body.appendChild(container);
    }
    const rect = host.getBoundingClientRect();
    container.style.top = `${rect.top + 10}px`;
    container.style.left = `${rect.right - 200}px`;

    let wrapOn = false;
    try { wrapOn = localStorage.getItem(`codeWrap:${blockId}`) === "true"; } catch {}
    host.classList.toggle("code-wrap-on", wrapOn);

    next.push({
      container,
      host,
      code,
      blockId,
      language: detectLanguage(code),
    });
  }
  return next;
}

function slotsEqual(a: Slot[], b: Slot[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i].container !== b[i].container) return false;
    if (a[i].host !== b[i].host) return false;
    if (a[i].code !== b[i].code) return false;
    if (a[i].language !== b[i].language) return false;
  }
  return true;
}

export function CodeBlockOverlays({ editor, shell }: Props) {
  const [slots, setSlots] = useState<Slot[]>([]);

  useEffect(() => {
    if (!shell) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const scanNow = () => {
      const next = computeSlots(shell);
      setSlots((prev) => (slotsEqual(prev, next) ? prev : next));
    };
    const schedule = (delay = 60) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(scanNow, delay);
    };

    scanNow();
    [50, 150, 400, 1000].forEach((d) => setTimeout(scanNow, d));

    const unsub = editor.onChange(() => schedule());
    const onClickOrFocus = () => schedule(0);
    const onScrollResize = () => schedule(0);
    shell.addEventListener("click", onClickOrFocus, true);
    shell.addEventListener("focusin", onClickOrFocus, true);
    const scroller = shell.closest("[class*='overflow-y-auto']") ?? window;
    (scroller as any).addEventListener("scroll", onScrollResize, true);
    window.addEventListener("resize", onScrollResize);

    return () => {
      if (timer) clearTimeout(timer);
      unsub?.();
      shell.removeEventListener("click", onClickOrFocus, true);
      shell.removeEventListener("focusin", onClickOrFocus, true);
      (scroller as any).removeEventListener("scroll", onScrollResize, true);
      window.removeEventListener("resize", onScrollResize);
      document.querySelectorAll(".code-toolbar-mount").forEach((n) => n.remove());
    };
  }, [shell, editor]);

  return (
    <>
      {slots.map((slot) => (
        <PortalToolbar key={slot.blockId} slot={slot} editor={editor} />
      ))}
    </>
  );
}

function PortalToolbar({ slot, editor }: { slot: Slot; editor: BlockNoteEditor }) {
  const [wrap, setWrap] = useState<boolean>(() => {
    try { return localStorage.getItem(`codeWrap:${slot.blockId}`) === "true"; } catch { return false; }
  });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const styleId = `code-wrap-style-${slot.blockId}`;
    let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }
    const id = slot.blockId;
    if (wrap) {
      styleEl.textContent = `
        .bn-block-outer[data-id="${id}"],
        .bn-block-outer[data-id="${id}"] .bn-block,
        .bn-block-outer[data-id="${id}"] [data-content-type="codeBlock"] {
          min-width: 0 !important;
          max-width: 100% !important;
        }
        .bn-block-outer[data-id="${id}"] [data-content-type="codeBlock"] {
          display: block !important;
          overflow: hidden !important;
        }
        .bn-block-outer[data-id="${id}"] [data-content-type="codeBlock"] > pre,
        .bn-block-outer[data-id="${id}"] pre {
          display: block !important;
          white-space: pre-wrap !important;
          word-break: break-all !important;
          overflow-wrap: anywhere !important;
          overflow-x: hidden !important;
          min-width: 0 !important;
          max-width: 100% !important;
          width: 100% !important;
          box-sizing: border-box !important;
        }
        .bn-block-outer[data-id="${id}"] pre > code,
        .bn-block-outer[data-id="${id}"] pre > code.bn-inline-content {
          display: block !important;
          white-space: pre-wrap !important;
          word-break: break-all !important;
          overflow-wrap: anywhere !important;
          min-width: 0 !important;
          max-width: 100% !important;
          width: 100% !important;
          box-sizing: border-box !important;
        }
        .bn-block-outer[data-id="${id}"] pre * {
          white-space: pre-wrap !important;
          word-break: break-all !important;
          overflow-wrap: anywhere !important;
          max-width: 100% !important;
        }
      `;
    } else {
      styleEl.textContent = "";
    }
    return () => {
      styleEl?.remove();
    };
  }, [wrap, slot.blockId]);

  const setLanguage = (lang: string) => {
    try {
      editor.updateBlock(slot.blockId as any, {
        type: "codeBlock" as any,
        props: { language: lang } as any,
      } as any);
    } catch {}
  };

  const copyCode = async () => {
    const text = slot.code.textContent ?? "";
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  };

  const toggleWrap = () => {
    setWrap((prev) => {
      const next = !prev;
      try { localStorage.setItem(`codeWrap:${slot.blockId}`, String(next)); } catch {}
      return next;
    });
  };

  return createPortal(
    <div className="flex items-center gap-1 rounded-md border border-border bg-background/95 p-0.5 text-xs shadow-md backdrop-blur">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="rounded px-2 py-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            title="Language"
          >
            {slot.language}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="max-h-[300px] w-40 overflow-y-auto">
          {LANGUAGES.map((lang) => (
            <DropdownMenuItem key={lang} onClick={() => setLanguage(lang)}>
              <span className={cn("flex-1", lang === slot.language && "font-medium")}>{lang}</span>
              {lang === slot.language && <Check className="h-3.5 w-3.5" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <button
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => {
          toggleWrap();
          (e.currentTarget as HTMLButtonElement).blur();
        }}
        className={cn(
          "flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground",
          wrap && "bg-accent text-primary",
        )}
        title={wrap ? "Wrap: on" : "Wrap: off"}
      >
        <WrapText className="h-3.5 w-3.5" />
      </button>
      <button
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => {
          copyCode();
          (e.currentTarget as HTMLButtonElement).blur();
        }}
        className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
        title={copied ? "Copied!" : "Copy code"}
      >
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>,
    slot.container,
  );
}
