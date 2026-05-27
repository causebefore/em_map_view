import * as vscode from 'vscode';
import * as fs from 'fs';
import { parseMapFile, MapParseResult } from './parser';
import { getConfig } from './config';

let currentData: MapParseResult | null = null;

export function activate(context: vscode.ExtensionContext) {
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
        // Handled by webview
      }
    }),

    vscode.commands.registerCommand('emMapView.selectModule', (moduleName: string) => {
      // Will be wired to webview in Task 9
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
    // TreeView and Webview will be wired in Task 9
  } catch (err: any) {
    vscode.window.showErrorMessage(`Failed to parse MAP file: ${err.message}`);
  }
}

export function deactivate() {}
