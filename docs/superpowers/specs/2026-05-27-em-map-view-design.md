# EM Map View - VSCode Keil MAP 文件分析插件设计文档

## 1. 项目概述

**项目名称**：em-map-view
**定位**：VSCode 扩展，用于分析 Keil MDK 生成的 .map 文件，帮助嵌入式开发者可视化内存使用情况。
**代码复用**：基于现有 `C:\Users\lbqdl\Desktop\utools_em\嵌入式开发工具集` 项目的 map 分析功能。

### 1.1 核心功能

- Keil MAP 文件解析（符号、模块、内存区域）
- 内存布局可视化（Flash/RAM 使用率图表）
- 模块大小柱状图（Top N）
- 符号列表（搜索、排序、类型过滤）
- 地址反查（单个/批量）
- 内存预警（使用率阈值告警）
- TreeView ↔ Webview 双向联动

### 1.2 技术栈

- **Extension Host**：TypeScript + esbuild
- **Webview 前端**：Vue 3 + Composition API + TypeScript + Vite
- **测试**：Vitest + Vue Test Utils

---

## 2. 整体架构

### 2.1 目录结构

```
em-map-view/
├── .vscode/                    # VSCode 开发配置
│   ├── launch.json             # 调试配置
│   └── tasks.json              # 构建任务
├── src/                        # Extension Host (TypeScript, esbuild)
│   ├── extension.ts            # 入口：activate/deactivate
│   ├── commands.ts             # 注册命令
│   ├── fileWatcher.ts          # .map 文件打开监听
│   ├── treeView/
│   │   ├── mapTreeProvider.ts  # TreeDataProvider 实现
│   │   ├── treeItems.ts        # 各节点类型定义
│   │   └── symbolFilter.ts     # 符号类型过滤器
│   ├── parser/
│   │   ├── index.ts            # parse()、detectFormat() 导出
│   │   ├── keilParser.ts       # Keil 解析器（从 map_parser.js 改写）
│   │   ├── types.ts            # 统一数据结构类型定义
│   │   └── symbolLookup.ts     # findSymbolByAddress()
│   ├── config.ts               # 用户配置读取
│   └── webview/
│       ├── webviewManager.ts   # 创建/管理 WebviewPanel
│       └── html.ts             # 生成 Webview HTML
├── webview/                    # Webview 前端 (Vue 3 + Vite + TS)
│   ├── index.html
│   ├── src/
│   │   ├── main.ts             # Vue app 入口
│   │   ├── App.vue             # 主布局（纵向分区）
│   │   ├── vscode.ts           # acquireVsCodeApi 封装
│   │   ├── components/
│   │   │   ├── MemoryLayout.vue    # 内存布局 Canvas 图
│   │   │   ├── ModuleBarChart.vue  # 模块柱状图
│   │   │   └── AddressLookup.vue   # 地址反查面板
│   │   └── composables/
│   │       ├── useMapData.ts       # 接收 Extension Host 消息
│   │       └── useHighlight.ts     # 高亮联动状态管理
│   ├── vite.config.ts
│   └── tsconfig.json
├── test/
│   ├── parser/
│   │   ├── keilParser.test.ts
│   │   ├── symbolLookup.test.ts
│   │   └── fixtures/           # 测试用 map 文件
│   └── webview/
│       └── components.test.ts
├── package.json                # VSCode 插件清单 + 依赖
├── tsconfig.json               # Extension Host TS 配置
├── esbuild.config.mjs          # Extension Host 构建
└── README.md
```

### 2.2 数据流

```
用户操作（双击 .map / 命令面板 / 右键菜单）
    │
    ▼
Extension Host
    ├── 读取 .map 文件内容
    ├── 调用 Parser 解析 → MapParseResult
    ├── 更新 TreeView 数据
    └── 通过 postMessage 发送到 Webview
            │
            ▼
        Vue Webview
            ├── 接收 MapParseResult
            ├── 渲染内存布局图、柱状图、反查面板
            └── 用户交互 → postMessage 回传 Extension Host
```

### 2.3 通信协议

