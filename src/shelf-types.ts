export const SHELF_LIMITS = {
  items: 100,
  totalBytes: 250 * 1024 * 1024,
  itemBytes: 50 * 1024 * 1024,
  textBytes: 64 * 1024,
  pickerFiles: 10,
  imagePixels: 16_000_000,
  previewBytes: 256 * 1024,
  previewEdge: 320,
} as const;

export type ShelfKind = "text" | "link" | "image" | "file";
export interface ShelfItem {
  id: string;
  kind: ShelfKind;
  createdAt: number;
  pinned: boolean;
  name: string;
  bytes: number;
  mime: string;
  text?: string;
}
export interface ShelfSnapshot {
  items: ShelfItem[];
  totalBytes: number;
  revision: number;
  unavailable: boolean;
  error: string;
}
export interface ShelfSummary {
  count: number;
  totalBytes: number;
  revision: number;
  unavailable: boolean;
  open: boolean;
}
export interface ShelfRequest {
  action:
    | "surface"
    | "list"
    | "add-text"
    | "clipboard"
    | "pick-files"
    | "pin"
    | "remove"
    | "clear"
    | "copy"
    | "export"
    | "preview";
  lockVersion: number;
  id?: string;
  text?: string;
  pinned?: boolean;
  open?: boolean;
}
export interface ShelfResult {
  ok: boolean;
  message?: string;
  snapshot?: ShelfSnapshot;
  dataUrl?: string;
}
