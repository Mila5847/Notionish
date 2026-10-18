import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Member, Role, Workspace } from "@/lib/types";

export function useWorkspaces() {
  return useQuery({
    queryKey: ["workspaces"],
    queryFn: () => api.get<Workspace[]>("/workspaces"),
  });
}

export function useCreateWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api.post<Workspace>("/workspaces", { name }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workspaces"] }),
  });
}

export function useUpdateWorkspace(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name?: string; iconUrl?: string | null }) =>
      api.patch<Workspace>(`/workspaces/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workspaces"] }),
  });
}

export function useDeleteWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/workspaces/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workspaces"] }),
  });
}

export function useMembers(workspaceId: string | null) {
  return useQuery({
    queryKey: ["members", workspaceId],
    queryFn: () => api.get<Member[]>(`/workspaces/${workspaceId}/members`),
    enabled: !!workspaceId,
  });
}

export function useInviteMember(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { email: string; role: Role }) =>
      api.post<Member>(`/workspaces/${workspaceId}/members`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["members", workspaceId] }),
  });
}

export function useUpdateMemberRole(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { userId: string; role: Role }) =>
      api.patch(`/workspaces/${workspaceId}/members/${input.userId}`, { role: input.role }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["members", workspaceId] }),
  });
}

export function useRemoveMember(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api.delete(`/workspaces/${workspaceId}/members/${userId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["members", workspaceId] }),
  });
}
