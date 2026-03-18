import { config } from "../../package.json";
import { getApiKey, setApiKey } from "./config-file";
import { cliExists, getCliVersion } from "./wakatime-cli";

export async function registerPrefsScripts(_window: Window) {
  if (!addon.data.prefs) {
    addon.data.prefs = { window: _window };
  } else {
    addon.data.prefs.window = _window;
  }
  await updatePrefsUI();
  bindPrefEvents();
}

async function updatePrefsUI() {
  const win = addon.data.prefs?.window;
  if (!win) return;

  // Load API key from config file into the preference input
  const apiKey = await getApiKey();
  const apiKeyInput = win.document.querySelector(
    `#zotero-prefpane-${config.addonRef}-apikey`,
  ) as HTMLInputElement;
  if (apiKeyInput && apiKey) {
    apiKeyInput.value = apiKey;
  }

  // Show CLI status
  const statusLabel = win.document.querySelector(
    `#zotero-prefpane-${config.addonRef}-status`,
  ) as HTMLElement;
  if (statusLabel) {
    const hasCli = await cliExists();
    if (hasCli) {
      try {
        const version = await getCliVersion();
        statusLabel.textContent = `wakatime-cli: ${version}`;
      } catch {
        statusLabel.textContent = "wakatime-cli: found (version unknown)";
      }
    } else {
      statusLabel.textContent =
        "wakatime-cli: NOT FOUND — install from https://wakatime.com/";
    }
  }
}

function bindPrefEvents() {
  const win = addon.data.prefs?.window;
  if (!win) return;

  // When API key changes, write to ~/.wakatime.cfg
  win.document
    .querySelector(`#zotero-prefpane-${config.addonRef}-apikey`)
    ?.addEventListener("change", async (e: Event) => {
      const value = (e.target as HTMLInputElement).value;
      if (value) {
        await setApiKey(value.trim());
      }
    });
}
