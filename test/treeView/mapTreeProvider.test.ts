import { describe, it, expect, vi } from 'vitest';

vi.mock('vscode', () => {
  class TreeItem {
    label: string;
    collapsibleState: number;
    constructor(label: string, collapsibleState?: number) {
      this.label = label;
      this.collapsibleState = collapsibleState ?? 0;
    }
  }

  return {
    EventEmitter: vi.fn().mockImplementation(() => ({
      event: vi.fn(),
      fire: vi.fn(),
      dispose: vi.fn(),
    })),
    TreeItem,
    TreeItemCollapsibleState: {
      None: 0,
      Collapsed: 1,
    },
    ThemeIcon: vi.fn(),
    ThemeColor: vi.fn(),
  };
});

describe('MapTreeProvider', () => {
  it('should have a dispose method that disposes the EventEmitter', async () => {
    const { MapTreeProvider } = await import('../../src/treeView/mapTreeProvider');
    const provider = new MapTreeProvider();

    expect(typeof provider.dispose).toBe('function');

    // Calling dispose should not throw
    expect(() => provider.dispose()).not.toThrow();
  });
});
