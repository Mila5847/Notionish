import { useState } from "react";
import { ChevronRight, MoreHorizontal, Plus, Star, Trash2, Copy, FileText, Folder, FolderOpen, FolderPlus, FilePlus } from "lucide-react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import type { PageSummary } from "@/lib/types";
import { cn } from "@/lib/cn";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown";
import { useArchivePage, useCreatePage, useDuplicatePage, useToggleFavorite } from "@/features/page/hooks";

interface Props {
  page: PageSummary;
  children: PageSummary[];
  childrenOf: Map<string | null, PageSummary[]>;
  depth: number;
  activePageId: string | null;
  workspaceId: string;
  favoriteIds: Set<string>;
  onSelect: (id: string) => void;
}

export function PageTreeItem({ page, children, childrenOf, depth, activePageId, workspaceId, favoriteIds, onSelect }: Props) {
  const [expanded, setExpanded] = useState(depth === 0);
  const create = useCreatePage(workspaceId);
  const archive = useArchivePage(workspaceId);
  const duplicate = useDuplicatePage(workspaceId);
  const favorite = useToggleFavorite(workspaceId);
  const isFav = favoriteIds.has(page.id);
  const isFolder = page.type === "FOLDER";
  const hasChildren = children.length > 0;
  const active = activePageId === page.id;

  const drag = useDraggable({ id: page.id, data: { type: "page", pageId: page.id } });
  const dropBefore = useDroppable({ id: `before:${page.id}`, data: { type: "before", pageId: page.id } });
  const dropInto = useDroppable({ id: `into:${page.id}`, data: { type: "into", pageId: page.id } });

  const title = page.title || "Untitled";

  return (
    <div>
      <div
        ref={dropBefore.setNodeRef}
        className={cn(
          "h-0.5 -mt-0.5 rounded",
          dropBefore.isOver ? "bg-primary/70" : "bg-transparent",
        )}
      />
      <div
        ref={(node) => {
          drag.setNodeRef(node);
          dropInto.setNodeRef(node);
        }}
        {...drag.attributes}
        {...drag.listeners}
        className={cn(
          "group flex items-center gap-0.5 rounded-md px-1 py-0.5 text-sm hover:bg-accent cursor-pointer",
          active && "bg-accent",
          drag.isDragging && "opacity-40",
          dropInto.isOver && "ring-2 ring-primary/60",
        )}
        style={{
          paddingLeft: `${depth * 12 + 4}px`,
          transform: drag.transform ? `translate3d(${drag.transform.x}px, ${drag.transform.y}px, 0)` : undefined,
        }}
        onClick={(e) => {
          if (drag.isDragging) return;
          e.stopPropagation();
          if (isFolder) {
            setExpanded((v) => !v);
            onSelect(page.id);
          } else {
            onSelect(page.id);
          }
        }}
      >
        <button
          className={cn(
            "flex h-5 w-5 items-center justify-center rounded hover:bg-muted",
            !hasChildren && "opacity-0 pointer-events-none",
          )}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
        >
          <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-90")} />
        </button>
        <span className="flex h-5 w-5 items-center justify-center text-sm">
          {page.icon ? (
            <span>{page.icon}</span>
          ) : isFolder ? (
            expanded ? (
              <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <Folder className="h-3.5 w-3.5 text-muted-foreground" />
            )
          ) : (
            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </span>
        <span className="flex-1 truncate">{title}</span>
        <div
          className="flex gap-0.5 opacity-0 group-hover:opacity-100 has-[[data-state=open]]:opacity-100 focus-within:opacity-100 transition-opacity"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex h-5 w-5 items-center justify-center rounded hover:bg-muted"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuItem onClick={() => favorite.mutate({ id: page.id, favorited: isFav })}>
                <Star className={cn("h-4 w-4", isFav && "fill-yellow-500 text-yellow-500")} />
                {isFav ? "Remove favorite" : "Add to favorites"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => duplicate.mutate(page.id)}>
                <Copy className="h-4 w-4" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive onClick={() => archive.mutate(page.id)}>
                <Trash2 className="h-4 w-4" />
                Move to trash
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex h-5 w-5 items-center justify-center rounded hover:bg-muted"
                onClick={(e) => e.stopPropagation()}
                title="Add inside"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-40">
              <DropdownMenuItem
                onClick={async () => {
                  const p = await create.mutateAsync({ parentPageId: page.id, title: "", type: "PAGE" });
                  setExpanded(true);
                  onSelect(p.id);
                }}
              >
                <FilePlus className="h-4 w-4" /> New page
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={async () => {
                  const p = await create.mutateAsync({ parentPageId: page.id, title: "", type: "FOLDER" });
                  setExpanded(true);
                  onSelect(p.id);
                }}
              >
                <FolderPlus className="h-4 w-4" /> New folder
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {expanded && hasChildren && (
        <div>
          {children.map((child) => (
            <PageTreeItem
              key={child.id}
              page={child}
              children={childrenOf.get(child.id) ?? []}
              childrenOf={childrenOf}
              depth={depth + 1}
              activePageId={activePageId}
              workspaceId={workspaceId}
              favoriteIds={favoriteIds}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}
