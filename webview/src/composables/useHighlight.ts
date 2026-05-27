import { ref } from 'vue';

export const highlightModule = ref<string | null>(null);

export function useHighlight() {
  function setHighlight(moduleName: string | null) {
    highlightModule.value = moduleName;
  }

  function clearHighlight() {
    highlightModule.value = null;
  }

  return { highlightModule, setHighlight, clearHighlight };
}
