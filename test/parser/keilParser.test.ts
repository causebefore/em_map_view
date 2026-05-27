import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseKeil } from '../../src/parser/keilParser';

const fixture = readFileSync(
  join(__dirname, 'fixtures/keil_sample.map'),
  'utf-8'
);

describe('parseKeil', () => {
  it('should parse memory regions', () => {
    const result = parseKeil(fixture);
    expect(result.memoryRegions.length).toBeGreaterThanOrEqual(2);
    const flash = result.memoryRegions.find(r => r.name === 'LR_IROM1');
    expect(flash).toBeDefined();
    expect(flash!.origin).toBe(0x08000000);
    expect(flash!.length).toBe(0x00040000);
    expect(flash!.used).toBe(0x00004c9c);
    const ram = result.memoryRegions.find(r => r.name === 'RW_IRAM1');
    expect(ram).toBeDefined();
    expect(ram!.origin).toBe(0x20000000);
  });

  it('should parse modules from Component Sizes', () => {
    const result = parseKeil(fixture);
    expect(result.modules.length).toBeGreaterThanOrEqual(3);
    const mainMod = result.modules.find(m => m.name === 'main.o');
    expect(mainMod).toBeDefined();
    expect(mainMod!.code).toBe(224);
    expect(mainMod!.ro_data).toBe(32);
    expect(mainMod!.rw_data).toBe(256);
    expect(mainMod!.zi_data).toBe(1024);
  });

  it('should parse global symbols', () => {
    const result = parseKeil(fixture);
    expect(result.symbols.length).toBeGreaterThanOrEqual(5);
    const mainSym = result.symbols.find(s => s.name === 'main');
    expect(mainSym).toBeDefined();
    expect(mainSym!.address).toBe(0x08000155);
    expect(mainSym!.size).toBe(224);
    expect(mainSym!.section).toBe('.text');
  });

  it('should compute totals from Grand Totals', () => {
    const result = parseKeil(fixture);
    expect(result.totals.code).toBe(19248);
    expect(result.totals.roData).toBe(2080);
    expect(result.totals.rwData).toBe(768);
    expect(result.totals.ziData).toBe(1536);
    expect(result.totals.flashUsed).toBe(19248 + 2080 + 768);
    expect(result.totals.ramUsed).toBe(768 + 1536);
    expect(result.totals.flashTotal).toBe(0x00040000);
  });

  it('should return formatType Keil', () => {
    const result = parseKeil(fixture);
    expect(result.formatType).toBe('Keil');
  });
});
