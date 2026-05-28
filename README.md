<p align="center">
  <img alt="EM Map View banner" src="https://capsule-render.vercel.app/api?type=waving&height=220&color=0:0EA5E9,45:22C55E,100:F59E0B&text=EM%20Map%20View&fontColor=ffffff&fontSize=52&fontAlignY=38&desc=Keil%20MDK%20MAP%20analysis%20inside%20VS%20Code&descSize=18&descAlignY=58" />
</p>

<div align="center">

# EM Map View

**A focused VS Code extension for reading Keil MDK `.map` files, visualizing memory usage, and tracing symbols back from addresses.**

[简体中文](README.zh-CN.md) | English

![Version](https://img.shields.io/badge/version-0.1.0-0EA5E9?style=for-the-badge)
![VS Code](https://img.shields.io/badge/VS%20Code-%5E1.85.0-007ACC?style=for-the-badge&logo=visualstudiocode&logoColor=white)
![Keil MDK](https://img.shields.io/badge/Keil%20MDK-armlink-22C55E?style=for-the-badge)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-F59E0B?style=for-the-badge)

</div>

---

## Quick Navigation

- [EM Map View](#em-map-view)
  - [Quick Navigation](#quick-navigation)
  - [Why EM Map View](#why-em-map-view)
  - [Highlights](#highlights)
  - [Screenshots](#screenshots)
    - [Workspace Overview](#workspace-overview)
    - [Explorer TreeView](#explorer-treeview)
    - [Analysis Webview](#analysis-webview)
  - [Field Descriptions](#field-descriptions)
  - [Quick Start](#quick-start)
  - [Commands](#commands)
  - [Configuration](#configuration)
  - [Data Source Labels](#data-source-labels)
  - [Supported Formats](#supported-formats)
  - [Development](#development)
  - [Roadmap](#roadmap)
  - [Contact](#contact)
  - [License](#license)

---

## Why EM Map View

Embedded `.map` files are dense, valuable, and easy to ignore until Flash or RAM is already in trouble. EM Map View turns Keil MDK/armlink output into a VS Code-native analysis workspace:

- See Flash and RAM usage at a glance.
- Find the modules and objects taking the most space.
- Browse symbols without leaving the editor.
- Reverse lookup single or batch addresses from logs, crash dumps, or debugger output.
- Keep official, computed, derived, and inferred values clearly labeled.

## Highlights

| Area              | Capability                                                                                                              |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Memory layout     | Canvas-based Flash/RAM usage charts with Code, RO, RW, ZI, and free-space breakdowns                                    |
| Module analysis   | Top N module/object contribution chart for quick size triage                                                            |
| Symbol browser    | Searchable and filterable TreeView for modules, regions, and symbols                                                    |
| Address lookup    | Single and batch reverse lookup with exact, range, and approximate matches                                              |
| Provenance badges | `Official`, `Computed`, `Derived`, `Inferred`, and `N/A` labels keep data trust visible                                 |
| Threshold warnings| Configurable warning and critical memory usage indicators                                                               |
| VS Code workflow  | Explorer TreeView, command palette entries, context menu support, auto-refresh on active `.map` editor, non-blocking I/O |

## Screenshots

### Workspace Overview

![EM Map View workspace overview](https://raw.githubusercontent.com/causebefore/em_map_view/master/docs/images/overview-workspace.png)

The editor, Explorer TreeView, and analysis webview side by side, making it easy to cross-reference the raw linker output with the parsed results.

### Explorer TreeView

![EM Map View TreeView panel](https://raw.githubusercontent.com/causebefore/em_map_view/master/docs/images/treeview-panel.png)

The TreeView is ideal for quick scanning: summary fields (Format, Flash, RAM, Symbols, Modules) appear at the top, followed by the top modules by size contribution.

### Analysis Webview

![EM Map View analysis webview](https://raw.githubusercontent.com/causebefore/em_map_view/master/docs/images/webview-panel.png)

The webview gives a compact visual overview, combining summary cards, memory layout, module ranking, and address lookup in a single panel.

## Field Descriptions

| Field                                                     | Description                                                                                                                           |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `Format`                                                  | Detected MAP file format. Displays `Keil` when a supported Keil MDK/armlink format is recognized.                                     |
| `Flash`                                                   | Flash usage and total capacity. The left value is the used size; the right is the total capacity used for percentage and free-space.   |
| `RAM`                                                     | RAM usage and total capacity. Typically compares RW + ZI usage against the available RAM capacity.                                     |
| `Symbols`                                                 | Number of successfully parsed symbols, available for browsing and address lookup.                                                     |
| `Modules`                                                 | Number of successfully parsed modules or object files, affecting the module ranking and TreeView display.                              |
| `Memory Layout`                                           | Visual breakdown of Flash and RAM usage, showing occupied sections and free space.                                                    |
| `Module Size (Top N)`                                     | Top modules or object files by size contribution, useful for quickly identifying hotspots.                                            |
| `Address Lookup`                                          | Entry point for single or batch address lookups, suitable for log lines, crash dumps, and debugger addresses.                         |
| `Official` / `Computed` / `Derived` / `Inferred` / `N/A` | Source labels: directly from the MAP file, calculated by formula, aggregated from related rows, inferred from usage, or unavailable.   |

## Quick Start

1. Open a Keil MDK/armlink `.map` file in VS Code.
2. EM Map View activates automatically and stays in sync with the active `.map` editor.
3. Check the `MAP Analysis` TreeView in the Explorer sidebar.
4. Use the webview panel to inspect memory layout, module sizes, and address lookup results.
5. Click a module in the chart to highlight its matching TreeView node.

> Tip: You can also run `EM Map View: Open MAP File` from the command palette or from a `.map` file context menu.

## Commands

| Command                             | Description                                        |
| ----------------------------------- | -------------------------------------------------- |
| `EM Map View: Open MAP File`        | Open a file picker and analyze a `.map` file       |
| `EM Map View: Analyze Current File` | Analyze the active `.map` editor                   |
| `EM Map View: Lookup Address`       | Reverse lookup an address from the current analysis|

## Configuration

| Setting                        | Default | Description                                        |
| ------------------------------ | ------: | -------------------------------------------------- |
| `emMapView.warningThreshold`   |   `80` | Memory usage warning threshold in percent          |
| `emMapView.criticalThreshold`  |   `95` | Memory usage critical threshold in percent         |
| `emMapView.topModulesCount`    |   `20` | Number of modules shown in the top-module chart    |

## Data Source Labels

EM Map View keeps parsed values useful without pretending all values are equally authoritative.

| Label      | Meaning                                                                                       |
| ---------- | --------------------------------------------------------------------------------------------- |
| `Official` | Parsed directly from Keil MAP sections, such as Grand Totals or regions                       |
| `Computed` | Calculated from official values, such as Flash Used or RAM Used                               |
| `Derived`  | Aggregated from related MAP rows, such as Memory Map object contributions                     |
| `Inferred` | Estimated from available usage data because capacity or region details were missing           |
| `N/A`      | Not available from the current MAP file                                                       |

When `Image Component Sizes` is missing, module bars may still be shown as `Derived` from `Memory Map of the image` object rows. This keeps useful analysis visible while avoiding confusion with official Keil component-size data.

## Supported Formats

| Format           | Status                                 |
| ---------------- | -------------------------------------- |
| Keil MDK/armlink | Full support                           |
| GCC/ARM LD       | Detected and reported as unsupported   |
| IAR              | Detected and reported as unsupported   |

Planned:

- GCC/ARM LD parser support
- IAR parser support

> **Note:** The `.map` extension is also used by JavaScript source maps. If you open a JS source map file, the extension will detect it as an unrecognized format and show a warning. Only Keil MDK/armlink `.map` files are fully supported.

## Development

```bash
# Install extension dependencies
npm install

# Install webview dependencies
cd webview && npm install && cd ..

# Build extension and webview
npm run build

# Run tests
npm test

# Type check
npm run lint

# Package VSIX
npm run package
```

Launch the extension development host from VS Code with `F5`.

## Roadmap

- GCC/ARM LD parser support
- IAR parser support
- More export and reporting options for firmware size review

## Contact

If you have questions, suggestions, or want to contribute:

- Email: lbq08@foxmail.com
- GitHub: [causebefore](https://github.com/causebefore)

## License

[MIT LICENSE](LICENSE)
