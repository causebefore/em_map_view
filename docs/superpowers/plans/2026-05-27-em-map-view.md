# EM Map View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a VSCode extension that analyzes Keil MDK .map files with TreeView sidebar + Webview visualization panel.

**Architecture:** Extension Host (TypeScript/esbuild) reads .map files and runs the parser, then sends parsed data to a Vue 3 Webview panel via postMessage. TreeView shows structured data (modules, symbols, memory regions), Webview shows Canvas visualizations (memory layout, bar chart, address lookup).

**Tech Stack:** TypeScript, esbuild (Extension Host), Vue 3 + Vite (Webview), Vitest (testing)

**Spec:** `docs/superpowers/specs/2026-05-27-em-map-view-design.md`

---

## File Map

| File | Responsibility |
|------|---------------|
| `src/parser/types.ts` | TypeScript type definitions for all parser data structures |
| `src/parser/keilParser.ts` | Keil map file state machine parser |
| `src/parser/symbolLookup.ts` | Address-to-symbol lookup (exact + approximate) |
| `src/parser/index.ts` | Public API: `parseMapFile()`, `findSymbolByAddress()`, `detectFormat()` |
| `src/extension.ts` | Extension entry: activate/deactivate |
| `src/commands.ts` | Register all VSCode commands |
| `src/fileWatcher.ts` | Listen for .map file opens |
| `src/config.ts` | Read user settings |
| `src/treeView/treeItems.ts` | TreeItem subclasses for each node type |
| `src/treeView/mapTreeProvider.ts` | TreeDataProvider implementation |
| `src/treeView/symbolFilter.ts` | Symbol type filter state |
| `src/webview/webviewManager.ts` | Create/manage WebviewPanel |
| `src/webview/html.ts` | Generate Webview HTML with CSP |
| `webview/src/main.ts` | Vue app entry |
| `webview/src/vscode.ts` | acquireVsCodeApi wrapper |
| `webview/src/App.vue` | Main layout (vertical sections) |
| `webview/src/composables/useMapData.ts` | Receive messages from Extension Host |
| `webview/src/composables/useHighlight.ts` | Highlight state for module linkage |
| `webview/src/components/MemoryLayout.vue` | Canvas memory bar chart |
| `webview/src/components/ModuleBarChart.vue` | Top N module horizontal bar chart |
| `webview/src/components/AddressLookup.vue` | Address reverse lookup panel |
| `test/parser/fixtures/keil_sample.map` | Test fixture: real Keil map file |
| `test/parser/keilParser.test.ts` | Parser unit tests |
| `test/parser/symbolLookup.test.ts` | Symbol lookup unit tests |
| `package.json` | Extension manifest + dependencies |
| `tsconfig.json` | Extension Host TS config |
| `webview/tsconfig.json` | Webview TS config |
| `webview/vite.config.ts` | Vite build config |
| `esbuild.config.mjs` | esbuild build config |
| `.vscode/launch.json` | Debug configuration |
| `.vscode/tasks.json` | Build tasks |

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `esbuild.config.mjs`
- Create: `.vscode/launch.json`
- Create: `.vscode/tasks.json`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "em-map-view",
  "displayName": "EM Map View",
  "description": "Keil MDK MAP file analysis for embedded developers",
  "version": "0.1.0",
  "publisher": "your-publisher-id",
  "engines": { "vscode": "^1.85.0" },
  "categories": ["Other"],
  "activationEvents": [
    "onLanguage:map",
    "onCommand:emMapView.openMapFile",
    "onCommand:emMapView.analyzeCurrentFile"
  ],
  "main": "./dist/extension.js",
  "contributes": {
    "commands": [
      {
        "command": "emMapView.openMapFile",
        "title": "EM Map View: Open MAP File",
        "icon": "$(file-code)"
      },
      {
        "command": "emMapView.analyzeCurrentFile",
        "title": "EM Map View: Analyze Current File",
        "icon": "$(search)"
      },
      {
        "command": "emMapView.lookupAddress",
        "title": "EM Map View: Lookup Address",
        "icon": "$(symbol-field)"
      }
    ],
    "views": {
      "explorer": [
        {
          "id": "emMapView.analysis",
          "name": "MAP Analysis",
          "when": "emMapView:hasData"
        }
      ]
    },
    "menus": {
      "explorer/context": [
        {
          "command": "emMapView.openMapFile",
          "when": "resourceExtname == .map",
          "group": "navigation"
        }
      ],
      "commandPalette": [
        { "command": "emMapView.openMapFile" },
        { "command": "emMapView.analyzeCurrentFile" },
        { "command": "emMapView.lookupAddress" }
      ]
    },
    "configuration": {
      "title": "EM Map View",
      "properties": {
        "emMapView.warningThreshold": {
          "type": "number",
          "default": 80,
          "description": "Memory usage warning threshold (%)",
          "minimum": 0,
          "maximum": 100
        },
        "emMapView.criticalThreshold": {
          "type": "number",
          "default": 95,
          "description": "Memory usage critical threshold (%)",
          "minimum": 0,
          "maximum": 100
        },
        "emMapView.topModulesCount": {
          "type": "number",
          "default": 20,
          "description": "Number of top modules to show in bar chart",
          "minimum": 5,
          "maximum": 100
        }
      }
    }
  },
  "scripts": {
    "build": "npm run build:ext && npm run build:webview",
    "build:ext": "node esbuild.config.mjs",
    "build:webview": "cd webview && npm run build",
    "watch": "node esbuild.config.mjs --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "tsc --noEmit",
    "package": "vsce package"
  },
  "devDependencies": {
    "@types/vscode": "^1.85.0",
    "@vscode/vsce": "^2.22.0",
    "esbuild": "^0.20.0",
    "typescript": "^5.3.0",
    "vitest": "^1.2.0"
  },
  "dependencies": {}
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "webview", "test"]
}
```

- [ ] **Step 3: Create esbuild.config.mjs**

```javascript
import * as esbuild from 'esbuild';

const watch = process.argv.includes('--watch');

const ctx = await esbuild.context({
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  external: ['vscode'],
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  sourcemap: true,
  minify: false,
});

if (watch) {
  await ctx.watch();
  console.log('Watching for changes...');
} else {
  await ctx.rebuild();
  await ctx.dispose();
  console.log('Build complete.');
}
```

- [ ] **Step 4: Create .vscode/launch.json**

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Run Extension",
      "type": "extensionHost",
      "request": "launch",
      "args": ["--extensionDevelopmentPath=${workspaceFolder}"],
      "outFiles": ["${workspaceFolder}/dist/**/*.js"],
      "preLaunchTask": "build:all"
    },
    {
      "name": "Run Tests",
      "type": "extensionHost",
      "request": "launch",
      "args": [
        "--extensionDevelopmentPath=${workspaceFolder}",
        "--extensionTestsPath=${workspaceFolder}/dist/test"
      ],
      "outFiles": ["${workspaceFolder}/dist/**/*.js"],
      "preLaunchTask": "build:all"
    }
  ]
}
```

- [ ] **Step 5: Create .vscode/tasks.json**

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "build:all",
      "dependsOn": ["build:ext", "build:webview"],
      "problemMatcher": []
    },
    {
      "label": "build:ext",
      "type": "npm",
      "script": "build:ext",
      "problemMatcher": ["$esbuild-watch"]
    },
    {
      "label": "build:webview",
      "type": "npm",
      "script": "build:webview",
      "problemMatcher": []
    }
  ]
}
```

- [ ] **Step 6: Initialize git and commit**

```bash
git init
git add package.json tsconfig.json esbuild.config.mjs .vscode/launch.json .vscode/tasks.json
git commit -m "chore: project scaffolding with esbuild + vscode config"
```

---

### Task 2: Parser Types

**Files:**
- Create: `src/parser/types.ts`

- [ ] **Step 1: Create types.ts**

```typescript
// src/parser/types.ts

export interface MapSymbol {
  name: string;
  address: number;
  size: number;
  section: string;
  type: string;       // 'Thumb Code' | 'Data' | 'RO Data' etc.
  scope: string;      // 'Gb' | 'Lc' | 'St'
}

export interface MapModule {
  name: string;
  code: number;
  ro_data: number;
  rw_data: number;
  zi_data: number;
}

export interface MemoryRegion {
  name: string;
  origin: number;
  length: number;
  used: number;
  attributes: string;
}

export interface MapSection {
  name: string;
  address: number;
  size: number;
  type: string;
  attributes: string;
}

export interface MapTotals {
  code: number;
  roData: number;
  rwData: number;
  ziData: number;
  flashTotal: number;
  flashUsed: number;
  ramTotal: number;
  ramUsed: number;
}

export interface MapParseResult {
  formatType: 'Keil' | 'GCC' | 'IAR';
  symbols: MapSymbol[];
  sections: MapSection[];
  modules: MapModule[];
  memoryRegions: MemoryRegion[];
  totals: MapTotals;
}

export interface SymbolLookupResult {
  name: string;
  address: number;
  size: number;
  section: string;
  offset: number;
  isApproximate?: boolean;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/parser/types.ts
git commit -m "feat: add parser type definitions"
```

---

### Task 3: Keil Parser (TDD)

**Files:**
- Create: `test/parser/fixtures/keil_sample.map`
- Create: `test/parser/keilParser.test.ts`
- Create: `src/parser/keilParser.ts`

- [ ] **Step 1: Create test fixture**

Create `test/parser/fixtures/keil_sample.map` with a realistic Keil map file:

```
ARM Linker, 5.06 update 6 (build 750)

Component: ARM Compiler 5.06 update 6 (build 750) Tool: armlink [4d35fe]

Memory Map of the image

