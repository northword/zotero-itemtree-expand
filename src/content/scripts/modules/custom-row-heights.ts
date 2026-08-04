/**
 * 智能计算并应用自定义行高到item tree
 * 使用Zotero原生支持的customRowHeights机制
 *
 * 核心理念：
 * - 对于固定宽度，每个条目的高度是确定的
 * - 只在必要时计算（首次加载、宽度变化、内容变化）
 * - 滚动时复用已计算的高度，不重新计算
 */

import { getPref } from "../utils/prefs";

// 全局高度缓存 - 持久保存所有条目的计算高度
const heightCache = new Map<number, number>();

// 上次计算时的容器宽度 - 用于检测宽度变化
let lastContainerWidth = 0;

// 标记是否正在处理resize - 避免resize期间的重复计算
let isResizing = false;

// resize完成后的稳定时间戳 - 避免resize完成后立即再次触发
let resizeCompleteTime = 0;

/**
 * 计算单个条目应该有的行高
 */
function calculateRowHeight(row: Element, _win: Window): number {
  const minHeight = 32; // 最小行高(像素)

  try {
    // 获取row中的所有文本内容
    const cells = row.querySelectorAll(".cell");
    let maxContentHeight = minHeight;

    for (const cell of cells) {
      // 获取cell的scrollHeight(内容实际高度)
      const cellHeight = (cell as HTMLElement).scrollHeight;
      if (cellHeight > maxContentHeight) {
        maxContentHeight = cellHeight;
      }
    }

    // 添加一些内边距
    return Math.max(minHeight, maxContentHeight + 6);
  } catch (e) {
    ztoolkit.log("Error calculating row height:", e);
    return minHeight;
  }
}

/**
 * 为item tree生成customRowHeights数组
 * @param win
 * @param forceRecalculate 是否强制重新计算（宽度变化或内容变化时）
 */
export function generateCustomRowHeights(
  win: Window,
  forceRecalculate = false,
): number[][] {
  try {
    const doc = win.document;
    const itemTree = doc.querySelector("#zotero-items-tree");

    if (!itemTree) {
      return [];
    }

    // 查找virtualized table body
    const tableBody = itemTree.querySelector(".virtualized-table-body");
    if (!tableBody) {
      return [];
    }

    // 获取所有可见的行
    const rows = Array.from(tableBody.querySelectorAll(".row"));
    if (rows.length === 0) {
      return [];
    }

    let newCalculations = 0;
    let cachedUsed = 0;

    // 处理当前可见的行
    rows.forEach((row) => {
      if (!row || !(row as HTMLElement).id) return;

      // 从row的id中提取索引: "zotero-items-tree-row-123"
      const id = (row as HTMLElement).id;
      const match = id.match(/row-(\d+)$/);
      if (match) {
        const index = Number.parseInt(match[1]);

        // 智能缓存策略：
        // 1. 如果强制重算（宽度变化） - 重新计算
        // 2. 如果缓存中没有 - 计算新条目
        // 3. 如果缓存中有 - 直接使用，避免重复计算
        if (forceRecalculate || !heightCache.has(index)) {
          const height = calculateRowHeight(row as Element, win);
          heightCache.set(index, height);
          newCalculations++;
        } else {
          cachedUsed++;
        }
      }
    });

    // 关键修复：返回所有缓存的高度（不仅是可见行）
    // Zotero的虚拟滚动需要知道所有条目的高度才能正确计算滚动位置
    const customHeights: number[][] = [];
    heightCache.forEach((height, index) => {
      customHeights.push([index, height]);
    });

    ztoolkit.log(
      `[Custom Row Heights] Generated ${customHeights.length} heights (${newCalculations} new, ${cachedUsed} cached, total cache: ${heightCache.size})`,
    );
    return customHeights;
  } catch (e) {
    ztoolkit.log("[Custom Row Heights] Error generating custom heights:", e);
    return [];
  }
}

/**
 * 清除行高缓存
 */
export function clearHeightCache(): void {
  heightCache.clear();
  ztoolkit.log("[Custom Row Heights] Cache cleared");
}

/**
 * 应用customRowHeights到item tree
 * @param win
 * @param forceRecalculate 是否强制重新计算所有高度
 */