```typescript
// Extension → Webview
type ExtToWebMessage =
  | { type: "updateData"; data: MapParseResult }
  | { type: "highlightModule"; moduleName: string }
  | { type: "addressLookupResult"; result: SymbolLookupResult | null }
  | {
      type: "config";
      warningThreshold: number;
      criticalThreshold: number;
      topModulesCount: number;
    };

// Webview → Extension
type WebToExtMessage =
  | { type: "ready" }
  | { type: "requestAddressLookup"; addresses: string[] }
  | { type: "moduleClicked"; moduleName: string }
  | { type: "openSymbolInEditor"; symbolName: string };
```

---

## 3. Parser 层设计

### 3.1 类型定义

```typescript
// src/parser/types.ts

interface MapSymbol {
  name: string;
  address: number;
  size: number;
  section: string;
  type: string; // 'Thumb Code' | 'Data' | 'RO Data' 等
  scope: string; // 'Gb' | 'Lc' | 'St'
}

interface MapModule {
  name: string;
  code: number;
  ro_data: number;
  rw_data: number;
  zi_data: number;
}

interface MemoryRegion {
  name: string;
  origin: number;
  length: number;
  used: number;
  attributes: string;
}

interface MapTotals {
  code: number;
  roData: number;
  rwData: number;
  ziData: number;
  flashTotal: number;
  flashUsed: number;
  ramTotal: number;
  ramUsed: number;
}

interface MapParseResult {
  formatType: "Keil";
  symbols: MapSymbol[];
  modules: MapModule[];
  memoryRegions: MemoryRegion[];
  totals: MapTotals;
}

interface SymbolLookupResult {
  name: string;
  address: number;
  size: number;
  section: string;
  offset: number;
  isApproximate?: boolean;
}
```

### 3.2 公共接口

```typescript
// src/parser/index.ts

export function parseMapFile(content: string): MapParseResult;
export function findSymbolByAddress(
  symbols: MapSymbol[],
  targetAddr: number,
): SymbolLookupResult | null;
export function detectFormat(content: string): "Keil" | "GCC" | "IAR" | null;
```

### 3.3 改写策略

从 `map_parser.js` 改写为 TypeScript：

- **保留**：Keil 解析器（原文件第 255-507 行的状态机逻辑）
- **保留**：`classifySection()`、`computeTotals()`、`addModuleContribution()` 等辅助函数
- **改写**：`findSymbolByAddress()` → 独立模块 `symbolLookup.ts`
- **删除**：GCC 和 IAR 解析器（后续版本可扩展）
- **新增**：TypeScript 类型定义

---

## 4. Extension Host 层设计

### 4.1 入口

```typescript
// src/extension.ts

export function activate(context: vscode.ExtensionContext) {
  // 1. 注册 CustomEditorProvider（双击 .map 文件触发）
  // 2. 注册命令（命令面板、右键菜单）
  // 3. 注册 TreeDataProvider
  // 4. 初始化 WebviewManager
}

export function deactivate() {}
```

### 4.2 命令注册

| 命令 ID                        | 触发方式            | 功能                                   |
| ------------------------------ | ------------------- | -------------------------------------- |
| `emMapView.openMapFile`        | 命令面板 + 右键菜单 | 打开文件选择器，选 .map 文件后启动分析 |
| `emMapView.analyzeCurrentFile` | 命令面板            | 分析当前活动编辑器中的 .map 文件       |
| `emMapView.lookupAddress`      | 命令面板            | 弹出输入框输入地址反查                 |

### 4.3 文件打开触发机制

**不使用 CustomEditor**（CustomEditor 会替换默认文本编辑器）。改用**文件监听 + 命令**组合：

```typescript
// src/extension.ts activate() 中

// 方式 1：监听 .map 文件打开事件
context.subscriptions.push(
  vscode.workspace.onDidOpenTextDocument((doc) => {
    if (doc.uri.fsPath.endsWith(".map")) {
      analyzeMapFile(doc.uri);
    }
  }),
);

// 方式 2：命令面板 / 右键菜单
context.subscriptions.push(
  vscode.commands.registerCommand("emMapView.openMapFile", async () => {
    const uris = await vscode.window.showOpenDialog({
      filters: { "Map Files": ["map"] },
    });
    if (uris?.[0]) {
      const doc = await vscode.workspace.openTextDocument(uris[0]);
      await vscode.window.showTextDocument(doc);
      analyzeMapFile(uris[0]);
    }
  }),
);

// analyzeMapFile 统一处理：
// 1. 读取文件内容
// 2. 调用 Parser 解析
// 3. 更新 TreeView 数据
// 4. 打开/更新右侧 Webview 面板
```

