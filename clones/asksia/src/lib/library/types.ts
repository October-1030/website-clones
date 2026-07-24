export type LibraryItemKind = "study" | "homework" | "video" | "transcribe";

export interface LibraryItem {
  id: string;
  kind: LibraryItemKind;
  title: string;
  subtitle: string;
  providerLabel: string;
  updatedAt: string;
  href: string;
}
