export type Role = "OWNER" | "EDITOR" | "VIEWER";

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

export interface Workspace {
  id: string;
  name: string;
  iconUrl: string | null;
  role: Role;
}

export interface Member {
  userId: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  role: Role;
}

export type PageType = "PAGE" | "FOLDER";

export interface PageSummary {
  id: string;
  parentPageId: string | null;
  type: PageType;
  title: string;
  icon: string | null;
  position: string;
  updatedAt: string;
}

export interface PageFull {
  id: string;
  workspaceId: string;
  parentPageId: string | null;
  type: PageType;
  title: string;
  icon: string | null;
  coverUrl: string | null;
  updatedAt: string;
  blocks: Array<{
    id: string;
    pageId: string;
    parentBlockId: string | null;
    type: string;
    content: unknown;
    textContent: string;
    position: string;
  }>;
}

export interface SearchResult {
  pages: Array<{
    id: string;
    title: string;
    icon: string | null;
    parentPageId: string | null;
    updatedAt: string;
  }>;
  blocks: Array<{
    id: string;
    pageId: string;
    textContent: string;
    page: { title: string; icon: string | null };
  }>;
}
