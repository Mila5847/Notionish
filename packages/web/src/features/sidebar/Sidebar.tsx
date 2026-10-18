import { useMemo, useState } from "react";
import { FileText, FilePlus, Folder, FolderOpen, FolderPlus, Plus, Search, Settings, Star, Trash2, PanelLeftClose } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown";
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors, useDroppable } from "@dnd-kit/core";
import { WorkspaceSwitcher } from "@/features/workspace/WorkspaceSwitcher";
import { useCreatePage, useFavorites, useMovePage, usePages } from "@/features/page/hooks";
import type { PageSummary } from "@/lib/types";
import { PageTreeItem } from "./PageTreeItem";
import { cn } from "@/lib/cn";

interface Props {
  workspaceId: string | null;
  activePageId: string | null;
  onSelectWorkspace: (id: string) => void;
  onSelectPage: (id: string) => void;
  onOpenSearch: () => void;
  onOpenSettings: () => void;
  onOpenTrash: () => void;
  onCollapse: () => void;
}

function RootDropZone() {
  const { setNodeRef, isOver } = useDroppable({ id: "into:__root__", data: { type: "into", pageId: null } });
  return (
    <div
      ref={setNodeRef}
      className={cn("mx-2 mb-2 h-6 rounded border border-dashed text-[10px] flex items-center justify-center transition-colors",
        isOver ? "border-primary bg-primary/10 text-primary" : "border-transparent text-transparent",
      )}
    >
      Drop to make top-level
    </div>
  );
}

export function Sidebar({
  workspaceId,
  activePageId,
  onSelectWorkspace,
  onSelectPage,
  onOpenSearch,
  onOpenSettings,
  onOpenTrash,
  onCollapse,
}: Props) {
  const { data: pages = [] } = usePages(workspaceId);
  const { data: favorites = [] } = useFavorites(workspaceId);
  const create = useCreatePage(workspaceId ?? "");
  const move = useMovePage(workspaceId ?? "");
  const [favOpen, setFavOpen] = useState(true);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const childrenOf = useMemo(() => {
    const map = new Map<string | null, PageSummary[]>();
    for (const p of pages) {
      const arr = map.get(p.parentPageId) ?? [];
      arr.push(p);
      map.set(p.parentPageId, arr);
    }
    for (const arr of map.values()) arr.sort((a, b) => a.position.localeCompare(b.position));
    return map;
  }, [pages]);

  const roots = childrenOf.get(null) ?? [];
  const favoriteIds = useMemo(() => new Set(favorites.map((f) => f.id)), [favorites]);

  const isDescendant = (ancestorId: string, candidateId: string): boolean => {
    const kids = childrenOf.get(ancestorId) ?? [];
    for (const k of kids) {
      if (k.id === candidateId) return true;
      if (isDescendant(k.id, candidateId)) return true;
    }
    return false;
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const draggedId = e.active.data.current?.pageId as string | undefined;
    const drop = e.over?.data.current as { type: "before" | "into"; pageId: string | null } | undefined;
    if (!draggedId || !drop) return;
    if (drop.pageId === draggedId) return;
    if (drop.pageId && isDescendant(draggedId, drop.pageId)) return;

    if (drop.type === "before") {
      const target = pages.find((p) => p.id === drop.pageId);
      if (!target) return;
      const siblings = childrenOf.get(target.parentPageId) ?? [];
      const idx = siblings.findIndex((p) => p.id === target.id);
      const prev = idx > 0 ? siblings[idx - 1] : null;
      move.mutate({
        id: draggedId,
        parentPageId: target.parentPageId,
        afterPageId: prev?.id ?? null,
        beforePageId: target.id,
      });
    } else {
      move.mutate({ id: draggedId, parentPageId: drop.pageId ?? null });
    }
  };

  return (
    <aside className="bg-sidebar flex h-full w-64 shrink-0 flex-col border-r border-border">
      <div className="flex items-center gap-1 p-2">
        <div className="flex-1">
          {workspaceId && (
            <WorkspaceSwitcher
              currentId={workspaceId}
              onSelect={onSelectWorkspace}
              onOpenSettings={onOpenSettings}
            />
          )}
        </div>
        <button
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
          onClick={onCollapse}
          title="Collapse sidebar"
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>
      </div>

      <div className="px-2 pb-2 space-y-0.5">
        <button
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent"
          onClick={onOpenSearch}
        >
          <Search className="h-4 w-4" />
          <span>Search</span>
          <kbd className="ml-auto text-[10px] font-mono text-muted-foreground">⌘K</kbd>
        </button>
        <button
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent"
          onClick={onOpenSettings}
        >
          <Settings className="h-4 w-4" />
          <span>Settings</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {favorites.length > 0 && (
          <div className="mb-3">
            <button
              className="flex w-full items-center gap-1 px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground"
              onClick={() => setFavOpen((v) => !v)}
            >
              <Star className="h-3 w-3" />
              Favorites
            </button>
            {favOpen && (
              <div className="mt-0.5 space-y-0.5">
                {favorites.map((f) => (
                  <button
                    key={f.id}
                    className={cn(
                      "flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-sm hover:bg-accent",
                      activePageId === f.id && "bg-accent",
                    )}
                    onClick={() => onSelectPage(f.id)}
                  >
                    <span className="flex h-4 w-4 items-center justify-center text-sm">
                      {f.icon
                        ? <span>{f.icon}</span>
                        : f.type === "FOLDER"
                          ? <Folder className="h-3.5 w-3.5 text-muted-foreground" />
                          : <FileText className="h-3.5 w-3.5 text-muted-foreground" />}
                    </span>
                    <span className="truncate">{f.title || "Untitled"}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="mb-1 flex items-center justify-between px-2 pt-1">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Pages</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex h-5 w-5 items-center justify-center rounded hover:bg-accent"
                title="New page or folder"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem
                onClick={async () => {
                  if (!workspaceId) return;
                  const p = await create.mutateAsync({ title: "", type: "PAGE" });
                  onSelectPage(p.id);
                }}
              >
                <FilePlus className="h-4 w-4" /> New page
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={async () => {
                  if (!workspaceId) return;
                  const p = await create.mutateAsync({ title: "", type: "FOLDER" });
                  onSelectPage(p.id);
                }}
              >
                <FolderPlus className="h-4 w-4" /> New folder
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {roots.length === 0 && (
          <div className="px-2 py-2 text-xs text-muted-foreground">
            No pages yet. Click <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-muted"><Plus className="h-3 w-3" /></span> to create one.
          </div>
        )}

        {workspaceId && (
          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <div>
              {roots.map((p) => (
                <PageTreeItem
                  key={p.id}
                  page={p}
                  children={childrenOf.get(p.id) ?? []}
                  childrenOf={childrenOf}
                  depth={0}
                  activePageId={activePageId}
                  workspaceId={workspaceId}
                  favoriteIds={favoriteIds}
                  onSelect={onSelectPage}
                />
              ))}
              <RootDropZone />
            </div>
          </DndContext>
        )}
      </div>

      <div className="border-t border-border p-2">
        <button
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent"
          onClick={onOpenTrash}
        >
          <Trash2 className="h-4 w-4" />
          Trash
        </button>
      </div>
    </aside>
  );
}
