import { useSupabase } from '@/hooks'
import { normalizeNullableText } from '@/utils/form/normalize'
import type {
  InventoryRuleQuery,
  OutboundRule,
  OutboundRuleInput,
  OutboundSortField,
  SupplyChainCodeAttribute,
  SupplyChainCodeRule,
  SupplyChainCodeRuleInput,
  WarehouseGroupInput,
  WarehouseInput,
  WarehouseQuery,
  WarehouseWorkspaceResult
} from './inventory.types'
import { buildOrIlikeFilter } from '@/utils/supabase/search'
import { buildSupabasePageRange } from '@/utils/supabase/pagination'

export * from './inventory.types'

const { supabase, responseHandle, keysToSnakeDeep } = useSupabase()
const readOptions = {
  breakReturn: true,
  showErrorMessage: false,
  errorMessage: '仓库主数据加载失败，请重试'
}
const writeOptions = {
  breakReturn: true,
  showErrorMessage: true,
  showMessage: true,
  requireAffected: false,
  errorMessage: '仓库主数据操作失败，请检查编码、关联数据和当前权限'
}

export async function fetchWarehouseWorkspace(
  params: WarehouseQuery,
  options?: { signal?: AbortSignal }
): Promise<WarehouseWorkspaceResult> {
  const { from, to } = buildSupabasePageRange(params)
  let request = supabase.rpc('mdm_list_warehouses_secure', {
    p_from: from,
    p_to: to,
    p_keyword: normalizeNullableText(params.keyword),
    p_status: params.status || null,
    p_group_id: params.groupId || null
  })
  if (options?.signal) request = request.abortSignal(options.signal)
  const { data } = await responseHandle<WarehouseWorkspaceResult>(() => request, readOptions)
  return {
    data: data?.data ?? [],
    total: data?.total ?? 0,
    groups: data?.groups ?? [],
    overview: data?.overview ?? { total: 0, enabled: 0, locationEnabled: 0, managed: 0 }
  }
}

export async function saveWarehouse(payload: WarehouseInput, id?: string): Promise<void> {
  await responseHandle(
    () =>
      supabase.rpc('mdm_save_warehouse_secure', {
        p_id: id ?? null,
        p_payload: keysToSnakeDeep(payload)
      }),
    { ...writeOptions, message: id ? '仓库已更新' : '仓库已新增' }
  )
}

export async function deleteWarehouses(ids: string[]): Promise<void> {
  await responseHandle(() => supabase.rpc('mdm_delete_warehouses_secure', { p_ids: ids }), {
    ...writeOptions,
    message: '仓库已删除'
  })
}

export async function setWarehousesEnabled(ids: string[], enabled: boolean): Promise<void> {
  await responseHandle(
    () => supabase.rpc('mdm_set_warehouses_enabled_secure', { p_ids: ids, p_enabled: enabled }),
    { ...writeOptions, message: enabled ? '仓库已启用' : '仓库已停用' }
  )
}

export async function saveWarehouseGroup(payload: WarehouseGroupInput, id?: string): Promise<void> {
  await responseHandle(
    () =>
      supabase.rpc('mdm_save_warehouse_group_secure', {
        p_id: id ?? null,
        p_payload: keysToSnakeDeep(payload)
      }),
    { ...writeOptions, message: id ? '仓库分组已更新' : '仓库分组已新增' }
  )
}

export async function deleteWarehouseGroup(id: string): Promise<void> {
  await responseHandle(() => supabase.rpc('mdm_delete_warehouse_group_secure', { p_id: id }), {
    ...writeOptions,
    message: '仓库分组已删除'
  })
}

const ruleReadOptions = {
  breakReturn: true,
  showErrorMessage: false,
  errorMessage: '库存规则加载失败，请重试'
}

const ruleWriteOptions = {
  breakReturn: true,
  showErrorMessage: true,
  showMessage: true,
  requireAffected: false,
  errorMessage: '库存规则保存失败，请检查编码、明细和当前权限'
}

export async function fetchSupplyChainCodeAttributes(): Promise<SupplyChainCodeAttribute[]> {
  const { data } = await responseHandle<SupplyChainCodeAttribute[]>(
    () =>
      supabase
        .from('mdm_supply_chain_code_attribute')
        .select('*')
        .eq('enabled', true)
        .order('sort'),
    ruleReadOptions
  )
  return data ?? []
}

