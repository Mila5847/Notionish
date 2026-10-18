import { useEffect, useState } from "react";
import { PanelLeftOpen, Users } from "lucide-react";
import { Sidebar } from "@/features/sidebar/Sidebar";
import { PageView } from "@/features/page/PageView";
import { CommandPalette } from "@/features/command-palette/CommandPalette";
import { useWorkspaces } from "@/features/workspace/hooks";
import { useCreatePage, usePages } from "@/features/page/hooks";
import { TrashDialog } from "@/features/page/TrashDialog";
import { MembersDialog } from "@/features/members/MembersDialog";
import { motion } from "framer-motion";

export function AppShell() {
  const { data: workspaces = [] } = useWorkspaces();
  const [workspaceId, setWorkspaceId] = useState<string | null>(() => {
    try { return localStorage.getItem("lastWorkspaceId"); } catch { return null; }
  });
  const [pageId, setPageId] = useState<string | null>(() => {
    try { return localStorage.getItem("lastPageId"); } catch { return null; }
  });
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [focusMode, setFocusMode] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const stored = localStorage.getItem("theme");
    if (stored === "dark" || stored === "light") return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    if (!workspaces.length) return;
    if (!workspaceId || !workspaces.some((w) => w.id === workspaceId)) {
      setWorkspaceId(workspaces[0].id);
    }
  }, [workspaces, workspaceId]);

  useEffect(() => {
    if (workspaceId) {
      try { localStorage.setItem("lastWorkspaceId", workspaceId); } catch {}
    }
  }, [workspaceId]);

  const { data: pages = [] } = usePages(workspaceId);
  const create = useCreatePage(workspaceId ?? "");

  useEffect(() => {
    if (!pages.length) return;
    if (!pageId || !pages.some((p) => p.id === pageId)) {
      const first = pages.find((p) => !p.parentPageId) ?? pages[0];
      setPageId(first.id);
    }
  }, [pages, pageId]);

  useEffect(() => {
    if (pageId) {
      try { localStorage.setItem("lastPageId", pageId); } catch {}
    }
  }, [pageId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "\\") {
        e.preventDefault();
        setSidebarOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const currentWs = workspaces.find((w) => w.id === workspaceId);
  const editable = currentWs ? currentWs.role !== "VIEWER" : false;

  const createPage = async () => {
    if (!workspaceId) return;
    const p = await create.mutateAsync({ title: "" });
    setPageId(p.id);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      {sidebarOpen && !focusMode && (
        <motion.div
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.15 }}
          className="h-full"
        >
          <Sidebar
            workspaceId={workspaceId}
            activePageId={pageId}
            onSelectWorkspace={(id) => { setWorkspaceId(id); setPageId(null); }}
            onSelectPage={setPageId}
            onOpenSearch={() => setPaletteOpen(true)}
            onOpenSettings={() => setMembersOpen(true)}
            onOpenTrash={() => setTrashOpen(true)}
            onCollapse={() => setSidebarOpen(false)}
          />
        </motion.div>
      )}
      <main className="flex flex-1 flex-col">
        {(!sidebarOpen || focusMode) && (
          <div className="absolute left-2 top-2 z-10 flex gap-1">
            <button
              className="flex h-8 w-8 items-center justify-center rounded-md bg-background text-muted-foreground shadow-sm hover:bg-accent"
              onClick={() => { setSidebarOpen(true); setFocusMode(false); }}
              title="Open sidebar"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>
          </div>
        )}
        {!focusMode && workspaceId && (
          <div className="pointer-events-none absolute right-2 top-2 z-10 flex gap-1">
            <button
              className="pointer-events-auto flex h-8 items-center gap-1.5 rounded-md bg-background px-2.5 text-xs text-muted-foreground shadow-sm hover:bg-accent"
              onClick={() => setMembersOpen(true)}
            >
              <Users className="h-3.5 w-3.5" /> Share
            </button>
          </div>
        )}

        {pageId && workspaceId ? (
          <PageView
            pageId={pageId}
            workspaceId={workspaceId}
            theme={theme}
            editable={editable}
            focusMode={focusMode}
            onSelectPage={setPageId}
            onToggleFocus={() => setFocusMode((v) => !v)}
          />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <div className="text-4xl">✨</div>
            <div>
              <h2 className="text-xl font-semibold">No page selected</h2>
              <p className="text-sm text-muted-foreground">Create a page from the sidebar to get started.</p>
            </div>
          </div>
        )}
      </main>

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        workspaceId={workspaceId}
        onSelectPage={setPageId}
        onSelectWorkspace={(id) => { setWorkspaceId(id); setPageId(null); }}
        onCreatePage={createPage}
        onToggleTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
      />

      {workspaceId && (
        <>
          <TrashDialog workspaceId={workspaceId} open={trashOpen} onClose={() => setTrashOpen(false)} />
          <MembersDialog workspaceId={workspaceId} open={membersOpen} onClose={() => setMembersOpen(false)} />
        </>
      )}
    </div>
  );
}
