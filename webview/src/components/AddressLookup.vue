<script setup lang="ts">
import { onUnmounted, ref } from 'vue';
import { postMessage, onMessage } from '../vscode';

interface LookupResult { name: string; address: number; size: number; section: string; offset: number; isApproximate?: boolean; }

const input = ref('');
const results = ref<(LookupResult | null)[]>([]);
const searched = ref(false);

function resetLookupState() {
  input.value = '';
  results.value = [];
  searched.value = false;
}

function lookup() {
  const addresses = input.value.split(/[\n,;]+/).map(s => s.trim()).filter(s => s.length > 0);
  if (addresses.length === 0) return;
  searched.value = true;
  postMessage({ type: 'requestAddressLookup', addresses });
}

const disposeMessageListener = onMessage((msg) => {
  if (msg.type === 'resetTransientState') {
    resetLookupState();
    return;
  }

  if (msg.type === 'addressLookupResult') {
    searched.value = true;
    if (Array.isArray(msg.addresses)) {
      input.value = msg.addresses.join('\n');
    }
    results.value = Array.isArray(msg.results) ? msg.results : [];
  }
});

onUnmounted(() => {
  disposeMessageListener();
});

function formatHex(n: number): string {
  return '0x' + n.toString(16).toUpperCase().padStart(8, '0');
}
</script>

<template>
  <div class="section">
    <h3 class="section-title">Address Lookup</h3>
    <div class="lookup-input">
      <textarea v-model="input" placeholder="Enter addresses (one per line, e.g. 0x08000100)" rows="3" @keydown.ctrl.enter="lookup"></textarea>
      <button @click="lookup">Lookup</button>
    </div>
    <div v-if="searched" class="results">
      <div v-if="results.length === 0" class="no-result">No results</div>
      <table v-else>
        <thead><tr><th>Name</th><th>Address</th><th>Size</th><th>Section</th><th>Offset</th><th>Status</th></tr></thead>
        <tbody>
          <tr v-for="(r, i) in results" :key="i">
            <template v-if="r">
              <td>{{ r.name }}</td><td class="mono">{{ formatHex(r.address) }}</td><td>{{ r.size }}B</td>
              <td>{{ r.section }}</td><td class="mono">+{{ r.offset }}</td>
              <td><span v-if="r.isApproximate" class="approx">~ Approx</span><span v-else class="exact">Exact</span></td>
            </template>
            <template v-else><td colspan="6" class="no-match">No match found</td></template>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.section { margin-bottom: 20px; }
.section-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 12px;
  padding-bottom: 7px;
  border-bottom: 1px solid var(--panel-border, var(--vscode-editorWidget-border, #ccc));
}
.lookup-input {
  display: grid;
  grid-template-columns: minmax(180px, 1fr) auto;
  gap: 10px;
  align-items: end;
  margin-bottom: 12px;
}
textarea {
  min-height: 58px;
  background: var(--vscode-input-background, #fff);
  color: var(--vscode-input-foreground, #333);
  border: 1px solid var(--vscode-input-border, var(--panel-border, #ccc));
  border-radius: 4px;
  padding: 8px 10px;
  font-family: var(--vscode-editor-font-family, monospace);
  font-size: 12px;
  resize: vertical;
}
textarea:focus { outline: 1px solid var(--vscode-focusBorder, #0078d4); border-color: var(--vscode-focusBorder, #0078d4); }
button {
  min-width: 86px;
  height: 34px;
  padding: 0 16px;
  background: var(--vscode-button-background, #0078d4);
  color: var(--vscode-button-foreground, #fff);
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
}
button:hover { background: var(--vscode-button-hoverBackground, #106ebe); }
.results table { width: 100%; border-collapse: collapse; font-size: 12px; }
th, td { padding: 6px 8px; text-align: left; border-bottom: 1px solid var(--panel-border, var(--vscode-editorWidget-border, #eee)); }
th { font-weight: 600; color: var(--text-muted, var(--vscode-descriptionForeground, #999)); }
.mono { font-family: var(--vscode-editor-font-family, monospace); }
.exact { color: var(--vscode-charts-green, #4CAF50); }
.approx { color: var(--vscode-charts-orange, #FF9800); }
.no-match { color: var(--vscode-errorForeground, #e53935); font-style: italic; }
.no-result { color: var(--text-muted, var(--vscode-descriptionForeground, #999)); }
</style>