export async function fetchSupplyChainCodeRules(
  params: InventoryRuleQuery,
  options?: { signal?: AbortSignal }
) {
  const { from, to } = buildSupabasePageRange(params)
  let query = supabase
    .from('mdm_supply_chain_code_rule')
    .select(
      '*,segments:mdm_supply_chain_code_segment(*,attribute:mdm_supply_chain_code_attribute(*))',
      { count: 'exact' }
    )
    .order('update_time', { ascending: false })
    .order('id')
  if (params.keyword)
    query = query.or(buildOrIlikeFilter(['rule_code', 'rule_name', 'example_code'], params.keyword))
  if (params.status) query = query.eq('status', params.status)
  query = query.range(from, to)
  const { data, total } = await responseHandle<SupplyChainCodeRule[]>(
    () => (options?.signal ? query.abortSignal(options.signal) : query),
    ruleReadOptions
  )
  return {
    data: (data ?? []).map((row) => ({
      ...row,
      segments: (row.segments ?? []).toSorted((left, right) => left.sort - right.sort)
    })),
    total: total ?? 0,
    current: params.current,
    size: params.size
  }
}

export async function saveSupplyChainCodeRule(
  tenantId: string,
  payload: SupplyChainCodeRuleInput,
  id?: string
): Promise<void> {
  await responseHandle(
    () =>
      supabase.rpc('mdm_save_supply_chain_code_rule_secure', {
        p_id: id ?? null,
        p_tenant_id: tenantId || null,
        p_payload: keysToSnakeDeep(payload)
      }),
    { ...ruleWriteOptions, message: id ? '供应链编码规则已更新' : '供应链编码规则已创建' }
  )
}

export async function deleteSupplyChainCodeRules(ids: string[]): Promise<void> {
  await responseHandle(
    () => supabase.rpc('mdm_delete_supply_chain_code_rules_secure', { p_ids: ids }),
    { ...ruleWriteOptions, message: '供应链编码规则已删除' }
  )
}

export async function setSupplyChainCodeRulesEnabled(
  ids: string[],
  enabled: boolean
): Promise<void> {
  await responseHandle(
    () =>
      supabase.rpc('mdm_set_supply_chain_code_rules_enabled_secure', {
        p_ids: ids,
        p_enabled: enabled
      }),
    { ...ruleWriteOptions, message: enabled ? '编码规则已启用' : '编码规则已停用' }
  )
}

export async function fetchOutboundSortFields(): Promise<OutboundSortField[]> {
  const { data } = await responseHandle<OutboundSortField[]>(
    () => supabase.from('mdm_outbound_sort_field').select('*').eq('enabled', true).order('sort'),
    ruleReadOptions
  )
  return data ?? []
}

export async function fetchOutboundRules(
  params: InventoryRuleQuery,
  options?: { signal?: AbortSignal }
) {
  const { from, to } = buildSupabasePageRange(params)
  let query = supabase
    .from('mdm_outbound_rule')
    .select('*,sorts:mdm_outbound_rule_sort(*,field:mdm_outbound_sort_field(*))', {
      count: 'exact'
    })
    .order('update_time', { ascending: false })
    .order('id')
  if (params.keyword)
    query = query.or(buildOrIlikeFilter(['rule_code', 'rule_name', 'remark'], params.keyword))
  if (params.status) query = query.eq('status', params.status)
  query = query.range(from, to)
  const { data, total } = await responseHandle<OutboundRule[]>(
    () => (options?.signal ? query.abortSignal(options.signal) : query),
    ruleReadOptions
  )
  return {
    data: (data ?? []).map((row) => ({
      ...row,
      sorts: (row.sorts ?? []).toSorted((left, right) => left.sort - right.sort)
    })),
    total: total ?? 0,
    current: params.current,
    size: params.size
  }
}

export async function saveOutboundRule(
  tenantId: string,
  payload: OutboundRuleInput,
  id?: string
): Promise<void> {
  await responseHandle(
    () =>
      supabase.rpc('mdm_save_outbound_rule_secure', {
        p_id: id ?? null,
        p_tenant_id: tenantId || null,
        p_payload: keysToSnakeDeep(payload)
      }),
    { ...ruleWriteOptions, message: id ? '出库规则已更新' : '出库规则已创建' }
  )
}

export async function deleteOutboundRules(ids: string[]): Promise<void> {
  await responseHandle(() => supabase.rpc('mdm_delete_outbound_rules_secure', { p_ids: ids }), {
    ...ruleWriteOptions,
    message: '出库规则已删除'
  })
}

export async function setOutboundRulesEnabled(ids: string[], enabled: boolean): Promise<void> {
  await responseHandle(
    () => supabase.rpc('mdm_set_outbound_rules_enabled_secure', { p_ids: ids, p_enabled: enabled }),
    { ...ruleWriteOptions, message: enabled ? '出库规则已启用' : '出库规则已停用' }
  )
}