**activationEvents 配置**：

```json
{
  "activationEvents": [
    "onLanguage:map",
    "onCommand:emMapView.openMapFile",
    "onCommand:emMapView.analyzeCurrentFile"
  ]
}
```

**实际效果**：

- 双击 .map 文件 → VSCode 默认文本编辑器打开原始内容 + TreeView 自动出现 + 右侧 Webview 面板自动打开
- 用户也可以通过命令面板手动触发分析

### 4.4 TreeView Provider

```typescript
// src/treeView/mapTreeProvider.ts

class MapTreeProvider implements vscode.TreeDataProvider<MapTreeItem> {
  // 节点类型：
  // - SummaryItem（摘要：格式、Flash、RAM、符号数、模块数）
  // - ModuleItem（模块：名称、Code/RO/RW/ZI、百分比）
  // - SymbolItem（符号：名称、地址、大小、类型）
  // - MemoryRegionItem（内存区域：名称、起始、大小、已用）
  // - AddressLookupItem（地址反查入口）

  // 排序支持
  sortModulesBy: "flash" | "code" | "name" | "ram";

  // 过滤支持
  symbolFilter: Set<string>; // 'Code' | 'Data' | 'RO' | 'RW' | 'BSS'
}
```

### 4.5 Webview 管理

```typescript
// src/webview/webviewManager.ts

class WebviewManager {
  private panel: vscode.WebviewPanel | undefined;

  show(data: MapParseResult): void {
    // 创建或显示已有 panel
    // 发送 updateData 消息
  }

  highlightModule(moduleName: string): void {
    // 发送 highlightModule 消息到 webview
  }

  private getHtml(webview: vscode.Webview): string {
    // 注入 Vite 构建的 JS/CSS
    // 设置 CSP
  }
}
```

### 4.6 用户配置

```typescript
// src/config.ts

interface MapViewConfig {
  warningThreshold: number; // 默认 80
  criticalThreshold: number; // 默认 95
  topModulesCount: number; // 默认 20
}

function getConfig(): MapViewConfig {
  const config = vscode.workspace.getConfiguration("emMapView");
  return {
    warningThreshold: config.get("warningThreshold", 80),
    criticalThreshold: config.get("criticalThreshold", 95),
    topModulesCount: config.get("topModulesCount", 20),
  };
}
```

---

## 5. Webview 前端层设计

### 5.1 消息通信

```typescript
// webview/src/vscode.ts

const vscode = acquireVsCodeApi<MapViewState>();

export function postMessage(msg: WebToExtMessage) {
  vscode.postMessage(msg);
}

export function onMessage(handler: (msg: ExtToWebMessage) => void) {
  window.addEventListener("message", (e) => handler(e.data));
}

interface MapViewState {
  // 持久化状态，VSCode 切换标签页时恢复
  scrollPosition?: number;
  activeSection?: string;
}
```

### 5.2 数据管理

```typescript
// webview/src/composables/useMapData.ts

const mapData = ref<MapParseResult | null>(null);
const highlightModule = ref<string | null>(null);
const config = ref<MapViewConfig>({ warningThreshold: 80, criticalThreshold: 95, topModulesCount: 20 });

export function useMapData() {
  onMounted(() => {
    onMessage((msg) => {
      switch (msg.type) {
        case 'updateData':
          mapData.value = msg.data;
          break;
        case 'highlightModule':
          highlightModule.value = msg.moduleName;
          break;
        case 'config':
          config.value = { warningThreshold: msg.warningThreshold, ... };
          break;
      }
    });
    postMessage({ type: 'ready' });
  });

  return { mapData, highlightModule, config };
}
```

### 5.3 组件设计

**App.vue** - 主布局（纵向分区，非标签页）

