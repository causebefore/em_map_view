<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import SourceBadge from './SourceBadge.vue';
import type { DataSource } from '../sourceMetadata';

const props = defineProps<{
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
  sources: {
    code: DataSource;
    roData: DataSource;
    rwData: DataSource;
    ziData: DataSource;
    flashTotal: DataSource;
    flashUsed: DataSource;
    ramTotal: DataSource;
    ramUsed: DataSource;
  };
  warningThreshold: number;
  criticalThreshold: number;
}>();

const canvasRef = ref<HTMLCanvasElement | null>(null);
const containerRef = ref<HTMLDivElement | null>(null);
let resizeObserver: ResizeObserver | null = null;

const canvasDescription = computed(() => {
  const t = props.totals;
  const flashPct = t.flashTotal > 0 ? ((t.flashUsed / t.flashTotal) * 100).toFixed(1) : '0.0';
  const ramPct = t.ramTotal > 0 ? ((t.ramUsed / t.ramTotal) * 100).toFixed(1) : '0.0';
  const flashFree = Math.max(0, t.flashTotal - t.flashUsed);
  const ramFree = Math.max(0, t.ramTotal - t.ramUsed);
  return `Memory layout: Flash ${formatSize(t.flashUsed)} of ${formatSize(t.flashTotal)} used (${flashPct}%), RAM ${formatSize(t.ramUsed)} of ${formatSize(t.ramTotal)} used (${ramPct}%). Flash: Code ${formatSize(t.code)}, RO Data ${formatSize(t.roData)}, RW Data ${formatSize(t.rwData)}, Free ${formatSize(flashFree)}. RAM: RW Data ${formatSize(t.rwData)}, ZI Data ${formatSize(t.ziData)}, Free ${formatSize(ramFree)}.`;
});

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  return `${(bytes / 1024).toFixed(1)}KB`;
}

function cssVar(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!value || value.includes('color-mix(')) return fallback;
  return value;
}

function drawMemoryLayout() {
  const canvas = canvasRef.value;
  const container = containerRef.value;
  if (!canvas || !container) return;

  const dpr = window.devicePixelRatio || 1;
  const rect = container.getBoundingClientRect();
  const width = rect.width - 4;
  const totalHeight = 188;

  canvas.width = width * dpr;
  canvas.height = totalHeight * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${totalHeight}px`;

  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);
  ctx.textBaseline = 'middle';

  const t = props.totals;
  const margin = { left: 72, right: 78, top: 12, bottom: 10 };
  const barArea = width - margin.left - margin.right;
  const barH = 30;
  const gap = 42;

  const flashY = margin.top + 20;
  drawBar(ctx, 'FLASH', margin.left, flashY, barArea, barH, t.flashTotal, [
    { label: 'Code', size: t.code, color: cssVar('--vscode-charts-green', '#4CAF50'), textColor: '#fff' },
    { label: 'RO', size: t.roData, color: cssVar('--vscode-charts-blue', '#3794FF'), textColor: '#fff' },
    { label: 'RW', size: t.rwData, color: cssVar('--vscode-charts-orange', '#D18616'), textColor: '#fff' },
    { label: 'Free', size: Math.max(0, t.flashTotal - t.flashUsed), color: cssVar('--surface-subtle', '#2b3138'), textColor: cssVar('--vscode-descriptionForeground', '#9aa4b2') },
  ]);

  const ramY = flashY + barH + gap;
  drawBar(ctx, 'RAM', margin.left, ramY, barArea, barH, t.ramTotal, [
    { label: 'RW', size: t.rwData, color: cssVar('--vscode-charts-orange', '#D18616'), textColor: '#fff' },
    { label: 'ZI', size: t.ziData, color: cssVar('--vscode-charts-purple', '#9C27B0'), textColor: '#fff' },
    { label: 'Free', size: Math.max(0, t.ramTotal - t.ramUsed), color: cssVar('--surface-subtle', '#2b3138'), textColor: cssVar('--vscode-descriptionForeground', '#9aa4b2') },
  ]);
}

function drawBar(ctx: CanvasRenderingContext2D, title: string, x: number, y: number, totalWidth: number, barH: number, totalSize: number, segments: { label: string; size: number; color: string; textColor: string }[]) {
  const effective = segments.filter(s => s.size > 0);
  if (effective.length === 0 || totalSize <= 0) return;

  ctx.fillStyle = cssVar('--vscode-editor-foreground', '#333');
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(title, x - 68, y + barH / 2);

  ctx.font = '11px sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = cssVar('--surface-subtle', '#2b3138');
  ctx.fillRect(x, y, totalWidth, barH);

  let drawX = x;
  for (const seg of effective) {
    const segW = Math.max((seg.size / totalSize) * totalWidth, 1);

    ctx.fillStyle = seg.color;
    ctx.fillRect(drawX, y, segW, barH);

    ctx.strokeStyle = 'rgba(0,0,0,0.16)';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(drawX, y, segW, barH);

    if (segW > 50) {
      ctx.fillStyle = seg.textColor;
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${seg.label} ${formatSize(seg.size)}`, drawX + segW / 2, y + barH / 2);
    } else if (segW > 20) {
      ctx.fillStyle = seg.textColor;
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(seg.label, drawX + segW / 2, y + barH / 2);
    }

    drawX += segW;
  }

  ctx.fillStyle = cssVar('--vscode-descriptionForeground', '#666');
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(formatSize(totalSize), x + totalWidth + 8, y + barH / 2);
}

onMounted(() => {
  if (containerRef.value) {
    resizeObserver = new ResizeObserver(() => drawMemoryLayout());
    resizeObserver.observe(containerRef.value);
  }
  drawMemoryLayout();
});

onUnmounted(() => {
  resizeObserver?.disconnect();
});

watch(() => props.totals, () => nextTick(drawMemoryLayout), { deep: true });
</script>

<template>
  <div class="section">
    <div class="section-heading">
      <h3 class="section-title">Memory Layout</h3>
      <div class="layout-sources">
        <span class="source-row">
          <span>FLASH</span>
          <SourceBadge :source="sources.flashUsed" />
          <SourceBadge :source="sources.flashTotal" />
        </span>
        <span class="source-row">
          <span>RAM</span>
          <SourceBadge :source="sources.ramUsed" />
          <SourceBadge :source="sources.ramTotal" />
        </span>
      </div>
    </div>
    <div ref="containerRef" class="canvas-container">
      <canvas ref="canvasRef" :aria-label="canvasDescription" role="img"></canvas>
    </div>
  </div>
</template>

<style scoped>
.section { margin-bottom: 22px; }
.section-heading {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 10px;
  padding-bottom: 7px;
  border-bottom: 1px solid var(--panel-border, var(--vscode-editorWidget-border, #ccc));
}
.section-title {
  font-size: 14px;
  font-weight: 600;
  margin: 0;
}
.layout-sources { display: flex; gap: 10px; flex-wrap: wrap; justify-content: flex-end; }
.source-row { display: inline-flex; align-items: center; gap: 4px; color: var(--text-muted, var(--vscode-descriptionForeground, #999)); font-size: 10px; }
.canvas-container { width: 100%; overflow: hidden; }
canvas { display: block; }
</style>