export function applyCustomRowHeights(
  win: Window,
  forceRecalculate = false,
): void {
  try {
    const wrapEnabled = getPref("wrapTitles") as boolean;
    if (!wrapEnabled) {
      return;
    }

    // 如果正在resize，跳过宽度检测，避免重复计算
    if (!isResizing) {
      // 检测容器宽度是否变化
      const doc = win.document;
      const itemTree = doc.querySelector("#zotero-items-tree");
      if (itemTree) {
        const currentWidth = (itemTree as HTMLElement).clientWidth;
        const widthDiff = Math.abs(currentWidth - lastContainerWidth);

        // 如果刚完成resize不到2秒，忽略小幅宽度变化（<20px）
        // 这是因为清空customRowHeights后，滚动条出现/消失会导致细微宽度变化
        const timeSinceResize = Date.now() - resizeCompleteTime;
        const isRecentResize = timeSinceResize < 2000;

        if (lastContainerWidth !== currentWidth) {
          if (isRecentResize && widthDiff < 20) {
            // 刚完成resize，忽略小幅变化
            ztoolkit.log(
              `[Custom Row Heights] Ignoring small width change ${lastContainerWidth} → ${currentWidth} (Δ${widthDiff}px) after recent resize`,
            );
            lastContainerWidth = currentWidth;
            return; // 直接返回，不强制重算
          } else {
            ztoolkit.log(
              `[Custom Row Heights] Width changed: ${lastContainerWidth} → ${currentWidth}, forcing recalculation`,
            );
            lastContainerWidth = currentWidth;
            forceRecalculate = true;
          }
        }
      }
    }

    const customHeights = generateCustomRowHeights(win, forceRecalculate);

    if (customHeights.length === 0) {
      return;
    }

    // 获取ZoteroPane中的item tree实例
    const ZoteroPane = (win as any).ZoteroPane;
    if (!ZoteroPane || !ZoteroPane.itemsView) {
      return;
    }

    const itemsView = ZoteroPane.itemsView;

    // 调用Zotero原生的updateCustomRowHeights方法
    if (
      itemsView.tree &&
      typeof itemsView.tree.updateCustomRowHeights === "function"
    ) {
      itemsView.tree.updateCustomRowHeights(customHeights);
      ztoolkit.log(
        `[Custom Row Heights] Applied ${customHeights.length} custom row heights`,
      );

      // 强制重新渲染
      if (typeof itemsView.tree.invalidate === "function") {
        itemsView.tree.invalidate();
      }
    }
  } catch (e) {
    ztoolkit.log("[Custom Row Heights] Error applying custom heights:", e);
  }
}

/**
 * 监听必要的事件并在需要时重新计算行高
 * 只在真正需要时触发计算：
 * 1. 首次加载
 * 2. 容器宽度变化（ResizeObserver）
 * 3. 内容变化（新增/删除条目）- MutationObserver仅监听childList
 * 4. 滚动时只应用缓存的高度，不重新计算
 */
