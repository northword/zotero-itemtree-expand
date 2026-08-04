# Expand Item Tree

[![zotero target version](https://img.shields.io/badge/Zotero-7-green?style=flat-square&logo=zotero&logoColor=CC2936)](https://www.zotero.org)
[![Using Zotero Plugin Template](https://img.shields.io/badge/Using-Zotero%20Plugin%20Template-blue?style=flat-square&logo=github)](https://github.com/windingwind/zotero-plugin-template)

一个 Zotero 插件,让文库条目列表中的标题能够换行显示,方便阅读完整标题。

此插件处于开发中，尚未准备好生产使用。

## 功能特性

- ✅ **多行标题显示** - 条目标题自动换行,完整显示内容
- ✅ **保持可读性** - 充足的行高确保多行文本完全可见
- ✅ **可自定义行数** - 支持设置标题最大显示行数(1-10行)
- ✅ **动态开关** - 可随时在设置中启用或禁用,立即生效无需重启
- ✅ **性能优化** - 使用CSS限制行数,避免过度扩展
- ✅ **兼容性强** - 支持 Zotero 7 和 Zotero 8

## 安装

1. 从 [Releases](../../releases) 页面下载最新的 `.xpi` 文件
2. 在 Zotero 中,打开 `工具` → `插件`
3. 点击右上角齿轮图标,选择 `Install Add-on From File...`
4. 选择下载的 `.xpi` 文件

## 使用方法

安装后插件默认启用。条目标题会自动换行显示,无需任何操作。

你可以在 `编辑` → `首选项` → `Expand Item Tree` 中:

- 启用/禁用标题换行功能
- 调整标题最大显示行数(默认5行)

设置更改后会立即生效,无需重启 Zotero。

## 开发

```bash
# 安装依赖
pnpm install

# 开发模式(监听文件变化并自动重新加载)
pnpm start

# 构建
pnpm build

# 发布
pnpm release
```

## 许可证

AGPL-3.0-or-later
