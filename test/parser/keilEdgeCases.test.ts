import { describe, it, expect } from 'vitest';
import { parseKeil } from '../../src/parser/keilParser';
import { parseMapFile, detectFormat } from '../../src/parser';

// ============================================================
// Inline fixture builders
// ============================================================

function componentSizesOnly(): string {
  return `
Component: ARM Compiler 6.19 Tool: armlink

Image component sizes

      Code (inc. data)   RO Data    RW Data    ZI Data      Debug   Object Name
       512          0        128         64        256          0   main.o
       256          0         64         32        128          0   startup.o
      1024          0        256        128        512          0   Grand Totals
`;
}

function memoryMapOnly(): string {
  return `
Component: ARM Compiler 6.19 Tool: armlink

Memory Map of the image

  Load Region LR_IROM1 (Base: 0x08000000, Size: 0x00000200, Max: 0x00010000, ABSOLUTE)
    Execution Region ER_IROM1 (Base: 0x08000000, Size: 0x00000180, Max: 0x00010000, ABSOLUTE)
    Exec Addr    Load Addr    Size         Type   Attr      Idx    E Section Name        Object
    0x08000000   0x08000000   0x00000040   Code   RO           1    .text               startup.o
    0x08000040   0x08000040   0x00000080   Code   RO           2    i.main              main.o
    0x080000c0   0x080000c0   0x00000020   Data   RO           3    .constdata          main.o

    Execution Region RW_IRAM1 (Base: 0x20000000, Size: 0x00000080, Max: 0x00004000, ABSOLUTE)
    Exec Addr    Load Addr    Size         Type   Attr      Idx    E Section Name        Object
    0x20000000   COMPRESSED   0x00000020   Data   RW           4    .data               main.o
    0x20000020        -       0x00000060   Zero   RW           5    .bss                main.o
`;
}

function globalSymbolsOnly(): string {
  return `
Component: ARM Compiler 6.19 Tool: armlink

Global Symbols

    Symbol Name                              Value     Ov Type        Size  Object(Section)

    __main                                   0x08000101   Thumb   Code       8  main.o(.text)
    my_func                                  0x08000201   Thumb   Code      64  main.o(.text)
    g_status                                 0x20000000   Data    Data       4  main.o(.bss)
`;
}

function multipleLoadRegions(): string {
  return `
Component: ARM Compiler 6.19 Tool: armlink

Memory Map of the image

  Load Region LR_IROM1 (Base: 0x08000000, Size: 0x00001000, Max: 0x00020000, ABSOLUTE)
    Execution Region ER_IROM1 (Base: 0x08000000, Size: 0x00001000, Max: 0x00020000, ABSOLUTE)
    Exec Addr    Load Addr    Size         Type   Attr      Idx    E Section Name        Object
    0x08000000   0x08000000   0x00000100   Code   RO           1    .text               main.o

  Load Region LR_IROM2 (Base: 0x08020000, Size: 0x00000800, Max: 0x00020000, ABSOLUTE)
    Execution Region ER_IROM2 (Base: 0x08020000, Size: 0x00000800, Max: 0x00020000, ABSOLUTE)
    Exec Addr    Load Addr    Size         Type   Attr      Idx    E Section Name        Object
    0x08020000   0x08020000   0x00000080   Code   RO           2    .text               ext.o
`;
}

function armcc5xFormat(): string {
  return `
Component: ARM Compiler 5.06 update 6 (build 750) Tool: armlink [4d35ed]

Memory Map of the image

  Load Region LR_IROM1 (Base: 0x08000000, Size: 0x00000140, Max: 0x00010000, ABSOLUTE)
    Execution Region ER_IROM1 (Exec base: 0x08000000, Load base: 0x08000000, Size: 0x00000100, Max: 0x00010000, ABSOLUTE)
    Exec Addr    Load Addr    Size         Type   Attr      Idx    E Section Name        Object
    0x08000000   0x08000000   0x00000020   Code   RO           1    .text               startup.o
    0x08000020   0x08000020   0x00000030   Code   RO           2    i.main              main.o

    Execution Region RW_IRAM1 (Exec base: 0x20000000, Load base: 0x08000100, Size: 0x00000040, Max: 0x00001000, ABSOLUTE)
    Exec Addr    Load Addr    Size         Type   Attr      Idx    E Section Name        Object
    0x20000000   COMPRESSED   0x00000010   Data   RW           3    .data               main.o
    0x20000010        -       0x00000030   Zero   RW           4    .bss                main.o
`;
}

