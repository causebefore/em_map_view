import { beforeEach, describe, expect, it, vi } from 'vitest';

type CommandHandler = (...args: any[]) => unknown;

const commandHandlers: Record<string, CommandHandler> = {};
const treeProviderInstances: Array<{ refresh: ReturnType<typeof vi.fn>; clear: ReturnType<typeof vi.fn> }> = [];
const webviewManagerInstances: Array<{
  setData: ReturnType<typeof vi.fn>;
  show: ReturnType<typeof vi.fn>;
  clear: ReturnType<typeof vi.fn>;
  refreshConfig: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
  lookupAddresses: ReturnType<typeof vi.fn>;
  highlightModule: ReturnType<typeof vi.fn>;
}> = [];

let activeTextEditor: any;
let changeActiveEditorHandler: ((editor: any) => void) | undefined;
let changeTextDocumentHandler: ((event: { document: any }) => void) | undefined;
let changeConfigurationHandler: ((event: { affectsConfiguration: (section: string) => boolean }) => void) | undefined;

const executeCommand = vi.fn();
const registerCommand = vi.fn((command: string, handler: CommandHandler) => {
  commandHandlers[command] = handler;
  return { dispose: vi.fn() };
});
const registerTreeDataProvider = vi.fn(() => ({ dispose: vi.fn() }));
const showWarningMessage = vi.fn();
const showErrorMessage = vi.fn();
const showOpenDialog = vi.fn();
const showInputBox = vi.fn();
const openTextDocument = vi.fn();

const parseMapFile = vi.fn();
const findSymbolByAddress = vi.fn();
const parseHexAddress = vi.fn();

const MapTreeProvider = vi.fn().mockImplementation(() => {
  const instance = {
    refresh: vi.fn(),
    clear: vi.fn(),
  };
  treeProviderInstances.push(instance);
  return instance;
});

const WebviewManager = vi.fn().mockImplementation(() => {
  const instance = {
    setData: vi.fn(),
    show: vi.fn(),
    clear: vi.fn(),
    refreshConfig: vi.fn(),
    dispose: vi.fn(),
    lookupAddresses: vi.fn(),
    highlightModule: vi.fn(),
  };
  webviewManagerInstances.push(instance);
  return instance;
});

vi.mock('vscode', () => ({
  commands: {
    executeCommand,
    registerCommand,
  },
  window: {
    get activeTextEditor() {
      return activeTextEditor;
    },
    registerTreeDataProvider,
    onDidChangeActiveTextEditor: vi.fn((handler: (editor: any) => void) => {
      changeActiveEditorHandler = handler;
      return { dispose: vi.fn() };
    }),
    showWarningMessage,
    showErrorMessage,
    showOpenDialog,
    showInputBox,
  },
  workspace: {
    onDidChangeTextDocument: vi.fn((handler: (event: { document: any }) => void) => {
      changeTextDocumentHandler = handler;
      return { dispose: vi.fn() };
    }),
    onDidChangeConfiguration: vi.fn((handler: (event: { affectsConfiguration: (section: string) => boolean }) => void) => {
      changeConfigurationHandler = handler;
      return { dispose: vi.fn() };
    }),
    openTextDocument,
  },
}));

vi.mock('../../src/parser', () => ({
  parseMapFile,
  findSymbolByAddress,
  parseHexAddress,
}));

vi.mock('../../src/treeView/mapTreeProvider', () => ({
  MapTreeProvider,
}));

vi.mock('../../src/webview/webviewManager', () => ({
  WebviewManager,
}));

function makeParseResult(name: string) {
  return {
    formatType: 'Keil',
    symbols: [{ name }],
    modules: [{ name: `${name}.o` }],
  };
}

function makeDocument(fileName: string, text: string) {
  const getText = vi.fn(() => text);
  return {
    fileName,
    uri: {
      toString: () => `file:///${fileName}`,
    },
    getText,
  };
}

function makeContext() {
  return {
    extensionUri: {} as any,
    subscriptions: [] as any[],
  };
}

