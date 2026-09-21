<template>
  <div class="shift-bar">
    <div class="shift-tabs">
      <button v-for="s in store.shifts" :key="s.id" class="shift-tab"
        :class="{active: current?.id === s.id}" @click="store.selectShift(s.id)">
        <span class="tab-name">{{ s.name }}</span>
        <span class="tab-window">{{ s.window }}</span>
        <span v-if="s.active" class="live-dot" title="当前班次"></span>
      </button>
    </div>
    <div class="shift-readings" :class="{stale: store.stale}">
      <div class="reading">
        <span class="r-label">运行状态</span>
        <span class="r-value" :style="{color: statusColor}">{{ statusText }}</span>
      </div>
      <div class="reading">
        <span class="r-label">连续运行时长</span>
        <span class="r-value mono">{{ durationText }}</span>
      </div>
      <div class="reading">
        <span class="r-label">今日产量</span>
        <span class="r-value prod">{{ current?.production ?? 0 }}</span>
      </div>
      <span v-if="store.stale" class="stale-badge">⚠ 数据已过期</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useFactoryStore } from '../store/factory'
import { SHIFT_STATUS_COLORS, SHIFT_STATUS_TEXT } from '../types'

const store = useFactoryStore()
const current = computed(() => store.currentShift)

const statusText = computed(() =>
  current.value ? (SHIFT_STATUS_TEXT[current.value.status] ?? current.value.status) : '--')
const statusColor = computed(() =>
  current.value ? (SHIFT_STATUS_COLORS[current.value.status] ?? '#94a3b8') : '#64748b')
const durationText = computed(() => {
  const sec = current.value?.run_seconds ?? 0
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(Math.floor(sec / 3600))}:${pad(Math.floor((sec % 3600) / 60))}:${pad(sec % 60)}`
})
</script>

<style scoped>
.shift-bar{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;margin:12px 24px 0;padding:10px 16px;background:#0d1b2a;border:1px solid #1e3a5f;border-radius:10px}
.shift-tabs{display:flex;gap:8px}
.shift-tab{display:flex;align-items:center;gap:8px;padding:6px 14px;background:#112233;border:1px solid #1e3a5f;border-radius:8px;color:#94a3b8;font-size:13px;cursor:pointer;transition:all .15s}
.shift-tab:hover{border-color:#64b5f6}
.shift-tab.active{background:#1a3a5c;border-color:#64b5f6;color:#e0e6ed}
.tab-name{font-weight:600}
.tab-window{font-size:11px;color:#64748b}
.live-dot{width:7px;height:7px;border-radius:50%;background:#22c55e;box-shadow:0 0 6px #22c55e}
.shift-readings{display:flex;gap:24px;align-items:center;flex-wrap:wrap}
.reading{display:flex;flex-direction:column;gap:2px}
.r-label{font-size:11px;color:#64748b}
.r-value{font-size:16px;font-weight:600;color:#e0e6ed}
.r-value.mono{font-family:ui-monospace,monospace;font-variant-numeric:tabular-nums}
.r-value.prod{color:#fbbf24}
.shift-readings.stale .r-value{opacity:.45}
.stale-badge{font-size:12px;color:#fbbf24;background:#fbbf2415;border:1px solid #fbbf2455;padding:2px 10px;border-radius:10px}
</style>
