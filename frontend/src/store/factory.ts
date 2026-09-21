import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { FactoryData, ShiftInfo } from '@/types'

const SHIFT_STORAGE_KEY = 'dt_selected_shift'

export const useFactoryStore = defineStore('factory', () => {
  const data = ref<FactoryData | null>(null)
  const ws = ref<WebSocket | null>(null)
  const connected = ref(false)
  // 刷新后仍停留在同一班次
  const selectedShiftId = ref<string>(localStorage.getItem(SHIFT_STORAGE_KEY) || '')

  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let intentionalClose = false

  const shifts = computed<ShiftInfo[]>(() => data.value?.shifts || [])
  // 选中的班次无效（如跨天）时回退到当前进行中的班次
  const currentShift = computed<ShiftInfo | null>(() =>
    shifts.value.find(s => s.id === selectedShiftId.value)
    || shifts.value.find(s => s.active)
    || shifts.value[0] || null)
  // 连接断开但手里还有上一份数据 -> 读数已过期，保留展示
  const stale = computed(() => !connected.value && data.value !== null)

  function selectShift(id: string) {
    selectedShiftId.value = id
    localStorage.setItem(SHIFT_STORAGE_KEY, id)
  }

  function connect() {
    if (ws.value) return
    intentionalClose = false
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
    const s = new WebSocket(`${protocol}//${location.hostname}:8000/ws`)
    s.onopen = () => { connected.value = true; console.log('WS connected') }
    s.onmessage = (e) => {
      // 服务端推送的是各班次累计值，直接整体替换，不做本地累加
      try { data.value = JSON.parse(e.data) } catch {}
    }
    s.onclose = () => {
      connected.value = false
      ws.value = null
      // 非主动断开时自动重连，恢复后按最新数据重算
      if (!intentionalClose) {
        reconnectTimer = setTimeout(connect, 3000)
      }
    }
    ws.value = s
  }

  function disconnect() {
    intentionalClose = true
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null }
    ws.value?.close()
    ws.value = null
    connected.value = false
  }

  return { data, connected, shifts, currentShift, stale, selectedShiftId, selectShift, connect, disconnect }
})
