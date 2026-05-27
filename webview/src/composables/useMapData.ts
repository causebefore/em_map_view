import { ref, onMounted } from 'vue';
import { onMessage, postMessage } from '../vscode';

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
}

export interface MapViewConfig {
  warningThreshold: number;
  criticalThreshold: number;
  topModulesCount: number;
}

export const mapData = ref<MapParseResult | null>(null);
export const config = ref<MapViewConfig>({ warningThreshold: 80, criticalThreshold: 95, topModulesCount: 20 });

export function useMapData() {
  onMounted(() => {
    onMessage((msg) => {
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

  return { mapData, config };
}
