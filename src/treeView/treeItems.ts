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
    this.iconPath = new vscode.ThemeIcon(symbol.type === '函数' ? 'symbol-method' : 'symbol-variable');
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
    this.command = { command: 'emMapView.lookupAddress', title: 'Lookup Address' };
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  return `${(bytes / 1024).toFixed(1)}KB`;
}
