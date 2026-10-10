import { useSupabase } from '@/hooks/core/useSupabase'
import { normalizeNullableText } from '@/utils/form/normalize'
import { buildOrIlikeFilter } from '@/utils/supabase/search'
import { buildSupabasePageRange } from '@/utils/supabase/pagination'
import { loadAllDocumentPages } from '@/utils/business/document-detail-list'
import { uniq } from 'lodash-es'
import type {
  MovementTypeInput,
  MovementTypeOption,
  MovementTypeQuery,
  MovementTypeRecord
} from './movement-type.types'

export * from './movement-type.types'

const { supabase, responseHandle, keysToSnakeDeep } = useSupabase()
const selectFields =
  'id,tenant_id,movement_code,movement_name,direction,reverse_type_id,reversal,other_io,status,remark,create_time,update_time'
const readOptions = {
  breakReturn: true,
  showErrorMessage: false,
  errorMessage: '出入库类型加载失败，请重试'
}
const writeOptions = {
  breakReturn: true,
  showErrorMessage: true,
  showMessage: true,
  requireAffected: false,
  errorMessage: '出入库类型操作失败，请检查编码、关联类型和当前权限'
}

export async function fetchMovementTypePage(
  params: MovementTypeQuery,
  options?: { signal?: AbortSignal }
): Promise<{ records: MovementTypeRecord[]; total: number }> {
  const { from, to } = buildSupabasePageRange(params)
  let query = supabase
    .from('mdm_stock_movement_type')
    .select(selectFields, { count: 'exact' })
    .order('movement_code')
    .order('id')
    .range(from, to)
  if (params.tenantId) query = query.eq('tenant_id', params.tenantId)
  if (params.direction) query = query.eq('direction', params.direction)
  if (params.keyword?.trim()) {
    query = query.or(buildOrIlikeFilter(['movement_code', 'movement_name'], params.keyword))
  }
  if (options?.signal) query = query.abortSignal(options.signal)
  const { data, total } = await responseHandle<MovementTypeRecord[]>(() => query, readOptions)
  const records = data ?? []
  const reverseIds = uniq(
    records.map((row) => row.reverseTypeId).filter((id): id is string => !!id)
  )
  if (!reverseIds.length) return { records, total: total ?? 0 }

  let reverseQuery = supabase
    .from('mdm_stock_movement_type')
    .select('id,movement_code,movement_name')
    .in('id', reverseIds)
  if (options?.signal) reverseQuery = reverseQuery.abortSignal(options.signal)
  const { data: reverseTypes } = await responseHandle<
    Pick<MovementTypeRecord, 'id' | 'movementCode' | 'movementName'>[]
  >(() => reverseQuery, readOptions)
  const reverseMap = new Map((reverseTypes ?? []).map((row) => [row.id, row]))
  return {
    records: records.map((row) => ({
      ...row,
      reverseType: row.reverseTypeId ? (reverseMap.get(row.reverseTypeId) ?? null) : null
    })),
    total: total ?? 0
  }
}

export async function fetchMovementTypeOptions(tenantId: string): Promise<MovementTypeOption[]> {
  if (!tenantId) return []
  return loadAllDocumentPages<MovementTypeOption, { from?: number; to?: number }>(
    ({ from = 0, to = 499 }) =>
      responseHandle<MovementTypeOption[]>(
        () =>
          supabase
            .from('mdm_stock_movement_type')
            .select('id,tenant_id,movement_code,movement_name,direction,status', { count: 'exact' })
            .eq('tenant_id', tenantId)
            .order('movement_code')
            .order('id')
            .range(from, to),
        readOptions
      ),
    {}
  )
}

export async function exportMovementTypes(
  params: Omit<MovementTypeQuery, 'current' | 'size'>,
  maxRows: number
): Promise<MovementTypeRecord[]> {
  const rows: MovementTypeRecord[] = []
  let current = 1
  while (rows.length < maxRows) {
    const page = await fetchMovementTypePage({
      ...params,
      current,
      size: 1000
    })
    rows.push(...page.records.slice(0, maxRows - rows.length))
    if (page.records.length === 0 || rows.length >= page.total) break
    current += 1
  }
  return rows
}

export async function saveMovementType(payload: MovementTypeInput, id?: string): Promise<void> {
  await responseHandle(
    () =>
      supabase.rpc('mdm_save_stock_movement_type_secure', {
        p_id: id ?? null,
        p_tenant_id: payload.tenantId ?? null,
        p_payload: keysToSnakeDeep({
          ...payload,
          remark: normalizeNullableText(payload.remark)
        })
      }),
    { ...writeOptions, message: id ? '出入库类型已更新' : '出入库类型已新增' }
  )
}

export async function deleteMovementTypes(ids: string[]): Promise<void> {
  await responseHandle(
    () => supabase.rpc('mdm_delete_stock_movement_types_secure', { p_ids: ids }),
    { ...writeOptions, message: '出入库类型已删除' }
  )
}
