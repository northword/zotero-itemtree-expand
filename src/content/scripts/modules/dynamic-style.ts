import { config } from "../../../../package.json";
import { getPref } from "../utils/prefs";

/**
 * Generate dynamic CSS based on user preferences
 * This allows customization of max lines for titles
 */
function generateDynamicCSS(): string {
  const maxLines = (getPref("maxLines") as number) || 5;

  // If maxLines is 0 or negative, don't apply any line clamp (show all content)
  if (maxLines <= 0) {
    return `
/* Dynamic styles: No line limit - show full content */
#zotero-items-pane #zotero-items-tree .cell span,
#item-tree-main-default .virtualized-table span,
.zotero-view-item-container .virtualized-table span,
#zotero-items-tree.main span {
  display: inline !important;
  overflow: visible !important;
}
    `.trim();
  }

  return `
/* Dynamic styles generated based on user preferences */
/* Apply line limit to all cell content in main item tree */
#zotero-items-pane #zotero-items-tree .cell span,
#zotero-items-pane #zotero-items-tree .virtualized-table-cell > span,
#zotero-items-pane #zotero-items-tree div[role="gridcell"] span,
#item-tree-main-default .virtualized-table span,
.zotero-view-item-container .virtualized-table span,
#zotero-items-tree.main span {
  display: -webkit-box !important;
  -webkit-line-clamp: ${maxLines} !important;
  line-clamp: ${maxLines} !important;
  -webkit-box-orient: vertical !important;
  overflow: hidden !important;
}

/* Keep icon columns at single line */
#zotero-items-pane #zotero-items-tree .cell.icon *,
#zotero-items-pane #zotero-items-tree .cell[data-key="hasAttachment"] *,
#zotero-items-pane #zotero-items-tree .cell[data-key="numNotes"] *,
#item-tree-main-default .virtualized-table .cell.icon *,
.zotero-view-item-container .virtualized-table .cell.icon *,
#zotero-items-tree.main .cell.icon * {
  -webkit-line-clamp: 1 !important;
  line-clamp: 1 !important;
}
  `.trim();
}

/**
 * Register dynamic stylesheet in a window
 */
export function registerDynamicStyleSheet(win: Window): void {
  const doc = win.document;
  const styleId = `${config.addonRef}-dynamic-stylesheet`;

  // Remove existing dynamic stylesheet if any
  const existing = doc.getElementById(styleId);
  if (existing) {
    existing.remove();
  }

  // Create and append new style element
  const styleElement = doc.createElement("style");
  styleElement.id = styleId;
  styleElement.textContent = generateDynamicCSS();
  doc.documentElement.appendChild(styleElement);
}

/**
 * Unregister dynamic stylesheet from a window
 */
export function unregisterDynamicStyleSheet(win: Window): void {
  const doc = win.document;
  const styleId = `${config.addonRef}-dynamic-stylesheet`;
  const element = doc.getElementById(styleId);
  element?.remove();
}

/**
 * Update dynamic stylesheet in all windows
 * Call this when preferences change
 */
export function updateDynamicStyleSheet(): void {
  const windows = Zotero.getMainWindows();
  for (const win of windows) {
    registerDynamicStyleSheet(win);
  }
}