export function setupCustomRowHeights(win: Window): void {
  try {
    // 首次加载 - 延迟确保DOM就绪
    win.setTimeout(() => {
      applyCustomRowHeights(win, false);
    }, 100);

    const doc = win.document;
    const itemTree = doc.querySelector("#zotero-items-tree");
    const tableBody = itemTree?.querySelector(".virtualized-table-body");

    if (!itemTree || !tableBody) {
      ztoolkit.log("[Custom Row Heights] Item tree not found, will retry");
      win.setTimeout(() => setupCustomRowHeights(win), 500);
      return;
    }

    // 1. ResizeObserver - 监听容器宽度变化
    const resizeObserver = new win.ResizeObserver((entries: any) => {
      for (const entry of entries) {
        const newWidth = entry.contentRect.width;

        // 如果是首次获取宽度，直接记录
        if (lastContainerWidth === 0) {
          lastContainerWidth = newWidth;
          return;
        }

        // 计算宽度变化量
        const widthChange = Math.abs(newWidth - lastContainerWidth);

        // 只有宽度变化超过阈值（10px）才触发重算
        // 避免拖动窗口时每1px变化都触发
        if (widthChange >= 10) {
          ztoolkit.log(
            `[Custom Row Heights] Significant width change: ${lastContainerWidth} → ${newWidth} (Δ${widthChange}px)`,
          );

          lastContainerWidth = newWidth;

          // 清除之前的定时器
          if ((win as any).__resizeTimeout) {
            win.clearTimeout((win as any).__resizeTimeout);
          }

          // 延迟等窗口调整完成，然后完全重置状态
          (win as any).__resizeTimeout = win.setTimeout(() => {
            ztoolkit.log(
              `[Custom Row Heights] Width stabilized at ${newWidth}, resetting to initial state`,
            );

            // 标记正在resize，防止applyCustomRowHeights中的宽度检测干扰
            isResizing = true;

            const ZoteroPane = (win as any).ZoteroPane;
            if (
              !ZoteroPane ||
              !ZoteroPane.itemsView ||
              !ZoteroPane.itemsView.tree
            ) {
              isResizing = false;
              return;
            }

            const tree = ZoteroPane.itemsView.tree;
            const doc = win.document;
            const itemTree = doc.querySelector("#zotero-items-tree");

            // 暂停MutationObserver，避免干扰
            if ((win as any).__customHeightsMutationObserver) {
              (win as any).__customHeightsMutationObserver.disconnect();
              ztoolkit.log(
                `[Custom Row Heights] MutationObserver paused for resize`,
              );
            }

            // 关键策略：完全重置到初始状态
            // 清空缓存
            heightCache.clear();
            ztoolkit.log(`[Custom Row Heights] Cache cleared for resize`);

            // 清空所有自定义行高，恢复到默认状态
            if (typeof tree.updateCustomRowHeights === "function") {
              tree.updateCustomRowHeights([]);
              ztoolkit.log(
                `[Custom Row Heights] Cleared all custom row heights`,
              );
            }

            // 强制滚动到顶部，确保从index 0开始计算
            if (typeof tree.scrollToRow === "function") {
              tree.scrollToRow(0);
              ztoolkit.log(`[Custom Row Heights] Scrolled to top`);
            }

            // 等待DOM更新后，从顶部开始重新计算（只调用一次）
            win.setTimeout(() => {
              // 强制刷新以确保DOM正确
              if (typeof tree.invalidate === "function") {
                tree.invalidate();
              }

              win.setTimeout(() => {
                ztoolkit.log(
                  `[Custom Row Heights] Starting fresh calculation from top`,
                );

                // 只调用一次applyCustomRowHeights
                applyCustomRowHeights(win, true);

                // 计算完成后，更新lastContainerWidth、解除resize标记、恢复MutationObserver
                win.setTimeout(() => {
                  lastContainerWidth = newWidth;
                  isResizing = false;
                  resizeCompleteTime = Date.now();

                  // 恢复MutationObserver
                  const tableBody = itemTree?.querySelector(
                    ".virtualized-table-body",
                  );
                  if (
                    tableBody &&
                    (win as any).__customHeightsMutationObserver
                  ) {
                    (win as any).__customHeightsMutationObserver.observe(
                      tableBody,
                      {
                        childList: true,
                        subtree: true,
                        attributes: false,
                      },
                    );
                    ztoolkit.log(
                      `[Custom Row Heights] MutationObserver resumed`,
                    );
                  }

                  ztoolkit.log(
                    `[Custom Row Heights] Resize complete, cache has ${heightCache.size} items`,
                  );
                }, 100);
              }, 50);
            }, 100);
          }, 500);
        }
      }
    });

    resizeObserver.observe(itemTree as Element);
    (win as any).__customHeightsResizeObserver = resizeObserver;

    // 2. MutationObserver - 监听DOM变化（包括深层subtree）
    const mutationObserver = new win.MutationObserver((mutations: any) => {
      // 检查是否有新增或删除的.row元素
      let hasAddedRows = false;
      let hasRemovedRows = false;
      // let addedCount = 0;
      // let removedCount = 0;

      for (const mutation of mutations) {
        if (mutation.type === "childList") {
          const added = Array.from(mutation.addedNodes).filter(
            (node: any) => node.classList && node.classList.contains("row"),
          );
          const removed = Array.from(mutation.removedNodes).filter(
            (node: any) => node.classList && node.classList.contains("row"),
          );

          if (added.length > 0) {
            hasAddedRows = true;
            // addedCount += added.length;
          }
          if (removed.length > 0) {
            hasRemovedRows = true;
            // removedCount += removed.length;
          }
        }
      }

      // 如果有行的增删，触发高度计算
      if (hasAddedRows || hasRemovedRows) {
        if ((win as any).__customHeightsTimeout) {
          win.clearTimeout((win as any).__customHeightsTimeout);
        }

        // 延迟一点让DOM稳定，然后计算新条目
        (win as any).__customHeightsTimeout = win.setTimeout(() => {
          applyCustomRowHeights(win, false); // 计算新条目，复用已缓存的
        }, 50);
      }
    });

    mutationObserver.observe(tableBody, {
      childList: true, // 监听子节点增删
      subtree: true, // 监听深层变化（关键！）
      attributes: false, // 不监听属性变化
    });

    (win as any).__customHeightsMutationObserver = mutationObserver;
    ztoolkit.log(
      "[Custom Row Heights] Observers set up successfully (ResizeObserver + smart MutationObserver)",
    );
  } catch (e) {
    ztoolkit.log("[Custom Row Heights] Error setting up observer:", e);
  }
}

/**
 * 清理observers和缓存
 */
export function cleanupCustomRowHeights(win: Window): void {
  try {
    // 清理MutationObserver
    if ((win as any).__customHeightsMutationObserver) {
      (win as any).__customHeightsMutationObserver.disconnect();
      delete (win as any).__customHeightsMutationObserver;
    }

    // 清理ResizeObserver
    if ((win as any).__customHeightsResizeObserver) {
      (win as any).__customHeightsResizeObserver.disconnect();
      delete (win as any).__customHeightsResizeObserver;
    }

    // 清理定时器
    if ((win as any).__customHeightsTimeout) {
      win.clearTimeout((win as any).__customHeightsTimeout);
      delete (win as any).__customHeightsTimeout;
    }

    if ((win as any).__resizeTimeout) {
      win.clearTimeout((win as any).__resizeTimeout);
      delete (win as any).__resizeTimeout;
    }

    if ((win as any).__scrollApplyTimeout) {
      win.clearTimeout((win as any).__scrollApplyTimeout);
      delete (win as any).__scrollApplyTimeout;
    }

    // 清除缓存
    clearHeightCache();
    lastContainerWidth = 0;
    isResizing = false;
    resizeCompleteTime = 0;

    ztoolkit.log("[Custom Row Heights] Cleanup完成");
  } catch (e) {
    ztoolkit.log("[Custom Row Heights] Error during cleanup:", e);
  }
}
