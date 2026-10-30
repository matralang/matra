import { execFileSync } from "node:child_process"
import { join } from "node:path"

export const windows = process.platform === "win32"
export const runtimeBinary = windows ? "runtime/node.exe" : "runtime/bin/node"
export const launcherName = windows ? "matra.cmd" : "matra"

function powershell(script, variables) {
  const executable = join(process.env.SystemRoot, "System32/WindowsPowerShell/v1.0/powershell.exe")
  return execFileSync(
    executable,
    [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      `$ErrorActionPreference = 'Stop'; Add-Type -AssemblyName System.IO.Compression.FileSystem; ${script}`,
    ],
    {
      env: { ...process.env, ...variables },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  )
}

export function extractZip(archive, destination) {
  if (windows) {
    powershell(
      "[IO.Compression.ZipFile]::ExtractToDirectory($env:MATRA_ARCHIVE, $env:MATRA_DESTINATION)",
      { MATRA_ARCHIVE: archive, MATRA_DESTINATION: destination },
    )
  } else {
    execFileSync("unzip", ["-q", archive, "-d", destination])
  }
}

export function createZip(archive, folder, parent, name) {
  if (windows) {
    powershell(
      "[IO.Compression.ZipFile]::CreateFromDirectory($env:MATRA_FOLDER, $env:MATRA_ARCHIVE, [IO.Compression.CompressionLevel]::Optimal, $true)",
      { MATRA_FOLDER: folder, MATRA_ARCHIVE: archive },
    )
  } else {
    execFileSync("zip", ["-q", "-r", archive, name], { cwd: parent })
  }
}

export function runLauncher(home, args, options) {
  if (!windows) return execFileSync(join(home, launcherName), args, options)
  // PowerShellの引数展開を使い、cmd.exeのcommand文字列へパスを連結しない。
  const executable = join(process.env.SystemRoot, "System32/WindowsPowerShell/v1.0/powershell.exe")
  return execFileSync(
    executable,
    [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      '$ErrorActionPreference = "Stop"; $OutputEncoding = [Console]::OutputEncoding = [Text.UTF8Encoding]::new($false); $arguments = @(ConvertFrom-Json $env:MATRA_ARGUMENTS); & $env:MATRA_LAUNCHER @arguments; exit $LASTEXITCODE',
    ],
    {
      ...options,
      env: {
        ...options.env,
        MATRA_LAUNCHER: join(home, launcherName),
        MATRA_ARGUMENTS: JSON.stringify(args),
      },
    },
  )
}
