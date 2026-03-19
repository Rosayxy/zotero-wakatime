/**
 * Most of this code is from Zotero team's official Make It Red example[1]
 * or the Zotero 7 documentation[2].
 * [1] https://github.com/zotero/make-it-red
 * [2] https://www.zotero.org/support/dev/zotero_7_for_developers
 */

var chromeHandle;

function log(msg) {
  // dump() is always available in bootstrap context; Zotero.debug() may not be
  dump("[ZoteroWakaTime] " + msg + "\n");
  if (typeof Zotero !== "undefined") {
    Zotero.debug("[ZoteroWakaTime] " + msg);
  }
}

function install(data, reason) {
  log("bootstrap.install() called");
}

async function startup({ id, version, resourceURI, rootURI }, reason) {
  log(
    "bootstrap.startup() called, id=" +
      id +
      ", version=" +
      version +
      ", rootURI=" +
      rootURI,
  );
  try {
    var aomStartup = Components.classes[
      "@mozilla.org/addons/addon-manager-startup;1"
    ].getService(Components.interfaces.amIAddonManagerStartup);
    var manifestURI = Services.io.newURI(rootURI + "manifest.json");
    chromeHandle = aomStartup.registerChrome(manifestURI, [
      ["content", "__addonRef__", rootURI + "content/"],
    ]);
    log("chrome registered OK");

    /**
     * Global variables for plugin code.
     * The `_globalThis` is the global root variable of the plugin sandbox environment
     * and all child variables assigned to it is globally accessible.
     * See `src/index.ts` for details.
     */
    const ctx = { rootURI };
    ctx._globalThis = ctx;

    var scriptURI = rootURI + "content/scripts/__addonRef__.js";
    log("loading script: " + scriptURI);
    Services.scriptloader.loadSubScript(scriptURI, ctx);
    log(
      "script loaded OK, Zotero.__addonInstance__ = " +
        typeof Zotero.__addonInstance__,
    );
    await Zotero.__addonInstance__.hooks.onStartup();
    log("onStartup() completed OK");
  } catch (e) {
    log("bootstrap.startup() FAILED: " + e);
  }
}

async function onMainWindowLoad({ window }, reason) {
  log("bootstrap.onMainWindowLoad() called");
  try {
    await Zotero.__addonInstance__?.hooks.onMainWindowLoad(window);
    log("onMainWindowLoad() completed OK");
  } catch (e) {
    log("onMainWindowLoad() FAILED: " + e);
  }
}

async function onMainWindowUnload({ window }, reason) {
  await Zotero.__addonInstance__?.hooks.onMainWindowUnload(window);
}

async function shutdown({ id, version, resourceURI, rootURI }, reason) {
  log("bootstrap.shutdown() called, reason=" + reason);
  if (reason === APP_SHUTDOWN) {
    return;
  }

  await Zotero.__addonInstance__?.hooks.onShutdown();

  if (chromeHandle) {
    chromeHandle.destruct();
    chromeHandle = null;
  }
}

async function uninstall(data, reason) {
  log("bootstrap.uninstall() called");
}
