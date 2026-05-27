<script setup lang="ts">
import { computed } from 'vue';
import { postMessage } from '../vscode';

const props = defineProps<{
  modules: { name: string; code: number; ro_data: number; rw_data: number; zi_data: number }[];
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
</script>

<template>
  <div class="section">
    <h3 class="section-title">Module Size (Top {{ topCount }})</h3>
    <div class="bar-list">
      <div v-for="mod in sortedModules" :key="mod.name" class="bar-item" :class="{ highlighted: highlight === mod.name }" @click="onModuleClick(mod.name)">
        <div class="bar-label">{{ mod.name }}</div>
        <div class="bar-track">
          <div class="bar-fill" :style="{ width: barPercent(mod.flashSize) + '%' }">
            <span v-if="barPercent(mod.flashSize) > 25" class="bar-value">{{ (mod.flashSize / 1024).toFixed(1) }}KB</span>
          </div>
          <span v-if="barPercent(mod.flashSize) <= 25" class="bar-value-outside">{{ (mod.flashSize / 1024).toFixed(1) }}KB</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.section { margin-bottom: 20px; }
.section-title {
  font-size: 14px; font-weight: 600; margin-bottom: 12px;
  padding-bottom: 6px; border-bottom: 1px solid var(--vscode-editorWidget-border, #ccc);
}
.bar-list { display: flex; flex-direction: column; gap: 4px; }
.bar-item {
  display: flex; align-items: center; gap: 8px; padding: 3px 6px;
  border-radius: 3px; cursor: pointer; transition: background 0.15s;
}
.bar-item:hover { background: var(--vscode-list-hoverBackground, rgba(0,0,0,0.05)); }
.bar-item.highlighted {
  background: var(--vscode-list-activeSelectionBackground, rgba(0,120,215,0.15));
  outline: 1px solid var(--vscode-focusBorder, #0078d4);
}
.bar-label { min-width: 180px; max-width: 180px; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bar-track { flex: 1; height: 20px; background: var(--vscode-editorWidget-background, #f0f0f0); border-radius: 3px; position: relative; overflow: hidden; }
.bar-fill {
  height: 100%; background: linear-gradient(135deg, var(--vscode-charts-blue, #4A90D9), var(--vscode-charts-purple, #7B61FF));
  border-radius: 3px; display: flex; align-items: center; justify-content: center;
  min-width: 2px; transition: width 0.3s ease;
}
.bar-value { font-size: 10px; color: #fff; font-weight: 600; }
.bar-value-outside { font-size: 10px; color: var(--vscode-descriptionForeground, #999); margin-left: 4px; position: absolute; left: 100%; top: 50%; transform: translateY(-50%); white-space: nowrap; }
</style>
