import {
  applyCustomRowHeights,
  cleanupCustomRowHeights,
  clearHeightCache,
  setupCustomRowHeights,
} from "./modules/custom-row-heights";
import {
  registerDynamicStyleSheet,
  unregisterDynamicStyleSheet,
  updateDynamicStyleSheet,
} from "./modules/dynamic-style";
import { registerPreferencePanel } from "./modules/preference";
import {
  registerStyleSheet,
  unregisterStyleSheet,
} from "./modules/style-sheet";
import { initLocale } from "./utils/locale";
import { getPref, setPref } from "./utils/prefs";
import { createZToolkit } from "./utils/ztoolkit";

let prefObserverId: symbol | undefined;

async function onStartup() {
  await Promise.all([
    Zotero.initializationPromise,
    Zotero.unlockPromise,
    Zotero.uiReadyPromise,
  ]);

  initLocale();

  // Register preference panel so users can control the feature.
  try {
    registerPreferencePanel();
  } catch (err) {
    ztoolkit.log("Failed to register preference panel:", err);
  }

  // Set up preference defaults
  if (
    typeof getPref("wrapTitles") === "undefined" ||
    getPref("wrapTitles") === null
  ) {
    setPref("wrapTitles", true as any);
  }
  if (
    typeof getPref("maxLines") === "undefined" ||
    getPref("maxLines") === null
  ) {
    setPref("maxLines", 5 as any);
  }

  // Register preference observer to update styles when preferences change
  prefObserverId = Zotero.Prefs.registerObserver(
    addon.data.config.prefsPrefix,
    (prefName: string) => {
      ztoolkit.log(`Preference changed: ${prefName}`);
      const enabled = getPref("wrapTitles") as boolean;

      if (prefName === "wrapTitles") {
        // Toggle stylesheets for all windows
        const windows = Zotero.getMainWindows();
        for (const win of windows) {
          if (enabled) {
            registerStyleSheet(win);
            registerDynamicStyleSheet(win);
            setupCustomRowHeights(win);
          } else {
            cleanupCustomRowHeights(win);
            unregisterStyleSheet(win);
            unregisterDynamicStyleSheet(win);
          }
        }
      } else if (prefName === "maxLines" && enabled) {
        // Update dynamic stylesheet with new max lines value
        updateDynamicStyleSheet();

        // 清除缓存,因为maxLines改变会影响行高
        clearHeightCache();

        // Refresh all trees after style update
        const windows = Zotero.getMainWindows();
        for (const win of windows) {
          setTimeout(() => applyCustomRowHeights(win), 200);
        }
      }
    },
  );

  // Read preference to decide whether to inject stylesheet.
  const enabled = getPref("wrapTitles") as boolean;

  await Promise.all(
    Zotero.getMainWindows().map((win) => onMainWindowLoad(win, enabled)),
  );
}

async function onMainWindowLoad(win: Window, enabled?: boolean): Promise<void> {
  // Create ztoolkit for every window
  addon.data.ztoolkit = createZToolkit();

  // Register stylesheet only when enabled by pref.
  // For compatibility, allow callers to pass `enabled` flag.
  const shouldEnable =
    typeof enabled === "boolean" ? enabled : (getPref("wrapTitles") as boolean);

  if (shouldEnable) {
    registerStyleSheet(win);
    registerDynamicStyleSheet(win);

    // Set up custom row heights system
    setupCustomRowHeights(win);
  }
}

function onMainWindowUnload(win: Window): void {
  ztoolkit.unregisterAll();
  cleanupCustomRowHeights(win);
  unregisterStyleSheet(win);
  unregisterDynamicStyleSheet(win);
}

async function onShutdown() {
  // Unregister preference observer
  if (prefObserverId) {
    Zotero.Prefs.unregisterObserver(prefObserverId);
    prefObserverId = undefined;
  }

  await Promise.all(
    Zotero.getMainWindows().map((win) => onMainWindowUnload(win)),
  );
  ztoolkit.unregisterAll();
  // Remove addon object
  addon.data.alive = false;
  // @ts-expect-error - Plugin instance is not typed
  delete Zotero[addon.data.config.addonInstance];
}

// Add your hooks here. For element click, etc.
// Keep in mind hooks only do dispatch. Don't add code that does real jobs in hooks.
// Otherwise the code would be hard to read and maintain.

export default {
  onStartup,
  onShutdown,
  onMainWindowLoad,
  onMainWindowUnload,
};
