<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue';

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
  warningThreshold: number;
  criticalThreshold: number;
}>();

const canvasRef = ref<HTMLCanvasElement | null>(null);
const containerRef = ref<HTMLDivElement | null>(null);
let resizeObserver: ResizeObserver | null = null;

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  return `${(bytes / 1024).toFixed(1)}KB`;
}

function drawMemoryLayout() {
  const canvas = canvasRef.value;
  const container = containerRef.value;
  if (!canvas || !container) return;

  const dpr = window.devicePixelRatio || 1;
  const rect = container.getBoundingClientRect();
  const width = rect.width - 4;
  const totalHeight = 260;

  canvas.width = width * dpr;
  canvas.height = totalHeight * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${totalHeight}px`;

  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);
  ctx.textBaseline = 'middle';

  const t = props.totals;
  const margin = { left: 60, right: 20, top: 10, bottom: 10 };
  const barArea = width - margin.left - margin.right;
  const barH = 36;
  const gap = 60;

  const flashY = margin.top + 24;
  drawBar(ctx, 'FLASH', margin.left, flashY, barArea, barH, t.flashTotal, [
    { label: 'Code', size: t.code, color: '#4CAF50' },
    { label: 'RO', size: t.roData, color: '#2196F3' },
    { label: 'RW', size: t.rwData, color: '#FF9800' },
    { label: 'Free', size: Math.max(0, t.flashTotal - t.flashUsed), color: '#E0E0E0' },
  ]);

  const ramY = flashY + barH + gap;
  drawBar(ctx, 'RAM', margin.left, ramY, barArea, barH, t.ramTotal, [
    { label: 'RW', size: t.rwData, color: '#FF9800' },
    { label: 'ZI', size: t.ziData, color: '#9C27B0' },
    { label: 'Free', size: Math.max(0, t.ramTotal - t.ramUsed), color: '#E0E0E0' },
  ]);
}

function drawBar(ctx: CanvasRenderingContext2D, title: string, x: number, y: number, totalWidth: number, barH: number, totalSize: number, segments: { label: string; size: number; color: string }[]) {
  const effective = segments.filter(s => s.size > 0);
  if (effective.length === 0 || totalSize <= 0) return;

  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--vscode-editor-foreground') || '#333';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(title, x - 50, y + barH / 2);

  ctx.font = '11px sans-serif';
  ctx.textBaseline = 'middle';

  let drawX = x;
  for (const seg of effective) {
    const segW = Math.max((seg.size / totalSize) * totalWidth, 1);

    ctx.fillStyle = seg.color;
    ctx.fillRect(drawX, y, segW, barH);

    ctx.strokeStyle = 'rgba(0,0,0,0.08)';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(drawX, y, segW, barH);

    if (segW > 50) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${seg.label} ${formatSize(seg.size)}`, drawX + segW / 2, y + barH / 2);
    } else if (segW > 20) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(seg.label, drawX + segW / 2, y + barH / 2);
    }

    drawX += segW;
  }

  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--vscode-descriptionForeground') || '#666';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`Total: ${formatSize(totalSize)}`, drawX + 6, y + barH / 2);
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
    <h3 class="section-title">Memory Layout</h3>
    <div ref="containerRef" class="canvas-container">
      <canvas ref="canvasRef"></canvas>
    </div>
  </div>
</template>

<style scoped>
.section { margin-bottom: 20px; }
.section-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 12px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--vscode-editorWidget-border, #ccc);
}
.canvas-container { width: 100%; overflow: hidden; }
canvas { display: block; }
</style>
