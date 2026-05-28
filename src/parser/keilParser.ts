import type {
  MapSymbol,
  MapModule,
  MemoryRegion,
  MapSection,
  MapTotals,
  MapParseResult,
  DataSource,
  MapSources
} from './types';

// ============================================================
// Helper functions
// ============================================================

function source(kind: DataSource['kind'], label: string, detail?: string): DataSource {
  return detail ? { kind, label, detail } : { kind, label };
}

function computeTotals(
  sections: MapSection[],
  modules: MapModule[],
  memoryRegions: MemoryRegion[],
  explicitTotals: MapTotals | null
): MapTotals {
  const totals: MapTotals = explicitTotals ? { ...explicitTotals } : {
    code: 0,
    roData: 0,
    rwData: 0,
    ziData: 0,
    flashTotal: 0,
    flashUsed: 0,
    ramTotal: 0,
    ramUsed: 0
  };

  if (!explicitTotals) {
    for (const mod of modules) {
      totals.code += mod.code || 0;
      totals.roData += mod.ro_data || 0;
      totals.rwData += mod.rw_data || 0;
      totals.ziData += mod.zi_data || 0;
    }
  }

  if (!explicitTotals && modules.length === 0) {
    for (const sec of sections) {
      if (sec.type === '代码' || /^(CODE|ER_RO|ER_CO)/i.test(sec.name)) {
        totals.code += sec.size || 0;
      } else if (sec.type === '只读数据') {
        totals.roData += sec.size || 0;
      } else if (sec.type === '数据' || /^(DATA|RW|ER_RW)/i.test(sec.name)) {
        totals.rwData += sec.size || 0;
      } else if (sec.type === 'BSS' || /^(BSS|ZI|ER_ZI)/i.test(sec.name)) {
        totals.ziData += sec.size || 0;
      }
    }
  }

  totals.flashUsed = totals.code + totals.roData + totals.rwData;
  totals.ramUsed = totals.rwData + totals.ziData;

  for (const region of memoryRegions) {
    const name = region.name.toUpperCase();
    if (/FLASH|ROM|IROM|ER_IROM|LR_IROM/i.test(name)) {
      if (totals.flashTotal === 0) {
        totals.flashTotal = region.length;
      }
    }
    if (/RAM|IRAM|DRAM|SRAM|ER_IRAM|LR_IRAM/i.test(name)) {
      if (totals.ramTotal === 0) {
        totals.ramTotal = region.length;
      }
    }
  }

  if (totals.flashUsed === 0) {
    const loadRegions = memoryRegions.filter(
      region => /^LR_/i.test(region.name) && region.used > 0
    );
    const flashRegions = loadRegions.length > 0
      ? loadRegions
      : memoryRegions.filter(
          region => /FLASH|ROM|IROM|ER_IROM|LR_IROM/i.test(region.name) && region.used > 0
        );
    totals.flashUsed = flashRegions.reduce(
      (sum, region) => sum + (region.used || 0), 0
    );
  }

  if (totals.ramUsed === 0) {
    const ramRegions = memoryRegions.filter(
      region => /RAM|IRAM|DRAM|SRAM|ER_IRAM|LR_IRAM/i.test(region.name)
    );
    totals.ramUsed = ramRegions.reduce(
      (sum, region) => sum + (region.used || 0), 0
    );
  }

  return totals;
}

