<template>
  <div class="widget-default-style p-2 text-gray-100 absolute left-4 bottom-4">
    <div class="max-w-md p-2">
      <div class="mb-2" v-if="!leagues.error.value">
        <div class="flex-1 mb-1">League
          <button class="btn" @click="leagues.load" :disabled="leagues.isLoading.value">Refresh</button>
        </div>
        <div v-if="leagues.isLoading.value" class="mb-4">
          <i class="fas fa-info-circle text-gray-600"></i>Loading leagues...</div>
        <template v-else-if="leagues.trade.value.length">
          <div
            class="mb-2 grid grid-cols-2 gap-x-2 gap-y-1 whitespace-nowrap"
            style="grid-template-columns: repeat(2, min-content);">
            <div v-for="league of leagues.trade.value" :key="league.id">
              <ui-radio v-model="leagueId" :value="league.id">{{ league.id }}</ui-radio>
            </div>
          </div>
          <div class="flex gap-x-2 mb-4">
            <div class="text-gray-500">or Private League</div>
            <input v-model="customLeagueId" placeholder="My League (PL12345)" class="rounded bg-gray-900 px-1 mb-1 flex-1" />
          </div>
        </template>
      </div>
      <ui-error-box v-else class="mb-4">
        <template #name>Failed to load leagues</template>
        <p>Price check Item, and follow the instructions in the error description.</p>
        <template #actions>
          <button class="btn" @click="leagues.load">Retry</button>
        </template>
      </ui-error-box>
    </div>
    Tip: to price check press Ctrl+V
  </div>
</template>

<script lang="ts">
import { defineComponent, shallowRef, inject, computed } from 'vue'
import { MainProcess } from '@/web/background/IPC'
import * as Leagues from '@/web/background/Leagues'
import { AppConfig, updateConfig, saveConfig } from '@/web/Config'
import { parseClipboard } from '@/parser'

import { WidgetManager } from './interfaces'
import Widget from './Widget.vue'

export default defineComponent({
  components: { Widget },
  mounted() {
    document.addEventListener('paste', (event: ClipboardEvent ) => {
      const clipboard = event.clipboardData?.getData('text') || '';

      MainProcess.selfDispatch({
        name: 'MAIN->OVERLAY::price-check',
        payload: { clipboard, position: { x: window.screenX + 100, y: window.screenY + 100 }, lockedMode: false }
      })
    });
  },
  setup (props) {
    const configClone = shallowRef<Config>(AppConfig())

    return {
      leagueId: computed({
        get: () => configClone.value.leagueId,
        set: (value) => {
          configClone.value.leagueId = value;
          updateConfig(configClone.value);
          saveConfig();
        }
      }),
      customLeagueId: computed<string>({
        get: () => !Leagues.isPublicLeague(configClone.value.leagueId ?? '')
          ? configClone.value.leagueId ?? ''
          : '',
        set: (value) => { 
          configClone.value.leagueId = value;
          updateConfig(configClone.value);
          saveConfig();
        }
      }),
      leagues: {
        trade: Leagues.tradeLeagues,
        isLoading: Leagues.isLoading,
        error: Leagues.error,
        load: Leagues.load
      }
    }
  }
})
</script>
