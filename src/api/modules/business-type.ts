import { useSupabase } from '@/hooks/core/useSupabase'
import { WRITE_PERMISSION_DENIED_MESSAGE } from '@/hooks/core/useSupabase'
import { normalizeNullableText } from '@/utils/form/normalize'
import { applyFilters, fetchAllRangePages } from '@/utils/supabase'
import { buildOrIlikeFilter } from '@/utils/supabase/search'
import { buildSupabasePageRange } from '@/utils/supabase/pagination'
import TreeUtils from '@/utils/tree'
import { chunk, uniq } from 'lodash-es'
import type {
  BusinessTypeDocumentReference,
  BusinessTypeExportQuery,
  BusinessTypeExportRecord,
  BusinessTypeMenuNode,
  BusinessTypeOptionQuery,
  BusinessTypeQuery,
  BusinessTypeRecord,
  BusinessTypeSourceReference,
  BusinessTypeStats,
  BusinessTypeUpdateInput,
  BusinessTypeWriteInput
} from './business-type.types'

export * from './business-type.types'

const { supabase, keysToSnakeDeep, responseHandle } = useSupabase()
const treeUtils = new TreeUtils({ idKey: 'id', parentKey: 'parentId', childrenKey: 'children' })

const readOptions = {
  breakReturn: true,
  showErrorMessage: true,
  errorMessage: '业务类型加载失败，请稍后重试'
}

const writeOptions = {
  breakReturn: true,
  showErrorMessage: true,
  showMessage: true,
  requireAffected: true,
  noAffectedMessage: WRITE_PERMISSION_DENIED_MESSAGE,
  errorMessage: '保存失败，请检查类型编号、单据归属和当前权限'
}

const businessTypeSelect = `
  *,
  tenant:sys_tenant!mdm_business_type_tenant_id_fkey(tenant_code, tenant_name),
  documentType:mdm_document_type!mdm_business_type_document_type_fkey!inner(
    id, tenant_id, menu_id, menu_ids, document_type_code, document_type_name, enabled
  )
`

async function attachDocumentTypes(rows: BusinessTypeRecord[]): Promise<BusinessTypeRecord[]> {
  const ids = uniq(
    rows.flatMap((row) =>
      row.documentTypeIds?.length ? row.documentTypeIds : [row.documentTypeId]
    )
  )
  if (!ids.length) return rows
  const documents: BusinessTypeDocumentReference[] = []
  for (const batch of chunk(ids, 200)) {
    const { data } = await responseHandle<BusinessTypeDocumentReference[]>(
      () =>
        supabase
          .from('mdm_document_type')
          .select('id,tenant_id,menu_id,menu_ids,document_type_code,document_type_name,enabled')
          .in('id', batch),
      { ...readOptions, showErrorMessage: false }
    )
    documents.push(...(data ?? []))
  }
  const byId = new Map(documents.map((item) => [item.id, item]))
  return rows.map((row) => ({
    ...row,
    documentTypes: (row.documentTypeIds?.length ? row.documentTypeIds : [row.documentTypeId])
      .map((id) => byId.get(id))
      .filter((item): item is BusinessTypeDocumentReference => Boolean(item))
  }))
}

async function attachSourceBusinessTypes(
  rows: BusinessTypeRecord[],
  signal?: AbortSignal
): Promise<BusinessTypeRecord[]> {
  const sourceIds = uniq(
    rows
      .map((row) => row.sourceBusinessTypeId)
      .filter((id): id is string => typeof id === 'string' && Boolean(id))
  )
  if (!sourceIds.length) return rows

  const query = supabase
    .from('mdm_business_type')
    .select('id,business_type_code,business_type_name,enabled')
    .in('id', sourceIds)
  const { data } = await responseHandle<BusinessTypeSourceReference[]>(
    () => (signal ? query.abortSignal(signal) : query),
    { ...readOptions, showErrorMessage: false }
  )
  const sourceById = new Map((data ?? []).map((source) => [source.id, source]))

  return rows.map((row) => ({
    ...row,
    sourceBusinessType: row.sourceBusinessTypeId
      ? (sourceById.get(row.sourceBusinessTypeId) ?? null)
      : null
  }))
}

