<template>
  <div v-if="show" class="widget-default-style p-2 text-gray-100 absolute left-4 bottom-4">
    Tip: to price check press Ctrl+V
  </div>
</template>

<script lang="ts">
import { defineComponent, inject, computed } from 'vue'
import { WidgetManager } from './interfaces'
import Widget from './Widget.vue'
import { MainProcess } from '@/web/background/IPC'
import { parseClipboard } from '@/parser'

export default defineComponent({
  components: { Widget },
  mounted() {
    window.addEventListener('paste', (event) => {
      const clipboard = (event.clipboardData || window.clipboardData).getData('text');

      MainProcess.selfDispatch({
        name: 'MAIN->OVERLAY::price-check',
        payload: { clipboard, position: { x: window.screenX + 100, y: window.screenY + 100 }, lockedMode: false }
      })
    });
  },
  setup () {
    return {
      show: computed(() => !MainProcess.isElectron),
    }
  }
})
</script>
