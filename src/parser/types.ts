export interface MapSymbol {
  name: string;
  address: number;
  size: number;
  section: string;
  type: string;
  scope: string;
}

export interface MapModule {
  name: string;
  code: number;
  ro_data: number;
  rw_data: number;
  zi_data: number;
}

export interface MemoryRegion {
  name: string;
  origin: number;
  length: number;
  used: number;
  attributes: string;
}

export interface MapSection {
  name: string;
  address: number;
  size: number;
  type: string;
  attributes: string;
}

export interface MapTotals {
  code: number;
  roData: number;
  rwData: number;
  ziData: number;
  flashTotal: number;
  flashUsed: number;
  ramTotal: number;
  ramUsed: number;
}

export type DataSourceKind = 'official' | 'computed' | 'derived' | 'inferred' | 'unavailable';

export interface DataSource {
  kind: DataSourceKind;
  label: string;
  detail?: string;
}

export interface MapTotalsSources {
  code: DataSource;
  roData: DataSource;
  rwData: DataSource;
  ziData: DataSource;
  flashTotal: DataSource;
  flashUsed: DataSource;
  ramTotal: DataSource;
  ramUsed: DataSource;
}

export interface MapSources {
  formatType: DataSource;
  symbols: DataSource;
  sections: DataSource;
  modules: DataSource;
  memoryRegions: DataSource;
  totals: MapTotalsSources;
}

export interface MapParseResult {
  formatType: 'Keil' | 'GCC' | 'IAR';
  symbols: MapSymbol[];
  sections: MapSection[];
  modules: MapModule[];
  memoryRegions: MemoryRegion[];
  totals: MapTotals;
  sources: MapSources;
}

export interface SymbolLookupResult {
  name: string;
  address: number;
  size: number;
  section: string;
  offset: number;
  isApproximate?: boolean;
}
