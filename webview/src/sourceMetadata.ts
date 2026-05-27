export type DataSourceKind = 'official' | 'computed' | 'derived' | 'inferred' | 'unavailable';

export interface DataSource {
  kind: DataSourceKind;
  label: string;
  detail?: string;
}

export function formatSourceLabel(source: DataSource | undefined): string {
  if (!source || source.kind === 'unavailable') return 'N/A';
  return source.label;
}

export function sourceKindClass(source: DataSource | undefined): string {
  return `source-${source?.kind ?? 'unavailable'}`;
}

export function formatSourceTitle(source: DataSource | undefined): string {
  if (!source) return 'Unavailable';
  if (!source.detail) return formatSourceLabel(source);
  return `${formatSourceLabel(source)}: ${source.detail}`;
}
