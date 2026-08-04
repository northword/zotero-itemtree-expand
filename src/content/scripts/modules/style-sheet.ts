import { config, version } from "../../../../package.json";

const STYLE_SHEET_PATH = `chrome://${config.addonRef}/content/zoteroPane.css`;

function getHash(): string {
  if (__env__ === "production") return version;
  return String(Date.now());
}

export function registerStyleSheet(win: Window) {
  const doc = win.document;
  const styles = ztoolkit.UI.createElement(doc, "link", {
    properties: {
      type: "text/css",
      rel: "stylesheet",
      id: `${config.addonRef}-stylesheet`,
      href: `${STYLE_SHEET_PATH}?v=${getHash()}`,
    },
  });
  doc.documentElement.appendChild(styles);
}

export function unregisterStyleSheet(win: Window) {
  const doc = win.document;
  // Use config.addonRef (not global addon) to find the stylesheet element.
  const e = doc.getElementById(`${config.addonRef}-stylesheet`);
  // ztoolkit may not be available at very early unload; guard logging.
  try {
    ztoolkit?.log?.("unregisterStyleSheet", e);
  } catch {
    // ignore
  }
  e?.remove();
}