function buildSources(input: {
  symbols: MapSymbol[];
  sections: MapSection[];
  modules: MapModule[];
  memoryRegions: MemoryRegion[];
  explicitTotals: MapTotals | null;
  hasComponentSizeModules: boolean;
  hasDerivedMemoryMapModules: boolean;
  hasOfficialMemoryRegions: boolean;
  usedInferredMemoryRegions: boolean;
}): MapSources {
  const official = (detail: string) => source('official', 'Official', detail);
  const computed = (detail: string) => source('computed', 'Computed', detail);
  const derived = (detail: string) => source('derived', 'Derived', detail);
  const inferred = (detail: string) => source('inferred', 'Inferred', detail);
  const unavailable = (detail: string) => source('unavailable', 'Unavailable', detail);

  const hasExplicitTotals = input.explicitTotals !== null;
  const usesSectionFallback = !hasExplicitTotals && input.modules.length === 0 && input.sections.length > 0;
  const usesRegionFallback = !hasExplicitTotals &&
    input.modules.length === 0 &&
    input.sections.length === 0 &&
    input.memoryRegions.some(region => region.used > 0);

  let moduleSource: DataSource;
  if (input.hasComponentSizeModules) {
    moduleSource = official('Parsed from Image Component Sizes object table.');
  } else if (input.hasDerivedMemoryMapModules) {
    moduleSource = derived('Aggregated from Memory Map object rows because Component Sizes was missing.');
  } else {
    moduleSource = unavailable('No Component Sizes object table or usable Memory Map object rows were found.');
  }

  let totalPartSource: DataSource;
  if (hasExplicitTotals) {
    totalPartSource = official('Parsed from Grand Totals in Image Component Sizes.');
  } else if (input.hasComponentSizeModules) {
    totalPartSource = computed('Summed from official Image Component Sizes object rows.');
  } else if (input.hasDerivedMemoryMapModules) {
    totalPartSource = derived('Summed from Memory Map object rows.');
  } else if (usesSectionFallback) {
    totalPartSource = derived('Estimated from parsed execution regions.');
  } else {
    totalPartSource = unavailable('No reliable size totals were found.');
  }

  let usedSource: DataSource;
  if (hasExplicitTotals) {
    usedSource = computed('Computed from official Grand Totals values.');
  } else if (input.hasComponentSizeModules) {
    usedSource = computed('Computed from summed official module rows.');
  } else if (input.hasDerivedMemoryMapModules) {
    usedSource = derived('Computed from Memory Map object row aggregation.');
  } else if (usesSectionFallback) {
    usedSource = derived('Computed from parsed execution region sizes.');
  } else if (usesRegionFallback) {
    usedSource = derived('Taken from Memory Map region usage because detailed totals were unavailable.');
  } else {
    usedSource = unavailable('No usage data was found.');
  }

  let capacitySource: DataSource;
  if (input.usedInferredMemoryRegions) {
    capacitySource = inferred('Capacity was inferred from usage because no Memory Map regions were present.');
  } else if (input.hasOfficialMemoryRegions) {
    capacitySource = official('Parsed from Load/Execution Region Max values.');
  } else {
    capacitySource = unavailable('No memory capacity data was found.');
  }

  return {
    formatType: official('Detected as Keil MDK/armlink MAP format.'),
    symbols: input.symbols.length > 0
      ? official('Parsed from Global Symbols.')
      : unavailable('No Global Symbols entries were found.'),
    sections: input.sections.length > 0
      ? official('Parsed from Memory Map execution regions.')
      : unavailable('No execution regions were found.'),
    modules: moduleSource,
    memoryRegions: input.usedInferredMemoryRegions
      ? inferred('Synthetic FLASH/RAM regions were created from usage values.')
      : input.hasOfficialMemoryRegions
        ? official('Parsed from Memory Map Load/Execution Region entries.')
        : unavailable('No Memory Map region data was found.'),
    totals: {
      code: totalPartSource,
      roData: totalPartSource,
      rwData: totalPartSource,
      ziData: totalPartSource,
      flashUsed: usedSource,
      ramUsed: usedSource,
      flashTotal: capacitySource,
      ramTotal: capacitySource
    }
  };
}

function inferMemoryRegions(
  modules: MapModule[],
  memoryRegions: MemoryRegion[],
  _sections: MapSection[]
): void {
  const totalCode = modules.reduce((s, m) => s + (m.code || 0), 0);
  const totalRo = modules.reduce((s, m) => s + (m.ro_data || 0), 0);
  const totalRw = modules.reduce((s, m) => s + (m.rw_data || 0), 0);
  const totalZi = modules.reduce((s, m) => s + (m.zi_data || 0), 0);

  const flashUsed = totalCode + totalRo + totalRw;
  const ramUsed = totalRw + totalZi;

  const flashLen = nextPow2(flashUsed, 0x10000);
  const ramLen = nextPow2(ramUsed, 0x8000);

  memoryRegions.push({
    name: 'FLASH',
    origin: 0x08000000,
    length: flashLen,
    used: flashUsed,
    attributes: 'rx'
  });

  memoryRegions.push({
    name: 'RAM',
    origin: 0x20000000,
    length: ramLen,
    used: ramUsed,
    attributes: 'rwx'
  });
}

