/**
 * WakaTime CLI binary management — locate and execute wakatime-cli.
 */

function getCliPath(): string {
  const homeDir = Services.dirsvc.get("Home", Ci.nsIFile).path;

  let platform: string;
  if (Zotero.isWin) {
    platform = "windows";
  } else if (Zotero.isMac) {
    platform = "darwin";
  } else {
    platform = "linux";
  }

  // Detect architecture from Zotero's runtime info
  const abi = Services.appinfo.XPCOMABI || "";
  let arch: string;
  if (abi.startsWith("aarch64") || abi.startsWith("arm64")) {
    arch = "arm64";
  } else if (abi.startsWith("x86_64") || abi.startsWith("x86-64")) {
    arch = "amd64";
  } else if (abi.startsWith("arm")) {
    arch = "arm";
  } else {
    // Default to amd64 for unknown or 32-bit x86
    arch = "amd64";
  }

  const binaryName = Zotero.isWin
    ? `wakatime-cli-${platform}-${arch}.exe`
    : `wakatime-cli-${platform}-${arch}`;

  return PathUtils.join(homeDir, ".wakatime", binaryName);
}

async function cliExists(): Promise<boolean> {
  try {
    return await IOUtils.exists(getCliPath());
  } catch {
    return false;
  }
}

function runCli(args: string[]): Promise<{ exitCode: number }> {
  return new Promise((resolve, reject) => {
    try {
      const cliPath = getCliPath();
      Zotero.debug(`[zotero-wakatime] runCli: path=${cliPath} args=${JSON.stringify(args)}`);
      const file = Cc["@mozilla.org/file/local;1"].createInstance(
        Ci.nsIFile,
      );
      file.initWithPath(cliPath);

      if (!file.exists()) {
        Zotero.debug(`[zotero-wakatime] runCli: CLI not found at ${cliPath}`);
        reject(new Error(`wakatime-cli not found at ${cliPath}`));
        return;
      }

      const process = Cc["@mozilla.org/process/util;1"].createInstance(
        Ci.nsIProcess,
      );
      process.init(file);

      const observer = {
        observe(_subject: any, topic: string, _data: string) {
          Zotero.debug(`[zotero-wakatime] runCli: observer topic=${topic} exitValue=${process.exitValue}`);
          if (topic === "process-finished") {
            resolve({ exitCode: process.exitValue });
          } else if (topic === "process-failed") {
            reject(new Error("wakatime-cli process failed"));
          }
        },
      };

      process.runAsync(args, args.length, observer);
      Zotero.debug("[zotero-wakatime] runCli: runAsync called");
    } catch (e) {
      Zotero.debug(`[zotero-wakatime] runCli: EXCEPTION ${e}`);
      reject(e);
    }
  });
}

async function getCliVersion(): Promise<string> {
  const cliPath = getCliPath();
  const file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
  file.initWithPath(cliPath);

  if (!file.exists()) {
    throw new Error(`wakatime-cli not found at ${cliPath}`);
  }

  const process = Cc["@mozilla.org/process/util;1"].createInstance(
    Ci.nsIProcess,
  );
  process.init(file);

  // Run synchronously to capture version output
  process.run(true, ["--version"], 1);

  // wakatime-cli --version returns exit code 0 on success
  // The actual version string is printed to stdout, but nsIProcess
  // doesn't capture stdout. Return a confirmation instead.
  if (process.exitValue === 0) {
    return "installed";
  }
  throw new Error(`wakatime-cli exited with code ${process.exitValue}`);
}

export { getCliPath, cliExists, runCli, getCliVersion };
