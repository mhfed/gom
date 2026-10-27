/** Serializable state shared by the main process and the trusted app shell. */
export type UpdateState = {
  phase:
    | "idle"
    | "checking"
    | "available"
    | "downloading"
    | "downloaded"
    | "installing"
    | "current"
    | "ahead"
    | "unavailable"
    | "error";
  currentVersion: string;
  automaticInstallAvailable?: boolean;
  latestVersion: string | null;
  releaseUrl: string | null;
  releaseNotes: string;
  downloadProgress: number | null;
  checkedAt: number | null;
  message: string;
};
