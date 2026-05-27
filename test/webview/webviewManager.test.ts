import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MapParseResult } from '../../src/parser';

type MessageHandler = (msg: any) => void;

let messageHandler: MessageHandler | undefined;

const postMessage = vi.fn();
const reveal = vi.fn();
const executeCommand = vi.fn();
const onDidReceiveMessage = vi.fn((handler: MessageHandler) => {
  messageHandler = handler;
  return { dispose: vi.fn() };
});

const panel = {
  webview: {
    html: '',
    postMessage,
    onDidReceiveMessage,
    asWebviewUri: vi.fn((uri: unknown) => uri),
  },
  onDidDispose: vi.fn(),
  reveal,
  dispose: vi.fn(),
};

vi.mock('vscode', () => ({
  window: {
    createWebviewPanel: vi.fn(() => panel),
  },
  workspace: {
    getConfiguration: vi.fn(() => ({
      get: vi.fn((_key: string, fallback: number) => fallback),
    })),
  },
  commands: {
    executeCommand,
  },
  Uri: {
    joinPath: vi.fn((_base: unknown, ...parts: string[]) => ({ parts })),
  },
  ViewColumn: {
    Beside: 2,
  },
}));

const unavailable = {
  kind: 'unavailable' as const,
  label: 'Unavailable',
};

const official = {
  kind: 'official' as const,
  label: 'Official',
};

const computed = {
  kind: 'computed' as const,
  label: 'Computed',
};

function makeData(name: string, address: number): MapParseResult {
  return {
    formatType: 'Keil',
    symbols: [
      {
        name,
        address,
        size: 16,
        section: '.text',
        type: '函数',
        scope: 'Global',
      },
    ],
    sections: [],
    modules: [],
    memoryRegions: [],
    totals: {
      code: 0,
      roData: 0,
      rwData: 0,
      ziData: 0,
      flashTotal: 0,
      flashUsed: 0,
      ramTotal: 0,
      ramUsed: 0,
    },
    sources: {
      formatType: official,
      symbols: official,
      sections: unavailable,
      modules: unavailable,
      memoryRegions: unavailable,
      totals: {
        code: unavailable,
        roData: unavailable,
        rwData: unavailable,
        ziData: unavailable,
        flashTotal: unavailable,
        flashUsed: computed,
        ramTotal: unavailable,
        ramUsed: computed,
      },
    },
  };
}

describe('WebviewManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    messageHandler = undefined;
    panel.webview.html = '';
  });

  it('uses the latest shown data for address lookup after panel reuse', async () => {
    const { WebviewManager } = await import('../../src/webview/webviewManager');
    const manager = new WebviewManager({} as any);

    manager.show(makeData('first_map_symbol', 0x08000000));
    manager.show(makeData('second_map_symbol', 0x20000000));

    messageHandler?.({ type: 'requestAddressLookup', addresses: ['0x20000004'] });

    const lookupMessage = postMessage.mock.calls
      .map(([msg]) => msg)
      .find(msg => msg.type === 'addressLookupResult');

    expect(lookupMessage.results[0].name).toBe('second_map_symbol');
  });

  it('responds to ready without revealing the panel again', async () => {
    const { WebviewManager } = await import('../../src/webview/webviewManager');
    const manager = new WebviewManager({} as any);

    manager.show(makeData('loaded_symbol', 0x08000000));
    reveal.mockClear();
    postMessage.mockClear();

    messageHandler?.({ type: 'ready' });

    expect(reveal).not.toHaveBeenCalled();
    expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'updateData' }));
  });
});
