export type MovementDirection = 'inbound' | 'outbound' | 'transfer'
export type MovementTypeStatus = 'enabled' | 'disabled'

export interface MovementTypeRecord {
  id: string
  tenantId: string
  movementCode: string
  movementName: string
  direction: MovementDirection
  reverseTypeId: string | null
  reversal: boolean
  otherIo: boolean
  status: MovementTypeStatus
  remark: string | null
  createTime: string
  updateTime: string
  reverseType?: Pick<MovementTypeRecord, 'movementCode' | 'movementName'> | null
}

export interface MovementTypeQuery {
  current: number
  size: number
  keyword?: string
  direction?: MovementDirection
  tenantId?: string | null
}

export interface MovementTypeInput {
  tenantId?: string
  movementCode: string
  movementName: string
  direction: MovementDirection
  reverseTypeId: string | null
  reversal: boolean
  otherIo: boolean
  status: MovementTypeStatus
  remark: string | null
}

export interface MovementTypeOption {
  id: string
  tenantId: string
  movementCode: string
  movementName: string
  direction: MovementDirection
  status: MovementTypeStatus
}
