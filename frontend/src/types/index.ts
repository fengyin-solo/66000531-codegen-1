export interface Device {
  id: number; type: string; status: string; position: number[]
  temperature: number; vibration: number; pressure: number
  production_count: number; fault_count: number
  uptime: number; quality_rate: number
}

export interface Anomaly {
  timestamp: number; triggers: { device_id: number; rule: string; value: number; threshold: string }[]
  device_type: string
}

export interface OEEItem {
  id: number; type: string; oee: number
  availability: number; performance: number; quality: number
}

export interface ShiftInfo {
  id: string; name: string; window: string
  active: boolean; status: string
  production: number; run_seconds: number
}

export interface FactoryData {
  devices: Device[]
  production: number
  anomalies: Anomaly[]
  oee: OEEItem[]
  shifts: ShiftInfo[]
  current_shift?: string
}

export const DEVICE_COLORS: Record<string, string> = {
  CNC: '#e74c3c', RobotArm: '#3498db', Conveyor: '#f39c12',
  AGV: '#2ecc71', InjectionMolding: '#9b59b6', QCStation: '#1abc9c'
}

export const STATUS_COLORS: Record<string, string> = {
  RUNNING: '#2ecc71', IDLE: '#f1c40f', FAULT: '#e74c3c', OFFLINE: '#95a5a6'
}

export const SHIFT_STATUS_TEXT: Record<string, string> = {
  RUNNING: '运行中', IDLE: '空闲', FAULT: '故障', OFFLINE: '离线',
  ENDED: '已结束', PENDING: '未开始'
}

export const SHIFT_STATUS_COLORS: Record<string, string> = {
  ...STATUS_COLORS, ENDED: '#94a3b8', PENDING: '#64748b'
}