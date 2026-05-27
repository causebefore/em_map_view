import { MapParseResult, SymbolLookupResult, MapSymbol, MapSources } from './types';
import { parseKeil } from './keilParser';
import { findSymbolByAddress, parseHexAddress } from './symbolLookup';

export { findSymbolByAddress, parseHexAddress };
export type { MapParseResult, MapSymbol, SymbolLookupResult, MapModule, MemoryRegion, MapTotals, MapSection, DataSource, DataSourceKind, MapSources, MapTotalsSources } from './types';

function emptySources(format: 'Keil' | 'GCC' | 'IAR'): MapSources {
  const unavailable = {
    kind: 'unavailable' as const,
    label: 'Unavailable',
    detail: 'This value was not available from the parsed MAP data.'
  };
  return {
    formatType: {
      kind: format === 'Keil' ? 'unavailable' : 'official',
      label: format === 'Keil' ? 'Unavailable' : 'Detected',
      detail: format === 'Keil'
        ? 'No MAP format could be detected.'
        : `Detected ${format} format, but only Keil MDK parsing is currently supported.`
    },
    symbols: unavailable,
    sections: unavailable,
    modules: unavailable,
    memoryRegions: unavailable,
    totals: {
      code: unavailable,
      roData: unavailable,
      rwData: unavailable,
      ziData: unavailable,
      flashTotal: unavailable,
      flashUsed: unavailable,
      ramTotal: unavailable,
      ramUsed: unavailable
    }
  };
}

export function detectFormat(content: string): 'Keil' | 'GCC' | 'IAR' | null {
  if (!content || typeof content !== 'string') return null;

  const header = content.slice(0, 128 * 1024);

  if (/ARM\s+LINKER|ARM\s+COMPILER[\s\S]{0,200}\bARMLINK\b|\bARMLINK\b|COMPONENT\s+SIZES/i.test(header)) {
    return 'Keil';
  }

  if (/IAR\s+LINKER/i.test(header) || (/ENTRY/i.test(header) && /MODULE/i.test(header) && /ADDRESS/i.test(header))) {
    return 'IAR';
  }

  if (/MEMORY\s+CONFIGURATION|GNU\s+LD/i.test(header)) {
    return 'GCC';
  }

  return null;
}

export function parseMapFile(content: string): MapParseResult {
  if (!content || typeof content !== 'string') {
    return {
      formatType: 'Keil',
      symbols: [],
      sections: [],
      modules: [],
      memoryRegions: [],
      totals: { code: 0, roData: 0, rwData: 0, ziData: 0, flashTotal: 0, flashUsed: 0, ramTotal: 0, ramUsed: 0 },
      sources: emptySources('Keil'),
    };
  }

  const format = detectFormat(content);

  if (format === 'Keil') {
    return parseKeil(content);
  }

  // Only Keil is parsed for now; preserve detected format for honest UI state.
  return {
    formatType: format ?? 'Keil',
    symbols: [],
    sections: [],
    modules: [],
    memoryRegions: [],
    totals: { code: 0, roData: 0, rwData: 0, ziData: 0, flashTotal: 0, flashUsed: 0, ramTotal: 0, ramUsed: 0 },
    sources: emptySources(format ?? 'Keil'),
  };
}
