# Source Provenance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show where every important MAP analysis value came from, including Official, Computed, Derived, Inferred, and Unavailable data.

**Architecture:** Keep existing numeric parser fields for compatibility and add a parallel `sources` metadata object to `MapParseResult`. Parser code assigns provenance while parsing; webview and tree view render badges and source-aware labels without changing the command/data flow.

**Tech Stack:** TypeScript, Vitest, Vue 3 single-file components, VSCode extension APIs.

---

## Source Vocabulary

- `official`: directly parsed from a Keil MAP section that declares the displayed value, such as Image Component Sizes, Grand Totals, Global Symbols, or Load/Execution Region Max.
- `computed`: calculated from official values with deterministic formulas, such as Flash Used = Code + RO Data + RW Data.
- `derived`: aggregated from a related but non-authoritative section, such as module/object contribution totals derived from Memory Map object rows when Component Sizes is missing.
- `inferred`: guessed from available usage data, such as synthetic FLASH/RAM capacity created by `inferMemoryRegions`.
- `unavailable`: not present and not safely derivable.

## File Structure

- Modify `src/parser/types.ts`: add `DataSourceKind`, `DataSource`, `MapTotalsSources`, and `MapSources`; add `sources` to `MapParseResult`.
- Modify `src/parser/keilParser.ts`: track source flags while parsing Component Sizes, Grand Totals, Memory Map regions, derived object rows, and inferred memory regions.
- Modify `src/parser/index.ts`: return `sources` for empty/unsupported parser results.
- Modify `src/treeView/mapTreeProvider.ts`: include compact source labels in summary rows.
- Modify `test/parser/keilParser.test.ts`: replace the old unmarked derived module test with source-aware parser tests.
- Modify `test/parser/index.test.ts`: assert unsupported formats expose unavailable sources.
- Modify `test/webview/webviewManager.test.ts`: update test fixture data with `sources`.
- Create `webview/src/sourceMetadata.ts`: shared helpers for source labels, CSS class names, and value formatting.
- Create `webview/src/components/SourceBadge.vue`: compact source badge with title tooltip.
- Modify `webview/src/composables/useMapData.ts`: add source metadata interfaces for webview data.
- Modify `webview/src/App.vue`: render summary badges and source-aware total formatting.
- Modify `webview/src/components/MemoryLayout.vue`: render legend badges and draw inferred totals honestly.
- Modify `webview/src/components/ModuleBarChart.vue`: render source badge in heading and keep Derived modules visible.
- Create `test/webview/sourceMetadata.test.ts`: test label/class formatting helpers.

---

### Task 1: Parser Source Metadata Tests

**Files:**
- Modify: `test/parser/keilParser.test.ts`
- Modify: `test/parser/index.test.ts`

- [ ] **Step 1: Write failing tests**

Add assertions that:

```ts
expect(result.sources.modules.kind).toBe('official');
expect(result.sources.totals.code.kind).toBe('official');
expect(result.sources.totals.flashUsed.kind).toBe('computed');
expect(result.sources.totals.flashTotal.kind).toBe('official');
```

For a Memory Map-only MAP:

```ts
expect(result.sources.modules.kind).toBe('derived');
expect(result.sources.totals.code.kind).toBe('derived');
expect(result.sources.totals.flashUsed.kind).toBe('derived');
expect(result.sources.totals.flashTotal.kind).toBe('official');
```

For Component Sizes-only input with no Memory Map regions:

```ts
expect(result.sources.memoryRegions.kind).toBe('inferred');
expect(result.sources.totals.flashTotal.kind).toBe('inferred');
expect(result.sources.totals.ramTotal.kind).toBe('inferred');
```

For unsupported GCC/IAR parse results:

```ts
expect(result.sources.modules.kind).toBe('unavailable');
expect(result.sources.totals.flashUsed.kind).toBe('unavailable');
```

- [ ] **Step 2: Run parser tests and verify RED**

Run:

```powershell
npm.cmd test -- test/parser/keilParser.test.ts test/parser/index.test.ts
```

Expected: FAIL because `sources` does not exist yet.

### Task 2: Parser Source Metadata Implementation

**Files:**
- Modify: `src/parser/types.ts`
- Modify: `src/parser/keilParser.ts`
- Modify: `src/parser/index.ts`
- Modify: `test/webview/webviewManager.test.ts`

- [ ] **Step 1: Add source types**

Add:

```ts
export type DataSourceKind = 'official' | 'computed' | 'derived' | 'inferred' | 'unavailable';

export interface DataSource {
  kind: DataSourceKind;
  label: string;
  detail?: string;
}

export interface MapTotalsSources {
  code: DataSource;
  roData: DataSource;
  rwData: DataSource;
  ziData: DataSource;
  flashTotal: DataSource;
  flashUsed: DataSource;
  ramTotal: DataSource;
  ramUsed: DataSource;
}

export interface MapSources {
  formatType: DataSource;
  symbols: DataSource;
  sections: DataSource;
  modules: DataSource;
  memoryRegions: DataSource;
  totals: MapTotalsSources;
}
```

- [ ] **Step 2: Track parser flags**

Track these booleans in `parseKeil`:

