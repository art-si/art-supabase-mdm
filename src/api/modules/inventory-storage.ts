import { useSupabase } from '@/hooks'
import { buildOrIlikeFilter } from '@/utils/supabase/search'
import { normalizeNullableText } from '@/utils/form/normalize'
import type {
  InventoryBatch,
  InventoryMovementInput,
  InventoryPackage,
  InventoryPackageItem,
  InventoryReservation,
  InventorySerial,
  StorageBin,
  StorageBinInput,
  StorageMaterial,
  StorageOverview,
  StorageWarehouse,
  StorageWorkOrder,
  StorageZone,
  StorageZoneInput
} from './inventory-storage.types'

export * from './inventory-storage.types'

const { supabase, responseHandle, keysToSnakeDeep } = useSupabase()
const readOptions = {
  breakReturn: true,
  showErrorMessage: false,
  errorMessage: '仓储数据加载失败，请重试'
}
const writeOptions = {
  breakReturn: true,
  showErrorMessage: true,
  showMessage: true,
  requireAffected: true,
  errorMessage: '仓储操作失败，请检查数据和当前权限'
}

export async function fetchStorageWarehouses(): Promise<StorageWarehouse[]> {
  const { data } = await responseHandle<StorageWarehouse[]>(
    () =>
      supabase
        .from('mdm_warehouse')
        .select(
          'id,tenant_id,warehouse_code,warehouse_name,warehouse_type,business_scopes,enable_locations,enable_zones,single_sku_per_bin,status'
        )
        .order('warehouse_code'),
    readOptions
  )
  return data ?? []
}

export async function fetchStorageZones(warehouseId: string): Promise<StorageZone[]> {
  const { data } = await responseHandle<StorageZone[]>(
    () =>
      supabase
        .from('mdm_warehouse_zone')
        .select(
          '*,category:mdm_material_category!mdm_warehouse_zone_category_fk(id,category_code,category_name)'
        )
        .eq('warehouse_id', warehouseId)
        .order('sort')
        .order('zone_code'),
    readOptions
  )
  return data ?? []
}

export async function fetchStorageBins(warehouseId: string): Promise<StorageBin[]> {
  const { data } = await responseHandle<StorageBin[]>(
    () =>
      supabase
        .from('mdm_warehouse_bin')
        .select('*')
        .eq('warehouse_id', warehouseId)
        .order('sort')
        .order('bin_code'),
    readOptions
  )
  return data ?? []
}

export async function fetchStorageOverview(warehouseId: string): Promise<StorageOverview> {
  const { data } = await responseHandle<StorageOverview>(
    () => supabase.rpc('wms_storage_overview_secure', { p_warehouse_id: warehouseId }),
    readOptions
  )
  return data ?? { staleDays: 90, zones: [], bins: [] }
}

export interface InventoryPolicy {
  staleDays: number
  autoReserveOnRelease: boolean
}

export async function fetchInventoryPolicy(tenantId: string): Promise<InventoryPolicy> {
  const { data } = await responseHandle<InventoryPolicy>(
    () =>
      supabase
        .from('wms_inventory_policy')
        .select('stale_days,auto_reserve_on_release')
        .eq('tenant_id', tenantId)
        .maybeSingle(),
    readOptions
  )
  return data ?? { staleDays: 90, autoReserveOnRelease: true }
}

export async function saveInventoryPolicy(
  tenantId: string,
  policy: InventoryPolicy
): Promise<void> {
  await responseHandle(
    () =>
      supabase
        .from('wms_inventory_policy')
        .upsert({ tenant_id: tenantId, ...keysToSnakeDeep(policy) }, { onConflict: 'tenant_id' })
        .select('tenant_id'),
    { ...writeOptions, message: '库存策略已保存' }
  )
}

export async function fetchStorageMaterials(
  tenantId: string,
  keyword = ''
): Promise<StorageMaterial[]> {
  let query = supabase
    .from('mdm_material')
    .select(
      'id,tenant_id,material_code,material_name,specification_model,description,material_source,material_type,inbound_warehouse_id,category_id,gross_weight'
    )
    .eq('tenant_id', tenantId)
    .eq('status', 'enabled')
    .order('material_code')
    .limit(100)
  if (keyword.trim())
    query = query.or(buildOrIlikeFilter(['material_code', 'material_name'], keyword))
  const { data } = await responseHandle<StorageMaterial[]>(() => query, readOptions)
  return data ?? []
}

export async function fetchStorageMaterialsPage(
  tenantId: string,
  keyword: string,
  current: number,
  size: number
) {
  let query = supabase
    .from('mdm_material')
    .select(
      'id,tenant_id,material_code,material_name,specification_model,description,material_source,material_type,inbound_warehouse_id,category_id,gross_weight',
      { count: 'exact' }
    )
    .eq('tenant_id', tenantId)
    .eq('status', 'enabled')
    .order('material_code')
    .range((current - 1) * size, current * size - 1)
  if (keyword.trim())
    query = query.or(buildOrIlikeFilter(['material_code', 'material_name'], keyword))
  const { data, total } = await responseHandle<StorageMaterial[]>(() => query, readOptions)
  return { data: data ?? [], total: total ?? 0 }
}

