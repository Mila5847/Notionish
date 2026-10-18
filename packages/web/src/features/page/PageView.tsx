import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ChevronRight, FilePlus, FileText, FolderOpen, FolderPlus, Image as ImageIcon, MoreHorizontal, Smile, Star, Trash2, Copy } from "lucide-react";
import { Editor, type EditorHandle } from "@/features/editor/Editor";
import { EditorBoundary } from "@/features/editor/EditorBoundary";
import {
  useArchivePage,
  useCreatePage,
  useDuplicatePage,
  usePage,
  usePages,
  useToggleFavorite,
  useUpdatePage,
  useFavorites,
} from "./hooks";
import { api } from "@/lib/api";
import { EmojiPickerPopover } from "./EmojiPicker";
import { CoverPicker } from "./CoverPicker";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown";
import { cn } from "@/lib/cn";

interface Props {
  pageId: string;
  workspaceId: string;
  theme: "light" | "dark";
  editable: boolean;
  focusMode: boolean;
  onSelectPage: (id: string) => void;
  onToggleFocus: () => void;
}

export function PageView({ pageId, workspaceId, theme, editable, focusMode, onSelectPage, onToggleFocus }: Props) {
  const { data: page, isLoading } = usePage(pageId);
  const { data: pages = [] } = usePages(workspaceId);
  const { data: favorites = [] } = useFavorites(workspaceId);
  const update = useUpdatePage(pageId, workspaceId);
  const archive = useArchivePage(workspaceId);
  const duplicate = useDuplicatePage(workspaceId);
  const favorite = useToggleFavorite(workspaceId);
  const create = useCreatePage(workspaceId);
  const [title, setTitle] = useState("");
  const [showCoverPicker, setShowCoverPicker] = useState(false);
  const editorRef = useRef<EditorHandle>(null);
  const [editorNonce, setEditorNonce] = useState(0);

  useEffect(() => {
    if (page) setTitle(page.title);
  }, [page?.id]);

  const breadcrumbs = useMemo(() => {
    if (!page) return [];
    const map = new Map(pages.map((p) => [p.id, p]));
    const trail: Array<{ id: string; title: string; icon: string | null }> = [];
    let cursor: string | null = page.parentPageId;
    while (cursor) {
      const p = map.get(cursor);
      if (!p) break;
      trail.unshift({ id: p.id, title: p.title || "Untitled", icon: p.icon });
      cursor = p.parentPageId;
    }
    return trail;
  }, [page?.id, pages]);

  const isFav = useMemo(() => favorites.some((f) => f.id === pageId), [favorites, pageId]);

  const childPages = useMemo(
    () => pages
      .filter((p) => p.parentPageId === pageId)
      .sort((a, b) => a.position.localeCompare(b.position)),
    [pages, pageId],
  );

  const uploadFile = useCallback(
    async (file: File): Promise<string> => {
      const form = new FormData();
      form.append("file", file);
      const asset = await api.upload<{ id: string; url: string }>(
        `/workspaces/${workspaceId}/files`,
        form,
      );
      return asset.url;
    },
    [workspaceId],
  );

  if (isLoading || !page) {
    return (
      <div className="flex-1 space-y-4 p-16">
        <div className="h-10 w-1/2 animate-pulse rounded bg-muted" />
        <div className="h-4 w-full animate-pulse rounded bg-muted" />
        <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden">
      <div className="flex h-11 shrink-0 items-center gap-1 border-b border-border px-4 text-sm">
        <div className="flex items-center gap-1 text-muted-foreground">
          {breadcrumbs.map((b, i) => (
            <div key={b.id} className="flex items-center gap-1">
              <button className="flex items-center gap-1 rounded px-1.5 py-1 hover:bg-accent" onClick={() => onSelectPage(b.id)}>
                {b.icon && <span>{b.icon}</span>}
                <span className="max-w-[120px] truncate">{b.title}</span>
              </button>
              <ChevronRight className="h-3.5 w-3.5" />
            </div>
          ))}
          <div className="flex items-center gap-1 rounded px-1.5 py-1 text-foreground">
            {page.icon && <span>{page.icon}</span>}
            <span className="max-w-[240px] truncate">{page.title || "Untitled"}</span>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <button
            className="flex h-7 w-7 items-center justify-center rounded hover:bg-accent"
            onClick={() => favorite.mutate({ id: pageId, favorited: isFav })}
            title="Favorite"
          >
            <Star className={cn("h-4 w-4", isFav && "fill-yellow-500 text-yellow-500")} />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex h-7 w-7 items-center justify-center rounded hover:bg-accent">
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={onToggleFocus}>
                {focusMode ? "Exit focus mode" : "Focus mode"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => duplicate.mutate(pageId)}>
                <Copy className="h-4 w-4" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive onClick={() => archive.mutate(pageId)}>
                <Trash2 className="h-4 w-4" />
                Move to trash
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {page.coverUrl && (
        <div className="relative h-[30vh] max-h-64 w-full overflow-hidden">
          <img src={page.coverUrl} alt="" className="h-full w-full object-cover" />
          <div className="absolute right-4 top-4 flex gap-1 opacity-0 transition-opacity hover:opacity-100">
            <button
              className="rounded bg-black/60 px-2 py-1 text-xs text-white hover:bg-black/80"
              onClick={() => setShowCoverPicker(true)}
            >
              Change cover
            </button>
            <button
              className="rounded bg-black/60 px-2 py-1 text-xs text-white hover:bg-black/80"
              onClick={() => update.mutate({ coverUrl: null })}
            >
              Remove
            </button>
          </div>
        </div>
      )}

      <div className={cn("flex-1 overflow-y-auto", focusMode && "px-8")}>
        <motion.div
          key={pageId}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className={cn("mx-auto w-full py-10", focusMode ? "max-w-3xl" : "max-w-[720px] px-2")}
        >
          <div className="mb-2 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100" data-page-actions>
            {!page.icon && (
              <EmojiPickerPopover
                onPick={(icon) => update.mutate({ icon })}
                trigger={
                  <button className="flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent">
                    <Smile className="h-3.5 w-3.5" /> Add icon
                  </button>
                }
              />
            )}
            {!page.coverUrl && (
              <button
                className="flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
                onClick={() => setShowCoverPicker(true)}
              >
                <ImageIcon className="h-3.5 w-3.5" /> Add cover
              </button>
            )}
          </div>

          <div className="flex items-start gap-3">
            {page.icon && (
              <EmojiPickerPopover
                onPick={(icon) => update.mutate({ icon })}
                trigger={
                  <button className="text-5xl leading-none hover:bg-accent rounded">{page.icon}</button>
                }
              />
            )}
          </div>

          <input
            value={title}
            onChange={(e) => {
              let v = e.target.value;
              if (title === "" && v.length > 0) {
                const first = v[0];
                if (first !== first.toUpperCase()) {
                  v = first.toUpperCase() + v.slice(1);
                }
              }
              setTitle(v);
            }}
            onBlur={() => {
              if (title !== page.title) update.mutate({ title });
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (title !== page.title) update.mutate({ title });
                editorRef.current?.insertBlockAtStart();
                return;
              }
              if (e.key === "ArrowDown") {
                e.preventDefault();
                if (title !== page.title) update.mutate({ title });
                editorRef.current?.focusFirstBlock();
              }
            }}
            placeholder="Untitled"
            className="mt-4 w-full bg-transparent text-4xl font-bold tracking-tight outline-none placeholder:text-muted-foreground/40"
            disabled={!editable}
          />

          <div className="mt-4">
            <EditorBoundary onReset={() => setEditorNonce((n) => n + 1)}>
              <Editor
                key={`${pageId}-${editorNonce}`}
                ref={editorRef}
                page={page}
                workspaceId={workspaceId}
                editable={editable}
                theme={theme}
                onUploadFile={uploadFile}
                onSelectPage={onSelectPage}
              />
            </EditorBoundary>
          </div>

          {(page.type === "FOLDER" || childPages.length > 0) && (
            <div className="mt-10 border-t border-border pt-6">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Pages inside
                </h3>
                {editable && (
                  <div className="flex gap-1">
                    <button
                      className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs hover:bg-accent"
                      onClick={async () => {
                        const p = await create.mutateAsync({ parentPageId: pageId, title: "", type: "PAGE" });
                        onSelectPage(p.id);
                      }}
                    >
                      <FilePlus className="h-3.5 w-3.5" /> Page
                    </button>
                    <button
                      className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs hover:bg-accent"
                      onClick={async () => {
                        const p = await create.mutateAsync({ parentPageId: pageId, title: "", type: "FOLDER" });
                        onSelectPage(p.id);
                      }}
                    >
                      <FolderPlus className="h-3.5 w-3.5" /> Folder
                    </button>
                  </div>
                )}
              </div>
              {childPages.length === 0 ? (
                <div className="rounded-md border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
                  No pages here yet.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {childPages.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => onSelectPage(c.id)}
                      className="group flex items-start gap-3 rounded-md border border-border p-3 text-left hover:bg-accent"
                    >
                      <div className="mt-0.5 text-xl leading-none">
                        {c.icon
                          ? c.icon
                          : c.type === "FOLDER"
                            ? <FolderOpen className="h-5 w-5 text-muted-foreground" />
                            : <FileText className="h-5 w-5 text-muted-foreground" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">
                          {c.title || (c.type === "FOLDER" ? "Untitled folder" : "Untitled")}
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {new Date(c.updatedAt).toLocaleDateString()}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </motion.div>
      </div>

      <CoverPicker
        open={showCoverPicker}
        onClose={() => setShowCoverPicker(false)}
        onPick={(coverUrl) => {
          update.mutate({ coverUrl });
          setShowCoverPicker(false);
        }}
        uploadFile={uploadFile}
      />
    </div>
  );
}