  Load Region LR_IROM1 (Base: 0x08000000, Size: 0x00004c9c, Max: 0x00040000, ABSOLUTE)

    Execution Region ER_IROM1 (Base: 0x08000000, Size: 0x00004ba0, Max: 0x00040000, ABSOLUTE)

    Exec Addr    Load Addr    Size         Type   Attr      Idx    E Section Name        Object

    0x08000000   0x08000000   0x00000130   Data   RO            3    RESET               startup_stm32f407xx.o
    0x08000130   0x08000130   0x00000000   Code   RO            4    .text               startup_stm32f407xx.o
    0x08000130   0x08000130   0x000000e0   Code   RO            5    .text               main.o
    0x08000210   0x08000210   0x00000020   Data   RO            6    .rodata             main.o
    0x08000230   0x08000230   0x00004970   Code   RO            7    .text               stm32f4xx_hal.o

    Execution Region RW_IRAM1 (Base: 0x20000000, Size: 0x00000800, Max: 0x00020000, ABSOLUTE)

    Exec Addr    Load Addr    Size         Type   Attr      Idx    E Section Name        Object

    0x20000000   0x08004b9c   0x00000100   Data   RW            8    .data               main.o
    0x20000100   0x20000100   0x00000400   Zero   RW            9    .bss                main.o
    0x20000500   0x20000500   0x00000200   Zero   RW           10    .bss                stm32f4xx_hal.o

Global Symbols

Symbol Name                              Value     Ov Type        Size  Object(Section)
Reset_Handler                            0x08000001   Thumb Code   8  startup_stm32f407xx.o(RESET)
NMI_Handler                              0x08000039   Thumb Code   0  startup_stm32f407xx.o(RESET)
HardFault_Handler                        0x08000041   Thumb Code   0  startup_stm32f407xx.o(RESET)
SystemInit                               0x08000131   Thumb Code   36  system_stm32f4xx.o(.text)
main                                     0x08000155   Thumb Code   224  main.o(.text)
HAL_Init                                 0x08000231   Thumb Code   64  stm32f4xx_hal.o(.text)
HAL_GPIO_Init                            0x08000271   Thumb Code   420  stm32f4xx_hal.o(.text)

Image component sizes

        Code (inc. data)   RO Data    RW Data    ZI Data      Debug   Object Name
        188        0          0          0          0          0   startup_stm32f407xx.o
         36        0          0          0          0        200   system_stm32f4xx.o
        224        0         32        256       1024        512   main.o
      18800        0       2048        512        512       1024   stm32f4xx_hal.o

      ----------------------------------------------------------------------

      19248        0       2080        768       1536       1736   Object Totals
          0        0          0          0          0          0   (incl. Padding)
      19248        0       2080        768       1536       1736   Grand Totals
```

- [ ] **Step 2: Write failing test**

Create `test/parser/keilParser.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseKeil } from '../../src/parser/keilParser';

const fixture = readFileSync(
  join(__dirname, 'fixtures/keil_sample.map'),
  'utf-8'
);