export async function fetchStorageMaterial(id: string): Promise<StorageMaterial | null> {
  const { data } = await responseHandle<StorageMaterial>(
    () =>
      supabase
        .from('mdm_material')
        .select(
          'id,tenant_id,material_code,material_name,specification_model,description,material_source,material_type,inbound_warehouse_id,category_id,gross_weight'
        )
        .eq('id', id)
        .maybeSingle(),
    readOptions
  )
  return data ?? null
}

export async function fetchStorageWorkOrders(
  warehouseId: string,
  keyword = ''
): Promise<StorageWorkOrder[]> {
  const { data } = await responseHandle<StorageWorkOrder[]>(
    () =>
      supabase.rpc('wms_work_order_options_secure', {
        p_warehouse_id: warehouseId,
        p_keyword: normalizeNullableText(keyword)
      }),
    readOptions
  )
  return data ?? []
}

export async function saveStorageZone(
  tenantId: string,
  payload: StorageZoneInput,
  id?: string
): Promise<void> {
  const data = { ...keysToSnakeDeep(payload), tenant_id: tenantId }
  await responseHandle(
    () =>
      id
        ? supabase.from('mdm_warehouse_zone').update(data).eq('id', id).select('id')
        : supabase.from('mdm_warehouse_zone').insert(data).select('id'),
    { ...writeOptions, message: id ? '库区已更新' : '库区已创建' }
  )
}

export async function deleteStorageZone(id: string): Promise<void> {
  await responseHandle(
    () => supabase.from('mdm_warehouse_zone').delete().eq('id', id).select('id'),
    { ...writeOptions, message: '库区已删除' }
  )
}

export async function reorderStorageZones(zoneIds: string[]): Promise<void> {
  await responseHandle(
    () => supabase.rpc('mdm_reorder_warehouse_zones_secure', { p_zone_ids: zoneIds }),
    { ...writeOptions, requireAffected: false, message: '库区顺序已保存' }
  )
}

export async function saveStorageBin(
  tenantId: string,
  payload: StorageBinInput,
  id?: string
): Promise<void> {
  const data = { ...keysToSnakeDeep(payload), tenant_id: tenantId }
  await responseHandle(
    () =>
      id
        ? supabase.from('mdm_warehouse_bin').update(data).eq('id', id).select('id')
        : supabase.from('mdm_warehouse_bin').insert(data).select('id'),
    { ...writeOptions, message: id ? '库位已更新' : '库位已创建' }
  )
}

export async function createShelfBins(tenantId: string, bins: StorageBinInput[]): Promise<void> {
  await responseHandle(
    () =>
      supabase
        .from('mdm_warehouse_bin')
        .insert(bins.map((bin) => ({ ...keysToSnakeDeep(bin), tenant_id: tenantId })))
        .select('id'),
    { ...writeOptions, message: '货架库位已生成' }
  )
}

export async function deleteStorageBin(id: string): Promise<void> {
  await responseHandle(
    () => supabase.from('mdm_warehouse_bin').delete().eq('id', id).select('id'),
    { ...writeOptions, message: '库位已删除' }
  )
}

export interface InventoryBatchQuery {
  warehouseId?: string
  zoneBinIds?: string[]
  binId?: string
  keyword?: string
  positiveOnly?: boolean
  current: number
  size: number
}

export async function fetchInventoryBatches(params: InventoryBatchQuery) {
  let query = supabase
    .from('wms_inventory_batch')
    .select(
      '*,warehouse:mdm_warehouse!wms_inventory_batch_warehouse_fk(id,warehouse_code,warehouse_name),bin:mdm_warehouse_bin!wms_inventory_batch_bin_fk(id,bin_code,bin_name,zone_id),material:mdm_material!wms_inventory_batch_material_fk(id,tenant_id,material_code,material_name,specification_model,description,material_source,material_type,category_id,gross_weight)',
      { count: 'exact' }
    )
    .order('last_movement_at', { ascending: false })
  if (params.warehouseId) query = query.eq('warehouse_id', params.warehouseId)
  if (params.binId) query = query.eq('bin_id', params.binId)
  if (params.zoneBinIds) {
    if (!params.zoneBinIds.length)
      return { data: [] as InventoryBatch[], total: 0, current: params.current, size: params.size }
    query = query.in('bin_id', params.zoneBinIds)
  }
  if (params.positiveOnly) query = query.gt('quantity', 0)
  if (params.keyword?.trim())
    query = query.or(buildOrIlikeFilter(['batch_no', 'remark'], params.keyword))
  query = query.range((params.current - 1) * params.size, params.current * params.size - 1)
  const { data, total } = await responseHandle<InventoryBatch[]>(() => query, readOptions)
  return { data: data ?? [], total: total ?? 0, current: params.current, size: params.size }
}

