import * as vscode from 'vscode';
import { MapParseResult } from '../parser/types';
import { findSymbolByAddress, parseHexAddress } from '../parser';
import { getWebviewHtml } from './html';
import { getConfig } from '../config';

export class WebviewManager {
  private panel: vscode.WebviewPanel | undefined;
  private currentData: MapParseResult | undefined;

  constructor(private readonly extensionUri: vscode.Uri) {}

  show(data: MapParseResult): void {
    const dataChanged = this.currentData !== data;
    this.currentData = data;

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
        this.handleMessage(msg);
      });

      this.panel.onDidDispose(() => {
        this.panel = undefined;
      });
    }

    if (dataChanged) {
      this.postResetTransientState();
    }
    this.postCurrentData();

    this.panel.reveal(vscode.ViewColumn.Beside, true);
  }

  setData(data: MapParseResult): void {
    const dataChanged = this.currentData !== data;
    this.currentData = data;

    if (!this.panel) {
      return;
    }

    if (dataChanged) {
      this.postResetTransientState();
    }
    this.postCurrentData();
  }

  lookupAddresses(addresses: string[]): void {
    const data = this.currentData;
    if (!data) return;

    const results = addresses.map(addrStr => {
      const addr = parseHexAddress(addrStr);
      if (addr === null) return null;
      return findSymbolByAddress(data.symbols, addr);
    });
    this.panel?.webview.postMessage({ type: 'addressLookupResult', addresses, results });
  }

  clear(): void {
    this.currentData = undefined;
    this.postResetTransientState();
    this.panel?.webview.postMessage({ type: 'updateData', data: null });
  }

  refreshConfig(): void {
    if (!this.panel) {
      return;
    }
    this.postConfig();
  }

  highlightModule(moduleName: string): void {
    this.panel?.webview.postMessage({ type: 'highlightModule', moduleName });
  }

  private handleMessage(msg: any): void {
    if (!msg || typeof msg !== 'object') return;
    switch (msg.type) {
      case 'ready':
        this.postCurrentData();
        break;
      case 'requestAddressLookup': {
        const addresses: unknown[] = Array.isArray(msg.addresses) ? msg.addresses : [];
        this.lookupAddresses(addresses.filter((addr): addr is string => typeof addr === 'string'));
        break;
      }
      case 'moduleClicked': {
        if (typeof msg.moduleName === 'string' && msg.moduleName.length > 0) {
          vscode.commands.executeCommand('emMapView.selectModule', msg.moduleName);
        }
        break;
      }
    }
  }

  private postCurrentData(): void {
    if (!this.panel || !this.currentData) return;

    this.panel.webview.postMessage({ type: 'updateData', data: this.currentData });
    this.postConfig();
  }

  private postConfig(): void {
    if (!this.panel) {
      return;
    }

    const config = getConfig();
    this.panel.webview.postMessage({
      type: 'config',
      warningThreshold: config.warningThreshold,
      criticalThreshold: config.criticalThreshold,
      topModulesCount: config.topModulesCount,
    });
  }

  private postResetTransientState(): void {
    this.panel?.webview.postMessage({ type: 'resetTransientState' });
  }

  dispose(): void {
    this.panel?.dispose();
  }
}
