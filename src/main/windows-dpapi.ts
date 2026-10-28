import { execFile } from "node:child_process";
import { join } from "node:path";
import { promisify } from "node:util";

const execute = promisify(execFile);
const script = [
  "$ErrorActionPreference = 'Stop'",
  "Add-Type -AssemblyName System.Security",
  "$inputBytes = [Convert]::FromBase64String($env:GOM_DPAPI_INPUT)",
  "try {",
  "  $outputBytes = [System.Security.Cryptography.ProtectedData]::Unprotect($inputBytes, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)",
  "  [Console]::Out.Write([Convert]::ToBase64String($outputBytes))",
  "  [Array]::Clear($outputBytes, 0, $outputBytes.Length)",
  "} finally { [Array]::Clear($inputBytes, 0, $inputBytes.Length) }",
].join("; ");
const encodedScript = Buffer.from(script, "utf16le").toString("base64");

/** Unprotects a legacy Chrome DPAPI blob for the currently signed-in Windows user. */
export async function unprotectWindowsDpapi(data: Buffer): Promise<Buffer> {
  if (
    process.platform !== "win32" ||
    data.length < 1 ||
    data.length > 64 * 1024
  )
    throw new Error("dpapi-unavailable");
  const systemRoot = process.env.SystemRoot || "C:\\Windows";
  const powershell = join(
    systemRoot,
    "System32",
    "WindowsPowerShell",
    "v1.0",
    "powershell.exe",
  );
  const input = data.toString("base64");
  try {
    const { stdout } = await execute(
      powershell,
      [
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-EncodedCommand",
        encodedScript,
      ],
      {
        encoding: "utf8",
        timeout: 8000,
        maxBuffer: 16 * 1024,
        windowsHide: true,
        env: { ...process.env, GOM_DPAPI_INPUT: input },
      },
    );
    const encoded = stdout.trim();
    if (
      !encoded ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
        encoded,
      )
    )
      throw new Error("dpapi-failed");
    const output = Buffer.from(encoded, "base64");
    if (!output.length || output.toString("base64") !== encoded) {
      output.fill(0);
      throw new Error("dpapi-failed");
    }
    return output;
  } catch {
    throw new Error("dpapi-failed");
  }
}
