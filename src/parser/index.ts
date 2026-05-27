import { MapParseResult, SymbolLookupResult, MapSymbol } from './types';
import { parseKeil } from './keilParser';
import { findSymbolByAddress } from './symbolLookup';

export { findSymbolByAddress };
export type { MapParseResult, MapSymbol, SymbolLookupResult, MapModule, MemoryRegion, MapTotals, MapSection } from './types';

export function detectFormat(content: string): 'Keil' | 'GCC' | 'IAR' | null {
  if (!content || typeof content !== 'string') return null;

  const upper = content.toUpperCase();

  if (upper.includes('ARM LINKER') || upper.includes('COMPONENT SIZES')) {
    return 'Keil';
  }

  if (upper.includes('IAR LINKER') || (upper.includes('ENTRY') && upper.includes('MODULE') && upper.includes('ADDRESS'))) {
    return 'IAR';
  }

  if (upper.includes('MEMORY CONFIGURATION') || upper.includes('GNU LD')) {
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
    };
  }

  const format = detectFormat(content);

  if (format === 'Keil') {
    return parseKeil(content);
  }

  // Only Keil supported for now
  return {
    formatType: 'Keil',
    symbols: [],
    sections: [],
    modules: [],
    memoryRegions: [],
    totals: { code: 0, roData: 0, rwData: 0, ziData: 0, flashTotal: 0, flashUsed: 0, ramTotal: 0, ramUsed: 0 },
  };
}
