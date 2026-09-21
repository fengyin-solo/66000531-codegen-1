import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { FactoryData, ShiftId, ShiftRecord } from '@/types'

const SHIFT_STORAGE_KEY = 'factory.selectedShift'
const SHIFT_IDS: ShiftId[] = ['morning', 'middle', 'night']
const STALE_MS = 5000 // 超过该时长未收到推送即视为读数已过期
const RECONNECT_MIN_MS = 1000
const RECONNECT_MAX_MS = 10000

function isShiftId(v: unknown): v is ShiftId {
  return typeof v === 'string' && (SHIFT_IDS as string[]).includes(v)
}

function loadStoredShift(): ShiftId | null {
  try {
    const v = localStorage.getItem(SHIFT_STORAGE_KEY)
    return isShiftId(v) ? v : null
  } catch {
    return null
  }
}

export const useFactoryStore = defineStore('factory', () => {
  const data = ref<FactoryData | null>(null)
  const connected = ref(false)
  const stale = ref(false)

  // 最近一帧的接收时刻；断线期间 data 整体保留，只通过它判断是否已过期
  const lastReceivedAt = ref(0)

  // 刷新后仍停在上次选择的班次；未选择过则等首帧数据对齐到当班
  const stored = loadStoredShift()
  const selectedShift = ref<ShiftId>(stored ?? 'morning')
  let userPicked = stored !== null

  let ws: WebSocket | null = null
  let reconnectDelay = 0
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let ticker: ReturnType<typeof setInterval> | null = null

  function persistShift(id: ShiftId) {
    try { localStorage.setItem(SHIFT_STORAGE_KEY, id) } catch {}
  }

  function selectShift(id: ShiftId) {
    userPicked = true
    selectedShift.value = id
    persistShift(id)
  }

  const shiftRecords = computed<ShiftRecord[]>(() => data.value?.shifts ?? [])
  const selectedShiftRecord = computed<ShiftRecord | undefined>(
    () => shiftRecords.value.find(s => s.id === selectedShift.value),
  )
  // 今日产量取服务端当班累计权威值，前端从不累加 -> 重复进入页面不会翻倍
  const shiftProduction = computed(() => selectedShiftRecord.value?.production ?? 0)
  const shiftRunningSeconds = computed(() => selectedShiftRecord.value?.running_seconds ?? 0)
  const lineStatus = computed(() => data.value?.line_status ?? 'IDLE')
  const currentShift = computed<ShiftId | undefined>(() => data.value?.current_shift)

  function refreshStale() {
    stale.value = !!data.value && (!connected.value || Date.now() - lastReceivedAt.value >= STALE_MS)
  }

  function startTicker() {
    if (ticker) return
    ticker = setInterval(refreshStale, 1000)
  }

  function scheduleReconnect() {
    if (ws || reconnectTimer) return
    const delay = reconnectDelay === 0 ? RECONNECT_MIN_MS : reconnectDelay
    reconnectDelay = Math.min(RECONNECT_MAX_MS, delay * 2)
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      connect()
    }, delay)
  }

  function connect() {
    if (ws) return
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
    let s: WebSocket
    try {
      s = new WebSocket(`${protocol}//${location.hostname}:8000/ws`)
    } catch {
      scheduleReconnect()
      return
    }
    ws = s
    startTicker()

    s.onopen = () => {
      connected.value = true
      reconnectDelay = 0
      refreshStale()
      console.log('WS connected')
    }
    s.onmessage = (e) => {
      try {
        const parsed = JSON.parse(e.data) as FactoryData
        // 首帧且用户从未手动选过班次时，跟随服务端当班
        if (!userPicked && isShiftId(parsed.current_shift)) {
          selectedShift.value = parsed.current_shift
        }
        // 连接恢复后用最新一帧整体替换，不做增量合并，读数按最新数据重算
        data.value = parsed
        lastReceivedAt.value = Date.now()
        connected.value = true
        stale.value = false
      } catch {}
    }
    s.onclose = () => {
      if (ws === s) ws = null
      connected.value = false
      // 保留最后一份读数，仅标记已过期，并安排自动重连
      refreshStale()
      scheduleReconnect()
    }
    s.onerror = () => { try { s.close() } catch {} }
  }

  function disconnect() {
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null }
    if (ticker) { clearInterval(ticker); ticker = null }
    reconnectDelay = 0
    ws?.close()
    ws = null
    connected.value = false
  }

  return {
    data, connected, stale, selectedShift,
    shiftRecords, selectedShiftRecord, shiftProduction, shiftRunningSeconds,
    lineStatus, currentShift,
    connect, disconnect, selectShift,
  }
})