export async function postInventoryMovement(payload: InventoryMovementInput): Promise<void> {
  await responseHandle(
    () =>
      supabase.rpc('wms_post_inventory_movement_secure', { p_payload: keysToSnakeDeep(payload) }),
    { ...writeOptions, requireAffected: false, message: '库存业务已办理' }
  )
}

export async function fetchInventoryReservations(params: {
  warehouseId?: string
  status?: string
  current: number
  size: number
}) {
  const from = (params.current - 1) * params.size
  const { data } = await responseHandle<{ data: InventoryReservation[]; total: number }>(
    () =>
      supabase.rpc('wms_list_reservations_secure', {
        p_warehouse_id: params.warehouseId || null,
        p_status: params.status || null,
        p_from: from,
        p_to: from + params.size - 1
      }),
    readOptions
  )
  return {
    data: data?.data ?? [],
    total: data?.total ?? 0,
    current: params.current,
    size: params.size
  }
}

export async function saveInventoryReservation(
  tenantId: string,
  payload: Omit<InventoryReservation, 'id' | 'tenantId' | 'createTime' | 'status'>
): Promise<void> {
  await responseHandle(
    () =>
      supabase
        .from('wms_inventory_reservation')
        .insert({ ...keysToSnakeDeep(payload), tenant_id: tenantId, status: 'active' })
        .select('id'),
    { ...writeOptions, message: '库存已预留' }
  )
}

export async function releaseInventoryReservation(id: string): Promise<void> {
  await responseHandle(
    () =>
      supabase
        .from('wms_inventory_reservation')
        .update({ status: 'released' })
        .eq('id', id)
        .eq('status', 'active')
        .select('id'),
    { ...writeOptions, message: '预留已释放' }
  )
}

export async function fetchInventoryPackages(params: {
  warehouseId: string
  keyword?: string
  current: number
  size: number
}) {
  const from = (params.current - 1) * params.size
  const { data } = await responseHandle<{ data: InventoryPackage[]; total: number }>(
    () =>
      supabase.rpc('wms_list_packages_secure', {
        p_warehouse_id: params.warehouseId,
        p_keyword: normalizeNullableText(params.keyword),
        p_from: from,
        p_to: from + params.size - 1
      }),
    readOptions
  )
  return {
    data: data?.data ?? [],
    total: data?.total ?? 0,
    current: params.current,
    size: params.size
  }
}

export async function fetchInventoryPackageItems(packId: string): Promise<InventoryPackageItem[]> {
  const { data } = await responseHandle<InventoryPackageItem[]>(
    () => supabase.rpc('wms_package_items_secure', { p_pack_id: packId }),
    readOptions
  )
  return data ?? []
}

export async function placeInventoryPackage(
  tenantId: string,
  packId: string,
  warehouseId: string,
  binId: string | null
): Promise<void> {
  await responseHandle(
    () =>
      supabase
        .from('wms_package_placement')
        .upsert(
          { tenant_id: tenantId, pack_id: packId, warehouse_id: warehouseId, bin_id: binId },
          { onConflict: 'tenant_id,pack_id' }
        )
        .select('id'),
    { ...writeOptions, message: '垛包落位已保存' }
  )
}

export async function unplaceInventoryPackage(id: string): Promise<void> {
  await responseHandle(
    () => supabase.from('wms_package_placement').delete().eq('id', id).select('id'),
    { ...writeOptions, message: '垛包落位已解除' }
  )
}

export async function fetchInventorySerials(params: {
  warehouseId?: string
  status?: string
  keyword?: string
  current: number
  size: number
}) {
  const from = (params.current - 1) * params.size
  const { data } = await responseHandle<{ data: InventorySerial[]; total: number }>(
    () =>
      supabase.rpc('wms_list_serials_secure', {
        p_warehouse_id: params.warehouseId || null,
        p_status: params.status || null,
        p_keyword: normalizeNullableText(params.keyword),
        p_from: from,
        p_to: from + params.size - 1
      }),
    readOptions
  )
  return {
    data: data?.data ?? [],
    total: data?.total ?? 0,
    current: params.current,
    size: params.size
  }
}

export async function saveInventorySerial(
  tenantId: string,
  payload: Omit<InventorySerial, 'id' | 'tenantId' | 'createTime'>,
  id?: string
): Promise<void> {
  const data = { ...keysToSnakeDeep(payload), tenant_id: tenantId }
  await responseHandle(
    () =>
      id
        ? supabase.from('wms_serial_number').update(data).eq('id', id).select('id')
        : supabase.from('wms_serial_number').insert(data).select('id'),
    { ...writeOptions, message: id ? '序列号已更新' : '序列号已创建' }
  )
}
