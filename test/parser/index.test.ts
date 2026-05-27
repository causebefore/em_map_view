import { describe, expect, it } from 'vitest';
import { detectFormat, parseMapFile } from '../../src/parser';
import { readFileSync } from 'fs';
import { join } from 'path';

const keilFixture = readFileSync(
  join(__dirname, 'fixtures/keil_sample.map'),
  'utf-8'
);

describe('parser index', () => {
  it('preserves detected GCC format on unsupported parse result', () => {
    const content = [
      'Memory Configuration',
      '',
      'Name             Origin             Length             Attributes',
      'FLASH            0x08000000         0x00040000         xr',
    ].join('\n');

    expect(detectFormat(content)).toBe('GCC');
    const result = parseMapFile(content);

    expect(result.formatType).toBe('GCC');
    expect(result.sources.modules.kind).toBe('unavailable');
    expect(result.sources.totals.flashUsed.kind).toBe('unavailable');
  });

  it('preserves detected IAR format on unsupported parse result', () => {
    const content = [
      'IAR Linker V9.40',
      '  Entry    Module    Address',
    ].join('\n');

    expect(detectFormat(content)).toBe('IAR');
    const result = parseMapFile(content);

    expect(result.formatType).toBe('IAR');
    expect(result.sources.modules.kind).toBe('unavailable');
    expect(result.sources.totals.ramUsed.kind).toBe('unavailable');
  });

  it('detects ARM Compiler armlink maps even when section markers appear late', () => {
    const content = [
      'Component: ARM Compiler 5.06 update 7 (build 960) Tool: armlink [4d3601]',
      'Section Cross References',
      'startup.o(RESET) refers to startup.o(.text) for Reset_Handler',
      'filler line\n'.repeat(140000),
      keilFixture,
    ].join('\n');

    const result = parseMapFile(content);

    expect(detectFormat(content)).toBe('Keil');
    expect(result.formatType).toBe('Keil');
    expect(result.symbols.length).toBeGreaterThan(0);
    expect(result.modules.length).toBeGreaterThan(0);
  });
});
