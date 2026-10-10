import { useSupabase } from '@/hooks/core/useSupabase'
import { clamp } from 'lodash-es'
import { normalizeNullableText } from '@/utils/form/normalize'
import { buildSupabasePageRange } from '@/utils/supabase/pagination'
import { mdmCatalogSourceDefinitions, type MdmCatalogScope } from './catalog-source-definitions'
export {
  mdmCatalogSourceDefinitions,
  mdmCatalogSourceKindCounts,
  type MdmCatalogScope,
  type MdmCatalogSourceDefinition
} from './catalog-source-definitions'

export type MdmCatalogState = 'active' | 'inactive'
export type MdmCatalogQuality = 'complete' | 'attention'

export interface MdmCatalogAttribute {
  label: string
  value: string | number | boolean | null
}

export interface MdmCatalogRecord {
  id: string
  code: string
  name: string
  status: string
  isActive: boolean
  subtitle: string
  sourceType: string
  sourceLabel: string
  sourceApp: string
  qualityScore: number
  qualityIssues: string[]
  attributes: MdmCatalogAttribute[]
  createTime: string | null
  updateTime: string | null
}

export interface MdmCatalogSourceSummary {
  type: string
  label: string
  app: string
  count: number
  attentionCount: number
}

export interface MdmCatalogSummary {
  total: number
  active: number
  inactive: number
  complete: number
  attention: number
  averageScore: number
}

export interface MdmCatalogQuery {
  current: number
  size: number
  keyword?: string
  sourceType?: string
  state?: MdmCatalogState
  quality?: MdmCatalogQuality
}

export interface MdmCatalogPageResponse {
  data: MdmCatalogRecord[]
  total: number
  current: number
  size: number
  sources: MdmCatalogSourceSummary[]
  summary: MdmCatalogSummary
}

export interface MdmDomainSummary {
  key: 'organization' | 'partner' | 'logistics' | 'asset' | 'material'
  label: string
  description: string
  icon: string
  recordCount: number
  attentionCount: number
  sourceCount: number
}

interface MdmOverviewDomainPayload {
  key: MdmDomainSummary['key']
  recordCount: number
  attentionCount: number
}

interface RequestOptions {
  signal?: AbortSignal
}

const { supabase, responseHandle } = useSupabase()

export const mdmDomainDefinitions: Omit<MdmDomainSummary, 'recordCount' | 'attentionCount'>[] = [
  {
    key: 'organization',
    label: '组织与人员',
    description: '组织、岗位、职务与员工身份',
    icon: 'ri:organization-chart',
    sourceCount:
      mdmCatalogSourceDefinitions.organization.length +
      mdmCatalogSourceDefinitions.position.length +
      mdmCatalogSourceDefinitions.employee.length
  },
  {
    key: 'partner',
    label: '往来主体',
    description: '客户、承运商、供应商等统一身份',
    icon: 'ri:building-4-line',
    sourceCount: mdmCatalogSourceDefinitions.partner.length
  },
  {
    key: 'logistics',
    label: '物流基础',
    description: '站点、客户地址、货物与司机基础资料',
    icon: 'ri:route-line',
    sourceCount: mdmCatalogSourceDefinitions.logistics.length
  },
  {
    key: 'asset',
    label: '资产设备',
    description: '车辆、设备与备件主档',
    icon: 'ri:tools-line',
    sourceCount:
      mdmCatalogSourceDefinitions.vehicle.length + mdmCatalogSourceDefinitions.equipment.length
  },
  {
    key: 'material',
    label: '物料与场所',
    description: '物料、场所与存放位置',
    icon: 'ri:archive-stack-line',
    sourceCount: mdmCatalogSourceDefinitions.material.length
  }
]

const emptySummary = (): MdmCatalogSummary => ({
  total: 0,
  active: 0,
  inactive: 0,
  complete: 0,
  attention: 0,
  averageScore: 0
})

const asObject = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}

const asString = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback

const asNullableString = (value: unknown): string | null =>
  typeof value === 'string' && value ? value : null

const asNumber = (value: unknown, fallback = 0): number => {
  const numberValue = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(numberValue) ? numberValue : fallback
}

const normalizeAttribute = (value: unknown): MdmCatalogAttribute | null => {
  const item = asObject(value)
  const label = asString(item.label).trim()
  const rawValue = item.value
  if (!label) return null
  if (
    rawValue !== null &&
    typeof rawValue !== 'string' &&
    typeof rawValue !== 'number' &&
    typeof rawValue !== 'boolean'
  ) {
    return null
  }
  return { label, value: rawValue ?? null }
}

