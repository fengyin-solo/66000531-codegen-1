<template>
  <div class="panel">
    <h4>📋 设备状态</h4>
    <div class="dev-list">
      <div v-for="dev in devices" :key="dev.id" class="dev-row" :style="{borderLeftColor: STATUS_COLORS[dev.status]}">
        <div class="dev-info">
          <span class="dev-type">{{ dev.type }}</span>
          <span class="dev-id">#{{ dev.id }}</span>
        </div>
        <div class="dev-metrics">
          <span class="metric">{{ dev.temperature.toFixed(1) }}°C</span>
          <span class="metric">{{ dev.vibration.toFixed(2) }}mm/s</span>
        </div>
        <el-tag size="small" :type="tagType(dev.status)">{{ dev.status }}</el-tag>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useFactoryStore } from '../store/factory'
import { STATUS_COLORS } from '../types'
const store = useFactoryStore()
const devices = computed(() => store.data?.devices || [])

function tagType(s: string) {
  const m: Record<string, any> = { RUNNING: 'success', IDLE: 'warning', FAULT: 'danger' }
  return m[s] || 'info'
}
</script>

<style scoped>
.panel{background:#0d1b2a;border-radius:8px;padding:12px;border:1px solid #1e3a5f}
.panel h4{color:#64b5f6;margin-bottom:8px;font-size:13px}
.dev-list{display:flex;flex-direction:column;gap:4px;max-height:250px;overflow-y:auto}
.dev-row{display:flex;justify-content:space-between;align-items:center;padding:6px 8px;background:#112233;border-radius:4px;border-left:3px solid #666}
.dev-info{display:flex;gap:6px;align-items:center}
.dev-type{font-size:12px;color:#e0e6ed;font-weight:600}
.dev-id{font-size:11px;color:#64748b}
.dev-metrics{display:flex;gap:10px;font-size:11px;color:#94a3b8}
</style>