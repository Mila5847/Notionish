import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { PageFull, PageSummary } from "@/lib/types";

export function usePages(workspaceId: string | null) {
  return useQuery({
    queryKey: ["pages", workspaceId],
    queryFn: () => api.get<PageSummary[]>(`/workspaces/${workspaceId}/pages`),
    enabled: !!workspaceId,
  });
}

export function useTrash(workspaceId: string | null) {
  return useQuery({
    queryKey: ["trash", workspaceId],
    queryFn: () => api.get<Array<{ id: string; title: string; icon: string | null; archivedAt: string }>>(
      `/workspaces/${workspaceId}/trash`,
    ),
    enabled: !!workspaceId,
  });
}

export function useFavorites(workspaceId: string | null) {
  return useQuery({
    queryKey: ["favorites", workspaceId],
    queryFn: () => api.get<Array<{ id: string; title: string; icon: string | null; type: "PAGE" | "FOLDER"; parentPageId: string | null }>>(
      `/workspaces/${workspaceId}/favorites`,
    ),
    enabled: !!workspaceId,
  });
}

export function usePage(pageId: string | null) {
  return useQuery({
    queryKey: ["page", pageId],
    queryFn: () => api.get<PageFull>(`/pages/${pageId}`),
    enabled: !!pageId,
  });
}

export function useCreatePage(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { parentPageId?: string | null; title?: string; type?: "PAGE" | "FOLDER" }) =>
      api.post<PageSummary & { workspaceId: string }>("/pages", { workspaceId, ...input }),
    onSuccess: (created) => {
      qc.setQueryData<PageSummary[] | undefined>(["pages", workspaceId], (prev) => {
        if (!prev) return prev;
        const summary: PageSummary = {
          id: created.id,
          parentPageId: created.parentPageId,
          type: created.type,
          title: created.title,
          icon: created.icon,
          position: created.position,
          updatedAt: created.updatedAt,
        };
        return [...prev.filter((p) => p.id !== created.id), summary];
      });
      qc.invalidateQueries({ queryKey: ["pages", workspaceId] });
    },
  });
}

export function useUpdatePage(pageId: string, workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { title?: string; icon?: string | null; coverUrl?: string | null }) =>
      api.patch(`/pages/${pageId}`, data),
    onMutate: (data) => {
      qc.setQueryData<PageFull | undefined>(["page", pageId], (prev) =>
        prev ? { ...prev, ...data } as PageFull : prev,
      );
      qc.setQueryData<PageSummary[] | undefined>(["pages", workspaceId], (prev) =>
        prev
          ? prev.map((p) =>
              p.id === pageId
                ? { ...p, ...(data.title !== undefined ? { title: data.title } : {}), ...(data.icon !== undefined ? { icon: data.icon } : {}) }
                : p,
            )
          : prev,
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["favorites", workspaceId] });
    },
  });
}

export function useMovePage(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      id: string;
      parentPageId?: string | null;
      beforePageId?: string | null;
      afterPageId?: string | null;
    }) =>
      api.post(`/pages/${input.id}/move`, {
        parentPageId: input.parentPageId,
        beforePageId: input.beforePageId,
        afterPageId: input.afterPageId,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pages", workspaceId] }),
  });
}

export function useArchivePage(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/pages/${id}/archive`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pages", workspaceId] });
      qc.invalidateQueries({ queryKey: ["trash", workspaceId] });
      qc.invalidateQueries({ queryKey: ["favorites", workspaceId] });
    },
  });
}

export function useRestorePage(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/pages/${id}/restore`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pages", workspaceId] });
      qc.invalidateQueries({ queryKey: ["trash", workspaceId] });
    },
  });
}

export function useHardDeletePage(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/pages/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["trash", workspaceId] }),
  });
}

export function useDuplicatePage(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<{ id: string }>(`/pages/${id}/duplicate`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pages", workspaceId] }),
  });
}

export function useToggleFavorite(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; favorited: boolean }) =>
      input.favorited ? api.delete(`/pages/${input.id}/favorite`) : api.post(`/pages/${input.id}/favorite`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["favorites", workspaceId] }),
  });
}
