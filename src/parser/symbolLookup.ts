import { MapSymbol, SymbolLookupResult } from './types';

export function parseHexAddress(value: string): number | null {
  const normalized = value.trim().replace(/^0x/i, '');
  if (!/^[0-9a-f]+$/i.test(normalized)) {
    return null;
  }

  const address = Number.parseInt(normalized, 16);
  return Number.isSafeInteger(address) ? address : null;
}

export function findSymbolByAddress(symbols: MapSymbol[], targetAddr: number): SymbolLookupResult | null {
  if (!symbols || symbols.length === 0) return null;

  // Phase 1: exact range match
  for (const sym of symbols) {
    if (sym.size > 0 && targetAddr >= sym.address && targetAddr < sym.address + sym.size) {
      return {
        name: sym.name,
        address: sym.address,
        size: sym.size,
        section: sym.section,
        offset: targetAddr - sym.address,
      };
    }
  }

  // Phase 2: exact address match (size === 0)
  for (const sym of symbols) {
    if (sym.size === 0 && sym.address === targetAddr) {
      return {
        name: sym.name,
        address: sym.address,
        size: sym.size,
        section: sym.section,
        offset: 0,
      };
    }
  }

  // Phase 3: approximate to the nearest preceding symbol.
  let nearest: MapSymbol | null = null;
  let minDist = Infinity;
  for (const sym of symbols) {
    if (sym.address > targetAddr) continue;

    const dist = targetAddr - sym.address;
    if (dist < minDist) {
      minDist = dist;
      nearest = sym;
    }
  }

  if (nearest) {
    return {
      name: nearest.name,
      address: nearest.address,
      size: nearest.size,
      section: nearest.section,
      offset: targetAddr - nearest.address,
      isApproximate: true,
    };
  }

  return null;
}
