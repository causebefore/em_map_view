import * as vscode from 'vscode';
import { DataSource, MapParseResult } from '../parser/types';
import { getConfig } from '../config';
import { MapTreeItem, SummaryItem, ModuleItem, ModuleDetailItem, SymbolItem, MemoryRegionItem, AddressLookupItem } from './treeItems';
import { SymbolFilterManager } from './symbolFilter';

export class MapTreeProvider implements vscode.TreeDataProvider<MapTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<MapTreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  dispose(): void {
    this._onDidChangeTreeData.dispose();
  }

  private data: MapParseResult | null = null;
  readonly filter = new SymbolFilterManager();
  private sortMode: 'flash' | 'code' | 'name' | 'ram' = 'flash';

  refresh(data: MapParseResult): void {
    this.data = data;
    this._onDidChangeTreeData.fire(undefined);
  }

  clear(): void {
    this.data = null;
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: MapTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: MapTreeItem): MapTreeItem[] {
    if (!this.data) return [];

    if (!element) {
      return [
        new SummaryItem(`Format: ${this.data.formatType} [${sourceLabel(this.data.sources.formatType)}]`),
        new SummaryItem(`Flash: ${formatBytes(this.data.totals.flashUsed)} / ${formatBytes(this.data.totals.flashTotal)} (${percent(this.data.totals.flashUsed, this.data.totals.flashTotal)}) [${sourceLabel(this.data.sources.totals.flashUsed)} / ${sourceLabel(this.data.sources.totals.flashTotal)}]`),
        new SummaryItem(`RAM: ${formatBytes(this.data.totals.ramUsed)} / ${formatBytes(this.data.totals.ramTotal)} (${percent(this.data.totals.ramUsed, this.data.totals.ramTotal)}) [${sourceLabel(this.data.sources.totals.ramUsed)} / ${sourceLabel(this.data.sources.totals.ramTotal)}]`),
        new SummaryItem(`Symbols: ${this.data.symbols.length} [${sourceLabel(this.data.sources.symbols)}]`),
        new SummaryItem(`Modules: ${moduleCountLabel(this.data)} [${sourceLabel(this.data.sources.modules)}]`),
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
    const filtered = this.data.symbols.filter(s => this.filter.matches(s.type, s.section));
    return filtered.slice(0, 500).map(s => new SymbolItem(s));
  }

  private getRegionItems(): MapTreeItem[] {
    if (!this.data) return [];
    const config = getConfig();
    return this.data.memoryRegions.map(r => new MemoryRegionItem(r, config.warningThreshold, config.criticalThreshold));
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

function sourceLabel(source: DataSource): string {
  return source.kind === 'unavailable' ? 'N/A' : source.label;
}

function moduleCountLabel(data: MapParseResult): string {
  return data.sources.modules.kind === 'unavailable' ? 'N/A' : String(data.modules.length);
}
