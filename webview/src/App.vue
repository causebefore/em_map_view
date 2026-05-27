<script setup lang="ts">
import { ref, onUnmounted, onErrorCaptured } from 'vue';
import { useMapData, config } from './composables/useMapData';
import { useHighlight } from './composables/useHighlight';
import { onMessage } from './vscode';
import MemoryLayout from './components/MemoryLayout.vue';
import ModuleBarChart from './components/ModuleBarChart.vue';
import AddressLookup from './components/AddressLookup.vue';
import SourceBadge from './components/SourceBadge.vue';

const error = ref<string | null>(null);

onErrorCaptured((err) => {
  error.value = err.message || 'An unexpected error occurred';
  return false;
});

const { mapData } = useMapData();
const { highlightModule, setHighlight } = useHighlight();

const disposeMessageListener = onMessage((msg) => {
  if (msg.type === 'highlightModule') {
    setHighlight(msg.moduleName);
  }
});

onUnmounted(() => {
  disposeMessageListener();
});

function formatSize(bytes: number, fractionDigits = 1): string {
  if (bytes <= 0) return '0KB';
  return `${(bytes / 1024).toFixed(fractionDigits)}KB`;
}

function formatCapacity(bytes: number): string {
  return bytes > 0 ? formatSize(bytes, 0) : 'N/A';
}

function moduleCountText(): string {
  const data = mapData.value;
  if (!data) return 'N/A';
  return data.sources.modules.kind === 'unavailable' ? 'N/A' : String(data.modules.length);
}
</script>

<template>
  <div class="map-analysis">
    <div v-if="error" class="error-boundary">
      <div class="error-icon">&#9888;</div>
      <div class="error-title">Something went wrong</div>
      <div class="error-message">{{ error }}</div>
      <button class="error-retry" @click="error = null">Retry</button>
    </div>
    <div v-else-if="!mapData" class="empty">
      <div class="empty-icon">&#128194;</div>
      <div>Waiting for MAP file data...</div>
    </div>

    <template v-else>
      <div class="summary-bar">
        <div class="summary-card">
          <div class="summary-label">Format <SourceBadge :source="mapData.sources.formatType" /></div>
          <div class="summary-value">{{ mapData.formatType }}</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">Flash</div>
          <div class="summary-value flash">
            {{ formatSize(mapData.totals.flashUsed) }}
            <span class="summary-sub">/ {{ formatCapacity(mapData.totals.flashTotal) }}</span>
          </div>
          <div class="summary-sources">
            <SourceBadge :source="mapData.sources.totals.flashUsed" />
            <SourceBadge :source="mapData.sources.totals.flashTotal" />
          </div>
        </div>
        <div class="summary-card">
          <div class="summary-label">RAM</div>
          <div class="summary-value ram">
            {{ formatSize(mapData.totals.ramUsed) }}
            <span class="summary-sub">/ {{ formatCapacity(mapData.totals.ramTotal) }}</span>
          </div>
          <div class="summary-sources">
            <SourceBadge :source="mapData.sources.totals.ramUsed" />
            <SourceBadge :source="mapData.sources.totals.ramTotal" />
          </div>
        </div>
        <div class="summary-card">
          <div class="summary-label">Symbols <SourceBadge :source="mapData.sources.symbols" /></div>
          <div class="summary-value">{{ mapData.symbols.length }}</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">Modules <SourceBadge :source="mapData.sources.modules" /></div>
          <div class="summary-value">{{ moduleCountText() }}</div>
        </div>
      </div>

      <MemoryLayout :totals="mapData.totals" :sources="mapData.sources.totals" :warning-threshold="config.warningThreshold" :critical-threshold="config.criticalThreshold" />
      <ModuleBarChart :modules="mapData.modules" :source="mapData.sources.modules" :highlight="highlightModule" :top-count="config.topModulesCount" />
      <AddressLookup />
    </template>
  </div>
</template>

<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
:root {
  --panel-bg: var(--vscode-editor-background, #1f2428);
  --panel-border: color-mix(in srgb, var(--vscode-editorWidget-border, #454b52) 78%, transparent);
  --surface-muted: color-mix(in srgb, var(--vscode-editorWidget-background, #252a30) 86%, transparent);
  --surface-subtle: color-mix(in srgb, var(--vscode-editorWidget-background, #252a30) 58%, transparent);
  --text-muted: var(--vscode-descriptionForeground, #9aa4b2);
}
body {
  font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
  font-size: var(--vscode-font-size, 13px);
  color: var(--vscode-editor-foreground, #333);
  background: var(--panel-bg);
  padding: 14px;
}
.map-analysis { max-width: 100%; }
.empty { text-align: center; padding: 60px 20px; color: var(--vscode-descriptionForeground, #999); }
.empty-icon { display: none; }
.summary-bar {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(168px, 1fr));
  gap: 10px;
  margin-bottom: 22px;
}
.summary-card {
  min-height: 82px;
  padding: 11px 14px;
  background: var(--surface-muted);
  border: 1px solid var(--panel-border);
  border-radius: 5px;
}
.summary-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  font-size: 11px;
  color: var(--text-muted);
  margin-bottom: 7px;
}
.summary-value {
  font-size: 17px;
  font-weight: 650;
  line-height: 1.15;
}
.summary-value.flash { color: var(--vscode-charts-green, #4CAF50); }
.summary-value.ram { color: var(--vscode-charts-purple, #9C27B0); }
.summary-sub { font-size: 11px; font-weight: 400; color: var(--text-muted); }
.summary-sources { display: flex; gap: 4px; margin-top: 9px; flex-wrap: wrap; }
.error-boundary {
  text-align: center;
  padding: 40px 20px;
  color: var(--vscode-errorForeground, #f44336);
}
.error-icon { font-size: 36px; margin-bottom: 12px; }
.error-title { font-size: 16px; font-weight: 600; margin-bottom: 8px; }
.error-message {
  font-size: 13px;
  color: var(--vscode-descriptionForeground, #999);
  margin-bottom: 16px;
  word-break: break-word;
}
.error-retry {
  padding: 6px 16px;
  background: var(--vscode-button-background, #0078d4);
  color: var(--vscode-button-foreground, #fff);
  border: none;
  border-radius: 3px;
  cursor: pointer;
  font-size: 12px;
}
</style>
