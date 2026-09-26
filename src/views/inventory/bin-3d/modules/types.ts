import type { StorageBin } from '@mdm/api'

export type BinTone = 'available' | 'occupied' | 'abnormal' | 'disabled'

export interface RackColumn {
  number: number
  bins: StorageBin[]
}

export interface RackGroup {
  code: string
  columns: RackColumn[]
  levelCount: number
  binCount: number
}
