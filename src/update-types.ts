/** Serializable state shared by the main process and the trusted app shell. */
export type UpdateState = {
  phase:
    | "idle"
    | "checking"
    | "available"
    | "current"
    | "ahead"
    | "unavailable"
    | "error";
  currentVersion: string;
  latestVersion: string | null;
  releaseUrl: string | null;
  releaseNotes: string;
  checkedAt: number | null;
  message: string;
};
