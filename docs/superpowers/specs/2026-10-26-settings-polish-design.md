# Gom settings and shell polish

The user requested continued UI improvement, including the Settings page's layout problems. This is an implementation direction selected within that request, not a separately approved redesign.

Keep the existing native messaging tabs and Gom identity. Use a quiet macOS settings layout: a persistent category rail, a readable content column, grouped preferences, real toggle styling, and account identities with visible connection states. The rail's mint Gom mark and teal selected category carry the brand. Native SF system typography serves headings (24px, semibold), body (13px), and utility labels (11–12px).

Palette: Gom teal #0B7A75, mint #9DE4CF, ivory #F7F7F2, white #FFFFFF, ink #172E2C, muted green #586E67. Dark colors remain derived from the existing theme. Follow platform appearance as currently configured.

Considered retaining horizontal tabs (smallest change, but weaker category separation) and a separate settings window (unnecessary native lifecycle complexity). Use an in-window category rail, with a compact layout for smaller viewports. Keep the 64px native-view boundary and provider pages intact.

Fix status disappearance at widths below 1100px, flex overflow for long labels, inconsistent control sizing, and retained scroll on section changes. Add keyboard tab navigation, visible focus, dialog labeling, and readable empty/disabled states. Preserve IDs, IPC APIs, account sessions, and preference semantics.

Verify light/dark across 940×640, 1024×720, and a large desktop. Use synthetic accounts and long labels. Check settings controls, theme persistence, account editor, native view preservation, build, typecheck, and existing tests. No external publishing or account changes.
