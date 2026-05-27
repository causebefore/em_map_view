<script setup lang="ts">
import type { DataSource } from '../sourceMetadata';
import { formatSourceLabel, formatSourceTitle, sourceKindClass } from '../sourceMetadata';

defineProps<{
  source?: DataSource;
}>();
</script>

<template>
  <span class="source-badge" :class="sourceKindClass(source)" :title="formatSourceTitle(source)">
    {{ formatSourceLabel(source) }}
  </span>
</template>

<style scoped>
.source-badge {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  height: 16px;
  padding: 0 5px;
  border-radius: 3px;
  border: 1px solid transparent;
  font-size: 9px;
  font-weight: 600;
  line-height: 1;
  letter-spacing: 0;
  white-space: nowrap;
  opacity: 0.92;
}

.source-official {
  color: var(--vscode-charts-green, #4caf50);
  border-color: color-mix(in srgb, var(--vscode-charts-green, #4caf50) 34%, transparent);
  background: color-mix(in srgb, var(--vscode-charts-green, #4caf50) 8%, transparent);
}

.source-computed {
  color: var(--vscode-charts-blue, #3794ff);
  border-color: color-mix(in srgb, var(--vscode-charts-blue, #3794ff) 34%, transparent);
  background: color-mix(in srgb, var(--vscode-charts-blue, #3794ff) 8%, transparent);
}

.source-derived {
  color: var(--vscode-charts-orange, #d18616);
  border-color: color-mix(in srgb, var(--vscode-charts-orange, #d18616) 38%, transparent);
  background: color-mix(in srgb, var(--vscode-charts-orange, #d18616) 9%, transparent);
}

.source-inferred {
  color: var(--vscode-charts-red, #f14c4c);
  border-color: color-mix(in srgb, var(--vscode-charts-red, #f14c4c) 38%, transparent);
  background: color-mix(in srgb, var(--vscode-charts-red, #f14c4c) 9%, transparent);
}

.source-unavailable {
  color: var(--vscode-disabledForeground, #777);
  border-color: var(--vscode-editorWidget-border, #555);
  background: var(--vscode-editorWidget-background, transparent);
}
</style>
