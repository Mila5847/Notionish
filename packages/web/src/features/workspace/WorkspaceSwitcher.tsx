import { useState } from "react";
import { Check, ChevronsUpDown, LogOut, Plus, Settings, User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWorkspaces, useCreateWorkspace } from "./hooks";
import { useLogout, useMe } from "@/features/auth/hooks";
import { cn } from "@/lib/cn";

interface Props {
  currentId: string | null;
  onSelect: (id: string) => void;
  onOpenSettings?: () => void;
  onOpenAccount?: () => void;
}

export function WorkspaceSwitcher({ currentId, onSelect, onOpenSettings, onOpenAccount }: Props) {
  const { data: workspaces = [] } = useWorkspaces();
  const { data: me } = useMe();
  const logout = useLogout();
  const create = useCreateWorkspace();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");

  const current = workspaces.find((w) => w.id === currentId) ?? workspaces[0] ?? null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-primary text-[11px] font-medium text-primary-foreground">
              {current?.name.slice(0, 1).toUpperCase() ?? "?"}
            </div>
            <span className="flex-1 truncate text-left font-medium">{current?.name ?? "No workspace"}</span>
            <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel>{me?.email}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
          {workspaces.map((w) => (
            <DropdownMenuItem key={w.id} onClick={() => onSelect(w.id)}>
              <div className="flex h-5 w-5 items-center justify-center rounded bg-muted text-[10px] font-medium">
                {w.name.slice(0, 1).toUpperCase()}
              </div>
              <span className="flex-1 truncate">{w.name}</span>
              <Check className={cn("h-4 w-4", w.id === current?.id ? "opacity-100" : "opacity-0")} />
            </DropdownMenuItem>
          ))}
          <DropdownMenuItem onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" />
            <span>New workspace</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {onOpenSettings && (
            <DropdownMenuItem onClick={onOpenSettings}>
              <Settings className="h-4 w-4" />
              <span>Workspace settings</span>
            </DropdownMenuItem>
          )}
          {onOpenAccount && (
            <DropdownMenuItem onClick={onOpenAccount}>
              <User className="h-4 w-4" />
              <span>Account</span>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => logout.mutate()}>
            <LogOut className="h-4 w-4" />
            <span>Log out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create workspace</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="wsname">Name</Label>
            <Input id="wsname" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              onClick={async () => {
                if (!name.trim()) return;
                const w = await create.mutateAsync(name.trim());
                onSelect(w.id);
                setName("");
                setCreating(false);
              }}
              disabled={create.isPending}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
