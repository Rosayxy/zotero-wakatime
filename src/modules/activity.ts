/**
 * Activity tracking — listens to Zotero events and triggers WakaTime heartbeats.
 */

import { getPref } from "../utils/prefs";
import { sendHeartbeat } from "./heartbeat";

let notifierID: string | null = null;
let selectDebounceTimer: ReturnType<typeof setTimeout> | null = null;

function registerActivityListener(): void {
  const callback = {
    notify: async (
      event: string,
      type: string,
      ids: (string | number)[],
      extraData: Record<string, any>,
    ) => {
      Zotero.debug(
        `[zotero-wakatime] Notifier.notify RECEIVED: event=${event} type=${type} ids=${JSON.stringify(ids)}`,
      );
      if (!addon?.data.alive) {
        Zotero.debug(
          "[zotero-wakatime] Notifier.notify: addon not alive, unregistering",
        );
        unregisterActivityListener();
        return;
      }
      await handleNotify(event, type, ids, extraData);
    },
  };

  notifierID = Zotero.Notifier.registerObserver(callback, [
    "tab",
    "item",
    "file",
  ]);
  Zotero.debug(
    `[zotero-wakatime] registerActivityListener: notifierID=${notifierID}`,
  );
}

function unregisterActivityListener(): void {
  if (notifierID) {
    Zotero.Notifier.unregisterObserver(notifierID);
    notifierID = null;
  }
}

async function handleNotify(
  event: string,
  type: string,
  ids: (string | number)[],
  extraData: Record<string, any>,
): Promise<void> {
  Zotero.debug(
    `[zotero-wakatime] handleNotify: event=${event} type=${type} ids=${JSON.stringify(ids)}`,
  );
  const enabled = getPref("enable");
  if (!enabled) {
    Zotero.debug("[zotero-wakatime] handleNotify: plugin disabled, skipping");
    return;
  }

  try {
    if (type === "tab" && event === "add") {
      await handleTabOpen(ids, extraData);
    } else if (type === "tab" && event === "select") {
      await handleTabSelect(ids, extraData);
    } else if (type === "item" && event === "select") {
      handleItemSelectDebounced(ids);
    } else if (type === "item" && event === "modify") {
      await handleItemModify(ids);
    } else if (type === "item" && event === "add") {
      await handleItemModify(ids);
    } else {
      Zotero.debug(
        `[zotero-wakatime] handleNotify: unhandled event/type combination`,
      );
    }
  } catch (e) {
    Zotero.debug(`[zotero-wakatime] handleNotify ERROR: ${e}`);
    ztoolkit.log(`Activity handler error: ${e}`);
  }
}

async function handleTabOpen(
  ids: (string | number)[],
  extraData: Record<string, any>,
): Promise<void> {
  const tabId = ids[0];
  const tabData = extraData[tabId];

  if (tabData?.type !== "reader") return;

  const item = Zotero.Items.get(tabData.itemID as number);
  if (!item) return;

  const parentItem = item.parentItem || item;
  const title = parentItem.getField("title") as string;
  const collection = getItemCollectionName(parentItem);

  const category = getPref("category") || "researching";

  await sendHeartbeat({
    entity: title || `item-${parentItem.id}`,
    entityType: "app",
    category,
    project: collection,
    isWrite: false,
  });
}

async function handleTabSelect(
  ids: (string | number)[],
  extraData: Record<string, any>,
): Promise<void> {
  const tabId = ids[0];
  const tabData = extraData[tabId];

  if (tabData?.type === "reader") {
    const item = Zotero.Items.get(tabData.itemID as number);
    if (!item) return;

    const parentItem = item.parentItem || item;
    const title = parentItem.getField("title") as string;
    const collection = getItemCollectionName(parentItem);
    const category = getPref("category") || "researching";

    await sendHeartbeat({
      entity: title || `item-${parentItem.id}`,
      entityType: "app",
      category,
      project: collection,
      isWrite: false,
    });
  }
}

function handleItemSelectDebounced(ids: (string | number)[]): void {
  if (selectDebounceTimer) {
    clearTimeout(selectDebounceTimer);
  }
  selectDebounceTimer = setTimeout(async () => {
    selectDebounceTimer = null;
    await handleItemSelect(ids);
  }, 500);
}

async function handleItemSelect(ids: (string | number)[]): Promise<void> {
  if (ids.length === 0) return;

  const item = Zotero.Items.get(ids[0] as number);
  if (!item || !item.isRegularItem()) return;

  const title = item.getField("title") as string;
  const collection = getItemCollectionName(item);
  const category = getPref("category") || "researching";

  await sendHeartbeat({
    entity: title || `item-${item.id}`,
    entityType: "app",
    category,
    project: collection,
    isWrite: false,
  });
}

async function handleItemModify(ids: (string | number)[]): Promise<void> {
  Zotero.debug(
    `[zotero-wakatime] handleItemModify: ids=${JSON.stringify(ids)}`,
  );
  for (const id of ids) {
    let item = Zotero.Items.get(id as number);
    if (!item) {
      Zotero.debug(
        `[zotero-wakatime] handleItemModify: item ${id} not found, skipping`,
      );
      continue;
    }

    Zotero.debug(
      `[zotero-wakatime] handleItemModify: item ${id} type=${item.itemType} isAnnotation=${(item as any).isAnnotation?.()}`,
    );

    // Annotations (highlights, notes) are child items — walk up to the parent paper.
    if ((item as any).isAnnotation?.()) {
      const attachment = item.parentItem;
      if (!attachment) {
        Zotero.debug(
          `[zotero-wakatime] handleItemModify: annotation ${id} has no parentItem, skipping`,
        );
        continue;
      }
      item = attachment.parentItem || attachment;
      Zotero.debug(
        `[zotero-wakatime] handleItemModify: walked up to item ${item.id} type=${item.itemType}`,
      );
    }

    if (!item.isRegularItem()) {
      Zotero.debug(
        `[zotero-wakatime] handleItemModify: item ${item.id} is not regular item, skipping`,
      );
      continue;
    }

    const title = item.getField("title") as string;
    const collection = getItemCollectionName(item);
    const category = getPref("category") || "researching";

    Zotero.debug(
      `[zotero-wakatime] handleItemModify: sending heartbeat entity="${title}" project="${collection}" category="${category}"`,
    );

    await sendHeartbeat({
      entity: title || `item-${item.id}`,
      entityType: "app",
      category,
      project: collection,
      isWrite: true,
    });
    break; // Only one heartbeat even if multiple items modified
  }
}

function getItemCollectionName(item: Zotero.Item): string {
  const collectionIDs = item.getCollections();
  if (collectionIDs.length > 0) {
    const collection = Zotero.Collections.get(collectionIDs[0]);
    if (collection) {
      return collection.name;
    }
  }
  const library = Zotero.Libraries.get(item.libraryID);
  if (library) {
    return library.name;
  }
  return "My Library";
}

export {
  registerActivityListener,
  unregisterActivityListener,
  handleNotify,
  getItemCollectionName,
};
