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

export type ShiftId = 'morning' | 'middle' | 'night'

export interface ShiftRecord {
  id: ShiftId
  name: string
  production: number
  running_seconds: number
}

export interface FactoryData {
  devices: Device[]
  production: number
  anomalies: Anomaly[]
  oee: OEEItem[]
  line_status?: string
  current_shift?: ShiftId
  shift_date?: string
  shifts?: ShiftRecord[]
}

export const SHIFTS: { id: ShiftId; name: string }[] = [
  { id: 'morning', name: '早班' },
  { id: 'middle', name: '中班' },
  { id: 'night', name: '晚班' },
]

export const SHIFT_NAMES: Record<string, string> = {
  morning: '早班 (00:00-08:00)',
  middle: '中班 (08:00-16:00)',
  night: '晚班 (16:00-24:00)',
}

export const STATUS_TEXT: Record<string, string> = {
  RUNNING: '运行中', IDLE: '待机', FAULT: '故障', OFFLINE: '离线',
}

export const DEVICE_COLORS: Record<string, string> = {
  CNC: '#e74c3c', RobotArm: '#3498db', Conveyor: '#f39c12',
  AGV: '#2ecc71', InjectionMolding: '#9b59b6', QCStation: '#1abc9c'
}

export const STATUS_COLORS: Record<string, string> = {
  RUNNING: '#2ecc71', IDLE: '#f1c40f', FAULT: '#e74c3c', OFFLINE: '#95a5a6'
}