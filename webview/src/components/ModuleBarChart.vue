<script setup lang="ts">
import { computed } from 'vue';
import { postMessage } from '../vscode';
import SourceBadge from './SourceBadge.vue';
import type { DataSource } from '../sourceMetadata';

const props = defineProps<{
  modules: { name: string; code: number; ro_data: number; rw_data: number; zi_data: number }[];
  source: DataSource;
  highlight: string | null;
  topCount: number;
}>();

const sortedModules = computed(() => {
  return [...props.modules]
    .map(m => ({ ...m, flashSize: m.code + m.ro_data + m.rw_data }))
    .sort((a, b) => b.flashSize - a.flashSize)
    .slice(0, props.topCount);
});

const maxFlashSize = computed(() => {
  return sortedModules.value.length > 0 ? sortedModules.value[0].flashSize : 1;
});

function barPercent(flashSize: number): number {
  return maxFlashSize.value > 0 ? (flashSize / maxFlashSize.value) * 100 : 0;
}

function onModuleClick(moduleName: string) {
  postMessage({ type: 'moduleClicked', moduleName });
}

const isUnavailable = computed(() => props.source.kind === 'unavailable' || props.modules.length === 0);
</script>

<template>
  <div class="section">
    <div class="section-heading">
      <h3 class="section-title">Module Size (Top {{ topCount }})</h3>
      <SourceBadge :source="source" />
    </div>
    <div v-if="isUnavailable" class="empty-state">
      No module-size data available for this MAP file.
    </div>
    <div v-else class="bar-list">
      <div v-for="mod in sortedModules" :key="mod.name" class="bar-item" :class="{ highlighted: highlight === mod.name }" @click="onModuleClick(mod.name)">
        <div class="bar-label">{{ mod.name }}</div>
        <div class="bar-track">
          <div class="bar-fill" :style="{ width: barPercent(mod.flashSize) + '%' }"></div>
        </div>
        <div class="bar-value">{{ (mod.flashSize / 1024).toFixed(1) }}KB</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.section { margin-bottom: 22px; }
.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
  padding-bottom: 7px;
  border-bottom: 1px solid var(--panel-border, var(--vscode-editorWidget-border, #ccc));
}
.section-title {
  font-size: 14px; font-weight: 600; margin: 0;
}
.empty-state {
  padding: 12px;
  border: 1px dashed var(--vscode-editorWidget-border, #555);
  border-radius: 4px;
  color: var(--vscode-descriptionForeground, #999);
  background: var(--vscode-editorWidget-background, transparent);
}
.bar-list { display: flex; flex-direction: column; gap: 5px; }
.bar-item {
  display: grid;
  grid-template-columns: minmax(120px, 190px) minmax(120px, 1fr) 58px;
  align-items: center;
  gap: 10px;
  min-height: 24px;
  padding: 2px 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.15s, outline-color 0.15s;
}
.bar-item:hover { background: var(--vscode-list-hoverBackground, rgba(0,0,0,0.05)); }
.bar-item.highlighted {
  background: var(--vscode-list-activeSelectionBackground, rgba(0,120,215,0.15));
  outline: 1px solid var(--vscode-focusBorder, #0078d4);
}
.bar-label {
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bar-track {
  height: 18px;
  background: var(--surface-subtle, var(--vscode-editorWidget-background, #f0f0f0));
  border-radius: 3px;
  position: relative;
  overflow: hidden;
}
.bar-fill {
  height: 100%;
  background: var(--vscode-charts-blue, #4A90D9);
  border-right: 2px solid color-mix(in srgb, #fff 38%, transparent);
  border-radius: 3px;
  min-width: 2px;
  transition: width 0.22s ease;
}
.bar-value {
  font-family: var(--vscode-editor-font-family, monospace);
  font-size: 11px;
  color: var(--text-muted, var(--vscode-descriptionForeground, #999));
  text-align: right;
  white-space: nowrap;
}
</style>
