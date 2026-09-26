export interface StorageWarehouse {
  id: string
  tenantId: string
  warehouseCode: string
  warehouseName: string
  warehouseType: string
  businessScopes: string[]
  enableLocations: boolean
  enableZones: boolean
  singleSkuPerBin: boolean
  status: 'enabled' | 'disabled'
}

export interface StorageZone {
  id: string
  tenantId: string
  warehouseId: string
  zoneCode: string
  zoneName: string
  categoryId: string | null
  purpose: string | null
  allowMix: boolean
  requiresInspection: boolean
  allowLock: boolean
  abnormal: boolean
  status: 'enabled' | 'disabled'
  sort: number
  remark: string | null
  category?: { id: string; categoryCode: string; categoryName: string } | null
}

export type StorageZoneInput = Pick<
  StorageZone,
  | 'warehouseId'
  | 'zoneCode'
  | 'zoneName'
  | 'categoryId'
  | 'purpose'
  | 'allowMix'
  | 'requiresInspection'
  | 'allowLock'
  | 'abnormal'
  | 'status'
  | 'sort'
  | 'remark'
>

export interface StorageBin {
  id: string
  tenantId: string
  warehouseId: string
  zoneId: string | null
  parentId: string | null
  binCode: string
  binName: string
  binType: string
  shelfCode: string | null
  levelNo: number | null
  columnNo: number | null
  maxWeightKg: number | null
  maxAreaSqm: number | null
  maxQuantity: number | null
  fixedMaterialId: string | null
  allowMix: boolean
  supportsSerial: boolean
  status: string
  sort: number
  remark: string | null
}

export type StorageBinInput = Omit<StorageBin, 'id' | 'tenantId'>

export interface StorageShelfUpdate {
  warehouseId: string
  zoneId: string | null
  currentShelfCode: string
  shelfCode: string
  levels: number
  columns: number
  applyMaxQuantity: boolean
  maxQuantity: number | null
  expectedBinIds: string[]
}

export interface StorageStockStat {
  materialCount: number
  amount: number | null
  unpricedCount: number
  staleMaterialCount: number
  staleAmount: number | null
  staleUnpricedCount: number
  quantity: number
}

export interface StorageOverview {
  staleDays: number
  zones: Array<StorageStockStat & { zoneId: string }>
  bins: Array<StorageStockStat & { binId: string }>
}

export interface StorageMaterial {
  id: string
  tenantId: string
  materialCode: string
  materialName: string
  specificationModel: string | null
  description: string | null
  materialSource: string | null
  materialType: string | null
  inboundWarehouseId: string | null
  categoryId: string | null
  grossWeight: number | null
}

export interface StorageWorkOrder {
  id: string
  tenantId: string
  workOrderNo: string
  materialId: string | null
  constructionNo: string | null
  allowedIssueWarehouseTypes: string[]
}

export interface InventoryBatch {
  id: string
  tenantId: string
  warehouseId: string
  zoneId: string | null
  binId: string | null
  materialId: string
  batchNo: string
  workOrderId: string | null
  packId: string | null
  quantity: number
  areaSqm: number | null
  lengthMm: number | null
  widthMm: number | null
  thicknessMm: number | null
  unitCost: number | null
  receivedAt: string
  lastMovementAt: string
  status: string
  remark: string | null
  warehouse?: Pick<StorageWarehouse, 'id' | 'warehouseCode' | 'warehouseName'> | null
  zone?: Pick<StorageZone, 'id' | 'zoneCode' | 'zoneName'> | null
  bin?: Pick<StorageBin, 'id' | 'binCode' | 'binName' | 'zoneId'> | null
  material?: StorageMaterial | null
  workOrder?: Pick<StorageWorkOrder, 'id' | 'workOrderNo'> | null
  pack?: { id: string; packNo: string } | null
}

export interface InventoryMovementInput {
  movementType: string
  quantity: number
  areaSqm?: number | null
  unitCost?: number | null
  materialId?: string | null
  warehouseId?: string | null
  zoneId?: string | null
  binId?: string | null
  targetWarehouseId?: string | null
  targetZoneId?: string | null
  targetBinId?: string | null
  batchId?: string | null
  workOrderId?: string | null
  packId?: string | null
  batchNo?: string | null
  referenceNo?: string | null
  remark?: string | null
  lengthMm?: number | null
  widthMm?: number | null
  thicknessMm?: number | null
}

export interface InventoryReservation {
  id: string
  tenantId: string
  workOrderId: string
  materialId: string
  warehouseId: string
  binId: string | null
  reservedQuantity: number
  status: string
  remark: string | null
  createTime: string
  workOrderNo?: string
  materialCode?: string
  materialName?: string
  warehouseName?: string
  binCode?: string | null
}

export interface InventoryPackage {
  id: string
  tenantId: string
  packNo: string
  workOrderId: string
  workOrderNo: string
  constructionNo: string | null
  materialId: string | null
  itemCount: number
  pieceCount: number
  placementId: string | null
  warehouseId: string | null
  binId: string | null
}

export interface InventoryPackageItem {
  id: string
  boardId: string
  pieces: number
  number: string | null
  lengthMm: number | null
  widthMm: number | null
  thicknessMm: number | null
  areaSqm: number | null
  remark: string | null
}

export interface InventorySerial {
  id: string
  tenantId: string
  serialNo: string
  workOrderId: string | null
  materialId: string
  batchId: string | null
  status: string
  warehouseId: string | null
  binId: string | null
  remark: string | null
  createTime: string
  workOrderNo?: string | null
  materialCode?: string
  materialName?: string
  materialDescription?: string | null
  specificationModel?: string | null
  materialSource?: string | null
  materialType?: string | null
  warehouseName?: string | null
  binCode?: string | null
}
