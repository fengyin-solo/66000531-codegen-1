<template>
  <div class="panel">
    <h4>⚠️ 近期告警</h4>
    <div v-if="!anomalies.length" class="empty">暂无告警</div>
    <div v-for="(a,i) in anomalies" :key="i" class="anomaly-row">
      <span class="a-time">{{ ts(a.timestamp) }}</span>
      <span v-for="t in a.triggers" :key="t.rule" class="a-tag">{{ t.rule }}: {{ t.value.toFixed(1) }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useFactoryStore } from '../store/factory'
const store = useFactoryStore()
const anomalies = computed(() => store.data?.anomalies || [])
function ts(t: number) { return new Date(t * 1000).toLocaleTimeString() }
</script>

<style scoped>
.panel{background:#0d1b2a;border-radius:8px;padding:12px;border:1px solid #1e3a5f;flex:1}
.panel h4{color:#f87171;margin-bottom:8px;font-size:13px}
.empty{color:#64748b;font-size:12px}
.anomaly-row{display:flex;gap:8px;padding:4px 0;font-size:11px;color:#fca5a5;flex-wrap:wrap}
.a-time{color:#64748b;min-width:70px}
.a-tag{background:#7f1d1d33;padding:1px 6px;border-radius:3px;border:1px solid #7f1d1d55}
</style>