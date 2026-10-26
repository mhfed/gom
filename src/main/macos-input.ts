interface CommandLine {
  getSwitchValue(name: string): string;
  appendSwitch(name: string, value: string): void;
}

export function configureMacOSInput(
  commandLine: CommandLine,
  platform: string,
  versions: { electron?: string; chrome?: string },
): boolean {
  if (
    platform !== "darwin" ||
    versions.electron !== "45.0.0" ||
    versions.chrome !== "156.0.8078.48"
  )
    return false;

  // Chromium's non-key-window focus change skips SetTextInputActive(false)
  // during SetActive(false), leaving macOS Secure Input owned by a hidden app.
  // Restore the prior focus semantics, not password/security protection.
  // Verified with Carbon IsSecureEventInputEnabled in scripts/ime-check.mjs.
  // Recheck/remove this version-scoped workaround when updating Electron:
  // https://github.com/chromium/chromium/blob/156.0.8078.48/content/browser/renderer_host/render_widget_host_view_mac.mm
  const feature = "RWHVMacHasFocusReturnsFalseForNonKeyWindow";
  const disabled = commandLine.getSwitchValue("disable-features");
  if (disabled.split(",").some((value) => value.trim() === feature))
    return false;
  commandLine.appendSwitch(
    "disable-features",
    disabled ? `${disabled},${feature}` : feature,
  );
  return true;
}
