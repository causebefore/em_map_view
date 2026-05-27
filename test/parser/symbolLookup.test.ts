import { describe, it, expect } from 'vitest';
import { findSymbolByAddress, parseHexAddress } from '../../src/parser/symbolLookup';
import { MapSymbol } from '../../src/parser/types';

const symbols: MapSymbol[] = [
  { name: 'Reset_Handler', address: 0x08000001, size: 8, section: 'RESET', type: '函数', scope: 'Global' },
  { name: 'main', address: 0x08000155, size: 200, section: '.text', type: '函数', scope: 'Global' },
  { name: 'HAL_Init', address: 0x08000231, size: 64, section: '.text', type: '函数', scope: 'Global' },
  { name: 'g_buffer', address: 0x20000000, size: 256, section: '.bss', type: '变量', scope: 'Global' },
];

describe('findSymbolByAddress', () => {
  it('should find exact match within symbol range', () => {
    const result = findSymbolByAddress(symbols, 0x08000160);
    expect(result).toBeDefined();
    expect(result!.name).toBe('main');
    expect(result!.offset).toBe(0x08000160 - 0x08000155);
    expect(result!.isApproximate).toBeFalsy();
  });

  it('should find symbol at exact start address', () => {
    const result = findSymbolByAddress(symbols, 0x08000231);
    expect(result).toBeDefined();
    expect(result!.name).toBe('HAL_Init');
    expect(result!.offset).toBe(0);
  });

  it('should find approximate match when no exact range hit', () => {
    const result = findSymbolByAddress(symbols, 0x08000300);
    expect(result).toBeDefined();
    expect(result!.isApproximate).toBe(true);
    expect(result!.offset).toBeGreaterThanOrEqual(0);
  });

  it('should not approximate to a symbol after the target address', () => {
    const result = findSymbolByAddress(symbols, 0x08000000);
    expect(result).toBeNull();
  });

  it('should return null for empty symbol list', () => {
    const result = findSymbolByAddress([], 0x08000000);
    expect(result).toBeNull();
  });

  it('should match last symbol at address just before end', () => {
    const result = findSymbolByAddress(symbols, 0x08000155 + 200 - 1);
    expect(result).toBeDefined();
    expect(result!.name).toBe('main');
  });
});

describe('parseHexAddress', () => {
  it('parses prefixed and unprefixed hex addresses', () => {
    expect(parseHexAddress('0x08000100')).toBe(0x08000100);
    expect(parseHexAddress('08000100')).toBe(0x08000100);
  });

  it('rejects partially parsed invalid input', () => {
    expect(parseHexAddress('0x08000100xyz')).toBeNull();
    expect(parseHexAddress('')).toBeNull();
  });
});
