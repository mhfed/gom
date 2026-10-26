import { authScript } from "./auth-detection.ts";
import { themeScript } from "./theme.ts";
import { unreadScript } from "./unread-snapshot.ts";

function createSnapshotScript(sampleTheme: boolean): string {
  return `/* tin-nhan:page-snapshot */ (()=>{
    const status=${authScript};
    const unread=status==='authenticated'?${unreadScript}:null;
    let theme=null;
    ${sampleTheme ? `try { theme=${themeScript}; } catch {}` : ""}
    return {status,unread,theme};
  })()`;
}

// Build each variant once; polling reuses the same source string for every view.
const snapshotWithoutTheme = createSnapshotScript(false);
const snapshotWithTheme = createSnapshotScript(true);

/** One renderer evaluation; no message text or account identifiers are returned. */
export function pageSnapshotScript(sampleTheme: boolean): string {
  return sampleTheme ? snapshotWithTheme : snapshotWithoutTheme;
}