function nextPow2(value: number, minSize: number): number {
  let size = minSize;
  while (size < value) {
    size *= 2;
  }
  return size;
}

function getOrCreateModule(moduleMap: Map<string, MapModule>, name: string): MapModule {
  let module = moduleMap.get(name);
  if (!module) {
    module = {
      name,
      code: 0,
      ro_data: 0,
      rw_data: 0,
      zi_data: 0
    };
    moduleMap.set(name, module);
  }
  return module;
}

function addMemoryMapModuleUsage(
  moduleMap: Map<string, MapModule>,
  objectName: string,
  size: number,
  type: string,
  attr: string
): void {
  if (!objectName || size <= 0) return;
  if (/^(PAD|FILL)$/i.test(objectName)) return;

  const module = getOrCreateModule(moduleMap, objectName);
  if (/^Code$/i.test(type)) {
    module.code += size;
  } else if (/^Data$/i.test(type) && /^RO$/i.test(attr)) {
    module.ro_data += size;
  } else if (/^Data$/i.test(type) && /^RW$/i.test(attr)) {
    module.rw_data += size;
  } else if (/^Zero$/i.test(type)) {
    module.zi_data += size;
  }
}

function parseMemoryMapObjectLine(trimmed: string): {
  size: number;
  type: string;
  attr: string;
  objectName: string;
} | null {
  const match = trimmed.match(
    /^0x[0-9a-fA-F]+\s+(?:0x[0-9a-fA-F]+|COMPRESSED|-)\s+0x([0-9a-fA-F]+)\s+(Code|Data|Zero)\s+(RO|RW)\s+\d+\s+(?:\*\s+)?(.+?)\s{2,}(\S.+)$/i
  );
  if (!match) return null;

  return {
    size: parseInt(match[1], 16),
    type: match[2],
    attr: match[3],
    objectName: match[5].trim()
  };
}

// ============================================================
// Keil MDK Parser
// ============================================================