const normalizeRecord = (value: unknown): MdmCatalogRecord => {
  const item = asObject(value)
  return {
    id: asString(item.id),
    code: asString(item.code, '—'),
    name: asString(item.name, '未命名主数据'),
    status: asString(item.status, '未知'),
    isActive: item.isActive === true,
    subtitle: asString(item.subtitle),
    sourceType: asString(item.sourceType),
    sourceLabel: asString(item.sourceLabel, '未识别来源'),
    sourceApp: asString(item.sourceApp, 'platform'),
    qualityScore: clamp(asNumber(item.qualityScore), 0, 100),
    qualityIssues: Array.isArray(item.qualityIssues)
      ? item.qualityIssues.map((issue) => asString(issue)).filter(Boolean)
      : [],
    attributes: Array.isArray(item.attributes)
      ? item.attributes
          .map(normalizeAttribute)
          .filter((entry): entry is MdmCatalogAttribute => !!entry)
      : [],
    createTime: asNullableString(item.createTime),
    updateTime: asNullableString(item.updateTime)
  }
}

const normalizeSource = (value: unknown): MdmCatalogSourceSummary => {
  const item = asObject(value)
  return {
    type: asString(item.type),
    label: asString(item.label),
    app: asString(item.app),
    count: asNumber(item.count),
    attentionCount: asNumber(item.attentionCount)
  }
}

const normalizeSummary = (value: unknown): MdmCatalogSummary => {
  const item = asObject(value)
  return {
    total: asNumber(item.total),
    active: asNumber(item.active),
    inactive: asNumber(item.inactive),
    complete: asNumber(item.complete),
    attention: asNumber(item.attention),
    averageScore: asNumber(item.averageScore)
  }
}

export async function fetchMdmCatalogPage(
  scope: MdmCatalogScope,
  query: MdmCatalogQuery,
  options?: RequestOptions
): Promise<MdmCatalogPageResponse> {
  const current = query.current ?? 1
  const size = query.size ?? 20
  const pageRange = buildSupabasePageRange({ current, size })
  // The catalog RPC limits each response to 100 rows; reject instead of silently changing pages.
  if (size > 100) throw new RangeError('主数据目录每页最多 100 条，请调整分页大小')
  const rpcQuery = supabase.rpc('mdm_list_catalog_secure', {
    p_scope: scope,
    p_keyword: normalizeNullableText(query.keyword),
    p_source_type: query.sourceType || null,
    p_state: query.state || null,
    p_quality: query.quality || null,
    p_from: pageRange.from,
    p_to: pageRange.to
  })
  const { data } = await responseHandle<unknown>(
    () => (options?.signal ? rpcQuery.abortSignal(options.signal) : rpcQuery),
    { breakReturn: true, showErrorMessage: true }
  )
  const payload = asObject(data)

  return {
    data: Array.isArray(payload.records) ? payload.records.map(normalizeRecord) : [],
    total: asNumber(payload.total),
    current,
    size,
    sources: Array.isArray(payload.sources) ? payload.sources.map(normalizeSource) : [],
    summary: payload.summary ? normalizeSummary(payload.summary) : emptySummary()
  }
}

export async function fetchMdmOverview(options?: RequestOptions): Promise<MdmDomainSummary[]> {
  const query = supabase.rpc('mdm_get_governance_overview_secure')
  const { data } = await responseHandle<unknown>(
    () => (options?.signal ? query.abortSignal(options.signal) : query),
    { breakReturn: true, showErrorMessage: false }
  )
  const payload = asObject(data)
  if (!Array.isArray(payload.domains)) {
    throw new Error('主数据概览返回异常，请重试')
  }
  const overviewDomains = new Map<MdmDomainSummary['key'], MdmOverviewDomainPayload>()
  for (const value of payload.domains) {
    const item = asObject(value)
    const definition = mdmDomainDefinitions.find((domain) => domain.key === item.key)
    // New server domains can coexist with an older frontend during rollout.
    if (!definition) continue
    const { recordCount, attentionCount } = item
    if (
      typeof recordCount !== 'number' ||
      !Number.isSafeInteger(recordCount) ||
      recordCount < 0 ||
      typeof attentionCount !== 'number' ||
      !Number.isSafeInteger(attentionCount) ||
      attentionCount < 0 ||
      attentionCount > recordCount ||
      overviewDomains.has(definition.key)
    ) {
      throw new Error('主数据概览统计异常，请重新加载')
    }
    overviewDomains.set(definition.key, { key: definition.key, recordCount, attentionCount })
  }

  return mdmDomainDefinitions.map((domain) => ({
    ...domain,
    recordCount: overviewDomains.get(domain.key)?.recordCount ?? 0,
    attentionCount: overviewDomains.get(domain.key)?.attentionCount ?? 0
  }))
}