function libraryMemberTable(): string {
  return `
Component: ARM Compiler 6.19 Tool: armlink

Image component sizes

      Code (inc. data)   RO Data    RW Data    ZI Data      Debug   Library Member Name
       128           0         16          0         0          0   __main
        64           0          8          0         0          0   __scatter
       256           0         32          0         0          0   Library Totals
`;
}

function localScopeSymbol(): string {
  return `
Component: ARM Compiler 6.19 Tool: armlink

Global Symbols

    Symbol Name                              Value     Ov Type        Size  Object(Section)

    my_func                                  0x08000201   Thumb   Code      64  main.o(.text)
    helper                                   0x08000301   Thumb   Static    32  main.o(.text)
`;
}

function dataTypeSymbol(): string {
  return `
Component: ARM Compiler 6.19 Tool: armlink

Global Symbols

    Symbol Name                              Value     Ov Type        Size  Object(Section)

    g_counter                                0x20000000   Number  Data       4  main.o(.data)
    g_buffer                                 0x20000010   Data    Data     256  main.o(.bss)
`;
}

// ============================================================
// Tests
// ============================================================

describe('parseKeil edge cases', () => {
  // ---- 1. Empty input ----
  it('empty string returns empty result with formatType Keil', () => {
    const result = parseKeil('');
    expect(result.formatType).toBe('Keil');
    expect(result.symbols).toEqual([]);
    expect(result.modules).toEqual([]);
    expect(result.sections).toEqual([]);
    expect(result.totals.code).toBe(0);
    expect(result.totals.roData).toBe(0);
    expect(result.totals.rwData).toBe(0);
    expect(result.totals.ziData).toBe(0);
  });

  // ---- 2. Null/undefined-like input ----
  it('parseMapFile(null) does not throw', () => {
    expect(() => parseMapFile(null as any)).not.toThrow();
    const result = parseMapFile(null as any);
    expect(result.formatType).toBe('Unknown');
    expect(result.modules).toEqual([]);
  });

  it('parseMapFile(undefined) does not throw', () => {
    expect(() => parseMapFile(undefined as any)).not.toThrow();
    const result = parseMapFile(undefined as any);
    expect(result.formatType).toBe('Unknown');
    expect(result.symbols).toEqual([]);
  });

  // ---- 3. Only Component Sizes, no Memory Map ----
  it('only Component Sizes: modules parsed, memory regions inferred', () => {
    const result = parseKeil(componentSizesOnly());

    expect(result.modules.length).toBeGreaterThanOrEqual(2);
    const main = result.modules.find(m => m.name === 'main.o');
    expect(main).toBeDefined();
    expect(main!.code).toBe(512);
    expect(main!.ro_data).toBe(128);
    expect(main!.rw_data).toBe(64);
    expect(main!.zi_data).toBe(256);

    // Memory regions should be inferred
    expect(result.memoryRegions.length).toBe(2);
    expect(result.memoryRegions.map(r => r.name)).toEqual(['FLASH', 'RAM']);
    expect(result.sources.memoryRegions.kind).toBe('inferred');
    expect(result.sources.modules.kind).toBe('official');
  });

  // ---- 4. Only Memory Map, no Component Sizes ----
  it('only Memory Map: modules derived from object rows', () => {
    const result = parseKeil(memoryMapOnly());

    expect(result.modules.length).toBeGreaterThanOrEqual(2);
    const main = result.modules.find(m => m.name === 'main.o');
    expect(main).toBeDefined();
    expect(main!.code).toBe(0x80);  // i.main
    expect(main!.ro_data).toBe(0x20);  // .constdata
    expect(main!.rw_data).toBe(0x20);  // .data
    expect(main!.zi_data).toBe(0x60);  // .bss

    expect(result.sources.modules.kind).toBe('derived');
    expect(result.sources.totals.code.kind).toBe('derived');
  });

  // ---- 5. Only Global Symbols ----
  it('only Global Symbols: symbols parsed, modules empty', () => {
    const result = parseKeil(globalSymbolsOnly());

    expect(result.symbols.length).toBeGreaterThanOrEqual(3);
    expect(result.modules).toEqual([]);

    const mainFunc = result.symbols.find(s => s.name === 'my_func');
    expect(mainFunc).toBeDefined();
    expect(mainFunc!.address).toBe(0x08000201);
    expect(mainFunc!.size).toBe(64);
    expect(mainFunc!.type).toBe('函数');
    expect(mainFunc!.scope).toBe('Global');

    const status = result.symbols.find(s => s.name === 'g_status');
    expect(status).toBeDefined();
    expect(status!.type).toBe('变量');
  });

  // ---- 6. Multiple Load Regions ----
  it('multiple Load Regions: both identified correctly', () => {
    const result = parseKeil(multipleLoadRegions());

    const loadRegions = result.memoryRegions.filter(r => /^LR_/.test(r.name));
    expect(loadRegions.length).toBe(2);

    const lr1 = loadRegions.find(r => r.name === 'LR_IROM1');
    expect(lr1).toBeDefined();
    expect(lr1!.origin).toBe(0x08000000);

    const lr2 = loadRegions.find(r => r.name === 'LR_IROM2');
    expect(lr2).toBeDefined();
    expect(lr2!.origin).toBe(0x08020000);
  });

  // ---- 7. ARMCC 5.x format (Exec base / Load base) ----
  it('ARMCC 5.x format with Exec base / Load base parses correctly', () => {
    const result = parseKeil(armcc5xFormat());

    expect(result.sections.length).toBeGreaterThanOrEqual(2);
    const erIrom = result.sections.find(s => s.name === 'ER_IROM1');
    expect(erIrom).toBeDefined();
    expect(erIrom!.address).toBe(0x08000000);
    expect(erIrom!.size).toBe(0x00000100);

    const erIram = result.sections.find(s => s.name === 'RW_IRAM1');
    expect(erIram).toBeDefined();
    expect(erIram!.address).toBe(0x20000000);

    // Memory regions should also be parsed
    const erIromRegion = result.memoryRegions.find(r => r.name === 'ER_IROM1');
    expect(erIromRegion).toBeDefined();
    expect(erIromRegion!.origin).toBe(0x08000000);
  });

  // ---- 8. Library Member table ----
  it('Library Member table: library member modules parsed', () => {
    const result = parseKeil(libraryMemberTable());

    // "Library Totals" row should be skipped
    const libTotals = result.modules.find(m => m.name === 'Library Totals');
    expect(libTotals).toBeUndefined();

    expect(result.modules.length).toBeGreaterThanOrEqual(2);
    const mainLib = result.modules.find(m => m.name === '__main');
    expect(mainLib).toBeDefined();
    expect(mainLib!.code).toBe(128);
    expect(mainLib!.ro_data).toBe(16);
  });

  // ---- 9. Symbol with Local scope ----
  it('symbol with Static type gets Local scope', () => {
    const result = parseKeil(localScopeSymbol());

    const helper = result.symbols.find(s => s.name === 'helper');
    expect(helper).toBeDefined();
    expect(helper!.scope).toBe('Local');
    expect(helper!.size).toBe(32);
  });

  // ---- 10. Symbol with Data type ----
  it('symbol with Data type identified as 变量', () => {
    const result = parseKeil(dataTypeSymbol());

    const counter = result.symbols.find(s => s.name === 'g_counter');
    expect(counter).toBeDefined();
    expect(counter!.type).toBe('变量');

    const buffer = result.symbols.find(s => s.name === 'g_buffer');
    expect(buffer).toBeDefined();
    expect(buffer!.type).toBe('变量');
    expect(buffer!.size).toBe(256);
  });

  // ---- 11. Very large module values ----
  it('very large code/ro/rw/zi values parsed correctly', () => {
    const content = `
Component: ARM Compiler 6.19 Tool: armlink

Image component sizes

      Code (inc. data)   RO Data    RW Data    ZI Data      Debug   Object Name
    1048576          0     524288     262144    131072          0   big_module.o
      65536          0      32768      16384      8192          0   medium.o
    1114112          0     557056     278528    139264          0   Grand Totals
`;
    const result = parseKeil(content);

    const big = result.modules.find(m => m.name === 'big_module.o');
    expect(big).toBeDefined();
    expect(big!.code).toBe(1048576);
    expect(big!.ro_data).toBe(524288);
    expect(big!.rw_data).toBe(262144);
    expect(big!.zi_data).toBe(131072);

    // Grand totals
    expect(result.totals.code).toBe(1114112);
    expect(result.totals.roData).toBe(557056);
    expect(result.totals.rwData).toBe(278528);
    expect(result.totals.ziData).toBe(139264);
  });

  // ---- 12. Duplicate region names ----
  it('duplicate region names do not create duplicate memory regions', () => {
    const content = `
Component: ARM Compiler 6.19 Tool: armlink

Memory Map of the image

  Load Region LR_IROM1 (Base: 0x08000000, Size: 0x00000200, Max: 0x00010000, ABSOLUTE)
    Execution Region ER_IROM1 (Base: 0x08000000, Size: 0x00000100, Max: 0x00010000, ABSOLUTE)
    Exec Addr    Load Addr    Size         Type   Attr      Idx    E Section Name        Object
    0x08000000   0x08000000   0x00000040   Code   RO           1    .text               startup.o

    Execution Region ER_IROM1 (Base: 0x08000100, Size: 0x00000100, Max: 0x00010000, ABSOLUTE)
    Exec Addr    Load Addr    Size         Type   Attr      Idx    E Section Name        Object
    0x08000100   0x08000100   0x00000040   Code   RO           2    .text               main.o
`;
    const result = parseKeil(content);

    const erIrom1Regions = result.memoryRegions.filter(r => r.name === 'ER_IROM1');
    expect(erIrom1Regions.length).toBe(1);
    // First occurrence wins
    expect(erIrom1Regions[0].origin).toBe(0x08000000);
  });
});

