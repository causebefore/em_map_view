import { ref, onMounted, onUnmounted } from 'vue';
import { onMessage, postMessage } from '../vscode';
import type { DataSource } from '../sourceMetadata';

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
  formatType: string;
  symbols: any[];
  modules: any[];
  memoryRegions: any[];
  totals: {
    code: number;
    roData: number;
    rwData: number;
    ziData: number;
    flashTotal: number;
    flashUsed: number;
    ramTotal: number;
    ramUsed: number;
  };
  sources: MapSources;
}

export interface MapViewConfig {
  warningThreshold: number;
  criticalThreshold: number;
  topModulesCount: number;
}

export const mapData = ref<MapParseResult | null>(null);
export const config = ref<MapViewConfig>({ warningThreshold: 80, criticalThreshold: 95, topModulesCount: 20 });

export function useMapData() {
  let disposeMessageListener: (() => void) | undefined;

  onMounted(() => {
    disposeMessageListener = onMessage((msg) => {
      switch (msg.type) {
        case 'updateData':
          mapData.value = msg.data;
          break;
        case 'config':
          config.value = {
            warningThreshold: msg.warningThreshold,
            criticalThreshold: msg.criticalThreshold,
            topModulesCount: msg.topModulesCount,
          };
          break;
      }
    });
    postMessage({ type: 'ready' });
  });

  onUnmounted(() => {
    disposeMessageListener?.();
    disposeMessageListener = undefined;
  });

  return { mapData, config };
}
