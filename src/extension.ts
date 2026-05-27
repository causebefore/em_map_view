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
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('emMapView.analysis', treeProvider)
  );

  // Initialize WebviewManager
  webviewManager = new WebviewManager(context.extensionUri);
  context.subscriptions.push(webviewManager);

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('emMapView.openMapFile', async (uri?: vscode.Uri) => {
      if (uri) {
        // Right-clicked on a file in Explorer
        const doc = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(doc);
        analyzeMapFile(uri);
      } else {
        // No file selected, show file picker
        const uris = await vscode.window.showOpenDialog({
          filters: { 'Map Files': ['map'] },
          canSelectMany: false,
        });
        if (uris?.[0]) {
          const doc = await vscode.workspace.openTextDocument(uris[0]);
          await vscode.window.showTextDocument(doc);
          analyzeMapFile(uris[0]);
        }
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
      }
    }),

    vscode.commands.registerCommand('emMapView.selectModule', (moduleName: string) => {
      webviewManager?.highlightModule(moduleName);
    })
  );
}

function analyzeMapFile(uri: vscode.Uri) {
  try {
    const content = fs.readFileSync(uri.fsPath, 'utf-8');
    currentData = parseMapFile(content);

    if (currentData.modules.length === 0 && currentData.symbols.length === 0) {
      vscode.window.showWarningMessage('无法识别此 MAP 文件，请确认是 Keil MDK 生成的 .map 文件');
      return;
    }

    vscode.commands.executeCommand('setContext', 'emMapView:hasData', true);
    treeProvider?.refresh(currentData);
    webviewManager?.show(currentData);
  } catch (err: any) {
    vscode.window.showErrorMessage(`MAP 文件解析失败: ${err.message}`);
  }
}

export function deactivate() {
  webviewManager?.dispose();
}