```vue
<template>
  <div class="map-analysis">
    <MemoryLayout :totals="mapData.totals" :regions="mapData.memoryRegions" />
    <ModuleBarChart :modules="mapData.modules" :highlight="highlightModule" />
    <AddressLookup />
  </div>
</template>
```

**MemoryLayout.vue** - 内存布局 Canvas 图

- 两组水平堆叠条：FLASH 和 RAM
- 颜色编码：Code（蓝）、RO Data（绿）、RW Data（橙）、ZI Data（红）、Free（灰）
- 预警颜色：超过 warningThreshold 时边框变黄，超过 criticalThreshold 时边框变红
- DPR 感知的 Canvas 渲染
- 响应式：ResizeObserver 监听容器大小变化

**ModuleBarChart.vue** - 模块柱状图

- Top N 模块按 Flash 大小降序排列
- 水平柱状图，渐变填充
- 高亮联动：收到 highlightModule 时，对应条目加边框高亮
- 点击联动：点击条目 → postMessage('moduleClicked') → Extension Host → TreeView 选中
- 标签：条内显示（够宽时）或条外显示

**AddressLookup.vue** - 地址反查面板

- 输入框支持批量地址（换行分隔）
- 结果表格：名称、地址、大小、段、偏移、精确/近似标记
- 通过 postMessage 请求 Extension Host 查询

### 5.4 主题适配

使用 VSCode 提供的 CSS 变量，自动跟随亮色/暗色主题：

```css
.map-analysis {
  background-color: var(--vscode-editor-background);
  color: var(--vscode-editor-foreground);
}

.card {
  background-color: var(--vscode-editorWidget-background);
  border: 1px solid var(--vscode-editorWidget-border);
}

input {
  background-color: var(--vscode-input-background);
  color: var(--vscode-input-foreground);
  border: 1px solid var(--vscode-input-border);
}
```

---

## 6. UI 布局设计

### 6.1 整体布局（三区）

```
┌──────────┬──────────────┬────────────────┐
│ 侧边栏    │  编辑器区域   │  Webview 面板   │
│ TreeView │  原始 .map   │  可视化分析      │
│ 摘要/模块 │  文本编辑器   │  布局/柱状图/反查 │
│ /符号/内存│  可搜索/跳转  │                │
└──────────┴──────────────┴────────────────┘
```

### 6.2 TreeView 节点结构

```
▼ MAP Analysis
│
├── 📊 摘要
│   ├── 格式: Keil
│   ├── Flash: 87.0KB / 128KB (68.2%)  ✓
│   ├── RAM: 58.0KB / 64KB (90.6%)  ⚠
│   ├── 符号数: 1,247
│   └── 模块数: 42
│
├── 📦 模块 (42)                    ← 排序：Flash/Code/Name/RAM
│   ├── main.o (5.6KB, 6.4%)
│   │   ├── Code: 4,200
│   │   ├── RO Data: 1,100
│   │   ├── RW Data: 256
│   │   └── ZI Data: 512
│   ├── stm32f4xx_hal.o (8.7KB, 9.9%)
│   └── ...
│
├── 🔤 符号 (1,247)                 ← 类型过滤按钮
│   ├── [Code][Data][RO][RW][BSS]   ← 快速过滤
│   ├── 🔍 [搜索...]
│   ├── Reset_Handler  0x08000100  256B
│   └── ...
│
├── 🗂️ 内存区域
│   ├── LR_IROM1 (Flash): 128KB, 68.2%
│   └── RW_IRAM1 (RAM): 64KB, 35.1%
│
└── 🔍 地址反查
    └── 输入地址查看所属符号...
```

### 6.3 Webview 面板内部

```
┌──────────────────────────────────────────┐
│ MAP Analysis                              │
├──────────────────────────────────────────┤
│                                          │
│  ━━━ 内存布局 ━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                          │
│  FLASH  ████████████████░░░░  68.2%      │
│  [  Code  ][ RO Data ][ RW ][ ZI ]      │
│                                          │
│  RAM    ██████░░░░░░░░░░░░░░  35.1%      │
│  [ RW ][ ZI Data ][     Free     ]      │
│                                          │
│  ━━━ 模块柱状图 (Top 20) ━━━━━━━━━━━━━━━ │
│                                          │
│  main.o             ████████████████ 87% │ ← 可点击
│  stm32f4xx_hal.o    ██████████████   76% │
│  system_stm32f4xx.o █████████        45% │
│  ...                                     │
│                                          │
│  ━━━ 地址反查 ━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                          │
│  地址: [0x08001A3C          ] [查找]     │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │ USART1_IRQHandler | 0x08001A3C     │  │
│  │ .text | 72B | offset: 0x0          │  │
│  └────────────────────────────────────┘  │
│                                          │
└──────────────────────────────────────────┘
```

