import * as vscode from 'vscode';
import { TextDecoder } from 'util';
import { findSymbolByAddress, parseHexAddress, parseMapFile, MapParseResult } from './parser';
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

  const activeEditor = vscode.window.activeTextEditor;
  if (activeEditor && isMapDocument(activeEditor.document)) {
    analyzeMapContent(activeEditor.document.getText());
  }

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((document) => {
      if (isMapDocument(document)) {
        analyzeMapContent(document.getText());
      }
    })
  );

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('emMapView.openMapFile', async (uri?: vscode.Uri) => {
      if (uri) {
        await analyzeMapFile(uri);
      } else {
        const uris = await vscode.window.showOpenDialog({
          filters: { 'Map Files': ['map'] },
          canSelectMany: false,
        });
        if (uris?.[0]) {
          await analyzeMapFile(uris[0]);
        }
      }
    }),

    vscode.commands.registerCommand('emMapView.analyzeCurrentFile', async () => {
      const editor = vscode.window.activeTextEditor;
      if (editor && isMapDocument(editor.document)) {
        analyzeMapContent(editor.document.getText());
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
        const parsedAddr = parseHexAddress(addr);
        if (parsedAddr === null) {
          vscode.window.showWarningMessage(`Invalid hex address: ${addr}`);
          return;
        }

        const result = findSymbolByAddress(currentData.symbols, parsedAddr);
        webviewManager?.show(currentData);
        webviewManager?.lookupAddresses([addr]);

        if (result) {
          const offset = result.offset === 0 ? '' : ` + ${result.offset}`;
          const prefix = result.isApproximate ? 'Nearest symbol' : 'Symbol';
          vscode.window.showInformationMessage(
            `${prefix}: ${result.name}${offset} (0x${result.address.toString(16).toUpperCase().padStart(8, '0')})`
          );
        } else {
          vscode.window.showWarningMessage(`No symbol found for ${addr}`);
        }
      }
    }),

    vscode.commands.registerCommand('emMapView.selectModule', (moduleName: string) => {
      webviewManager?.highlightModule(moduleName);
    })
  );
}

async function analyzeMapFile(uri: vscode.Uri) {
  try {
    const bytes = await vscode.workspace.fs.readFile(uri);
    analyzeMapContent(new TextDecoder('utf-8').decode(bytes));
  } catch (err: unknown) {
    vscode.window.showErrorMessage(`MAP 文件读取失败: ${errorMessage(err)}`);
  }
}

function analyzeMapContent(content: string) {
  try {
    currentData = parseMapFile(content);

    if (currentData.modules.length === 0 && currentData.symbols.length === 0) {
      const format = currentData.formatType === 'Keil' ? 'Keil MDK' : currentData.formatType;
      currentData = null;
      vscode.commands.executeCommand('setContext', 'emMapView:hasData', false);
      treeProvider?.clear();
      webviewManager?.clear();
      vscode.window.showWarningMessage(`无法解析 ${format} MAP 文件：当前仅支持 Keil MDK 格式`);
      return;
    }

    vscode.commands.executeCommand('setContext', 'emMapView:hasData', true);
    treeProvider?.refresh(currentData);
    webviewManager?.show(currentData);
  } catch (err: unknown) {
    vscode.window.showErrorMessage(`MAP 文件解析失败: ${errorMessage(err)}`);
  }
}

function isMapDocument(document: vscode.TextDocument): boolean {
  return document.fileName.toLowerCase().endsWith('.map');
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function deactivate() {
  webviewManager?.dispose();
}