describe('parseKeil', () => {
  it('should parse memory regions', () => {
    const result = parseKeil(fixture);

    expect(result.memoryRegions.length).toBeGreaterThanOrEqual(2);

    const flash = result.memoryRegions.find(r => r.name === 'LR_IROM1');
    expect(flash).toBeDefined();
    expect(flash!.origin).toBe(0x08000000);
    expect(flash!.length).toBe(0x00040000);
    expect(flash!.used).toBe(0x00004c9c);

    const ram = result.memoryRegions.find(r => r.name === 'RW_IRAM1');
    expect(ram).toBeDefined();
    expect(ram!.origin).toBe(0x20000000);
  });

  it('should parse modules from Component Sizes', () => {
    const result = parseKeil(fixture);

    expect(result.modules.length).toBeGreaterThanOrEqual(3);

    const mainMod = result.modules.find(m => m.name === 'main.o');
    expect(mainMod).toBeDefined();
    expect(mainMod!.code).toBe(224);
    expect(mainMod!.ro_data).toBe(32);
    expect(mainMod!.rw_data).toBe(256);
    expect(mainMod!.zi_data).toBe(1024);
  });

  it('should parse global symbols', () => {
    const result = parseKeil(fixture);

    expect(result.symbols.length).toBeGreaterThanOrEqual(5);

    const mainSym = result.symbols.find(s => s.name === 'main');
    expect(mainSym).toBeDefined();
    expect(mainSym!.address).toBe(0x08000155);
    expect(mainSym!.size).toBe(224);
    expect(mainSym!.section).toBe('.text');
  });

  it('should compute totals from Grand Totals', () => {
    const result = parseKeil(fixture);

    expect(result.totals.code).toBe(19248);
    expect(result.totals.roData).toBe(2080);
    expect(result.totals.rwData).toBe(768);
    expect(result.totals.ziData).toBe(1536);
    expect(result.totals.flashUsed).toBe(19248 + 2080 + 768);
    expect(result.totals.ramUsed).toBe(768 + 1536);
    expect(result.totals.flashTotal).toBe(0x00040000);
  });

  it('should return formatType Keil', () => {
    const result = parseKeil(fixture);
    expect(result.formatType).toBe('Keil');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run test/parser/keilParser.test.ts`
Expected: FAIL — `parseKeil` module not found

- [ ] **Step 4: Implement keilParser.ts**

Create `src/parser/keilParser.ts` — port the Keil parser from `map_parser.js` lines 255-507, plus `classifySection`, `addModuleContribution`, `sectionCategory`, `computeTotals`, `inferMemoryRegions`, `nextPow2` from lines 713-918. Convert to TypeScript with proper types.

```typescript
import { MapSymbol, MapModule, MemoryRegion, MapSection, MapTotals, MapParseResult } from './types';

export function parseKeil(content: string): MapParseResult {
  const symbols: MapSymbol[] = [];
  const sections: MapSection[] = [];
  const modules: MapModule[] = [];
  const memoryRegions: MemoryRegion[] = [];

  const lines = content.split(/\r?\n/);

  let inComponentSizes = false;
  let inGrandTotals = false;
  let inMemoryMap = false;
  let inGlobalSymbols = false;
  let componentTable = '';
  let explicitTotals: Partial<MapTotals> | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) continue;
    if (/^[\*=\-]{3,}$/.test(trimmed)) continue;

    // Section detection
    if (/^Image\s+component\s+sizes/i.test(trimmed) ||
        /^Component\s+Sizes/i.test(trimmed)) {
      inComponentSizes = true;
      inGrandTotals = false;
      inMemoryMap = false;
      inGlobalSymbols = false;
      continue;
    }

    if (/^Memory\s+Map\s+of\s+the\s+image/i.test(trimmed)) {
      inComponentSizes = false;
      inMemoryMap = true;
      inGlobalSymbols = false;
      componentTable = '';
      continue;
    }

    if (/^Global\s+Symbols/i.test(trimmed)) {
      inComponentSizes = false;
      inMemoryMap = false;
      inGlobalSymbols = true;
      componentTable = '';
      continue;
    }

    // === Image Component Sizes ===
    if (inComponentSizes) {
      if (/^-{5,}/.test(trimmed)) continue;

      if (/^\s*Code\s/i.test(trimmed)) {
        if (/Object\s+Name/i.test(trimmed)) componentTable = 'object';
        else if (/Library\s+Member\s+Name/i.test(trimmed)) componentTable = 'libraryMember';
        else if (/Library\s+Name/i.test(trimmed)) componentTable = 'libraryName';
        else componentTable = 'totals';
        continue;
      }

      if (/Grand\s+Totals/i.test(trimmed)) {
        const totalMatch = trimmed.match(/^(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+Grand\s+Totals/i);
        if (totalMatch) {
          explicitTotals = {
            code: parseInt(totalMatch[1], 10),
            roData: parseInt(totalMatch[3], 10),
            rwData: parseInt(totalMatch[4], 10),
            ziData: parseInt(totalMatch[5], 10),
            flashTotal: 0,
            flashUsed: 0,
            ramTotal: 0,
            ramUsed: 0,
          };
        }
        continue;
      }

      if (/^(Object|Library|ELF\s+Image|ROM)\s+Totals/i.test(trimmed)) continue;
      if (/^\(incl\./i.test(trimmed)) continue;
      if (/^Total\s+(RO|RW|ROM)\s+Size/i.test(trimmed)) continue;
      if (componentTable === 'libraryName' || componentTable === 'totals') continue;

      const modMatch = trimmed.match(/^(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(.+)$/);
      if (modMatch) {
        const code = parseInt(modMatch[1], 10);
        const roData = parseInt(modMatch[3], 10);
        const rwData = parseInt(modMatch[4], 10);
        const ziData = parseInt(modMatch[5], 10);
        const objName = modMatch[7].trim();
        if (/Totals$/i.test(objName) || /^\(incl\./i.test(objName) || /\.l$/i.test(objName)) continue;

        modules.push({ name: objName, code, ro_data: roData, rw_data: rwData, zi_data: ziData });
        continue;
      }
    }

    // === Memory Map ===
    if (inMemoryMap) {
      const loadRegionMatch = trimmed.match(/^Load\s+Region\s+(\S+)\s+\(Base:\s*0x([0-9a-fA-F]+),\s*Size:\s*0x([0-9a-fA-F]+),\s*Max:\s*0x([0-9a-fA-F]+)/i);
      if (loadRegionMatch) {
        const base = parseInt(loadRegionMatch[2], 16);
        const size = parseInt(loadRegionMatch[3], 16);
        const max = parseInt(loadRegionMatch[4], 16);
        memoryRegions.push({ name: loadRegionMatch[1], origin: base, length: max, used: size, attributes: 'rx' });
        continue;
      }

      const execRegionMatch = trimmed.match(/^Execution\s+Region\s+(\S+)\s+\((?:Base|Exec\s+base):\s*0x([0-9a-fA-F]+),\s*(?:Load\s+base:\s*0x[0-9a-fA-F]+,\s*)?Size:\s*0x([0-9a-fA-F]+),\s*Max:\s*0x([0-9a-fA-F]+)/i);
      if (execRegionMatch) {
        const base = parseInt(execRegionMatch[2], 16);
        const size = parseInt(execRegionMatch[3], 16);
        const max = parseInt(execRegionMatch[4], 16);

        let attrs = 'rwx';
        if (/IROM|ER_RO|ER_CO|LR_IROM/i.test(execRegionMatch[1])) attrs = 'rx';
        if (/IRAM|ER_RW|ER_ZI|ER_BSS|LR_IRAM/i.test(execRegionMatch[1])) attrs = 'rw';

        const exists = memoryRegions.some(r => r.name === execRegionMatch[1]);
        if (!exists) {
          memoryRegions.push({ name: execRegionMatch[1], origin: base, length: max, used: size, attributes: attrs });
        }

        sections.push({
          name: execRegionMatch[1],
          address: base,
          size,
          type: attrs === 'rx' ? '代码' : '数据',
          attributes: attrs === 'rx' ? 'RO' : 'RW',
        });
        continue;
      }

      if (/^Exec\s+Addr/i.test(trimmed)) continue;
      if (/^0x[0-9a-fA-F]+\s+0x[0-9a-fA-F]+\s+0x[0-9a-fA-F]+/.test(trimmed)) continue;
    }

    // === Global Symbols ===
    if (inGlobalSymbols) {
      if (/^-{5,}/.test(trimmed)) continue;
      if (/^Symbol\s+Name/i.test(trimmed)) continue;
      if (/^Module\s+Name/i.test(trimmed)) continue;

      const symMatch = trimmed.match(/^(.+?)\s{2,}0x([0-9a-fA-F]+)\s+(.+?)\s+(\d+)\s+(\S+(?:\(.+\))?)/);
      if (symMatch) {
        const symName = symMatch[1].trim();
        if (/^(Image|\s*$)/.test(symName)) continue;

        const symAddr = parseInt(symMatch[2], 16);
        const symSize = parseInt(symMatch[4], 10);
        const objSection = symMatch[5].trim();

        let section = '';
        const secExtract = objSection.match(/\((.+)\)$/);
        if (secExtract) {
          section = secExtract[1];
        }

        let symType = '数据';
        const typeInfo = symMatch[3].trim();
        if (/Code|Thumb/i.test(typeInfo)) symType = '函数';
        if (/Data|Number/i.test(typeInfo)) symType = '变量';

        let scope = 'Global';
        if (/Local|Static/i.test(typeInfo)) scope = 'Local';

        symbols.push({ name: symName, address: symAddr, size: symSize, section, type: symType, scope });
        continue;
      }

      // Fallback match
      const symFallback = trimmed.match(/^(.+?)\s{3,}0x([0-9a-fA-F]+)\s+/);
      if (symFallback) {
        const symName = symFallback[1].trim();
        if (/[a-zA-Z_]/.test(symName) && symName.length > 1 && !/^(Image|__)/.test(symName)) {
          if (!symbols.find(s => s.name === symName)) {
            symbols.push({ name: symName, address: parseInt(symFallback[2], 16), size: 0, section: '', type: '函数', scope: 'Global' });
          }
        }
      }
    }
  }

  if (memoryRegions.length === 0) {
    inferMemoryRegions(modules, memoryRegions, sections);
  }

  const totals = computeTotals(sections, modules, memoryRegions, explicitTotals);

  return { formatType: 'Keil', symbols, sections, modules, memoryRegions, totals };
}

function inferMemoryRegions(modules: MapModule[], memoryRegions: MemoryRegion[], _sections: MapSection[]): void {
  const totalCode = modules.reduce((s, m) => s + (m.code || 0), 0);
  const totalRo = modules.reduce((s, m) => s + (m.ro_data || 0), 0);
  const totalRw = modules.reduce((s, m) => s + (m.rw_data || 0), 0);
  const totalZi = modules.reduce((s, m) => s + (m.zi_data || 0), 0);

  const flashUsed = totalCode + totalRo + totalRw;
  const ramUsed = totalRw + totalZi;

  const flashLen = nextPow2(flashUsed, 0x10000);
  const ramLen = nextPow2(ramUsed, 0x8000);

  memoryRegions.push({ name: 'FLASH', origin: 0x08000000, length: flashLen, used: flashUsed, attributes: 'rx' });
  memoryRegions.push({ name: 'RAM', origin: 0x20000000, length: ramLen, used: ramUsed, attributes: 'rwx' });
}

function computeTotals(sections: MapSection[], modules: MapModule[], memoryRegions: MemoryRegion[], explicitTotals: Partial<MapTotals> | null): MapTotals {
  const totals: MapTotals = explicitTotals ? { code: 0, roData: 0, rwData: 0, ziData: 0, flashTotal: 0, flashUsed: 0, ramTotal: 0, ramUsed: 0, ...explicitTotals } : {
    code: 0, roData: 0, rwData: 0, ziData: 0, flashTotal: 0, flashUsed: 0, ramTotal: 0, ramUsed: 0,
  };

  if (!explicitTotals) {
    for (const mod of modules) {
      totals.code += mod.code || 0;
      totals.roData += mod.ro_data || 0;
      totals.rwData += mod.rw_data || 0;
      totals.ziData += mod.zi_data || 0;
    }
  }

  if (!explicitTotals && modules.length === 0) {
    for (const sec of sections) {
      if (sec.type === '代码' || /^(CODE|ER_RO|ER_CO)/i.test(sec.name)) totals.code += sec.size || 0;
      else if (sec.type === '只读数据') totals.roData += sec.size || 0;
      else if (sec.type === '数据' || /^(DATA|RW|ER_RW)/i.test(sec.name)) totals.rwData += sec.size || 0;
      else if (sec.type === 'BSS' || /^(BSS|ZI|ER_ZI)/i.test(sec.name)) totals.ziData += sec.size || 0;
    }
  }

  totals.flashUsed = totals.code + totals.roData + totals.rwData;
  totals.ramUsed = totals.rwData + totals.ziData;

  for (const region of memoryRegions) {
    const name = region.name.toUpperCase();
    if (/FLASH|ROM|IROM|ER_IROM|LR_IROM/i.test(name) && totals.flashTotal === 0) {
      totals.flashTotal = region.length;
    }
    if (/RAM|IRAM|DRAM|SRAM|ER_IRAM|LR_IRAM/i.test(name) && totals.ramTotal === 0) {
      totals.ramTotal = region.length;
    }
  }

  if (totals.flashUsed === 0) {
    const loadRegions = memoryRegions.filter(r => /^LR_/i.test(r.name) && r.used > 0);
    const flashRegions = loadRegions.length > 0
      ? loadRegions
      : memoryRegions.filter(r => /FLASH|ROM|IROM|ER_IROM|LR_IROM/i.test(r.name) && r.used > 0);
    totals.flashUsed = flashRegions.reduce((sum, r) => sum + (r.used || 0), 0);
  }

  if (totals.ramUsed === 0) {
    const ramRegions = memoryRegions.filter(r => /RAM|IRAM|DRAM|SRAM|ER_IRAM|LR_IRAM/i.test(r.name) && !/^LR_/i.test(r.name));
    totals.ramUsed = ramRegions.reduce((sum, r) => sum + (r.used || 0), 0);
  }

  return totals;
}

function nextPow2(value: number, minSize: number): number {
  let size = minSize;
  while (size < value) size *= 2;
  return size;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run test/parser/keilParser.test.ts`
Expected: All 5 tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/parser/keilParser.ts test/parser/keilParser.test.ts test/parser/fixtures/keil_sample.map
git commit -m "feat: implement Keil map parser with unit tests"
```

---

### Task 4: Symbol Lookup (TDD)

**Files:**
- Create: `test/parser/symbolLookup.test.ts`
- Create: `src/parser/symbolLookup.ts`

- [ ] **Step 1: Write failing test**

Create `test/parser/symbolLookup.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { findSymbolByAddress } from '../../src/parser/symbolLookup';
import { MapSymbol } from '../../src/parser/types';

const symbols: MapSymbol[] = [
  { name: 'Reset_Handler', address: 0x08000001, size: 8, section: 'RESET', type: '函数', scope: 'Global' },
  { name: 'main', address: 0x08000155, size: 224, section: '.text', type: '函数', scope: 'Global' },
  { name: 'HAL_Init', address: 0x08000231, size: 64, section: '.text', type: '函数', scope: 'Global' },
  { name: 'g_buffer', address: 0x20000000, size: 256, section: '.bss', type: '变量', scope: 'Global' },
];

describe('findSymbolByAddress', () => {
  it('should find exact match within symbol range', () => {
    const result = findSymbolByAddress(symbols, 0x08000160);
    expect(result).toBeDefined();
    expect(result!.name).toBe('main');
    expect(result!.offset).toBe(0x08000160 - 0x08000155);
    expect(result!.isApproximate).toBeFalsy();
  });

  it('should find symbol at exact start address', () => {
    const result = findSymbolByAddress(symbols, 0x08000231);
    expect(result).toBeDefined();
    expect(result!.name).toBe('HAL_Init');
    expect(result!.offset).toBe(0);
  });

  it('should find approximate match when no exact range hit', () => {
    const result = findSymbolByAddress(symbols, 0x08000300);
    expect(result).toBeDefined();
    expect(result!.isApproximate).toBe(true);
  });

  it('should return null for empty symbol list', () => {
    const result = findSymbolByAddress([], 0x08000000);
    expect(result).toBeNull();
  });

  it('should match last symbol at address just before end', () => {
    // main: 0x08000155 + 224 = 0x08000235 (but size 224, so last byte at offset 223)
    const result = findSymbolByAddress(symbols, 0x08000155 + 224 - 1);
    expect(result).toBeDefined();
    expect(result!.name).toBe('main');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/parser/symbolLookup.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement symbolLookup.ts**

Create `src/parser/symbolLookup.ts`:

```typescript
import { MapSymbol, SymbolLookupResult } from './types';

export function findSymbolByAddress(symbols: MapSymbol[], targetAddr: number): SymbolLookupResult | null {
  if (!symbols || symbols.length === 0) return null;

  // Phase 1: exact range match
  for (const sym of symbols) {
    if (sym.size > 0 && targetAddr >= sym.address && targetAddr < sym.address + sym.size) {
      return {
        name: sym.name,
        address: sym.address,
        size: sym.size,
        section: sym.section,
        offset: targetAddr - sym.address,
      };
    }
  }

  // Phase 2: exact address match (size === 0)
  for (const sym of symbols) {
    if (sym.size === 0 && sym.address === targetAddr) {
      return {
        name: sym.name,
        address: sym.address,
        size: sym.size,
        section: sym.section,
        offset: 0,
      };
    }
  }

  // Phase 3: approximate (nearest address)
  let nearest: MapSymbol | null = null;
  let minDist = Infinity;
  for (const sym of symbols) {
    const dist = Math.abs(targetAddr - sym.address);
    if (dist < minDist) {
      minDist = dist;
      nearest = sym;
    }
  }

  if (nearest) {
    return {
      name: nearest.name,
      address: nearest.address,
      size: nearest.size,
      section: nearest.section,
      offset: targetAddr - nearest.address,
      isApproximate: true,
    };
  }

  return null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/parser/symbolLookup.test.ts`
Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/parser/symbolLookup.ts test/parser/symbolLookup.test.ts
git commit -m "feat: implement symbol address lookup with exact and approximate matching"
```

---

### Task 5: Parser Index (detectFormat + public API)

**Files:**
- Create: `src/parser/index.ts`

- [ ] **Step 1: Create parser/index.ts**

```typescript
import { MapParseResult, SymbolLookupResult, MapSymbol } from './types';
import { parseKeil } from './keilParser';
import { findSymbolByAddress } from './symbolLookup';

export { findSymbolByAddress };
export type { MapParseResult, MapSymbol, SymbolLookupResult, MapModule, MemoryRegion, MapTotals, MapSection } from './types';

export function detectFormat(content: string): 'Keil' | 'GCC' | 'IAR' | null {
  if (!content || typeof content !== 'string') return null;

  const upper = content.toUpperCase();

  if (upper.includes('ARM LINKER') || upper.includes('COMPONENT SIZES')) {
    return 'Keil';
  }

  if (upper.includes('IAR LINKER') || (upper.includes('ENTRY') && upper.includes('MODULE') && upper.includes('ADDRESS'))) {
    return 'IAR';
  }

  if (upper.includes('MEMORY CONFIGURATION') || upper.includes('GNU LD')) {
    return 'GCC';
  }

  return null;
}

export function parseMapFile(content: string): MapParseResult {
  if (!content || typeof content !== 'string') {
    return {
      formatType: 'Keil',
      symbols: [],
      sections: [],
      modules: [],
      memoryRegions: [],
      totals: { code: 0, roData: 0, rwData: 0, ziData: 0, flashTotal: 0, flashUsed: 0, ramTotal: 0, ramUsed: 0 },
    };
  }

  const format = detectFormat(content);

  if (format === 'Keil') {
    return parseKeil(content);
  }

  // For now, only Keil is supported
  // GCC and IAR can be added later
  return {
    formatType: 'Keil',
    symbols: [],
    sections: [],
    modules: [],
    memoryRegions: [],
    totals: { code: 0, roData: 0, rwData: 0, ziData: 0, flashTotal: 0, flashUsed: 0, ramTotal: 0, ramUsed: 0 },
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/parser/index.ts
git commit -m "feat: add parser public API with format detection"
```

---

### Task 6: Extension Host Entry + Config

**Files:**
- Create: `src/config.ts`
- Create: `src/extension.ts`

- [ ] **Step 1: Create config.ts**

```typescript
import * as vscode from 'vscode';

export interface MapViewConfig {
  warningThreshold: number;
  criticalThreshold: number;
  topModulesCount: number;
}

export function getConfig(): MapViewConfig {
  const config = vscode.workspace.getConfiguration('emMapView');
  return {
    warningThreshold: config.get('warningThreshold', 80),
    criticalThreshold: config.get('criticalThreshold', 95),
    topModulesCount: config.get('topModulesCount', 20),
  };
}
```

- [ ] **Step 2: Create extension.ts**

```typescript
import * as vscode from 'vscode';
import { parseMapFile, MapParseResult } from './parser';
import { getConfig } from './config';

let currentData: MapParseResult | null = null;

export function activate(context: vscode.ExtensionContext) {
  // Set context for when-clause
  vscode.commands.executeCommand('setContext', 'emMapView:hasData', false);

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('emMapView.openMapFile', async () => {
      const uris = await vscode.window.showOpenDialog({
        filters: { 'Map Files': ['map'] },
        canSelectMany: false,
      });
      if (uris?.[0]) {
        const doc = await vscode.workspace.openTextDocument(uris[0]);
        await vscode.window.showTextDocument(doc);
        analyzeMapFile(uris[0]);
      }
    }),

    vscode.commands.registerCommand('emMapView.analyzeCurrentFile', () => {
      const editor = vscode.window.activeTextEditor;
      if (editor && editor.document.fileName.endsWith('.map')) {
        analyzeMapFile(editor.document.uri);
      } else {
        vscode.window.showWarningMessage('Current file is not a .map file');
      }
    }),

    vscode.commands.registerCommand('emMapView.lookupAddress', async () => {
      if (!currentData) {
        vscode.window.showWarningMessage('No MAP file loaded. Open a .map file first.');
        return;
      }
      const addr = await vscode.window.showInputBox({
        prompt: 'Enter hex address (e.g. 0x08000100)',
        placeHolder: '0x08000100',
      });
      if (addr) {
        // Will be handled by TreeView
      }
    })
  );

  // Listen for .map file opens
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((doc) => {
      if (doc.uri.fsPath.endsWith('.map')) {
        analyzeMapFile(doc.uri);
      }
    })
  );
}

function analyzeMapFile(uri: vscode.Uri) {
  try {
    const content = require('fs').readFileSync(uri.fsPath, 'utf-8');
    currentData = parseMapFile(content);

    if (currentData.modules.length === 0 && currentData.symbols.length === 0) {
      vscode.window.showWarningMessage('No data parsed from MAP file. Ensure it is a valid Keil MAP file.');
      return;
    }

    vscode.commands.executeCommand('setContext', 'emMapView:hasData', true);

    const config = getConfig();
    // TreeView and Webview will be wired in later tasks
    vscode.window.showInformationMessage(
      `MAP file loaded: ${currentData.modules.length} modules, ${currentData.symbols.length} symbols`
    );
  } catch (err: any) {
    vscode.window.showErrorMessage(`Failed to parse MAP file: ${err.message}`);
  }
}

export function deactivate() {}
```

- [ ] **Step 3: Commit**

```bash
git add src/config.ts src/extension.ts
git commit -m "feat: extension entry point with file open and command registration"
```

---

### Task 7: TreeView Provider

**Files:**
- Create: `src/treeView/treeItems.ts`
- Create: `src/treeView/symbolFilter.ts`
- Create: `src/treeView/mapTreeProvider.ts`

- [ ] **Step 1: Create treeItems.ts**

```typescript
import * as vscode from 'vscode';
import { MapModule, MapSymbol, MemoryRegion } from '../parser/types';

export abstract class MapTreeItem extends vscode.TreeItem {
  abstract readonly itemType: string;
}

export class SummaryItem extends MapTreeItem {
  readonly itemType = 'summary';
  constructor(label: string, tooltip?: string) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.tooltip = tooltip;
    this.iconPath = new vscode.ThemeIcon('info');
  }
}

export class ModuleItem extends MapTreeItem {
  readonly itemType = 'module';
  constructor(public readonly module: MapModule, flashTotal: number) {
    const flashSize = module.code + module.ro_data + module.rw_data;
    const percent = flashTotal > 0 ? ((flashSize / flashTotal) * 100).toFixed(1) : '0.0';
    super(`${module.name} (${formatBytes(flashSize)}, ${percent}%)`, vscode.TreeItemCollapsibleState.Collapsed);
    this.tooltip = `Code: ${module.code}\nRO: ${module.ro_data}\nRW: ${module.rw_data}\nZI: ${module.zi_data}`;
    this.iconPath = new vscode.ThemeIcon('package');
  }
}

export class ModuleDetailItem extends MapTreeItem {
  readonly itemType = 'moduleDetail';
  constructor(label: string) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.iconPath = new vscode.ThemeIcon('symbol-property');
  }
}

export class SymbolItem extends MapTreeItem {
  readonly itemType = 'symbol';
  constructor(public readonly symbol: MapSymbol) {
    super(`${symbol.name}  0x${symbol.address.toString(16).padStart(8, '0')}  ${symbol.size}B`, vscode.TreeItemCollapsibleState.None);
    this.tooltip = `Section: ${symbol.section}\nType: ${symbol.type}\nScope: ${symbol.scope}`;
    this.iconPath = new vscode.ThemeIcon(
      symbol.type === '函数' ? 'symbol-method' : 'symbol-variable'
    );
  }
}

export class MemoryRegionItem extends MapTreeItem {
  readonly itemType = 'region';
  constructor(public readonly region: MemoryRegion, warningThreshold: number, criticalThreshold: number) {
    const percent = region.length > 0 ? (region.used / region.length) * 100 : 0;
    const percentStr = percent.toFixed(1);
    let icon = 'check';
    if (percent >= criticalThreshold) icon = 'error';
    else if (percent >= warningThreshold) icon = 'warning';

    super(`${region.name}: ${formatBytes(region.used)} / ${formatBytes(region.length)} (${percentStr}%)`, vscode.TreeItemCollapsibleState.None);
    this.tooltip = `Origin: 0x${region.origin.toString(16)}\nAttributes: ${region.attributes}`;
    this.iconPath = new vscode.ThemeIcon(icon);
  }
}

export class AddressLookupItem extends MapTreeItem {
  readonly itemType = 'addressLookup';
  constructor() {
    super('Lookup address...', vscode.TreeItemCollapsibleState.None);
    this.iconPath = new vscode.ThemeIcon('search');
    this.command = {
      command: 'emMapView.lookupAddress',
      title: 'Lookup Address',
    };
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  return `${(bytes / 1024).toFixed(1)}KB`;
}
```

- [ ] **Step 2: Create symbolFilter.ts**

```typescript
export type SymbolType = 'Code' | 'Data' | 'RO' | 'RW' | 'BSS';

export class SymbolFilterManager {
  private activeFilters = new Set<SymbolType>();

  readonly allTypes: SymbolType[] = ['Code', 'Data', 'RO', 'RW', 'BSS'];

  toggle(type: SymbolType): void {
    if (this.activeFilters.has(type)) {
      this.activeFilters.delete(type);
    } else {
      this.activeFilters.add(type);
    }
  }

  isActive(type: SymbolType): boolean {
    return this.activeFilters.size === 0 || this.activeFilters.has(type);
  }

  hasActiveFilters(): boolean {
    return this.activeFilters.size > 0;
  }

  clear(): void {
    this.activeFilters.clear();
  }

  matches(symbolType: string, symbolSection: string): boolean {
    if (this.activeFilters.size === 0) return true;

    const normalizedType = symbolType.toLowerCase();
    const normalizedSection = symbolSection.toLowerCase();

    for (const filter of this.activeFilters) {
      switch (filter) {
        case 'Code':
          if (/code|thumb|函数/i.test(normalizedType) || /\.(text|isr_vector)/i.test(normalizedSection)) return true;
          break;
        case 'Data':
          if (/data|变量/i.test(normalizedType) || /\.data/i.test(normalizedSection)) return true;
          break;
        case 'RO':
          if (/ro|只读/i.test(normalizedType) || /\.(rodata|ARM)/i.test(normalizedSection)) return true;
          break;
        case 'RW':
          if (/rw/i.test(normalizedType) || /\.data/i.test(normalizedSection)) return true;
          break;
        case 'BSS':
          if (/bss|zi/i.test(normalizedType) || /\.(bss|heap|stack)/i.test(normalizedSection)) return true;
          break;
      }
    }
    return false;
  }
}
```

- [ ] **Step 3: Create mapTreeProvider.ts**

```typescript
import * as vscode from 'vscode';
import { MapParseResult } from '../parser/types';
import { getConfig } from '../config';
import { MapTreeItem, SummaryItem, ModuleItem, ModuleDetailItem, SymbolItem, MemoryRegionItem, AddressLookupItem } from './treeItems';
import { SymbolFilterManager, SymbolType } from './symbolFilter';

export class MapTreeProvider implements vscode.TreeDataProvider<MapTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<MapTreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private data: MapParseResult | null = null;
  readonly filter = new SymbolFilterManager();
  private sortMode: 'flash' | 'code' | 'name' | 'ram' = 'flash';

  refresh(data: MapParseResult): void {
    this.data = data;
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: MapTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: MapTreeItem): MapTreeItem[] {
    if (!this.data) return [];

    if (!element) {
      // Root level
      return [
        new SummaryItem(`Format: ${this.data.formatType}`),
        new SummaryItem(`Flash: ${formatBytes(this.data.totals.flashUsed)} / ${formatBytes(this.data.totals.flashTotal)} (${percent(this.data.totals.flashUsed, this.data.totals.flashTotal)})`),
        new SummaryItem(`RAM: ${formatBytes(this.data.totals.ramUsed)} / ${formatBytes(this.data.totals.ramTotal)} (${percent(this.data.totals.ramUsed, this.data.totals.ramTotal)})`),
        new SummaryItem(`Symbols: ${this.data.symbols.length}`),
        new SummaryItem(`Modules: ${this.data.modules.length}`),
        ...this.getModuleRoots(),
        ...this.getSymbolItems(),
        ...this.getRegionItems(),
        new AddressLookupItem(),
      ];
    }

    if (element instanceof ModuleItem) {
      return [
        new ModuleDetailItem(`Code: ${element.module.code}`),
        new ModuleDetailItem(`RO Data: ${element.module.ro_data}`),
        new ModuleDetailItem(`RW Data: ${element.module.rw_data}`),
        new ModuleDetailItem(`ZI Data: ${element.module.zi_data}`),
      ];
    }

    return [];
  }

  private getModuleRoots(): MapTreeItem[] {
    if (!this.data) return [];
    const sorted = [...this.data.modules].sort((a, b) => {
      switch (this.sortMode) {
        case 'flash': return (b.code + b.ro_data + b.rw_data) - (a.code + a.ro_data + a.rw_data);
        case 'code': return b.code - a.code;
        case 'ram': return (b.rw_data + b.zi_data) - (a.rw_data + a.zi_data);
        case 'name': return a.name.localeCompare(b.name);
      }
    });
    return sorted.map(m => new ModuleItem(m, this.data!.totals.flashTotal));
  }

  private getSymbolItems(): MapTreeItem[] {
    if (!this.data) return [];
    const filtered = this.data.symbols.filter(s =>
      this.filter.matches(s.type, s.section)
    );
    return filtered.slice(0, 500).map(s => new SymbolItem(s));
  }

  private getRegionItems(): MapTreeItem[] {
    if (!this.data) return [];
    const config = getConfig();
    return this.data.memoryRegions.map(r =>
      new MemoryRegionItem(r, config.warningThreshold, config.criticalThreshold)
    );
  }

  setSortMode(mode: 'flash' | 'code' | 'name' | 'ram'): void {
    this.sortMode = mode;
    this._onDidChangeTreeData.fire(undefined);
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  return `${(bytes / 1024).toFixed(1)}KB`;
}

function percent(used: number, total: number): string {
  return total > 0 ? `${((used / total) * 100).toFixed(1)}%` : '0%';
}
```

- [ ] **Step 4: Commit**

```bash
git add src/treeView/
git commit -m "feat: TreeView provider with modules, symbols, memory regions, and filter"
```

---

### Task 8: Webview Manager + HTML Generator

**Files:**
- Create: `src/webview/html.ts`
- Create: `src/webview/webviewManager.ts`

- [ ] **Step 1: Create html.ts**

```typescript
import * as vscode from 'vscode';

export function getWebviewHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'assets', 'index.js'));
  const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'assets', 'index.css'));

  const nonce = getNonce();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <link href="${styleUri}" rel="stylesheet">
  <title>MAP Analysis</title>
</head>
<body>
  <div id="app"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}

function getNonce(): string {
  let text = '';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}
```

- [ ] **Step 2: Create webviewManager.ts**

```typescript
import * as vscode from 'vscode';
import { MapParseResult, SymbolLookupResult } from '../parser/types';
import { findSymbolByAddress } from '../parser';
import { getWebviewHtml } from './html';
import { getConfig } from '../config';

export class WebviewManager {
  private panel: vscode.WebviewPanel | undefined;

  constructor(private readonly extensionUri: vscode.Uri) {}

  show(data: MapParseResult): void {
    if (!this.panel) {
      this.panel = vscode.window.createWebviewPanel(
        'emMapView.analysis',
        'MAP Analysis',
        { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview')],
        }
      );

      this.panel.webview.html = getWebviewHtml(this.panel.webview, this.extensionUri);

      this.panel.webview.onDidReceiveMessage((msg) => {
        this.handleMessage(msg, data);
      });

      this.panel.onDidDispose(() => {
        this.panel = undefined;
      });
    }

    const config = getConfig();
    this.panel.webview.postMessage({
      type: 'updateData',
      data,
    });
    this.panel.webview.postMessage({
      type: 'config',
      warningThreshold: config.warningThreshold,
      criticalThreshold: config.criticalThreshold,
      topModulesCount: config.topModulesCount,
    });

    this.panel.reveal(vscode.ViewColumn.Beside, true);
  }

  highlightModule(moduleName: string): void {
    this.panel?.webview.postMessage({ type: 'highlightModule', moduleName });
  }

  private handleMessage(msg: any, data: MapParseResult): void {
    switch (msg.type) {
      case 'ready':
        // Re-send data on ready
        this.show(data);
        break;
      case 'requestAddressLookup': {
        const addresses: string[] = msg.addresses || [];
        const results = addresses.map(addrStr => {
          const addr = parseInt(addrStr.replace(/^0x/i, ''), 16);
          if (isNaN(addr)) return null;
          return findSymbolByAddress(data.symbols, addr);
        });
        this.panel?.webview.postMessage({
          type: 'addressLookupResult',
          results,
        });
        break;
      }
      case 'moduleClicked': {
        // Notify TreeView to select this module
        vscode.commands.executeCommand('emMapView.selectModule', msg.moduleName);
        break;
      }
    }
  }

  dispose(): void {
    this.panel?.dispose();
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/webview/
git commit -m "feat: Webview manager with HTML generation and message handling"
```

---

### Task 9: Wire TreeView + Webview into Extension

**Files:**
- Modify: `src/extension.ts`

- [ ] **Step 1: Update extension.ts to register TreeView and Webview**

```typescript
import * as vscode from 'vscode';
import * as fs from 'fs';
import { parseMapFile, MapParseResult } from './parser';
import { getConfig } from './config';
import { MapTreeProvider } from './treeView/mapTreeProvider';
import { WebviewManager } from './webview/webviewManager';

let currentData: MapParseResult | null = null;
let treeProvider: MapTreeProvider | undefined;
let webviewManager: WebviewManager | undefined;

export function activate(context: vscode.ExtensionContext) {
  vscode.commands.executeCommand('setContext', 'emMapView:hasData', false);

  // Initialize TreeView
  treeProvider = new MapTreeProvider();
  const treeView = vscode.window.createTreeView('emMapView.analysis', {
    treeDataProvider: treeProvider,
    showCollapseAll: true,
  });
  context.subscriptions.push(treeView);

  // Initialize WebviewManager
  webviewManager = new WebviewManager(context.extensionUri);

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('emMapView.openMapFile', async () => {
      const uris = await vscode.window.showOpenDialog({
        filters: { 'Map Files': ['map'] },
        canSelectMany: false,
      });
      if (uris?.[0]) {
        const doc = await vscode.workspace.openTextDocument(uris[0]);
        await vscode.window.showTextDocument(doc);
        analyzeMapFile(uris[0]);
      }
    }),

    vscode.commands.registerCommand('emMapView.analyzeCurrentFile', () => {
      const editor = vscode.window.activeTextEditor;
      if (editor && editor.document.fileName.endsWith('.map')) {
        analyzeMapFile(editor.document.uri);
      } else {
        vscode.window.showWarningMessage('Current file is not a .map file');
      }
    }),

    vscode.commands.registerCommand('emMapView.lookupAddress', async () => {
      if (!currentData) {
        vscode.window.showWarningMessage('No MAP file loaded. Open a .map file first.');
        return;
      }
      const addr = await vscode.window.showInputBox({
        prompt: 'Enter hex address (e.g. 0x08000100)',
        placeHolder: '0x08000100',
      });
      if (addr) {
        webviewManager?.show(currentData);
        webviewManager?.highlightModule('');
        // The webview will handle the lookup request
      }
    }),

    vscode.commands.registerCommand('emMapView.selectModule', (moduleName: string) => {
      webviewManager?.highlightModule(moduleName);
    })
  );

  // Listen for .map file opens
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((doc) => {
      if (doc.uri.fsPath.endsWith('.map')) {
        analyzeMapFile(doc.uri);
      }
    })
  );

  // Check if a .map file is already open
  const activeEditor = vscode.window.activeTextEditor;
  if (activeEditor && activeEditor.document.fileName.endsWith('.map')) {
    analyzeMapFile(activeEditor.document.uri);
  }
}

function analyzeMapFile(uri: vscode.Uri) {
  try {
    const content = fs.readFileSync(uri.fsPath, 'utf-8');
    currentData = parseMapFile(content);

    if (currentData.modules.length === 0 && currentData.symbols.length === 0) {
      vscode.window.showWarningMessage('No data parsed. Ensure it is a valid Keil MAP file.');
      return;
    }

    vscode.commands.executeCommand('setContext', 'emMapView:hasData', true);
    treeProvider?.refresh(currentData);
    webviewManager?.show(currentData);
  } catch (err: any) {
    vscode.window.showErrorMessage(`Failed to parse MAP file: ${err.message}`);
  }
}

export function deactivate() {
  webviewManager?.dispose();
}
```

- [ ] **Step 2: Commit**

```bash
git add src/extension.ts
git commit -m "feat: wire TreeView and Webview into extension activation"
```

---

### Task 10: Webview Vue App Setup

**Files:**
- Create: `webview/package.json`
- Create: `webview/tsconfig.json`
- Create: `webview/vite.config.ts`
- Create: `webview/index.html`
- Create: `webview/src/main.ts`
- Create: `webview/src/vscode.ts`
- Create: `webview/src/App.vue`
- Create: `webview/src/composables/useMapData.ts`
- Create: `webview/src/composables/useHighlight.ts`
- Create: `webview/src/env.d.ts`

- [ ] **Step 1: Create webview/package.json**

```json
{
  "name": "em-map-view-webview",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "vue": "^3.4.0"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.0.0",
    "typescript": "^5.3.0",
    "vite": "^5.0.0",
    "vue-tsc": "^1.8.0"
  }
}
```

- [ ] **Step 2: Create webview/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "preserve",
    "strict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src/**/*.ts", "src/**/*.tsx", "src/**/*.vue"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 3: Create webview/tsconfig.node.json**

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 4: Create webview/vite.config.ts**

```typescript
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  build: {
    outDir: '../dist/webview',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },
});
```

- [ ] **Step 5: Create webview/index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MAP Analysis</title>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

- [ ] **Step 6: Create webview/src/env.d.ts**

```typescript
/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<{}, {}, any>;
  export default component;
}
```

- [ ] **Step 7: Create webview/src/vscode.ts**

```typescript
interface VSCodeApi {
  postMessage(message: any): void;
  getState(): any;
  setState(state: any): void;
}

declare function acquireVsCodeApi(): VSCodeApi;

const vscode = acquireVsCodeApi();

export function postMessage(msg: any): void {
  vscode.postMessage(msg);
}

export function onMessage(handler: (msg: any) => void): void {
  window.addEventListener('message', (e) => handler(e.data));
}

export function getState<T>(): T | undefined {
  return vscode.getState() as T | undefined;
}

export function setState<T>(state: T): void {
  vscode.setState(state);
}
```

- [ ] **Step 8: Create webview/src/composables/useMapData.ts**

```typescript
import { ref, onMounted } from 'vue';
import { onMessage, postMessage } from '../vscode';

export interface MapParseResult {
  formatType: string;
  symbols: any[];
  modules: any[];
  memoryRegions: any[];
  totals: {
    code: number;
    roData: number;
    rwData: number;
    ziData: number;
    flashTotal: number;
    flashUsed: number;
    ramTotal: number;
    ramUsed: number;
  };
}

export interface MapViewConfig {
  warningThreshold: number;
  criticalThreshold: number;
  topModulesCount: number;
}

export const mapData = ref<MapParseResult | null>(null);
export const config = ref<MapViewConfig>({ warningThreshold: 80, criticalThreshold: 95, topModulesCount: 20 });

export function useMapData() {
  onMounted(() => {
    onMessage((msg) => {
      switch (msg.type) {
        case 'updateData':
          mapData.value = msg.data;
          break;
        case 'config':
          config.value = {
            warningThreshold: msg.warningThreshold,
            criticalThreshold: msg.criticalThreshold,
            topModulesCount: msg.topModulesCount,
          };
          break;
      }
    });
    postMessage({ type: 'ready' });
  });

  return { mapData, config };
}
```

- [ ] **Step 9: Create webview/src/composables/useHighlight.ts**

```typescript
import { ref } from 'vue';

export const highlightModule = ref<string | null>(null);

export function useHighlight() {
  function setHighlight(moduleName: string | null) {
    highlightModule.value = moduleName;
  }

  function clearHighlight() {
    highlightModule.value = null;
  }

  return { highlightModule, setHighlight, clearHighlight };
}
```

- [ ] **Step 10: Create webview/src/main.ts**

```typescript
import { createApp } from 'vue';
import App from './App.vue';

createApp(App).mount('#app');
```

- [ ] **Step 11: Create webview/src/App.vue placeholder**

```vue
<script setup lang="ts">
import { useMapData } from './composables/useMapData';
import { useHighlight } from './composables/useHighlight';

const { mapData, config } = useMapData();
const { highlightModule } = useHighlight();
</script>

<template>
  <div class="map-analysis">
    <div v-if="!mapData" class="empty">Waiting for MAP data...</div>
    <div v-else>
      <p>Modules: {{ mapData.modules.length }}</p>
      <p>Symbols: {{ mapData.symbols.length }}</p>
    </div>
  </div>
</template>

<style>
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
  font-size: var(--vscode-font-size, 13px);
  color: var(--vscode-editor-foreground, #333);
  background: var(--vscode-editor-background, #fff);
  padding: 12px;
}

.empty {
  text-align: center;
  padding: 60px 20px;
  color: var(--vscode-descriptionForeground, #999);
}
</style>
```

- [ ] **Step 12: Install webview dependencies and build**

```bash
cd webview && npm install && npm run build
```

- [ ] **Step 13: Commit**

```bash
git add webview/
git commit -m "feat: Vue 3 webview app skeleton with message composable"
```

---

### Task 11: MemoryLayout Component

**Files:**
- Create: `webview/src/components/MemoryLayout.vue`

- [ ] **Step 1: Create MemoryLayout.vue**

Port the Canvas drawing logic from `MapAnalyzer/index.vue` lines 441-540.

```vue
<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { useHighlight } from '../composables/useHighlight';

const props = defineProps<{
  totals: {
    code: number;
    roData: number;
    rwData: number;
    ziData: number;
    flashTotal: number;
    flashUsed: number;
    ramTotal: number;
    ramUsed: number;
  };
  warningThreshold: number;
  criticalThreshold: number;
}>();

const canvasRef = ref<HTMLCanvasElement | null>(null);
const containerRef = ref<HTMLDivElement | null>(null);
let resizeObserver: ResizeObserver | null = null;

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  return `${(bytes / 1024).toFixed(1)}KB`;
}

function drawMemoryLayout() {
  const canvas = canvasRef.value;
  const container = containerRef.value;
  if (!canvas || !container) return;

  const dpr = window.devicePixelRatio || 1;
  const rect = container.getBoundingClientRect();
  const width = rect.width - 4;
  const totalHeight = 260;

  canvas.width = width * dpr;
  canvas.height = totalHeight * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${totalHeight}px`;

  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);
  ctx.textBaseline = 'middle';

  const t = props.totals;
  const margin = { left: 60, right: 20, top: 10, bottom: 10 };
  const barArea = width - margin.left - margin.right;
  const barH = 36;
  const gap = 60;

  // FLASH bar
  const flashY = margin.top + 24;
  drawBar(ctx, 'FLASH', margin.left, flashY, barArea, barH, t.flashTotal, [
    { label: 'Code', size: t.code, color: '#4CAF50' },
    { label: 'RO', size: t.roData, color: '#2196F3' },
    { label: 'RW', size: t.rwData, color: '#FF9800' },
    { label: 'Free', size: Math.max(0, t.flashTotal - t.flashUsed), color: '#E0E0E0' },
  ]);

  // RAM bar
  const ramY = flashY + barH + gap;
  drawBar(ctx, 'RAM', margin.left, ramY, barArea, barH, t.ramTotal, [
    { label: 'RW', size: t.rwData, color: '#FF9800' },
    { label: 'ZI', size: t.ziData, color: '#9C27B0' },
    { label: 'Free', size: Math.max(0, t.ramTotal - t.ramUsed), color: '#E0E0E0' },
  ]);
}

function drawBar(
  ctx: CanvasRenderingContext2D,
  title: string,
  x: number,
  y: number,
  totalWidth: number,
  barH: number,
  totalSize: number,
  segments: { label: string; size: number; color: string }[]
) {
  const effective = segments.filter(s => s.size > 0);
  if (effective.length === 0 || totalSize <= 0) return;

  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--vscode-editor-foreground') || '#333';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(title, x - 50, y + barH / 2);

  ctx.font = '11px sans-serif';
  ctx.textBaseline = 'middle';

  let drawX = x;
  for (const seg of effective) {
    const segW = Math.max((seg.size / totalSize) * totalWidth, 1);

    ctx.fillStyle = seg.color;
    ctx.fillRect(drawX, y, segW, barH);

    ctx.strokeStyle = 'rgba(0,0,0,0.08)';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(drawX, y, segW, barH);

    if (segW > 50) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${seg.label} ${formatSize(seg.size)}`, drawX + segW / 2, y + barH / 2);
    } else if (segW > 20) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(seg.label, drawX + segW / 2, y + barH / 2);
    }

    drawX += segW;
  }

  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--vscode-descriptionForeground') || '#666';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`Total: ${formatSize(totalSize)}`, drawX + 6, y + barH / 2);
}

onMounted(() => {
  if (containerRef.value) {
    resizeObserver = new ResizeObserver(() => drawMemoryLayout());
    resizeObserver.observe(containerRef.value);
  }
  drawMemoryLayout();
});

onUnmounted(() => {
  resizeObserver?.disconnect();
});

watch(() => props.totals, () => nextTick(drawMemoryLayout), { deep: true });
</script>

<template>
  <div class="section">
    <h3 class="section-title">Memory Layout</h3>
    <div ref="containerRef" class="canvas-container">
      <canvas ref="canvasRef"></canvas>
    </div>
  </div>
</template>

<style scoped>
.section {
  margin-bottom: 20px;
}
.section-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 12px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--vscode-editorWidget-border, #ccc);
}
.canvas-container {
  width: 100%;
  overflow: hidden;
}
canvas {
  display: block;
}
</style>
```

- [ ] **Step 2: Commit**

```bash
git add webview/src/components/MemoryLayout.vue
git commit -m "feat: MemoryLayout canvas component"
```

---

### Task 12: ModuleBarChart Component

**Files:**
- Create: `webview/src/components/ModuleBarChart.vue`

- [ ] **Step 1: Create ModuleBarChart.vue**

```vue
<script setup lang="ts">
import { computed } from 'vue';
import { postMessage } from '../vscode';

const props = defineProps<{
  modules: { name: string; code: number; ro_data: number; rw_data: number; zi_data: number }[];
  highlight: string | null;
  topCount: number;
}>();

const sortedModules = computed(() => {
  return [...props.modules]
    .map(m => ({
      ...m,
      flashSize: m.code + m.ro_data + m.rw_data,
    }))
    .sort((a, b) => b.flashSize - a.flashSize)
    .slice(0, props.topCount);
});

const maxFlashSize = computed(() => {
  return sortedModules.value.length > 0 ? sortedModules.value[0].flashSize : 1;
});

function barPercent(flashSize: number): number {
  return maxFlashSize.value > 0 ? (flashSize / maxFlashSize.value) * 100 : 0;
}

function onModuleClick(moduleName: string) {
  postMessage({ type: 'moduleClicked', moduleName });
}
</script>

<template>
  <div class="section">
    <h3 class="section-title">Module Size (Top {{ topCount }})</h3>
    <div class="bar-list">
      <div
        v-for="mod in sortedModules"
        :key="mod.name"
        class="bar-item"
        :class="{ highlighted: highlight === mod.name }"
        @click="onModuleClick(mod.name)"
      >
        <div class="bar-label">{{ mod.name }}</div>
        <div class="bar-track">
          <div
            class="bar-fill"
            :style="{ width: barPercent(mod.flashSize) + '%' }"
          >
            <span v-if="barPercent(mod.flashSize) > 25" class="bar-value">
              {{ (mod.flashSize / 1024).toFixed(1) }}KB
            </span>
          </div>
          <span v-if="barPercent(mod.flashSize) <= 25" class="bar-value-outside">
            {{ (mod.flashSize / 1024).toFixed(1) }}KB
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.section {
  margin-bottom: 20px;
}
.section-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 12px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--vscode-editorWidget-border, #ccc);
}
.bar-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.bar-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 3px 6px;
  border-radius: 3px;
  cursor: pointer;
  transition: background 0.15s;
}
.bar-item:hover {
  background: var(--vscode-list-hoverBackground, rgba(0,0,0,0.05));
}
.bar-item.highlighted {
  background: var(--vscode-list-activeSelectionBackground, rgba(0,120,215,0.15));
  outline: 1px solid var(--vscode-focusBorder, #0078d4);
}
.bar-label {
  min-width: 180px;
  max-width: 180px;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bar-track {
  flex: 1;
  height: 20px;
  background: var(--vscode-editorWidget-background, #f0f0f0);
  border-radius: 3px;
  position: relative;
  overflow: hidden;
}
.bar-fill {
  height: 100%;
  background: linear-gradient(135deg, var(--vscode-charts-blue, #4A90D9), var(--vscode-charts-purple, #7B61FF));
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 2px;
  transition: width 0.3s ease;
}
.bar-value {
  font-size: 10px;
  color: #fff;
  font-weight: 600;
}
.bar-value-outside {
  font-size: 10px;
  color: var(--vscode-descriptionForeground, #999);
  margin-left: 4px;
  position: absolute;
  left: 100%;
  top: 50%;
  transform: translateY(-50%);
  white-space: nowrap;
}
</style>
```

- [ ] **Step 2: Commit**

```bash
git add webview/src/components/ModuleBarChart.vue
git commit -m "feat: ModuleBarChart component with click-to-highlight"
```

---

### Task 13: AddressLookup Component

**Files:**
- Create: `webview/src/components/AddressLookup.vue`

- [ ] **Step 1: Create AddressLookup.vue**

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { postMessage, onMessage } from '../vscode';

interface LookupResult {
  name: string;
  address: number;
  size: number;
  section: string;
  offset: number;
  isApproximate?: boolean;
}

const input = ref('');
const results = ref<(LookupResult | null)[]>([]);
const searched = ref(false);

function lookup() {
  const addresses = input.value
    .split(/[\n,;]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  if (addresses.length === 0) return;

  searched.value = true;
  postMessage({ type: 'requestAddressLookup', addresses });
}

onMessage((msg) => {
  if (msg.type === 'addressLookupResult') {
    results.value = msg.results;
  }
});

function formatHex(n: number): string {
  return '0x' + n.toString(16).toUpperCase().padStart(8, '0');
}
</script>

<template>
  <div class="section">
    <h3 class="section-title">Address Lookup</h3>
    <div class="lookup-input">
      <textarea
        v-model="input"
        placeholder="Enter addresses (one per line, e.g. 0x08000100)"
        rows="3"
        @keydown.ctrl.enter="lookup"
      ></textarea>
      <button @click="lookup">Lookup</button>
    </div>

    <div v-if="searched" class="results">
      <div v-if="results.length === 0" class="no-result">No results</div>
      <table v-else>
        <thead>
          <tr>
            <th>Name</th>
            <th>Address</th>
            <th>Size</th>
            <th>Section</th>
            <th>Offset</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(r, i) in results" :key="i">
            <template v-if="r">
              <td>{{ r.name }}</td>
              <td class="mono">{{ formatHex(r.address) }}</td>
              <td>{{ r.size }}B</td>
              <td>{{ r.section }}</td>
              <td class="mono">+{{ r.offset }}</td>
              <td>
                <span v-if="r.isApproximate" class="approx">~ Approx</span>
                <span v-else class="exact">Exact</span>
              </td>
            </template>
            <template v-else>
              <td colspan="6" class="no-match">No match found</td>
            </template>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.section {
  margin-bottom: 20px;
}
.section-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 12px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--vscode-editorWidget-border, #ccc);
}
.lookup-input {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}
textarea {
  flex: 1;
  background: var(--vscode-input-background, #fff);
  color: var(--vscode-input-foreground, #333);
  border: 1px solid var(--vscode-input-border, #ccc);
  border-radius: 3px;
  padding: 6px 8px;
  font-family: var(--vscode-editor-font-family, monospace);
  font-size: 12px;
  resize: vertical;
}
textarea:focus {
  outline: 1px solid var(--vscode-focusBorder, #0078d4);
  border-color: var(--vscode-focusBorder, #0078d4);
}
button {
  padding: 6px 16px;
  background: var(--vscode-button-background, #0078d4);
  color: var(--vscode-button-foreground, #fff);
  border: none;
  border-radius: 3px;
  cursor: pointer;
  font-size: 12px;
  align-self: flex-end;
}
button:hover {
  background: var(--vscode-button-hoverBackground, #106ebe);
}
.results table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
th, td {
  padding: 4px 8px;
  text-align: left;
  border-bottom: 1px solid var(--vscode-editorWidget-border, #eee);
}
th {
  font-weight: 600;
  color: var(--vscode-descriptionForeground, #999);
}
.mono {
  font-family: var(--vscode-editor-font-family, monospace);
}
.exact {
  color: var(--vscode-charts-green, #4CAF50);
}
.approx {
  color: var(--vscode-charts-orange, #FF9800);
}
.no-match {
  color: var(--vscode-errorForeground, #e53935);
  font-style: italic;
}
</style>
```

- [ ] **Step 2: Commit**

```bash
git add webview/src/components/AddressLookup.vue
git commit -m "feat: AddressLookup component with batch lookup support"
```

---

### Task 14: Wire Webview Components into App.vue

**Files:**
- Modify: `webview/src/App.vue`

- [ ] **Step 1: Update App.vue**

```vue
<script setup lang="ts">
import { useMapData, config } from './composables/useMapData';
import { useHighlight } from './composables/useHighlight';
import { onMessage } from './vscode';
import MemoryLayout from './components/MemoryLayout.vue';
import ModuleBarChart from './components/ModuleBarChart.vue';
import AddressLookup from './components/AddressLookup.vue';

const { mapData } = useMapData();
const { highlightModule, setHighlight } = useHighlight();

onMessage((msg) => {
  if (msg.type === 'highlightModule') {
    setHighlight(msg.moduleName);
  }
});
</script>

<template>
  <div class="map-analysis">
    <div v-if="!mapData" class="empty">
      <div class="empty-icon">&#128194;</div>
      <div>Waiting for MAP file data...</div>
    </div>

    <template v-else>
      <!-- Summary cards -->
      <div class="summary-bar">
        <div class="summary-card">
          <div class="summary-label">Format</div>
          <div class="summary-value">{{ mapData.formatType }}</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">Flash</div>
          <div class="summary-value flash">
            {{ (mapData.totals.flashUsed / 1024).toFixed(1) }}KB
            <span class="summary-sub">/ {{ (mapData.totals.flashTotal / 1024).toFixed(0) }}KB</span>
          </div>
        </div>
        <div class="summary-card">
          <div class="summary-label">RAM</div>
          <div class="summary-value ram">
            {{ (mapData.totals.ramUsed / 1024).toFixed(1) }}KB
            <span class="summary-sub">/ {{ (mapData.totals.ramTotal / 1024).toFixed(0) }}KB</span>
          </div>
        </div>
        <div class="summary-card">
          <div class="summary-label">Symbols</div>
          <div class="summary-value">{{ mapData.symbols.length }}</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">Modules</div>
          <div class="summary-value">{{ mapData.modules.length }}</div>
        </div>
      </div>

      <MemoryLayout
        :totals="mapData.totals"
        :warning-threshold="config.warningThreshold"
        :critical-threshold="config.criticalThreshold"
      />

      <ModuleBarChart
        :modules="mapData.modules"
        :highlight="highlightModule"
        :top-count="config.topModulesCount"
      />

      <AddressLookup />
    </template>
  </div>
</template>

<style>
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
  font-size: var(--vscode-font-size, 13px);
  color: var(--vscode-editor-foreground, #333);
  background: var(--vscode-editor-background, #fff);
  padding: 12px;
}

.map-analysis {
  max-width: 100%;
}

.empty {
  text-align: center;
  padding: 60px 20px;
  color: var(--vscode-descriptionForeground, #999);
}
.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.3;
}

.summary-bar {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 20px;
}
.summary-card {
  padding: 8px 14px;
  background: var(--vscode-editorWidget-background, #f5f5f5);
  border: 1px solid var(--vscode-editorWidget-border, #e0e0e0);
  border-radius: 4px;
  min-width: 90px;
  flex: 1;
}
.summary-label {
  font-size: 11px;
  color: var(--vscode-descriptionForeground, #999);
  margin-bottom: 2px;
}
.summary-value {
  font-size: 15px;
  font-weight: 600;
}
.summary-value.flash {
  color: var(--vscode-charts-green, #4CAF50);
}
.summary-value.ram {
  color: var(--vscode-charts-purple, #9C27B0);
}
.summary-sub {
  font-size: 11px;
  font-weight: 400;
  color: var(--vscode-descriptionForeground, #999);
}
</style>
```

- [ ] **Step 2: Rebuild webview**

```bash
cd webview && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add webview/src/App.vue
git commit -m "feat: wire all webview components into main App layout"
```

---

### Task 15: Build and Integration Test

**Files:**
- Modify: `package.json` (scripts)

- [ ] **Step 1: Install root dependencies**

```bash
npm install
```

- [ ] **Step 2: Build both extension and webview**

```bash
npm run build
```

Expected: `dist/extension.js` and `dist/webview/` created without errors.

- [ ] **Step 3: Run the extension in VSCode**

1. Open the project in VSCode
2. Press F5 to launch Extension Development Host
3. Open a .map file
4. Verify: TreeView appears in Explorer, Webview panel opens, data displays correctly

- [ ] **Step 4: Run parser tests**

```bash
npx vitest run
```

Expected: All tests PASS.

- [ ] **Step 5: Fix any build errors and commit**

```bash
git add -A
git commit -m "fix: resolve build issues and verify integration"
```

---

### Task 16: README and Documentation

**Files:**
- Create: `README.md`
- Create: `CHANGELOG.md`
- Create: `LICENSE`

- [ ] **Step 1: Create README.md**

```markdown
# EM Map View

A VSCode extension for analyzing Keil MDK .map files, designed for embedded developers.

## Features

- **Memory Layout Visualization** - Canvas-based Flash/RAM usage bar charts with color-coded segments
- **Module Size Analysis** - Horizontal bar chart showing top N modules by Flash consumption
- **Symbol Browser** - Searchable, filterable symbol list with type filtering (Code/Data/RO/RW/BSS)
- **Address Lookup** - Single or batch address reverse lookup with exact/approximate matching
- **Memory Warnings** - Configurable usage thresholds with visual indicators
- **TreeView Integration** - Native VSCode TreeView in Explorer sidebar
- **Raw File Access** - Original .map text remains visible in the editor

## Usage

1. Open a `.map` file generated by Keil MDK (armlink)
2. The extension automatically activates:
   - TreeView appears in the Explorer sidebar
   - Webview panel opens with visualizations
3. Use the TreeView to browse modules and symbols
4. Click modules in the bar chart to highlight them in the TreeView
5. Enter addresses in the lookup panel for reverse lookup

### Commands

| Command | Description |
|---------|-------------|
| `EM Map View: Open MAP File` | Open file picker and analyze |
| `EM Map View: Analyze Current File` | Analyze the active .map file |
| `EM Map View: Lookup Address` | Reverse address lookup |

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `emMapView.warningThreshold` | 80 | Memory usage warning threshold (%) |
| `emMapView.criticalThreshold` | 95 | Memory usage critical threshold (%) |
| `emMapView.topModulesCount` | 20 | Number of top modules in bar chart |

## Supported Formats

- **Keil MDK** (armlink) - Full support

Planned:
- GCC/ARM LD
- IAR

## Development

```bash
# Install dependencies
npm install
cd webview && npm install && cd ..

# Build
npm run build

# Run tests
npm test

# Launch extension in VSCode
# Press F5 in VSCode
```

## License

MIT
```

- [ ] **Step 2: Create CHANGELOG.md**

```markdown
# Changelog

## 0.1.0

- Initial release
- Keil MAP file parsing
- Memory layout visualization (Canvas)
- Module size bar chart
- Symbol browser with type filtering
- Address reverse lookup (single/batch)
- Memory usage warning thresholds
- TreeView sidebar integration
```

- [ ] **Step 3: Create LICENSE**

```
MIT License

Copyright (c) 2026

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 4: Create .vscodeignore**

```
.vscode/**
src/**
webview/**
test/**
node_modules/**
docs/**
*.ts
!dist/**
```

- [ ] **Step 5: Commit**

```bash
git add README.md CHANGELOG.md LICENSE .vscodeignore
git commit -m "docs: add README, changelog, license, and vscodeignore"
```