---

## 7. 交互设计

### 7.1 双向联动

```
TreeView 点击模块 "main.o"
    → Webview 柱状图高亮 main.o 对应条
    → (可选) 原始编辑器滚动到 main.o 对应行

Webview 柱状图点击 "stm32f4xx_hal.o"
    → TreeView 自动展开并选中该模块节点

TreeView 点击 "🔍 地址反查"
    → Webview 自动滚动到反查面板
    → 输入框自动获得焦点
```

### 7.2 文件打开流程

```
双击 .map 文件
    → VSCode 默认文本编辑器打开原始 .map 内容
    → onDidOpenTextDocument 事件触发
    → Extension Host 读取文件 → Parser 解析
    → 左侧激活 "MAP Analysis" TreeView，填充数据
    → 右侧打开 Webview 面板，推送解析结果
    → 用户可同时查看原始文本和分析结果
```

---

## 8. 配置项

```json
{
  "emMapView.warningThreshold": {
    "type": "number",
    "default": 80,
    "description": "内存使用率警告阈值（%）",
    "minimum": 0,
    "maximum": 100
  },
  "emMapView.criticalThreshold": {
    "type": "number",
    "default": 95,
    "description": "内存使用率危险阈值（%）",
    "minimum": 0,
    "maximum": 100
  },
  "emMapView.topModulesCount": {
    "type": "number",
    "default": 20,
    "description": "柱状图显示的 Top N 模块数量",
    "minimum": 5,
    "maximum": 100
  }
}
```

---

## 9. 错误处理

| 场景                   | 处理方式                                       |
| ---------------------- | ---------------------------------------------- |
| 文件不是 Keil map 格式 | Webview 显示友好提示："未识别为 Keil MAP 文件" |
| 文件为空或损坏         | Webview 显示错误信息 + "重新选择文件" 按钮     |
| 文件超大（>10MB）      | 解析前提示确认                                 |
| 文件编码问题           | 使用 jschardet + iconv-lite 检测编码           |
| 地址反查无结果         | 显示 "未找到匹配符号"                          |

---

## 10. 测试策略

### 10.1 Parser 单元测试

- Keil 解析器：各种 map 样本的解析正确性
- 符号查找：精确匹配、近似匹配、无匹配
- 格式检测：Keil/GCC/IAR 正确识别，非 map 文件返回 null

### 10.2 组件测试

- 各组件渲染正确性
- 数据绑定验证
- 过滤逻辑验证

### 10.3 集成测试

- Extension Host ↔ Webview 消息通信
- CustomEditor 生命周期

### 10.4 测试 Fixtures

复用现有 `test/map_parser.test.mjs` 中的 Keil map 样本数据。

---

## 11. 构建配置

### 11.1 Extension Host（esbuild）

```javascript
// esbuild.config.mjs
export default {
  entryPoints: ["src/extension.ts"],
  bundle: true,
  outfile: "dist/extension.js",
  external: ["vscode"],
  format: "cjs",
  platform: "node",
  sourcemap: true,
};
```

### 11.2 Webview（Vite）

```typescript
// webview/vite.config.ts
export default defineConfig({
  build: {
    outDir: "../dist/webview",
    rollupOptions: {
      output: {
        entryFileNames: "[name]-[hash].js",
      },
    },
  },
});
```

---

## 12. 发布清单

- `package.json` 中的 `engines.vscode` 版本约束
- `activationEvents` 配置（`onCustomEditor:emMapView.mapEditor`）
- `contributes` 配置（commands、menus、views、configuration）
- README.md（功能说明、安装方式、使用指南）
- CHANGELOG.md
- LICENSE
- .vscodeignore
- Extension icon（128x128 PNG）
