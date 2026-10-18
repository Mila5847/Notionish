import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useHardDeletePage, useRestorePage, useTrash } from "./hooks";
import { FileText, Undo2, X } from "lucide-react";

interface Props {
  workspaceId: string;
  open: boolean;
  onClose: () => void;
}

export function TrashDialog({ workspaceId, open, onClose }: Props) {
  const { data: trash = [] } = useTrash(workspaceId);
  const restore = useRestorePage(workspaceId);
  const hardDelete = useHardDeletePage(workspaceId);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Trash</DialogTitle>
        </DialogHeader>
        {trash.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing here.</p>
        ) : (
          <div className="max-h-[400px] space-y-1 overflow-y-auto">
            {trash.map((p) => (
              <div key={p.id} className="flex items-center gap-2 rounded-md p-2 hover:bg-accent">
                <span className="text-lg">{p.icon ?? <FileText className="h-4 w-4 text-muted-foreground" />}</span>
                <span className="flex-1 truncate text-sm">{p.title || "Untitled"}</span>
                <Button variant="ghost" size="icon" onClick={() => restore.mutate(p.id)} title="Restore">
                  <Undo2 className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => hardDelete.mutate(p.id)} title="Delete forever">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
