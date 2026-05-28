import * as vscode from 'vscode';
import { findSymbolByAddress, parseHexAddress, parseMapFile, MapParseResult } from './parser';
import { MapTreeProvider } from './treeView/mapTreeProvider';
import { WebviewManager } from './webview/webviewManager';

let currentData: MapParseResult | null = null;
let currentMapDocumentUri: string | null = null;
let treeProvider: MapTreeProvider | undefined;
let webviewManager: WebviewManager | undefined;

export function activate(context: vscode.ExtensionContext) {
  clearAnalysisResult();

  // Initialize TreeView
  treeProvider = new MapTreeProvider();
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('emMapView.analysis', treeProvider)
  );

  // Initialize WebviewManager
  webviewManager = new WebviewManager(context.extensionUri);
  context.subscriptions.push(webviewManager);

  syncActiveEditor(vscode.window.activeTextEditor);

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      syncActiveEditor(editor);
    }),

    vscode.workspace.onDidChangeTextDocument((event) => {
      if (
        currentMapDocumentUri &&
        event.document.uri.toString() === currentMapDocumentUri &&
        isMapDocument(event.document)
      ) {
        analyzeDocument(event.document, { revealWebview: false });
      }
    }),

    vscode.workspace.onDidChangeConfiguration((event) => {
      if (!event.affectsConfiguration('emMapView') || !currentData) {
        return;
      }
      treeProvider?.refresh(currentData);
      webviewManager?.refreshConfig();
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
        analyzeDocument(editor.document, { revealWebview: true });
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

function syncActiveEditor(editor: vscode.TextEditor | undefined): void {
  if (editor && isMapDocument(editor.document)) {
    analyzeDocument(editor.document, { revealWebview: false });
  }
}

async function analyzeMapFile(uri: vscode.Uri) {
  try {
    const document = await vscode.workspace.openTextDocument(uri);
    analyzeDocument(document, { revealWebview: true });
  } catch (err: unknown) {
    clearAnalysisResult();
    vscode.window.showErrorMessage(`MAP 文件读取失败: ${errorMessage(err)}`);
  }
}

function analyzeDocument(document: vscode.TextDocument, options: { revealWebview: boolean }): void {
  currentMapDocumentUri = document.uri.toString();
  analyzeMapContent(document.getText(), options);
}

function analyzeMapContent(content: string, options: { revealWebview: boolean }) {
  try {
    const parsed = parseMapFile(content);

    if (parsed.modules.length === 0 && parsed.symbols.length === 0) {
      const format = parsed.formatType === 'Unknown' ? '未知'
        : parsed.formatType === 'Keil' ? 'Keil MDK'
        : parsed.formatType;
      clearAnalysisResult();
      vscode.window.showWarningMessage(`无法解析 ${format} MAP 文件：当前仅支持 Keil MDK 格式`);
      return;
    }

    currentData = parsed;
    void vscode.commands.executeCommand('setContext', 'emMapView:hasData', true);
    treeProvider?.refresh(parsed);
    webviewManager?.setData(parsed);
    if (options.revealWebview) {
      webviewManager?.show(parsed);
    }
  } catch (err: unknown) {
    clearAnalysisResult();
    vscode.window.showErrorMessage(`MAP 文件解析失败: ${errorMessage(err)}`);
  }
}

function clearAnalysisResult(): void {
  currentData = null;
  void vscode.commands.executeCommand('setContext', 'emMapView:hasData', false);
  treeProvider?.clear();
  webviewManager?.clear();
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