export async function fetchBusinessTypeList(
  params: BusinessTypeQuery,
  options?: { signal?: AbortSignal }
) {
  const pageRange = buildSupabasePageRange(params)
  const {
    current,
    size,
    keyword = '',
    tenantId,
    menuIds,
    documentTypeId,
    enabled,
    isDefault
  } = params
  let query = supabase
    .from('mdm_business_type')
    .select(businessTypeSelect, { count: 'exact' })
    .order('sort_order', { ascending: true })
    .order('business_type_name', { ascending: true })
    .order('id')
    .range(pageRange.from, pageRange.to)

  query = applyFilters(
    query,
    [
      { col: 'tenant_id', op: 'eq', val: tenantId },
      { col: 'enabled', op: 'eq', val: enabled },
      { col: 'is_default', op: 'eq', val: isDefault }
    ],
    { skipEmpty: true, camelToSnake: false }
  )
  if (documentTypeId) query = query.contains('document_type_ids', [documentTypeId])

  if (menuIds?.length) query = query.overlaps('menu_ids', menuIds)
  if (keyword.trim()) {
    query = query.or(
      buildOrIlikeFilter(['business_type_code', 'business_type_name', 'remark'], keyword.trim())
    )
  }

  const { data, total } = await responseHandle<BusinessTypeRecord[]>(
    () => (options?.signal ? query.abortSignal(options.signal) : query),
    readOptions
  )
  return {
    data: await attachDocumentTypes(await attachSourceBusinessTypes(data ?? [], options?.signal)),
    total: total ?? 0,
    current,
    size
  }
}

export async function fetchBusinessTypeStats(tenantId?: string | null): Promise<BusinessTypeStats> {
  const { data } = await fetchAllRangePages<BusinessTypeRecord>(
    ({ from, to }) => {
      let query = supabase
        .from('mdm_business_type')
        .select(
          `id,tenant_id,document_type_id,document_type_ids,menu_ids,enabled,is_default,update_time,
          documentType:mdm_document_type!mdm_business_type_document_type_fkey!inner(menu_id,menu_ids)`
        )
        .order('id')
        .range(from, to)
      if (tenantId) query = query.eq('tenant_id', tenantId)
      return responseHandle<BusinessTypeRecord[]>(() => query, {
        ...readOptions,
        showErrorMessage: false
      })
    },
    { pageSize: 500 }
  )

  const rows = data ?? []
  const menuCounts = rows.reduce<Record<string, number>>((counts, row) => {
    for (const menuId of row.menuIds) counts[menuId] = (counts[menuId] ?? 0) + 1
    return counts
  }, {})

  return {
    total: rows.length,
    enabled: rows.filter((row) => row.enabled).length,
    defaults: rows.filter((row) => row.isDefault).length,
    menuCount: Object.keys(menuCounts).length,
    documentTypeCount: new Set(rows.flatMap((row) => row.documentTypeIds ?? [row.documentTypeId]))
      .size,
    tenantCount: new Set(rows.map((row) => row.tenantId)).size,
    menuCounts,
    lastUpdateTime: rows
      .map((row) => row.updateTime ?? '')
      .filter(Boolean)
      .sort()
      .at(-1)
  }
}

export async function fetchBusinessTypeMenuTree(): Promise<BusinessTypeMenuNode[]> {
  const { data } = await fetchAllRangePages<BusinessTypeMenuNode>(
    ({ from, to }) =>
      responseHandle<BusinessTypeMenuNode[]>(
        () =>
          supabase
            .from('sys_menu')
            .select('id,parent_id,name,path,component,type,app_code,sort,meta')
            .in('type', ['folder', 'menu'])
            .order('app_code', { ascending: true })
            .order('sort', { ascending: true })
            .range(from, to),
        { ...readOptions, showErrorMessage: false }
      ),
    { pageSize: 500 }
  )
  return treeUtils.listToTree((data ?? []).filter((menu) => menu.meta?.isEnable !== false))
}

