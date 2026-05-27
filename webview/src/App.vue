<script setup lang="ts">
import { useMapData, config } from './composables/useMapData';
import { useHighlight } from './composables/useHighlight';
import { onMessage } from './vscode';
import MemoryLayout from './components/MemoryLayout.vue';
import ModuleBarChart from './components/ModuleBarChart.vue';
import AddressLookup from './components/AddressLookup.vue';

const { mapData } = useMapData();
const { highlightModule, setHighlight } = useHighlight();

onMessage((msg) => {
  if (msg.type === 'highlightModule') {
    setHighlight(msg.moduleName);
  }
});
</script>

<template>
  <div class="map-analysis">
    <div v-if="!mapData" class="empty">
      <div class="empty-icon">&#128194;</div>
      <div>Waiting for MAP file data...</div>
    </div>

    <template v-else>
      <div class="summary-bar">
        <div class="summary-card">
          <div class="summary-label">Format</div>
          <div class="summary-value">{{ mapData.formatType }}</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">Flash</div>
          <div class="summary-value flash">
            {{ (mapData.totals.flashUsed / 1024).toFixed(1) }}KB
            <span class="summary-sub">/ {{ (mapData.totals.flashTotal / 1024).toFixed(0) }}KB</span>
          </div>
        </div>
        <div class="summary-card">
          <div class="summary-label">RAM</div>
          <div class="summary-value ram">
            {{ (mapData.totals.ramUsed / 1024).toFixed(1) }}KB
            <span class="summary-sub">/ {{ (mapData.totals.ramTotal / 1024).toFixed(0) }}KB</span>
          </div>
        </div>
        <div class="summary-card">
          <div class="summary-label">Symbols</div>
          <div class="summary-value">{{ mapData.symbols.length }}</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">Modules</div>
          <div class="summary-value">{{ mapData.modules.length }}</div>
        </div>
      </div>

      <MemoryLayout :totals="mapData.totals" :warning-threshold="config.warningThreshold" :critical-threshold="config.criticalThreshold" />
      <ModuleBarChart :modules="mapData.modules" :highlight="highlightModule" :top-count="config.topModulesCount" />
      <AddressLookup />
    </template>
  </div>
</template>

<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
  font-size: var(--vscode-font-size, 13px);
  color: var(--vscode-editor-foreground, #333);
  background: var(--vscode-editor-background, #fff);
  padding: 12px;
}
.map-analysis { max-width: 100%; }
.empty { text-align: center; padding: 60px 20px; color: var(--vscode-descriptionForeground, #999); }
.empty-icon { font-size: 48px; margin-bottom: 16px; opacity: 0.3; }
.summary-bar { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 20px; }
.summary-card {
  padding: 8px 14px; background: var(--vscode-editorWidget-background, #f5f5f5);
  border: 1px solid var(--vscode-editorWidget-border, #e0e0e0); border-radius: 4px; min-width: 90px; flex: 1;
}
.summary-label { font-size: 11px; color: var(--vscode-descriptionForeground, #999); margin-bottom: 2px; }
.summary-value { font-size: 15px; font-weight: 600; }
.summary-value.flash { color: var(--vscode-charts-green, #4CAF50); }
.summary-value.ram { color: var(--vscode-charts-purple, #9C27B0); }
.summary-sub { font-size: 11px; font-weight: 400; color: var(--vscode-descriptionForeground, #999); }
</style>