```ts
let hasComponentSizeModules = false;
let hasExplicitTotals = false;
let hasOfficialMemoryRegions = false;
let hasDerivedMemoryMapModules = false;
let usedInferredMemoryRegions = false;
```

- [ ] **Step 3: Assign source metadata**

Use these rules:

```ts
modules: hasComponentSizeModules ? official : hasDerivedMemoryMapModules ? derived : unavailable
symbols: symbols.length > 0 ? official : unavailable
sections: sections.length > 0 ? official : unavailable
memoryRegions: usedInferredMemoryRegions ? inferred : hasOfficialMemoryRegions ? official : unavailable
```

For totals:

```ts
code/roData/rwData/ziData:
  explicit totals -> official
  official modules aggregate -> computed
  derived modules aggregate -> derived
  sections fallback -> derived
  otherwise -> unavailable

flashUsed/ramUsed:
  explicit totals or official modules -> computed
  derived modules or section fallback -> derived
  region used fallback -> derived
  otherwise -> unavailable

flashTotal/ramTotal:
  official memory regions -> official
  inferred memory regions -> inferred
  otherwise -> unavailable
```

- [ ] **Step 4: Run parser tests and verify GREEN**

Run:

```powershell
npm.cmd test -- test/parser/keilParser.test.ts test/parser/index.test.ts
```

Expected: PASS.

### Task 3: Webview Source Helper Tests

**Files:**
- Create: `webview/src/sourceMetadata.ts`
- Create: `test/webview/sourceMetadata.test.ts`

- [ ] **Step 1: Write failing tests**

Test:

```ts
expect(sourceKindClass({ kind: 'derived', label: 'Derived' })).toBe('source-derived');
expect(sourceKindClass({ kind: 'inferred', label: 'Inferred' })).toBe('source-inferred');
expect(formatSourceLabel({ kind: 'unavailable', label: 'Unavailable' })).toBe('N/A');
```

- [ ] **Step 2: Run source helper test and verify RED**

Run:

```powershell
npm.cmd test -- test/webview/sourceMetadata.test.ts
```

Expected: FAIL because helper module does not exist.

- [ ] **Step 3: Implement helpers**

Create helpers:

```ts
export function sourceKindClass(source: DataSource | undefined): string {
  return `source-${source?.kind ?? 'unavailable'}`;
}

export function formatSourceLabel(source: DataSource | undefined): string {
  if (!source || source.kind === 'unavailable') return 'N/A';
  return source.label;
}
```

- [ ] **Step 4: Run source helper test and verify GREEN**

Run:

```powershell
npm.cmd test -- test/webview/sourceMetadata.test.ts
```

Expected: PASS.

### Task 4: Webview Rendering

**Files:**
- Modify: `webview/src/composables/useMapData.ts`
- Create: `webview/src/components/SourceBadge.vue`
- Modify: `webview/src/App.vue`
- Modify: `webview/src/components/MemoryLayout.vue`
- Modify: `webview/src/components/ModuleBarChart.vue`

- [ ] **Step 1: Add webview types**

Mirror the parser source interfaces in `useMapData.ts` so Vue props are typed.

- [ ] **Step 2: Add SourceBadge**

Render a small badge:

```vue
<span class="source-badge" :class="sourceKindClass(source)" :title="source?.detail || source?.label">
  {{ formatSourceLabel(source) }}
</span>
```

- [ ] **Step 3: Update summary cards**

Each card gets a badge:

```vue
<SourceBadge :source="mapData.sources.modules" />
```

Modules card displays `N/A` only when `modules.kind === 'unavailable'`; Derived modules still display the count.

- [ ] **Step 4: Update MemoryLayout**

Pass `sources.totals` and display small legend rows:

```text
FLASH: Computed usage / Official capacity
RAM: Computed usage / Inferred capacity
```

Canvas still draws inferred totals, but the legend makes the inference explicit.

- [ ] **Step 5: Update ModuleBarChart**

Heading becomes:

```text
Module Size (Top 20) [Official|Derived|N/A]
```

If `unavailable`, show an empty state instead of an empty bar list.

### Task 5: Tree View Source Labels

**Files:**
- Modify: `src/treeView/mapTreeProvider.ts`

- [ ] **Step 1: Add compact source labels**

Tree rows should read like:

```text
Flash: 50.3KB / 64KB (78.6%) [Computed / Official]
RAM: 20.0KB / 20KB (100.0%) [Computed / Inferred]
Modules: 63 [Derived]
```

- [ ] **Step 2: Keep module children visible**

Derived modules remain sortable and clickable because the user asked for Derived data to display.

### Task 6: Final Verification

**Files:**
- All modified files.

- [ ] **Step 1: Run full test suite**

Run:

```powershell
npm.cmd test
```

Expected: all tests pass.

- [ ] **Step 2: Run type/lint check**

Run:

```powershell
npm.cmd run lint
```

Expected: exit code 0.

- [ ] **Step 3: Run build**

Run:

```powershell
npm.cmd run build
```

Expected: extension and webview build successfully.

- [ ] **Step 4: Review diff**

Run:

```powershell
git diff -- src/parser src/treeView webview/src test docs/superpowers/plans/2026-05-28-source-provenance.md
```

Expected: diff only contains source provenance changes.
