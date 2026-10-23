import { isPlainObjectRecord } from '@/utils/type-guards'
import type { EquipmentReference, ProductionEquipmentInput } from '@mdm/api'

export interface PreparedProductionEquipmentImport {
  fileRow: number
  payload: ProductionEquipmentInput
}

/** Resolve tenant-owned references and validate the complete file before the first write. */
export function prepareProductionEquipmentImport(
  rows: readonly unknown[],
  categories: readonly EquipmentReference[],
  departments: readonly EquipmentReference[],
  selectedTenantId?: string
): PreparedProductionEquipmentImport[] {
  if (!rows.length || rows.length > 1000) throw new Error('每次可导入 1 至 1000 行生产设备')
  const categoryIndex = indexReferences(categories, selectedTenantId)
  const departmentIndex = indexReferences(departments, selectedTenantId)
  const equipmentCodes = new Set<string>()
  return rows.map((raw, index) => {
    const fileRow = index + 2
    if (!isPlainObjectRecord(raw)) throw new Error(`第 ${fileRow} 行格式无效`)
    const departmentSource = String(raw['部门/产线'] ?? '').trim()
    const department = requireUniqueReference(
      departmentIndex.get(departmentSource),
      fileRow,
      '部门/产线',
      departmentSource,
      !selectedTenantId
    )
    const categorySource = String(raw['设备分类'] ?? '').trim()
    const category = requireUniqueReference(
      categoryIndex.get(categorySource)?.filter((item) => item.tenantId === department.tenantId),
      fileRow,
      '设备分类',
      categorySource
    )
    const equipmentName = String(raw['设备名称'] ?? '').trim()
    if (!equipmentName) throw new Error(`第 ${fileRow} 行缺少设备名称`)
    const equipmentCode = String(raw['设备编号'] ?? '').trim()
    if (equipmentCode) {
      const duplicateKey = `${department.tenantId}\u0000${equipmentCode}`
      if (equipmentCodes.has(duplicateKey))
        throw new Error(`第 ${fileRow} 行设备编号在同一目标租户内重复：${equipmentCode}`)
      equipmentCodes.add(duplicateKey)
    }
    return {
      fileRow,
      payload: {
        tenantId: department.tenantId,
        categoryId: category.id,
        productionDepartmentId: department.id,
        equipmentCode,
        equipmentName,
        equipmentBrand: String(raw['设备品牌'] ?? '').trim(),
        model: String(raw['设备型号'] ?? '').trim(),
        factoryNo: String(raw['序列号'] ?? '').trim(),
        fixedAssetNo: String(raw['固定资产编码'] ?? '').trim(),
        syncWorkCenter: false,
        operationStatus: 'normal',
        status: 'enabled',
        sort: 10
      }
    }
  })
}

function indexReferences(
  references: readonly EquipmentReference[],
  selectedTenantId?: string
): Map<string, EquipmentReference[]> {
  const index = new Map<string, EquipmentReference[]>()
  for (const reference of references) {
    if (selectedTenantId && reference.tenantId !== selectedTenantId) continue
    for (const key of new Set([reference.code.trim(), reference.name.trim()])) {
      if (!key) continue
      const matches = index.get(key)
      if (matches) matches.push(reference)
      else index.set(key, [reference])
    }
  }
  return index
}

function requireUniqueReference(
  matches: readonly EquipmentReference[] | undefined,
  fileRow: number,
  label: string,
  source: string,
  suggestTenantSelection = false
): EquipmentReference {
  if (!source || !matches?.length)
    throw new Error(`第 ${fileRow} 行缺少有效${label}：${source || '未填写'}`)
  if (matches.length > 1) {
    const suggestion = suggestTenantSelection ? '，请先选择目标租户后重新导入' : ''
    throw new Error(`第 ${fileRow} 行${label}存在多个匹配记录：${source}${suggestion}`)
  }
  return matches[0]
}
