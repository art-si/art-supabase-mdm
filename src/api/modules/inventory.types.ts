export type WarehouseStatus = 'enabled' | 'disabled'

export interface WarehouseGroup {
  id: string
  tenantId: string
  domain: 'warehouse'
  parentId: string | null
  code: string
  name: string
  sort: number
  enabled: boolean
  remark?: string | null
}

export interface WarehouseEmployeeReference {
  id: string
  tenantId: string
  employeeNo: string
  employeeName: string
  jobTitle?: string | null
  employmentStatus?: string | null
  organization?: {
    id: string
    organizationCode: string
    organizationName: string
  } | null
}

export interface WarehouseRecord {
  id: string
  tenantId: string
  groupId: string | null
  organizationId: string
  organizationName: string
  warehouseCode: string
  warehouseName: string
  responsibleEmployeeId: string | null
  warehouseType: string
  businessScopes: string[]
  enableLocations: boolean
  enableZones: boolean
  singleSkuPerBin: boolean
  remark?: string | null
  status: WarehouseStatus
  createTime?: string
  updateTime?: string
  group?: Pick<WarehouseGroup, 'id' | 'code' | 'name'> | null
  responsible?: WarehouseEmployeeReference | null
}

export interface WarehouseQuery {
  current: number
  size: number
  keyword?: string
  status?: WarehouseStatus
  groupId?: string
}

export interface WarehouseOverview {
  total: number
  enabled: number
  locationEnabled: number
  managed: number
}

export interface WarehouseWorkspaceResult {
  data: WarehouseRecord[]
  total: number
  groups: WarehouseGroup[]
  overview: WarehouseOverview
}

export interface WarehouseInput {
  groupId: string | null
  organizationId: string
  warehouseCode: string
  warehouseName: string
  responsibleEmployeeId: string | null
  warehouseType: string
  businessScopes: string[]
  enableLocations: boolean
  enableZones: boolean
  singleSkuPerBin: boolean
  remark: string
  status: WarehouseStatus
}

export interface WarehouseGroupInput {
  parentId: string | null
  code: string
  name: string
  sort: number
  enabled: boolean
  remark: string
}

export type InventoryRuleStatus = 'enabled' | 'disabled'
export type SupplyChainCodeAttributeType = 'constant' | 'date' | 'sequence' | 'text'
export type SupplyChainCodeUseMode = 'full' | 'configured'
export type SupplyChainCodePadDirection = 'left' | 'right'

export interface SupplyChainCodeAttribute {
  attributeCode: string
  attributeName: string
  attributeType: SupplyChainCodeAttributeType
  defaultFormat?: string | null
  description?: string | null
  sort: number
  enabled: boolean
}

export interface SupplyChainCodeSegment {
  id?: string
  tenantId?: string
  ruleId?: string
  attributeCode: string
  useMode: SupplyChainCodeUseMode
  format: string
  configuredValue: string
  length: number | null
  step: number
  paddingChar: string
  padDirection: SupplyChainCodePadDirection
  truncate: boolean
  sequenceSource: boolean
  sort: number
  attribute?: SupplyChainCodeAttribute | null
}

export interface SupplyChainCodeRule {
  id: string
  tenantId: string
  ruleCode: string
  ruleName: string
  exampleCode: string
  applyBatch: boolean
  applySerial: boolean
  applyTracking: boolean
  perMaterial: boolean
  separator: string
  status: InventoryRuleStatus
  remark?: string | null
  createTime?: string
  updateTime?: string
  segments: SupplyChainCodeSegment[]
}

export interface SupplyChainCodeRuleInput {
  ruleCode: string
  ruleName: string
  exampleCode: string
  applyBatch: boolean
  applySerial: boolean
  applyTracking: boolean
  perMaterial: boolean
  separator: string
  status: InventoryRuleStatus
  remark: string
  segments: SupplyChainCodeSegment[]
}

export interface InventoryRuleQuery {
  current: number
  size: number
  keyword?: string
  status?: InventoryRuleStatus
}

export interface OutboundSortField {
  fieldCode: string
  sourceCode: string
  sourceName: string
  fieldName: string
  fieldKey: string
  allowedDirections: Array<'asc' | 'desc'>
  description?: string | null
  sort: number
  enabled: boolean
}

export interface OutboundRuleSort {
  id?: string
  tenantId?: string
  ruleId?: string
  fieldCode: string
  direction: 'asc' | 'desc'
  sort: number
  field?: OutboundSortField | null
}

export interface OutboundRule {
  id: string
  tenantId: string
  ruleCode: string
  ruleName: string
  status: InventoryRuleStatus
  remark?: string | null
  createTime?: string
  updateTime?: string
  sorts: OutboundRuleSort[]
}

export interface OutboundRuleInput {
  ruleCode: string
  ruleName: string
  status: InventoryRuleStatus
  remark: string
  sorts: OutboundRuleSort[]
}
