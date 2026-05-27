import { describe, expect, it } from 'vitest';
import { formatSourceLabel, formatSourceTitle, sourceKindClass } from '../../webview/src/sourceMetadata';

describe('source metadata helpers', () => {
  it('formats source labels for display', () => {
    expect(formatSourceLabel({ kind: 'official', label: 'Official' })).toBe('Official');
    expect(formatSourceLabel({ kind: 'computed', label: 'Computed' })).toBe('Computed');
    expect(formatSourceLabel({ kind: 'derived', label: 'Derived' })).toBe('Derived');
    expect(formatSourceLabel({ kind: 'inferred', label: 'Inferred' })).toBe('Inferred');
    expect(formatSourceLabel({ kind: 'unavailable', label: 'Unavailable' })).toBe('N/A');
    expect(formatSourceLabel(undefined)).toBe('N/A');
  });

  it('maps source kinds to stable css classes', () => {
    expect(sourceKindClass({ kind: 'derived', label: 'Derived' })).toBe('source-derived');
    expect(sourceKindClass({ kind: 'inferred', label: 'Inferred' })).toBe('source-inferred');
    expect(sourceKindClass(undefined)).toBe('source-unavailable');
  });

  it('uses detail as tooltip text when available', () => {
    expect(formatSourceTitle({
      kind: 'derived',
      label: 'Derived',
      detail: 'Aggregated from Memory Map object rows.'
    })).toBe('Derived: Aggregated from Memory Map object rows.');
    expect(formatSourceTitle({ kind: 'computed', label: 'Computed' })).toBe('Computed');
    expect(formatSourceTitle(undefined)).toBe('Unavailable');
  });
});
