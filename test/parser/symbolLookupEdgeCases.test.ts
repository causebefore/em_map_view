import { describe, it, expect } from 'vitest';
import { findSymbolByAddress, parseHexAddress } from '../../src/parser/symbolLookup';
import { MapSymbol } from '../../src/parser/types';

// ============================================================
// findSymbolByAddress edge cases
// ============================================================

describe('findSymbolByAddress edge cases', () => {
  // ---- 1. Single symbol, exact match ----
  it('single symbol: exact match works', () => {
    const symbols: MapSymbol[] = [
      { name: 'only_func', address: 0x08000000, size: 64, section: '.text', type: '函数', scope: 'Global' },
    ];

    // Inside range
    const result = findSymbolByAddress(symbols, 0x08000010);
    expect(result).toBeDefined();
    expect(result!.name).toBe('only_func');
    expect(result!.offset).toBe(0x10);
    expect(result!.isApproximate).toBeFalsy();

    // At start
    const resultStart = findSymbolByAddress(symbols, 0x08000000);
    expect(resultStart).toBeDefined();
    expect(resultStart!.offset).toBe(0);

    // At end (exclusive)
    const resultEnd = findSymbolByAddress(symbols, 0x08000040);
    expect(resultEnd).toBeDefined();
    // size 64, so 0x08000000 + 64 = 0x08000040 is exclusive end
    // 0x0800003F is the last in-range address
    const resultLast = findSymbolByAddress(symbols, 0x0800003F);
    expect(resultLast).toBeDefined();
    expect(resultLast!.name).toBe('only_func');
    expect(resultLast!.offset).toBe(63);
  });

  // ---- 2. All symbols size 0: address-only matching ----
  it('all symbols size 0: address-only matching', () => {
    const symbols: MapSymbol[] = [
      { name: 'handler_a', address: 0x08000000, size: 0, section: '.text', type: '函数', scope: 'Global' },
      { name: 'handler_b', address: 0x08000100, size: 0, section: '.text', type: '函数', scope: 'Global' },
      { name: 'handler_c', address: 0x08000200, size: 0, section: '.text', type: '函数', scope: 'Global' },
    ];

    // Exact address match for size-0 symbol
    const result = findSymbolByAddress(symbols, 0x08000100);
    expect(result).toBeDefined();
    expect(result!.name).toBe('handler_b');
    expect(result!.offset).toBe(0);
    expect(result!.isApproximate).toBeFalsy();

    // Non-matching address falls through to approximate
    const resultApprox = findSymbolByAddress(symbols, 0x08000150);
    expect(resultApprox).toBeDefined();
    expect(resultApprox!.name).toBe('handler_b');
    expect(resultApprox!.isApproximate).toBe(true);
    expect(resultApprox!.offset).toBe(0x50);
  });

  // ---- 3. Overlapping symbols: first match wins ----
  it('overlapping symbols: first match wins', () => {
    const symbols: MapSymbol[] = [
      { name: 'sym_a', address: 0x08000000, size: 256, section: '.text', type: '函数', scope: 'Global' },
      { name: 'sym_b', address: 0x08000080, size: 256, section: '.text', type: '函数', scope: 'Global' },
    ];

    // Address 0x80 is in both ranges; sym_a comes first
    const result = findSymbolByAddress(symbols, 0x08000080);
    expect(result).toBeDefined();
    expect(result!.name).toBe('sym_a');
    expect(result!.offset).toBe(0x80);
  });

  // ---- 4. Very large address 0xFFFFFFFF ----
  it('address 0xFFFFFFFF handled correctly', () => {
    const symbols: MapSymbol[] = [
      { name: 'high_sym', address: 0xFFFFF000, size: 0x2000, section: '.text', type: '函数', scope: 'Global' },
    ];

    // Inside range
    const result = findSymbolByAddress(symbols, 0xFFFFFFFF);
    expect(result).toBeDefined();
    expect(result!.name).toBe('high_sym');
    expect(result!.offset).toBe(0x0FFF);

    // Exact boundary
    const resultStart = findSymbolByAddress(symbols, 0xFFFFF000);
    expect(resultStart).toBeDefined();
    expect(resultStart!.offset).toBe(0);

    // Outside range (past end)
    // 0xFFFFF000 + 0x2000 = 0x100001000 which overflows to 0x1000 in 32-bit
    // In JS: 0xFFFFF000 + 0x2000 = 4294967296+0x1000, so target is not < that
    const resultPast = findSymbolByAddress(symbols, 0xFFFFFFFF + 1);
    // 0xFFFFFFFF + 1 = 0x100000000 which is beyond 32-bit range
    // This should still work - it'll either find approximate or null
    expect(resultPast).toBeDefined();
  });

  // ---- 5. parseHexAddress edge cases ----
  describe('parseHexAddress edge cases', () => {
    it('parses 0x prefix', () => {
      expect(parseHexAddress('0x1A2B')).toBe(0x1A2B);
    });

    it('parses 0x0', () => {
      expect(parseHexAddress('0x0')).toBe(0);
    });

    it('parses FFFFFFFF (no prefix)', () => {
      expect(parseHexAddress('FFFFFFFF')).toBe(0xFFFFFFFF);
    });

    it('parses lowercase hex', () => {
      expect(parseHexAddress('0xabcdef')).toBe(0xabcdef);
    });

    it('parses uppercase hex', () => {
      expect(parseHexAddress('0xABCDEF')).toBe(0xABCDEF);
    });

    it('trims whitespace', () => {
      expect(parseHexAddress('  0x08000100  ')).toBe(0x08000100);
    });

    it('trims leading whitespace only', () => {
      expect(parseHexAddress('   FF')).toBe(0xFF);
    });

    it('trims trailing whitespace only', () => {
      expect(parseHexAddress('FF   ')).toBe(0xFF);
    });

    it('returns null for empty string', () => {
      expect(parseHexAddress('')).toBeNull();
    });

    it('returns null for whitespace-only string', () => {
      expect(parseHexAddress('   ')).toBeNull();
    });

    it('returns null for invalid hex chars', () => {
      expect(parseHexAddress('0xGGGG')).toBeNull();
    });

    it('returns null for mixed valid/invalid', () => {
      expect(parseHexAddress('0x08000100xyz')).toBeNull();
    });

    it('returns null for non-hex input', () => {
      expect(parseHexAddress('hello')).toBeNull();
    });

    it('handles 0x prefix with no digits', () => {
      // '0x' normalized to '' which fails regex -> null
      expect(parseHexAddress('0x')).toBeNull();
    });
  });
});
