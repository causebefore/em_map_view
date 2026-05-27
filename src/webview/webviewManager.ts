import * as vscode from 'vscode';
import { MapParseResult } from '../parser/types';
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
    this.panel.webview.postMessage({ type: 'updateData', data });
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
        this.show(data);
        break;
      case 'requestAddressLookup': {
        const addresses: string[] = msg.addresses || [];
        const results = addresses.map(addrStr => {
          const addr = parseInt(addrStr.replace(/^0x/i, ''), 16);
          if (isNaN(addr)) return null;
          return findSymbolByAddress(data.symbols, addr);
        });
        this.panel?.webview.postMessage({ type: 'addressLookupResult', results });
        break;
      }
      case 'moduleClicked': {
        vscode.commands.executeCommand('emMapView.selectModule', msg.moduleName);
        break;
      }
    }
  }

  dispose(): void {
    this.panel?.dispose();
  }
}