// ============================================================
// detectFormat tests
// ============================================================

describe('detectFormat', () => {
  it('detects Keil format via ARM LINKER', () => {
    expect(detectFormat('ARM LINKER V5.06')).toBe('Keil');
  });

  it('detects Keil format via ARMLINK', () => {
    expect(detectFormat('ARMLINK started')).toBe('Keil');
  });

  it('detects Keil format via COMPONENT SIZES', () => {
    expect(detectFormat('COMPONENT SIZES')).toBe('Keil');
  });

  it('detects Keil format via ARM COMPILER with ARMLINK', () => {
    expect(detectFormat('ARM COMPILER 6.19\narmlink')).toBe('Keil');
  });

  it('detects GCC format via MEMORY CONFIGURATION', () => {
    expect(detectFormat('Memory Configuration')).toBe('GCC');
  });

  it('detects GCC format via GNU LD', () => {
    expect(detectFormat('GNU ld (GNU Binutils) 2.38')).toBe('GCC');
  });

  it('detects IAR format via IAR LINKER', () => {
    expect(detectFormat('IAR Linker V9.40')).toBe('IAR');
  });

  it('detects IAR format via ENTRY/MODULE/ADDRESS', () => {
    expect(detectFormat('ENTRY    MODULE    ADDRESS')).toBe('IAR');
  });

  it('returns null for empty string', () => {
    expect(detectFormat('')).toBeNull();
  });

  it('returns null for null/undefined', () => {
    expect(detectFormat(null as any)).toBeNull();
    expect(detectFormat(undefined as any)).toBeNull();
  });

  it('returns null for unrecognized content', () => {
    expect(detectFormat('just some random text')).toBeNull();
  });
});

