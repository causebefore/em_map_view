<p align="center">
  <img alt="EM Map View 横幅" src="https://capsule-render.vercel.app/api?type=waving&height=220&color=0:0EA5E9,45:22C55E,100:F59E0B&text=EM%20Map%20View&fontColor=ffffff&fontSize=52&fontAlignY=38&desc=%E5%9C%A8%20VS%20Code%20%E4%B8%AD%E5%88%86%E6%9E%90%20Keil%20MDK%20MAP%20%E6%96%87%E4%BB%B6&descSize=18&descAlignY=58" />
</p>

<div align="center">

# EM Map View

**一个面向嵌入式开发者的 VS Code 插件，用于解析 Keil MDK `.map` 文件、可视化内存占用，并支持地址反查。**

[English](README.md) | 简体中文

![Version](https://img.shields.io/badge/version-0.1.0-0EA5E9?style=for-the-badge)
![VS Code](https://img.shields.io/badge/VS%20Code-%5E1.85.0-007ACC?style=for-the-badge&logo=visualstudiocode&logoColor=white)
![Keil MDK](https://img.shields.io/badge/Keil%20MDK-armlink-22C55E?style=for-the-badge)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-F59E0B?style=for-the-badge)

</div>

---

## 快速导航

- [EM Map View](#em-map-view)
  - [快速导航](#快速导航)
  - [为什么需要 EM Map View](#为什么需要-em-map-view)
  - [功能亮点](#功能亮点)
  - [界面预览](#界面预览)
    - [整体工作区视图](#整体工作区视图)
    - [Explorer TreeView](#explorer-treeview)
    - [分析 Webview](#分析-webview)
  - [字段说明](#字段说明)
  - [快速开始](#快速开始)
  - [命令](#命令)
  - [配置项](#配置项)
  - [数据来源说明](#数据来源说明)
  - [支持格式](#支持格式)
  - [开发](#开发)
  - [路线图](#路线图)
  - [联系作者](#联系作者)
  - [许可证](#许可证)

---

## 为什么需要 EM Map View

嵌入式 `.map` 文件信息量很大，但阅读成本也很高。EM Map View 会把 Keil MDK/armlink 输出整理成 VS Code 内的分析工作台，让你更快回答这些问题：

- Flash 和 RAM 现在用了多少？
- 哪些模块、对象或符号占用了最多空间？
- 某个崩溃地址、日志地址或调试器地址对应哪个符号？
- 当前数据是 Keil 官方字段、确定计算值，还是从 Memory Map 行推导出来的？

## 功能亮点

| 模块         | 能力                                                                                   |
| ------------ | -------------------------------------------------------------------------------------- |
| 内存布局     | 使用 Canvas 展示 Flash/RAM 占用，区分 Code、RO、RW、ZI 和空闲空间                      |
| 模块分析     | 展示 Top N 模块或对象贡献，便于快速定位体积热点                                        |
| 符号浏览     | 在 Explorer TreeView 中搜索、过滤、浏览模块、区域和符号                                |
| 地址反查     | 支持单个或批量地址查询，区分精确匹配、范围匹配和近似匹配                               |
| 来源标记     | 使用 `Official`、`Computed`、`Derived`、`Inferred`、`N/A` 标记数据可信来源             |
| 阈值提示     | 支持 warning/critical 内存使用率阈值配置                                               |
| VS Code 集成 | 支持 Explorer 侧边栏、命令面板、右键菜单、当前 `.map` 分析自动刷新，以及非阻塞文件读取 |

## 界面预览

### 整体工作区视图

![EM Map View 整体工作区视图](https://raw.githubusercontent.com/causebefore/em_map_view/master/docs/images/overview-workspace.png)

这张图展示了 `.map` 编辑器、Explorer TreeView 和分析 Webview 的并排效果，适合对照原始链接器输出和插件整理后的结果。

### Explorer TreeView

![EM Map View TreeView 面板](https://raw.githubusercontent.com/causebefore/em_map_view/master/docs/images/treeview-panel.png)

TreeView 适合快速扫描摘要信息：顶部先给出 Format、Flash、RAM、Symbols、Modules 等核心字段，下面按模块列出主要体积贡献。

### 分析 Webview

![EM Map View 分析 Webview](https://raw.githubusercontent.com/causebefore/em_map_view/master/docs/images/webview-panel.png)

Webview 提供更紧凑的可视化总览，把摘要卡片、内存布局、模块排行和地址反查放在同一块面板中。

## 字段说明

| 字段                                                     | 说明                                                                                         |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `Format`                                                 | 当前识别到的 MAP 文件格式。显示为 `Keil` 表示插件识别到了受支持的 Keil MDK/armlink 格式。    |
| `Flash`                                                  | Flash 已用量与总容量。左侧是已用大小，右侧是用于百分比和剩余空间计算的总容量。               |
| `RAM`                                                    | RAM 已用量与总容量。通常基于 RW + ZI 的使用量与可用 RAM 容量进行对比。                       |
| `Symbols`                                                | 当前成功解析出的符号数量，可用于符号浏览和地址反查。                                         |
| `Modules`                                                | 当前成功解析出的模块或目标文件数量，会影响模块排行和 TreeView 展示。                         |
| `Memory Layout`                                          | Flash 和 RAM 的可视化占用分布，展示已用区段和剩余空间。                                      |
| `Module Size (Top N)`                                    | 按体积贡献排序的主要模块或目标文件，便于快速识别热点。                                       |
| `Address Lookup`                                         | 一个或多个地址的反查入口，适合日志、崩溃地址和调试器地址定位。                               |
| `Official` / `Computed` / `Derived` / `Inferred` / `N/A` | 来源标记，分别表示直接来自 MAP、通过公式计算、从相关行聚合、基于已有数据推断，或当前不可用。 |

## 快速开始

1. 在 VS Code 中打开 Keil MDK/armlink 生成的 `.map` 文件。
2. 插件会自动激活，并与当前 `.map` 编辑器保持分析结果同步。
3. 在 Explorer 侧边栏查看 `MAP Analysis` TreeView。
4. 在 Webview 面板中查看内存布局、模块大小和地址查询结果。
5. 点击图表中的模块条目，可以在 TreeView 中高亮对应节点。

> 小提示：也可以通过命令面板或 `.map` 文件右键菜单运行 `EM Map View: Open MAP File`。

## 命令

| 命令                                | 说明                         |
| ----------------------------------- | ---------------------------- |
| `EM Map View: Open MAP File`        | 选择并分析 `.map` 文件       |
| `EM Map View: Analyze Current File` | 分析当前打开的 `.map` 文件   |
| `EM Map View: Lookup Address`       | 基于当前分析结果进行地址反查 |

## 配置项

| 配置项                        | 默认值 | 说明                                   |
| ----------------------------- | -----: | -------------------------------------- |
| `emMapView.warningThreshold`  |   `80` | 内存使用率 warning 阈值，单位为百分比  |
| `emMapView.criticalThreshold` |   `95` | 内存使用率 critical 阈值，单位为百分比 |
| `emMapView.topModulesCount`   |   `20` | 模块大小图中展示的模块数量             |

## 数据来源说明

插件会尽量展示有用数据，但不会把推导数据伪装成官方数据。界面中的来源标记含义如下：

| 标记       | 含义                                                                             |
| ---------- | -------------------------------------------------------------------------------- |
| `Official` | 直接来自 Keil MAP 文件的官方表格或字段，例如 Grand Totals、Load/Execution Region |
| `Computed` | 由官方数据通过确定公式计算得到，例如 Flash Used、RAM Used                        |
| `Derived`  | 从相关但非专用表格聚合得到，例如从 Memory Map Object 行推导模块贡献              |
| `Inferred` | 根据已有使用量估算得到，例如 MAP 文件缺少 region 时推断容量                      |
| `N/A`      | 当前 MAP 文件中没有可用数据                                                      |

如果 MAP 文件缺少 `Image Component Sizes`，插件仍可能从 `Memory Map of the image` 的 Object 行聚合出模块或对象贡献，并以 `Derived` 标记展示。这样既保留分析价值，也避免和 Keil 官方 Component Sizes 数据混淆。

## 支持格式

| 格式             | 状态                     |
| ---------------- | ------------------------ |
| Keil MDK/armlink | 完整支持                 |
| GCC/ARM LD       | 可检测并提示暂不支持解析 |
| IAR              | 可检测并提示暂不支持解析 |

计划中：

- 支持 GCC/ARM LD 解析
- 支持 IAR 解析

> **注意：** `.map` 扩展名同时也被 JavaScript source map 文件使用。如果你打开了 JS source map 文件，插件会检测到它是无法识别的格式并显示警告。目前只有 Keil MDK/armlink 的 `.map` 文件被完整支持。

## 开发

```bash
# 安装插件依赖
npm install

# 安装 Webview 依赖
cd webview && npm install && cd ..

# 构建插件和 Webview
npm run build

# 运行测试
npm test

# 类型检查
npm run lint

# 打包 VSIX
npm run package
```

在 VS Code 中按 `F5` 可以启动扩展开发宿主。

## 路线图

- 支持 GCC/ARM LD 解析
- 支持 IAR 解析
- 增加更多固件体积评审所需的导出与报告能力

## 联系作者

如果你有任何问题、建议或者想参与开发，欢迎通过以下方式联系我：

- 邮箱: lbq08@foxmail.com
- GitHub: [causebefore](https://github.com/causebefore)

## 许可证

[MIT LICENSE](LICENSE)