export async function fetchBusinessTypeDocumentOptions(
  params: BusinessTypeOptionQuery
): Promise<{ data: BusinessTypeDocumentReference[] }> {
  if (!params.tenantId) return { data: [] }
  const { data } = await fetchAllRangePages<BusinessTypeDocumentReference>(
    ({ from, to }) => {
      let query = supabase
        .from('mdm_document_type')
        .select('id,tenant_id,menu_id,menu_ids,document_type_code,document_type_name,enabled')
        .eq('tenant_id', params.tenantId)
        .order('sort_order')
        .order('document_type_name')
        .range(from, to)
      if (params.menuIds?.length) query = query.overlaps('menu_ids', params.menuIds)
      if (typeof params.enabled === 'boolean') query = query.eq('enabled', params.enabled)
      return responseHandle<BusinessTypeDocumentReference[]>(() => query, {
        ...readOptions,
        showErrorMessage: false
      })
    },
    { pageSize: 500 }
  )
  return { data: data ?? [] }
}

export async function fetchBusinessTypeOptions(
  params: BusinessTypeOptionQuery
): Promise<{ data: BusinessTypeRecord[] }> {
  if (!params.tenantId) return { data: [] }
  const { data } = await fetchAllRangePages<BusinessTypeRecord>(
    ({ from, to }) => {
      let query = supabase
        .from('mdm_business_type')
        .select(
          'id,business_type_code,business_type_name,document_type_id,document_type_ids,enabled'
        )
        .eq('tenant_id', params.tenantId)
        .order('sort_order')
        .order('business_type_name')
        .range(from, to)
      if (params.documentTypeId)
        query = query.contains('document_type_ids', [params.documentTypeId])
      if (params.excludeId) query = query.neq('id', params.excludeId)
      if (typeof params.enabled === 'boolean') query = query.eq('enabled', params.enabled)
      return responseHandle<BusinessTypeRecord[]>(() => query, {
        ...readOptions,
        showErrorMessage: false
      })
    },
    { pageSize: 500 }
  )
  return { data: data ?? [] }
}

export async function fetchNextBusinessTypeSort(documentTypeId: string, tenantId?: string | null) {
  let query = supabase
    .from('mdm_business_type')
    .select('sort_order')
    .contains('document_type_ids', [documentTypeId])
    .order('sort_order', { ascending: false })
    .limit(1)
  if (tenantId) query = query.eq('tenant_id', tenantId)
  const { data } = await responseHandle<Array<{ sortOrder: number }>>(() => query, {
    ...readOptions,
    showErrorMessage: false
  })
  return Math.max(10, (data?.[0]?.sortOrder ?? 0) + 10)
}

export async function createBusinessType(input: BusinessTypeWriteInput) {
  return await responseHandle(
    () =>
      supabase
        .from('mdm_business_type')
        .insert(keysToSnakeDeep(input), { count: 'exact' })
        .select('id'),
    { ...writeOptions, message: '业务类型已创建' }
  )
}

export async function updateBusinessType(id: string, input: BusinessTypeUpdateInput) {
  return await responseHandle(
    () =>
      supabase
        .from('mdm_business_type')
        .update(keysToSnakeDeep(input), { count: 'exact' })
        .eq('id', id)
        .select('id'),
    { ...writeOptions, message: '业务类型已更新' }
  )
}

