# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

em-map-view 是一个 VS Code 插件，用于解析 Keil MDK/armlink 生成的 `.map` 文件，可视化内存布局、模块大小和符号浏览，支持地址反查。

## 常用命令

```bash
npm run build       # 构建扩展主体 + webview
npm run build:ext   # 仅构建扩展主体 (esbuild)
npm run build:webview # 仅构建 webview (Vite)
npm run watch       # 监视模式
npm test            # 运行全部测试 (vitest)
npm test -- -t "test name"  # 运行匹配名称的单个测试
npm run lint        # TypeScript 类型检查 (tsc --noEmit)
npm run package     # 打包 VSIX
npx vsce publish    # 发布到 VSCode Marketplace
```

## 架构

### 扩展主体 (src/)

- **`extension.ts`** — 入口。注册命令 (`emMapView.openMapFile`, `emMapView.analyzeCurrentFile`, `emMapView.lookupAddress`, `emMapView.selectModule`)，管理 TreeView 和 WebviewManager 生命周期，处理配置变更和编辑器事件同步。
- **`config.ts`** — 读取 VS Code 配置项
- **`treeView/`** — VS Code TreeView 数据提供层（`MapTreeProvider` 实现 `TreeDataProvider<MapTreeItem>`），支持按 Flash/RAM/名称/Code 排序，500 条符号上限，模块可展开子节点，`SymbolFilterManager` 支持按类型（Code/Data/Unknown）过滤
- **`webview/`** — Webview 面板管理器（`WebviewManager`），管理 panel 生命周期、消息路由，生成 CSP 安全的 HTML
- **`parser/`** — MAP 文件解析：
  - `index.ts` — `detectFormat()` 识别 Keil/GCC/IAR，`parseMapFile()` 路由到对应解析器
  - `keilParser.ts` — Keil MDK 格式解析器，解析 Load/Execution Region、Image Component Sizes、Memory Map、Global Symbols 四个主要段
  - `symbolLookup.ts` — 地址反查，支持精确匹配、范围匹配、近似匹配
  - `types.ts` — 核心类型定义

### Webview (webview/src/)

- **Vue 3 + TypeScript + Vite** 构建，产物输出到 `dist/webview/`
- `App.vue` — 主布局，管理分析数据和配置的传递
- `components/AddressLookup.vue` — 地址反查 UI
- `components/MemoryLayout.vue` — Canvas 绘制 Flash/RAM 内存布局
- `components/ModuleBarChart.vue` — 模块大小柱状图
- `components/SourceBadge.vue` — 数据来源标记（Official/Computed/Derived/Inferred/N/A）
- `composables/useMapData.ts` — 核心数据状态管理，处理来自扩展宿主的消息
- `composables/useHighlight.ts` — 模块高亮状态

### 扩展↔Webview 消息协议

| 方向 | type | 用途 |
|------|------|------|
| Host→Webview | `updateData` | 传递 MapParseResult 数据 |
| Host→Webview | `config` | 传递配置项 |
| Host→Webview | `addressLookupResult` | 地址查询结果 |
| Host→Webview | `highlightModule` | 高亮指定模块 |
| Host→Webview | `resetTransientState` | 切换数据时重置 UI |
| Webview→Host | `ready` | Webview 就绪，请求数据 |
| Webview→Host | `requestAddressLookup` | 请求地址查询 |
| Webview→Host | `moduleClicked` | 用户点击模块 |

### 数据来源标记体系

解析结果中所有字段都有来源标记（`DataSourceKind`）：
- `official` — 直接来自 Keil MAP 文件官方字段（如 Grand Totals）
- `computed` — 由官方数据计算得出
- `derived` — 从相关行聚合推导（如 Memory Map Object 行）
- `inferred` — 根据使用量估算
- `unavailable` — 当前 MAP 文件中无数据

### MapParseResult 结构

```typescript
{
  formatType: 'Keil' | 'GCC' | 'IAR' | 'Unknown',
  symbols: MapSymbol[],      // name, address, size, section, type, scope
  sections: MapSection[],    // name, base, size, type(CODE/DATA/BSS)
  modules: MapModule[],      // name, code, ro_data, rw_data, zi_data
  memoryRegions: MemoryRegion[], // name, origin, length, used, attributes
  totals: MapTotals,         // code/roData/rwData/ziData/flashTotal/flashUsed/ramTotal/ramUsed
  sources: MapSources,       // 每个字段的数据来源标记
}
```

## 开发要求

- 修改代码时，必须同时检查 `README.md` 和 `README.zh-CN.md` 是否需要同步更新。特别是：功能变更、命令增删、配置项变更、支持格式变更。
- TDD 要求：先写失败测试，再写最小实现，全部测试通过后再提交。
- 测试文件使用内联 fixture 构建 MAP 内容，不依赖外部 `.map` 文件。`keilEdgeCases.test.ts` 中的 `componentSizesOnly()`、`memoryMapOnly()` 等 helper 函数可复用。
- `src/parser/keilParser.ts` 中的 `parseKeil` 函数是同步的，对大文件可能阻塞扩展宿主线程。当前通过 VS Code 的 `workspace.fs.readFile` 实现非阻塞文件读取，但解析本身在主机线程同步执行。