describe('extension activation flow', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    activeTextEditor = undefined;
    changeActiveEditorHandler = undefined;
    changeTextDocumentHandler = undefined;
    changeConfigurationHandler = undefined;

    Object.keys(commandHandlers).forEach((command) => delete commandHandlers[command]);
    treeProviderInstances.length = 0;
    webviewManagerInstances.length = 0;

    showOpenDialog.mockResolvedValue(undefined);
    showInputBox.mockResolvedValue(undefined);
    openTextDocument.mockReset();
    parseMapFile.mockReset();
    findSymbolByAddress.mockReset();
    parseHexAddress.mockReset();
  });

  it('tracks active map editors and refreshes config-driven UI', async () => {
    const firstDocument = makeDocument('first.map', 'FIRST');
    const secondDocument = makeDocument('second.map', 'SECOND');
    const firstResult = makeParseResult('first');
    const secondResult = makeParseResult('second');

    activeTextEditor = { document: firstDocument };
    parseMapFile
      .mockReturnValueOnce(firstResult)
      .mockReturnValueOnce(secondResult);

    const { activate } = await import('../../src/extension');
    activate(makeContext() as any);

    const treeProvider = treeProviderInstances[0];
    const webviewManager = webviewManagerInstances[0];

    expect(treeProvider.refresh).toHaveBeenCalledWith(firstResult);
    expect(webviewManager.setData).toHaveBeenCalledWith(firstResult);
    expect(webviewManager.show).not.toHaveBeenCalled();

    changeActiveEditorHandler?.({ document: secondDocument });

    expect(treeProvider.refresh).toHaveBeenLastCalledWith(secondResult);
    expect(webviewManager.setData).toHaveBeenLastCalledWith(secondResult);

    changeConfigurationHandler?.({
      affectsConfiguration: (section: string) => section === 'emMapView',
    });

    expect(treeProvider.refresh).toHaveBeenLastCalledWith(secondResult);
    expect(webviewManager.refreshConfig).toHaveBeenCalledTimes(1);
  });

  it('uses VS Code text documents for openMapFile command', async () => {
    const loadedDocument = makeDocument('command.map', 'COMMAND');
    const parsed = makeParseResult('command');

    parseMapFile.mockReturnValue(parsed);
    openTextDocument.mockResolvedValue(loadedDocument);

    const { activate } = await import('../../src/extension');
    activate(makeContext() as any);

    await commandHandlers['emMapView.openMapFile'](loadedDocument.uri);

    const treeProvider = treeProviderInstances[0];
    const webviewManager = webviewManagerInstances[0];

    expect(openTextDocument).toHaveBeenCalledWith(loadedDocument.uri);
    expect(treeProvider.refresh).toHaveBeenLastCalledWith(parsed);
    expect(webviewManager.setData).toHaveBeenLastCalledWith(parsed);
    expect(webviewManager.show).toHaveBeenCalledWith(parsed);
  });

  it('clears stale data on parse failure and can recover on the next change', async () => {
    const document = makeDocument('recoverable.map', 'INITIAL');
    const initialResult = makeParseResult('initial');
    const recoveredResult = makeParseResult('recovered');

    activeTextEditor = { document };
    parseMapFile.mockReturnValueOnce(initialResult);

    const { activate } = await import('../../src/extension');
    activate(makeContext() as any);

    const treeProvider = treeProviderInstances[0];
    const webviewManager = webviewManagerInstances[0];

    parseMapFile.mockImplementationOnce(() => {
      throw new Error('boom');
    });

    changeTextDocumentHandler?.({ document });

    expect(treeProvider.clear).toHaveBeenCalledTimes(1);
    expect(webviewManager.clear).toHaveBeenCalledTimes(1);
    expect(showErrorMessage).toHaveBeenCalledWith('MAP 文件解析失败: boom');
    expect(executeCommand).toHaveBeenLastCalledWith('setContext', 'emMapView:hasData', false);

    document.getText.mockReturnValue('RECOVERED');
    parseMapFile.mockReturnValueOnce(recoveredResult);

    changeTextDocumentHandler?.({ document });

    expect(treeProvider.refresh).toHaveBeenLastCalledWith(recoveredResult);
    expect(webviewManager.setData).toHaveBeenLastCalledWith(recoveredResult);
  });
});