export async function copyBusinessType(sourceId: string, input: BusinessTypeUpdateInput) {
  return await responseHandle<string>(
    () =>
      supabase.rpc('copy_mdm_business_type_with_menus_multi', {
        p_source_id: sourceId,
        p_document_type_id: input.documentTypeId,
        p_document_type_ids: input.documentTypeIds,
        p_business_type_code: input.businessTypeCode,
        p_business_type_name: input.businessTypeName,
        p_is_default: input.isDefault,
        p_source_business_type_id: input.sourceBusinessTypeId,
        p_inventory_direction: input.inventoryDirection,
        p_stock_movement: input.stockMovement,
        p_menu_ids: input.menuIds,
        p_owner_type: input.ownerType,
        p_inventory_accounting: input.inventoryAccounting,
        p_remark: input.remark,
        p_sort_order: input.sortOrder,
        p_text_color: input.textColor,
        p_tag_style: input.tagStyle,
        p_enabled: input.enabled
      }),
    { ...writeOptions, message: '业务类型副本已创建' }
  )
}

export async function deleteBusinessTypes(ids: string[]): Promise<void> {
  const targets = uniq(ids)
  if (!targets.length || targets.some((id) => !id.trim()))
    throw new Error('所选业务类型记录已变化，请刷新后重试')
  const { data } = await responseHandle<number>(
    () =>
      supabase
        .from('mdm_business_type')
        .delete({ count: 'exact' })
        .in('id', targets)
        .then((result) => ({ ...result, data: result.count })),
    {
      ...writeOptions,
      showMessage: false,
      showErrorMessage: false,
      noAffectedMessage: '所选业务类型未删除，请刷新列表核对权限和记录状态后重试',
      showReferenceFeedback: false,
      errorMessage: '删除失败，请先解除源业务类型或业务单据引用'
    }
  )
  if (data !== targets.length)
    throw new Error('删除结果与所选记录不一致，请刷新列表核对权限和记录状态后重试')
}

export async function exportBusinessTypes(
  params: BusinessTypeExportQuery
): Promise<BusinessTypeExportRecord[]> {
  const { data } = await responseHandle<
    Array<Omit<BusinessTypeExportRecord, 'menuIds' | 'stockMovement' | 'documentTypeIds'>>
  >(
    () =>
      supabase.rpc('export_mdm_business_types', {
        p_tenant_id: params.tenantId ?? null,
        p_menu_ids: params.menuIds?.length ? params.menuIds : null,
        p_document_type_id: params.documentTypeId || null,
        p_keyword: normalizeNullableText(params.keyword),
        p_enabled: params.enabled ?? null,
        p_is_default: params.isDefault ?? null,
        p_limit: params.limit ?? 10000
      }),
    { ...readOptions, errorMessage: '导出数据加载失败，请检查当前权限后重试' }
  )
  const rows = data ?? []
  const assignmentById = new Map<
    string,
    Pick<BusinessTypeRecord, 'menuIds' | 'stockMovement' | 'documentTypeIds'>
  >()
  for (const ids of chunk(
    rows.map((row) => row.id),
    200
  )) {
    const { data: assignments } = await responseHandle<
      Array<Pick<BusinessTypeRecord, 'id' | 'menuIds' | 'stockMovement' | 'documentTypeIds'>>
    >(
      () =>
        supabase
          .from('mdm_business_type')
          .select('id,menu_ids,stock_movement,document_type_ids')
          .in('id', ids),
      {
        ...readOptions,
        errorMessage: '导出业务类型扩展信息加载失败，请重试'
      }
    )
    for (const assignment of assignments ?? []) assignmentById.set(assignment.id, assignment)
  }
  const enriched = rows.map((row) => ({
    ...row,
    menuIds: assignmentById.get(row.id)?.menuIds ?? (row.menuId ? [row.menuId] : []),
    stockMovement: assignmentById.get(row.id)?.stockMovement ?? null,
    documentTypeIds: assignmentById.get(row.id)?.documentTypeIds ?? [row.documentTypeId]
  }))
  const withDocuments = await attachDocumentTypes(enriched)
  return enriched.map((row, index) => ({
    ...row,
    documentTypes: withDocuments[index].documentTypes,
    documentTypeName:
      withDocuments[index].documentTypes?.map((item) => item.documentTypeName).join('、') ||
      row.documentTypeName,
    documentTypeCode:
      withDocuments[index].documentTypes?.map((item) => item.documentTypeCode).join('、') ||
      row.documentTypeCode
  }))
}
