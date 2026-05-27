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

    this.postCurrentData();

    this.panel.reveal(vscode.ViewColumn.Beside, true);
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
    this.panel?.webview.postMessage({ type: 'updateData', data: null });
  }

  highlightModule(moduleName: string): void {
    this.panel?.webview.postMessage({ type: 'highlightModule', moduleName });
  }

  private handleMessage(msg: any): void {
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
        vscode.commands.executeCommand('emMapView.selectModule', msg.moduleName);
        break;
      }
    }
  }

  private postCurrentData(): void {
    if (!this.panel || !this.currentData) return;

    const config = getConfig();
    this.panel.webview.postMessage({ type: 'updateData', data: this.currentData });
    this.panel.webview.postMessage({
      type: 'config',
      warningThreshold: config.warningThreshold,
      criticalThreshold: config.criticalThreshold,
      topModulesCount: config.topModulesCount,
    });
  }

  dispose(): void {
    this.panel?.dispose();
  }
}