// ============================================================
// parseMapFile format routing
// ============================================================

describe('parseMapFile format routing', () => {
  it('GCC format returns empty result with formatType GCC', () => {
    const content = 'Memory Configuration\nFLASH  0x08000000  0x00040000';
    const result = parseMapFile(content);
    expect(result.formatType).toBe('GCC');
    expect(result.symbols).toEqual([]);
    expect(result.modules).toEqual([]);
    expect(result.sections).toEqual([]);
    expect(result.sources.modules.kind).toBe('unavailable');
  });

  it('IAR format returns empty result with formatType IAR', () => {
    const content = 'IAR Linker V9.40\n  Entry    Module    Address';
    const result = parseMapFile(content);
    expect(result.formatType).toBe('IAR');
    expect(result.symbols).toEqual([]);
    expect(result.modules).toEqual([]);
    expect(result.sources.totals.code.kind).toBe('unavailable');
  });

  it('unrecognized format returns empty result with formatType Unknown', () => {
    const content = 'some random content that does not match any format';
    const result = parseMapFile(content);
    expect(result.formatType).toBe('Unknown');
    expect(result.modules).toEqual([]);
  });

  it('Keil format routes to parseKeil', () => {
    const content = componentSizesOnly();
    const result = parseMapFile(content);
    expect(result.formatType).toBe('Keil');
    expect(result.modules.length).toBeGreaterThanOrEqual(2);
    expect(result.sources.modules.kind).toBe('official');
  });
});

