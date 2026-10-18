import { useEffect, useMemo, useState } from "react";
import { Command } from "cmdk";
import { FileText, Moon, Plus, Search, Sun, LayoutGrid } from "lucide-react";
import { usePages } from "@/features/page/hooks";
import { useWorkspaces } from "@/features/workspace/hooks";
import { api } from "@/lib/api";
import type { SearchResult } from "@/lib/types";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  workspaceId: string | null;
  onSelectPage: (id: string) => void;
  onSelectWorkspace: (id: string) => void;
  onCreatePage: () => void;
  onToggleTheme: () => void;
}

export function CommandPalette({
  open,
  onOpenChange,
  workspaceId,
  onSelectPage,
  onSelectWorkspace,
  onCreatePage,
  onToggleTheme,
}: Props) {
  const [query, setQuery] = useState("");
  const { data: pages = [] } = usePages(workspaceId);
  const { data: workspaces = [] } = useWorkspaces();
  const [remote, setRemote] = useState<SearchResult | null>(null);

  useEffect(() => {
    if (!query || !workspaceId) {
      setRemote(null);
      return;
    }
    const t = setTimeout(() => {
      api
        .get<SearchResult>(`/workspaces/${workspaceId}/search?q=${encodeURIComponent(query)}`)
        .then(setRemote)
        .catch(() => setRemote(null));
    }, 200);
    return () => clearTimeout(t);
  }, [query, workspaceId]);

  const localPages = useMemo(() => pages.slice(0, 20), [pages]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => onOpenChange(false)}
          />
          <motion.div
            className="fixed left-1/2 top-[15%] z-50 w-full max-w-xl -translate-x-1/2"
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.15 }}
          >
            <Command
              className="overflow-hidden rounded-lg border border-border bg-background shadow-2xl"
              label="Command palette"
            >
              <div className="flex items-center gap-2 border-b border-border px-3">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Command.Input
                  value={query}
                  onValueChange={setQuery}
                  placeholder="Search pages or run a command…"
                  className="flex-1 bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
                />
              </div>
              <Command.List className="max-h-[400px] overflow-y-auto p-1">
                <Command.Empty className="p-4 text-center text-sm text-muted-foreground">
                  No results.
                </Command.Empty>

                <Command.Group heading="Actions" className="p-1 text-xs text-muted-foreground">
                  <Command.Item onSelect={() => { onCreatePage(); onOpenChange(false); }} className="flex items-center gap-2 rounded p-2 text-sm text-foreground data-[selected=true]:bg-accent">
                    <Plus className="h-4 w-4" /> New page
                  </Command.Item>
                  <Command.Item onSelect={() => { onToggleTheme(); }} className="flex items-center gap-2 rounded p-2 text-sm text-foreground data-[selected=true]:bg-accent">
                    <Sun className="h-4 w-4 dark:hidden" />
                    <Moon className="h-4 w-4 hidden dark:block" />
                    Toggle theme
                  </Command.Item>
                </Command.Group>

                {workspaces.length > 1 && (
                  <Command.Group heading="Workspaces" className="p-1 text-xs text-muted-foreground">
                    {workspaces.map((w) => (
                      <Command.Item
                        key={w.id}
                        onSelect={() => { onSelectWorkspace(w.id); onOpenChange(false); }}
                        className="flex items-center gap-2 rounded p-2 text-sm text-foreground data-[selected=true]:bg-accent"
                      >
                        <LayoutGrid className="h-4 w-4" /> {w.name}
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}

                <Command.Group heading="Pages" className="p-1 text-xs text-muted-foreground">
                  {(remote?.pages ?? localPages).map((p) => (
                    <Command.Item
                      key={p.id}
                      value={`page:${p.id}:${p.title}`}
                      onSelect={() => { onSelectPage(p.id); onOpenChange(false); }}
                      className="flex items-center gap-2 rounded p-2 text-sm text-foreground data-[selected=true]:bg-accent"
                    >
                      <span className="w-4 text-center">{p.icon ?? <FileText className="h-3.5 w-3.5 text-muted-foreground inline" />}</span>
                      <span className="flex-1 truncate">{p.title || "Untitled"}</span>
                    </Command.Item>
                  ))}
                </Command.Group>

                {remote && remote.blocks.length > 0 && (
                  <Command.Group heading="Content" className="p-1 text-xs text-muted-foreground">
                    {remote.blocks.slice(0, 10).map((b) => (
                      <Command.Item
                        key={b.id}
                        value={`block:${b.id}:${b.textContent}`}
                        onSelect={() => { onSelectPage(b.pageId); onOpenChange(false); }}
                        className="flex flex-col items-start gap-0.5 rounded p-2 text-sm data-[selected=true]:bg-accent"
                      >
                        <span className="text-xs text-muted-foreground">{b.page.icon} {b.page.title || "Untitled"}</span>
                        <span className="line-clamp-1 text-foreground">{b.textContent}</span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}
              </Command.List>
            </Command>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