export function parseKeil(content: string): MapParseResult {
  const symbols: MapSymbol[] = [];
  const sections: MapSection[] = [];
  const modules: MapModule[] = [];
  const memoryRegions: MemoryRegion[] = [];
  const memoryMapModules = new Map<string, MapModule>();

  const lines = content.split(/\r?\n/);

  let inComponentSizes = false;
  let inGrandTotals = false;
  let inMemoryMap = false;
  let inGlobalSymbols = false;
  let componentTable = '';
  let explicitTotals: MapTotals | null = null;
  let hasComponentSizeModules = false;
  let hasOfficialMemoryRegions = false;
  let hasDerivedMemoryMapModules = false;
  let usedInferredMemoryRegions = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) continue;
    if (/^[\*=\-]{3,}$/.test(trimmed)) continue;

    // === Section detection ===
    if (/^Image\s+component\s+sizes/i.test(trimmed) ||
        /^Component\s+Sizes/i.test(trimmed)) {
      inComponentSizes = true;
      inGrandTotals = false;
      inMemoryMap = false;
      inGlobalSymbols = false;
      continue;
    }

    if (/^Memory\s+Map\s+of\s+the\s+image/i.test(trimmed)) {
      inComponentSizes = false;
      inMemoryMap = true;
      inGlobalSymbols = false;
      componentTable = '';
      continue;
    }

    if (/^Global\s+Symbols/i.test(trimmed)) {
      inComponentSizes = false;
      inMemoryMap = false;
      inGlobalSymbols = true;
      componentTable = '';
      continue;
    }

    // === Image Component Sizes section ===
    if (inComponentSizes) {
      if (/^-{5,}/.test(trimmed)) continue;

      if (/^\s*Code\s/i.test(trimmed)) {
        if (/Object\s+Name/i.test(trimmed)) componentTable = 'object';
        else if (/Library\s+Member\s+Name/i.test(trimmed)) componentTable = 'libraryMember';
        else if (/Library\s+Name/i.test(trimmed)) componentTable = 'libraryName';
        else componentTable = 'totals';
        continue;
      }

      // Grand Totals line
      if (/Grand\s+Totals/i.test(trimmed)) {
        const totalMatch = trimmed.match(
          /^(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+Grand\s+Totals/i
        );
        if (totalMatch) {
          explicitTotals = {
            code: parseInt(totalMatch[1], 10),
            roData: parseInt(totalMatch[3], 10),
            rwData: parseInt(totalMatch[4], 10),
            ziData: parseInt(totalMatch[5], 10),
            flashTotal: 0,
            flashUsed: 0,
            ramTotal: 0,
            ramUsed: 0
          };
        }
        continue;
      }

      if (/^(Object|Library|ELF\s+Image|ROM)\s+Totals/i.test(trimmed)) continue;
      if (/^\(incl\./i.test(trimmed)) continue;
      if (/^Total\s+(RO|RW|ROM)\s+Size/i.test(trimmed)) continue;
      if (componentTable === 'libraryName' || componentTable === 'totals') continue;

      // Module line: 6 numbers + module name
      const modMatch = trimmed.match(
        /^(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(.+)$/
      );
      if (modMatch) {
        const code = parseInt(modMatch[1], 10);
        const roData = parseInt(modMatch[3], 10);
        const rwData = parseInt(modMatch[4], 10);
        const ziData = parseInt(modMatch[5], 10);
        const objName = modMatch[7].trim();
        if (/Totals$/i.test(objName) || /^\(incl\./i.test(objName) || /\.l$/i.test(objName)) {
          continue;
        }

        modules.push({
          name: objName,
          code: code,
          ro_data: roData,
          rw_data: rwData,
          zi_data: ziData
        });
        hasComponentSizeModules = true;
        continue;
      }
    }

    // === Memory Map section ===
    if (inMemoryMap) {
      // Parse Load Region
      const loadRegionMatch = trimmed.match(
        /^Load\s+Region\s+(\S+)\s+\(Base:\s*0x([0-9a-fA-F]+),\s*Size:\s*0x([0-9a-fA-F]+),\s*Max:\s*0x([0-9a-fA-F]+)/i
      );
      if (loadRegionMatch) {
        const base = parseInt(loadRegionMatch[2], 16);
        const size = parseInt(loadRegionMatch[3], 16);
        const max = parseInt(loadRegionMatch[4], 16);

        memoryRegions.push({
          name: loadRegionMatch[1],
          origin: base,
          length: max,
          used: size,
          attributes: 'rx'
        });
        hasOfficialMemoryRegions = true;
        continue;
      }

      // Parse Execution Region
      const execRegionMatch = trimmed.match(
        /^Execution\s+Region\s+(\S+)\s+\((?:Base|Exec\s+base):\s*0x([0-9a-fA-F]+),\s*(?:Load\s+base:\s*0x[0-9a-fA-F]+,\s*)?Size:\s*0x([0-9a-fA-F]+),\s*Max:\s*0x([0-9a-fA-F]+)/i
      );
      if (execRegionMatch) {
        const base = parseInt(execRegionMatch[2], 16);
        const size = parseInt(execRegionMatch[3], 16);
        const max = parseInt(execRegionMatch[4], 16);

        let attrs = 'rwx';
        if (/IROM|ER_RO|ER_CO|LR_IROM/i.test(execRegionMatch[1])) attrs = 'rx';
        if (/IRAM|ER_RW|ER_ZI|ER_BSS|LR_IRAM/i.test(execRegionMatch[1])) attrs = 'rw';

        const exists = memoryRegions.some(r => r.name === execRegionMatch[1]);
        if (!exists) {
          memoryRegions.push({
            name: execRegionMatch[1],
            origin: base,
            length: max,
            used: size,
            attributes: attrs
          });
          hasOfficialMemoryRegions = true;
        }

        sections.push({
          name: execRegionMatch[1],
          address: base,
          size: size,
          type: attrs === 'rx' ? '代码' : '数据',
          attributes: attrs === 'rx' ? 'RO' : 'RW'
        });
        continue;
      }

      const memoryMapObjectLine = parseMemoryMapObjectLine(trimmed);
      if (memoryMapObjectLine) {
        addMemoryMapModuleUsage(
          memoryMapModules,
          memoryMapObjectLine.objectName,
          memoryMapObjectLine.size,
          memoryMapObjectLine.type,
          memoryMapObjectLine.attr
        );
        hasDerivedMemoryMapModules = memoryMapModules.size > 0;
        continue;
      }

      if (/^Exec\s+Addr/i.test(trimmed)) continue;
      if (/^0x[0-9a-fA-F]+\s+0x[0-9a-fA-F]+\s+0x[0-9a-fA-F]+/.test(trimmed)) continue;
    }

    // === Global Symbols section ===
    if (inGlobalSymbols) {
      if (/^-{5,}/.test(trimmed)) continue;
      if (/^Symbol\s+Name/i.test(trimmed)) continue;
      if (/^Module\s+Name/i.test(trimmed)) continue;

      const symMatch = trimmed.match(
        /^(.+?)\s{2,}0x([0-9a-fA-F]+)\s+(.+?)\s+(\d+)\s+(\S+(?:\(.+\))?)/
      );
      if (symMatch) {
        const symName = symMatch[1].trim();
        if (/^(Image|\s*$)/.test(symName)) continue;

        const symAddr = parseInt(symMatch[2], 16);
        const symSize = parseInt(symMatch[4], 10);
        const objSection = symMatch[5].trim();

        let section = '';
        const secExtract = objSection.match(/\((.+)\)$/);
        if (secExtract) {
          section = secExtract[1];
        }

        let symType = '数据';
        const typeInfo = symMatch[3].trim();
        if (/Code|Thumb/i.test(typeInfo)) symType = '函数';
        else if (/Data|Number/i.test(typeInfo)) symType = '变量';

        let scope = 'Global';
        if (/Local|Static/i.test(typeInfo)) scope = 'Local';

        symbols.push({
          name: symName,
          address: symAddr,
          size: symSize,
          section: section,
          type: symType,
          scope: scope
        });
        continue;
      }

      // Fallback: loose match on address and name
      const symFallback = trimmed.match(/^(.+?)\s{3,}0x([0-9a-fA-F]+)\s+/);
      if (symFallback) {
        const symName = symFallback[1].trim();
        if (/[a-zA-Z_]/.test(symName) && symName.length > 1 && !/^(Image|__)/.test(symName)) {
          if (!symbols.find(s => s.name === symName)) {
            symbols.push({
              name: symName,
              address: parseInt(symFallback[2], 16),
              size: 0,
              section: '',
              type: '未知',
              scope: 'Global'
            });
          }
        }
      }
    }
  }

  if (modules.length === 0 && memoryMapModules.size > 0) {
    modules.push(...Array.from(memoryMapModules.values()));
  }

  // If no memoryRegions parsed, infer from modules
  if (memoryRegions.length === 0) {
    inferMemoryRegions(modules, memoryRegions, sections);
    usedInferredMemoryRegions = true;
  }

  const totals = computeTotals(sections, modules, memoryRegions, explicitTotals);
  const sources = buildSources({
    symbols,
    sections,
    modules,
    memoryRegions,
    explicitTotals,
    hasComponentSizeModules,
    hasDerivedMemoryMapModules: hasDerivedMemoryMapModules && !hasComponentSizeModules,
    hasOfficialMemoryRegions,
    usedInferredMemoryRegions
  });

  return {
    formatType: 'Keil',
    symbols,
    sections,
    modules,
    memoryRegions,
    totals,
    sources
  };
}
