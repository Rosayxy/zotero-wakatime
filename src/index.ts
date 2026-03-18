import { BasicTool } from "zotero-plugin-toolkit";
import Addon from "./addon";
import { config } from "../package.json";

const basicTool = new BasicTool();

basicTool
  .getGlobal("console")
  .log(
    "[ZoteroWakaTime] index.ts executing, addonInstance=" +
      config.addonInstance,
  );

// @ts-expect-error - Plugin instance is not typed
if (!basicTool.getGlobal("Zotero")[config.addonInstance]) {
  basicTool
    .getGlobal("console")
    .log("[ZoteroWakaTime] creating new Addon instance");
  _globalThis.addon = new Addon();
  defineGlobal("ztoolkit", () => {
    return _globalThis.addon.data.ztoolkit;
  });
  // @ts-expect-error - Plugin instance is not typed
  Zotero[config.addonInstance] = addon;
  basicTool
    .getGlobal("console")
    .log(
      "[ZoteroWakaTime] Addon registered on Zotero." + config.addonInstance,
    );
} else {
  basicTool
    .getGlobal("console")
    .log("[ZoteroWakaTime] Addon instance already exists, skipping");
}

function defineGlobal(name: Parameters<BasicTool["getGlobal"]>[0]): void;
function defineGlobal(name: string, getter: () => any): void;
function defineGlobal(name: string, getter?: () => any) {
  Object.defineProperty(_globalThis, name, {
    get() {
      return getter ? getter() : basicTool.getGlobal(name);
    },
  });
}