// ============================================================
// Bug fix: symbol type classification with mixed type info
// ============================================================

function globalSymbolsWithMixedType(): string {
  return `
Component: ARM Compiler 6.19 Tool: armlink

Global Symbols

    Symbol Name                              Value     Ov Type        Size  Object(Section)

    mixed_func                               0x08000101   Thumb Code Data    64  main.o(.text)
    normal_func                              0x08000201   Thumb   Code       32  main.o(.text)
    data_var                                 0x20000000   Data    Data        4  main.o(.bss)
`;
}

describe('Bug fix: symbol type classification', () => {
  it('should classify symbol with both Code and Data in typeInfo as function', () => {
    const result = parseKeil(globalSymbolsWithMixedType());
    const mixed = result.symbols.find(s => s.name === 'mixed_func');
    expect(mixed).toBeDefined();
    // Code should take priority over Data — symbol is a function
    expect(mixed!.type).toBe('函数');
  });
});

// ============================================================
// Bug fix: fallback symbol type should be unknown, not function
// ============================================================

function globalSymbolsNonStandardFormat(): string {
  return `
Component: ARM Compiler 6.19 Tool: armlink

Global Symbols

    Symbol Name                              Value     Ov Type        Size  Object(Section)

    __main                                   0x08000101   Thumb   Code       8  main.o(.text)
    g_data_var                               0x20000000   Data    Data       4  main.o(.bss)
    my_orphan_func                           0x08000300   Thumb   Code      32  orphan.o(.text)
`;
}

describe('Bug fix: fallback symbol type', () => {
  it('should classify fallback-matched symbol as unknown, not function', () => {
    // Primary regex requires: name, 2+ spaces, 0xADDR, space, type, space, digits(size), space, object
    // Fallback regex requires: name, 3+ spaces, 0xADDR, space, (anything)
    // A line with name + 3+ spaces + 0xADDR + space + non-matching content triggers fallback.
    // The line "my_label   0x08000400 extra_text" has no digit group for size, so primary won't match.
    const content = `
Component: ARM Compiler 6.19 Tool: armlink

Global Symbols

    Symbol Name                              Value     Ov Type        Size  Object(Section)

    __main                                   0x08000101   Thumb   Code       8  main.o(.text)
    my_label   0x08000400 extra_text
`;
    const result = parseKeil(content);
    const fallbackSym = result.symbols.find(s => s.name === 'my_label');
    // The fallback should NOT hardcode type as '函数' — it should be '未知'
    expect(fallbackSym).toBeDefined();
    expect(fallbackSym!.type).not.toBe('函数');
  });
});

// ============================================================
// Bug fix: ramUsed with only LR_ RAM regions
// ============================================================

function onlyLrRamRegion(): string {
  return `
Component: ARM Compiler 6.19 Tool: armlink

Memory Map of the image

  Load Region LR_IROM1 (Base: 0x08000000, Size: 0x00000200, Max: 0x00010000, ABSOLUTE)
    Execution Region ER_IROM1 (Base: 0x08000000, Size: 0x00000200, Max: 0x00010000, ABSOLUTE)
    Exec Addr    Load Addr    Size         Type   Attr      Idx    E Section Name        Object
    0x08000000   0x08000000   0x00000100   Code   RO           1    .text               main.o
    0x08000100   0x08000100   0x00000080   Code   RO           2    i.init              init.o

  Load Region LR_IRAM (Base: 0x20000000, Size: 0x00000060, Max: 0x00004000, ABSOLUTE)
`;
}

describe('Bug fix: ramUsed with only LR_ RAM regions', () => {
  it('should compute ramUsed from LR_IRAM when no ER_IRAM exists', () => {
    const result = parseKeil(onlyLrRamRegion());
    // ramTotal should be set from LR_IRAM Max (0x4000)
    expect(result.totals.ramTotal).toBe(0x00004000);
    // ramUsed should be derived from LR_IRAM used size (0x20 + 0x40 = 0x60), not 0
    expect(result.totals.ramUsed).toBe(0x00000060);
  });
});
