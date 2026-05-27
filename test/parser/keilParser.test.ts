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
    expect(result.sources.modules.kind).toBe('official');
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
    expect(result.sources.symbols.kind).toBe('official');
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
    expect(result.sources.totals.code.kind).toBe('official');
    expect(result.sources.totals.roData.kind).toBe('official');
    expect(result.sources.totals.rwData.kind).toBe('official');
    expect(result.sources.totals.ziData.kind).toBe('official');
    expect(result.sources.totals.flashUsed.kind).toBe('computed');
    expect(result.sources.totals.ramUsed.kind).toBe('computed');
    expect(result.sources.totals.flashTotal.kind).toBe('official');
  });

  it('should return formatType Keil', () => {
    const result = parseKeil(fixture);
    expect(result.formatType).toBe('Keil');
  });

  it('should mark module sizes derived from Memory Map rows when Component Sizes is missing', () => {
    const content = `
Component: ARM Compiler 5.06 update 6 (build 750) Tool: armlink [4d35ed]

Memory Map of the image

  Load Region LR_IROM1 (Base: 0x08000000, Size: 0x00000140, Max: 0x00010000, ABSOLUTE)
    Execution Region ER_IROM1 (Exec base: 0x08000000, Load base: 0x08000000, Size: 0x00000100, Max: 0x00010000, ABSOLUTE)
    Exec Addr    Load Addr    Size         Type   Attr      Idx    E Section Name        Object
    0x08000000   0x08000000   0x00000020   Code   RO           1    .text               startup.o
    0x08000020   0x08000020   0x00000030   Code   RO           2    i.main              main.o
    0x08000050   0x08000050   0x00000010   Data   RO           3    .constdata          main.o

    Execution Region RW_IRAM1 (Exec base: 0x20000000, Load base: 0x08000100, Size: 0x00000060, Max: 0x00001000, ABSOLUTE)
    Exec Addr    Load Addr    Size         Type   Attr      Idx    E Section Name        Object
    0x20000000   COMPRESSED   0x00000008   Data   RW           4    .data               main.o
    0x20000008        -       0x00000040   Zero   RW           5    .bss                main.o
`;

    const result = parseKeil(content);
    const main = result.modules.find(m => m.name === 'main.o');

    expect(result.modules.length).toBeGreaterThanOrEqual(2);
    expect(main).toEqual({
      name: 'main.o',
      code: 0x30,
      ro_data: 0x10,
      rw_data: 0x08,
      zi_data: 0x40,
    });
    expect(result.sources.modules.kind).toBe('derived');
    expect(result.sources.totals.code.kind).toBe('derived');
    expect(result.sources.totals.roData.kind).toBe('derived');
    expect(result.sources.totals.rwData.kind).toBe('derived');
    expect(result.sources.totals.ziData.kind).toBe('derived');
    expect(result.sources.totals.flashUsed.kind).toBe('derived');
    expect(result.sources.totals.ramUsed.kind).toBe('derived');
    expect(result.sources.totals.flashTotal.kind).toBe('official');
    expect(result.sources.totals.ramTotal.kind).toBe('official');
  });

  it('should mark memory regions and capacity as inferred when no regions are present', () => {
    const content = `
Component: ARM Compiler 5.06 update 6 (build 750) Tool: armlink [4d35ed]

Image component sizes

      Code (inc. data)   RO Data    RW Data    ZI Data      Debug   Object Name
       512          0        128         64        256          0   main.o
       512          0        128         64        256          0   Grand Totals
`;

    const result = parseKeil(content);

    expect(result.memoryRegions.map(r => r.name)).toEqual(['FLASH', 'RAM']);
    expect(result.sources.memoryRegions.kind).toBe('inferred');
    expect(result.sources.totals.flashTotal.kind).toBe('inferred');
    expect(result.sources.totals.ramTotal.kind).toBe('inferred');
    expect(result.sources.totals.flashUsed.kind).toBe('computed');
    expect(result.sources.totals.ramUsed.kind).toBe('computed');
  });
});
