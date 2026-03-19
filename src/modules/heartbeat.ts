/**
 * WakaTime heartbeat logic — rate limiting and CLI argument construction.
 */

import { getPref } from "../utils/prefs";
import { runCli } from "./wakatime-cli";

const PLUGIN_VERSION = "0.1.0";

export interface HeartbeatData {
  entity: string;
  entityType: "app";
  category: string;
  project: string;
  isWrite: boolean;
  language?: string;
}

let lastHeartbeatTime = 0;
let lastHeartbeatEntity = "";
const HEARTBEAT_INTERVAL_MS = 2 * 1000; // 2 seconds

function shouldSendHeartbeat(entity: string, isWrite: boolean): boolean {
  const now = Date.now();
  const elapsed = now - lastHeartbeatTime;

  if (isWrite) return true;
  if (entity !== lastHeartbeatEntity) return true;
  if (elapsed >= HEARTBEAT_INTERVAL_MS) return true;

  return false;
}

function buildCliArgs(data: HeartbeatData): string[] {
  const args: string[] = [];

  args.push("--entity", data.entity);
  args.push("--entity-type", data.entityType);
  args.push("--category", data.category);

  const zoteroVersion = Zotero.version;
  args.push(
    "--plugin",
    `zotero/${zoteroVersion} zotero-wakatime/${PLUGIN_VERSION}`,
  );

  if (data.project) {
    args.push("--project", data.project);
  }

  if (data.isWrite) {
    args.push("--write");
  }

  if (data.language) {
    args.push("--language", data.language);
  }

  const debug = getPref("debug");
  if (debug) {
    args.push("--verbose");
    const homeDir = Services.dirsvc.get("Home", Ci.nsIFile).path;
    const logFile = PathUtils.join(homeDir, ".wakatime", "zotero-wakatime.log");
    args.push("--log-file", logFile);
  }

  return args;
}

async function sendHeartbeat(data: HeartbeatData): Promise<void> {
  Zotero.debug(
    `[zotero-wakatime] sendHeartbeat: entity="${data.entity}" isWrite=${data.isWrite}`,
  );
  if (!shouldSendHeartbeat(data.entity, data.isWrite)) {
    Zotero.debug("[zotero-wakatime] sendHeartbeat: rate limited, skipping");
    return;
  }

  const args = buildCliArgs(data);
  Zotero.debug(
    `[zotero-wakatime] sendHeartbeat: CLI args = ${JSON.stringify(args)}`,
  );

  // Update state immediately to prevent concurrent calls from passing the rate limit check
  lastHeartbeatTime = Date.now();
  lastHeartbeatEntity = data.entity;

  try {
    const result = await runCli(args);
    Zotero.debug(
      `[zotero-wakatime] sendHeartbeat: SUCCESS exit=${result.exitCode}`,
    );
    ztoolkit.log(`Heartbeat sent: ${data.entity} (exit: ${result.exitCode})`);
  } catch (e) {
    Zotero.debug(`[zotero-wakatime] sendHeartbeat: FAILED ${e}`);
    ztoolkit.log(`Heartbeat failed: ${e}`);
  }
}

function resetState(): void {
  lastHeartbeatTime = 0;
  lastHeartbeatEntity = "";
}

export { sendHeartbeat, resetState, shouldSendHeartbeat, buildCliArgs };
