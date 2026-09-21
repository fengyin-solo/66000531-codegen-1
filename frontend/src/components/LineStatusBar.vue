<template>
  <div class="line-bar" :class="{ 'is-stale': store.stale }">
    <div class="shift-tabs">
      <button
        v-for="s in SHIFTS"
        :key="s.id"
        class="shift-tab"
        :class="{ active: store.selectedShift === s.id }"
        @click="store.selectShift(s.id)"
      >
        {{ s.name }}
        <span v-if="store.currentShift === s.id && store.data" class="current-dot" title="当前班次"></span>
      </button>
    </div>

    <div class="line-readings">
      <div class="reading">
        <span class="label">产线状态</span>
        <span class="value status-value" :style="{ color: statusColor }">
          <span class="status-dot" :style="{ background: statusColor }"></span>
          {{ statusText }}
        </span>
      </div>
      <div class="reading">
        <span class="label">连续运行时长</span>
        <span class="value duration">{{ formattedDuration }}</span>
      </div>
      <div class="reading">
        <span class="label">今日产量（{{ shiftName }}）</span>
        <span class="value production">{{ hasData ? store.shiftProduction : '—' }}</span>
        <span class="unit">件</span>
      </div>
    </div>

    <span v-if="store.stale" class="stale-tag">● 数据已过期 · 等待重连</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useFactoryStore } from '../store/factory'
import { SHIFTS, STATUS_COLORS, STATUS_TEXT } from '../types'

const store = useFactoryStore()

const hasData = computed(() => !!store.data)
const statusText = computed(() =>
  store.data ? (STATUS_TEXT[store.lineStatus] || store.lineStatus) : '等待数据',
)
const statusColor = computed(() =>
  store.data ? (STATUS_COLORS[store.lineStatus] || '#95a5a6') : '#64748b',
)
const shiftName = computed(
  () => SHIFTS.find(s => s.id === store.selectedShift)?.name ?? '',
)
const formattedDuration = computed(() => {
  if (!store.data) return '--:--:--'
  const total = store.shiftRunningSeconds
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const sec = total % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(h)}:${pad(m)}:${pad(sec)}`
})
</script>

<style scoped>
.line-bar{display:flex;align-items:center;gap:24px;margin:12px 24px 0;padding:10px 16px;
  background:linear-gradient(90deg,#0d2137,#12304d);border:1px solid #1e3a5f;border-radius:10px;
  transition:border-color .2s,box-shadow .2s}
.line-bar.is-stale{border-color:#b45309;box-shadow:0 0 0 1px #b4530955 inset}
.shift-tabs{display:flex;gap:6px}
.shift-tab{position:relative;display:inline-flex;align-items:center;gap:6px;padding:6px 14px;
  background:#112233;border:1px solid #1e3a5f;border-radius:6px;color:#94a3b8;font-size:13px;
  cursor:pointer;transition:all .15s}
.shift-tab:hover{color:#e0e6ed;border-color:#3b5a7f}
.shift-tab.active{background:#1a3a5c;color:#64b5f6;border-color:#64b5f6;font-weight:600}
.current-dot{width:6px;height:6px;border-radius:50%;background:#22c55e;box-shadow:0 0 6px #22c55e}
.line-readings{display:flex;align-items:center;gap:28px;flex:1}
.reading{display:flex;align-items:baseline;gap:8px}
.reading .label{font-size:12px;color:#64748b}
.reading .value{font-size:15px;font-weight:600;color:#e0e6ed;font-variant-numeric:tabular-nums}
.status-value{display:inline-flex;align-items:center;gap:6px}
.status-dot{width:8px;height:8px;border-radius:50%;display:inline-block}
.duration{color:#7dd3fc;font-family:ui-monospace,Menlo,monospace}
.production{color:#fbbf24}
.unit{font-size:11px;color:#64748b}
.stale-tag{font-size:12px;color:#fbbf24;background:#b4530922;border:1px solid #b4530966;
  padding:3px 10px;border-radius:999px;white-space:nowrap}
</style>
