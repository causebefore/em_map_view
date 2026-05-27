# EM Map View

[English](README.md) | 简体中文

EM Map View 是一个用于分析 Keil MDK `.map` 文件的 VSCode 插件，面向嵌入式和固件开发场景。

## 功能特性

- **内存布局可视化**：使用 Canvas 展示 Flash/RAM 占用，区分 Code、RO、RW、ZI 和 Free。
- **模块大小分析**：展示 Top N 模块或对象贡献的 Flash 占用。
- **符号浏览**：在 TreeView 中浏览符号、模块、内存区域，并支持类型过滤。
- **地址反查**：支持单个或批量地址查询，区分精确匹配、范围匹配和近似匹配。
- **数据来源标记**：对关键数据标记 Official、Computed、Derived、Inferred 或 N/A。
- **内存阈值提示**：支持配置 warning/critical 使用率阈值。
- **自动分析 `.map` 文件**：打开 Keil MDK `.map` 文件后自动解析并展示结果。

## 使用方法

1. 在 VSCode 中打开 Keil MDK/armlink 生成的 `.map` 文件。
2. 插件会自动激活并分析文件：
   - Explorer 侧边栏出现 `MAP Analysis` TreeView。
   - Webview 面板展示内存布局、模块大小和地址查询。
3. 点击模块条形图可以在 TreeView 中高亮对应模块。
4. 在 Address Lookup 中输入地址，例如 `0x08000100`，可以反查对应符号。

## 数据来源说明

插件会尽量展示有用数据，但不会把推导数据伪装成官方数据。界面中的来源标记含义如下：

| 标记       | 含义                                                         |
| ---------- | ------------------------------------------------------------ |
| Official   | 直接来自 Keil MAP 文件的官方表格或字段，例如 Grand Totals、Load/Execution Region |
| Computed   | 由官方数据通过确定公式计算得到，例如 Flash Used、RAM Used    |
| Derived    | 从相关但非专用表格聚合得到，例如从 Memory Map Object 行推导模块贡献 |
| Inferred   | 根据已有使用量估算得到，例如 MAP 文件缺少 region 时推断容量 |
| N/A        | 当前 MAP 文件中没有可用数据                                 |

如果 MAP 文件缺少 `Image Component Sizes`，插件仍可能从 `Memory Map of the image` 的 Object 行聚合出模块/对象贡献，并用 `Derived` 标记显示。这样既保留分析价值，也避免和 Keil 官方 Component Sizes 数据混淆。

## 命令

| 命令                                | 说明                         |
| ----------------------------------- | ---------------------------- |
| `EM Map View: Open MAP File`        | 选择并分析 `.map` 文件       |
| `EM Map View: Analyze Current File` | 分析当前打开的 `.map` 文件   |
| `EM Map View: Lookup Address`       | 输入地址并反查符号           |

## 配置项

| 配置项                        | 默认值 | 说明                         |
| ----------------------------- | ------ | ---------------------------- |
| `emMapView.warningThreshold`  | 80     | 内存使用率 warning 阈值      |
| `emMapView.criticalThreshold` | 95     | 内存使用率 critical 阈值     |
| `emMapView.topModulesCount`   | 20     | 模块大小图中显示的模块数量   |

## 支持格式

- **Keil MDK/armlink**：完整支持。
- GCC/ARM LD、IAR：当前仅检测格式并提示尚未支持解析。

## 开发

```bash
# 安装依赖
npm install
cd webview && npm install && cd ..

# 构建
npm run build

# 测试
npm test

# 类型检查
npm run lint

# 打包 VSIX
npm run package
```

## 许可证

MIT
