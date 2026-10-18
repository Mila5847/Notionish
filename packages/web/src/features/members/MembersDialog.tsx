import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown";
import { useInviteMember, useMembers, useRemoveMember, useUpdateMemberRole } from "@/features/workspace/hooks";
import { useMe } from "@/features/auth/hooks";
import type { Role } from "@/lib/types";
import { ChevronDown } from "lucide-react";
import { ApiError } from "@/lib/api";

interface Props {
  workspaceId: string;
  open: boolean;
  onClose: () => void;
}

const ROLES: Role[] = ["OWNER", "EDITOR", "VIEWER"];

export function MembersDialog({ workspaceId, open, onClose }: Props) {
  const { data: members = [] } = useMembers(workspaceId);
  const { data: me } = useMe();
  const invite = useInviteMember(workspaceId);
  const setRole = useUpdateMemberRole(workspaceId);
  const remove = useRemoveMember(workspaceId);
  const [email, setEmail] = useState("");
  const [role, setRoleValue] = useState<Role>("EDITOR");
  const [error, setError] = useState<string | null>(null);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Members</DialogTitle>
        </DialogHeader>

        <div className="flex gap-2">
          <Input
            placeholder="Home Assistant username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-1">
                {role} <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {ROLES.map((r) => (
                <DropdownMenuItem key={r} onClick={() => setRoleValue(r)}>
                  {r}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            onClick={async () => {
              setError(null);
              try {
                await invite.mutateAsync({ email, role });
                setEmail("");
              } catch (e) {
                setError(e instanceof ApiError ? e.message : "Failed to invite");
              }
            }}
            disabled={!email || invite.isPending}
          >
            Invite
          </Button>
        </div>
        {error && <div className="text-sm text-destructive">{error}</div>}

        <div className="max-h-[400px] space-y-1 overflow-y-auto">
          {members.map((m) => (
            <div key={m.userId} className="flex items-center gap-2 rounded-md p-2 hover:bg-accent">
              <Avatar>
                {m.avatarUrl && <AvatarImage src={m.avatarUrl} />}
                <AvatarFallback>{m.name.slice(0, 1).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="truncate text-sm font-medium">
                  {m.name} {m.userId === me?.id && <span className="text-muted-foreground">(you)</span>}
                </div>
                <div className="truncate text-xs text-muted-foreground">{m.email}</div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-1 text-xs">
                    {m.role} <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {ROLES.map((r) => (
                    <DropdownMenuItem key={r} onClick={() => setRole.mutate({ userId: m.userId, role: r })}>
                      {r}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuItem destructive onClick={() => remove.mutate(m.userId)}>
                    Remove from workspace
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
