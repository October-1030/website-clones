export type BookKind = "novel" | "script";
export type BookStatus = "active" | "archived" | "trashed";
export interface Chapter {
  id: string;
  title: string;
  content: string;
  summary: string;
  updatedAt: string;
  bookmarked?: boolean;
  illustrations?: string[];
}
export interface Book {
  id: string;
  title: string;
  description: string;
  kind: BookKind;
  status: BookStatus;
  content: string;
  updatedAt: string;
  folderId?: string;
  chapters?: Chapter[];
  cover?: string;
}
export interface Folder { id: string; name: string }
export type LayoutMode = "comfortable" | "compact" | "list";
