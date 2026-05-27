export type SymbolType = 'Code' | 'Data' | 'RO' | 'RW' | 'BSS';

export class SymbolFilterManager {
  private activeFilters = new Set<SymbolType>();
  readonly allTypes: SymbolType[] = ['Code', 'Data', 'RO', 'RW', 'BSS'];

  toggle(type: SymbolType): void {
    if (this.activeFilters.has(type)) {
      this.activeFilters.delete(type);
    } else {
      this.activeFilters.add(type);
    }
  }

  isActive(type: SymbolType): boolean {
    return this.activeFilters.size === 0 || this.activeFilters.has(type);
  }

  hasActiveFilters(): boolean {
    return this.activeFilters.size > 0;
  }

  clear(): void {
    this.activeFilters.clear();
  }

  matches(symbolType: string, symbolSection: string): boolean {
    if (this.activeFilters.size === 0) return true;
    const normalizedType = symbolType.toLowerCase();
    const normalizedSection = symbolSection.toLowerCase();
    for (const filter of this.activeFilters) {
      switch (filter) {
        case 'Code':
          if (/code|thumb|函数/i.test(normalizedType) || /\.(text|isr_vector)/i.test(normalizedSection)) return true;
          break;
        case 'Data':
          if (/data|变量/i.test(normalizedType) || /\.data/i.test(normalizedSection)) return true;
          break;
        case 'RO':
          if (/ro|只读/i.test(normalizedType) || /\.(rodata|ARM)/i.test(normalizedSection)) return true;
          break;
        case 'RW':
          if (/rw/i.test(normalizedType) || /\.data/i.test(normalizedSection)) return true;
          break;
        case 'BSS':
          if (/bss|zi/i.test(normalizedType) || /\.(bss|heap|stack)/i.test(normalizedSection)) return true;
          break;
      }
    }
    return false;
  }
}
