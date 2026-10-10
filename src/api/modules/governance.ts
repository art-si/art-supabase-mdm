import { useSupabase } from '@/hooks/core/useSupabase'
import { normalizeNullableText } from '@/utils/form/normalize'
import { buildOrIlikeFilter } from '@/utils/supabase/search'
import { buildSupabasePageRange } from '@/utils/supabase/pagination'
import { loadAllDocumentPages } from '@/utils/business/document-detail-list'
import type {
  MdmChangeRequest,
  MdmChangeRequestInput,
  MdmDataStewardInput,
  MdmGovernanceOverview,
  MdmGovernancePageQuery,
  MdmMatchCandidate,
  MdmMatchScanResult,
  MdmOutboxConsumerInput,
  MdmOutboxDelivery,
  MdmQualityIssue,
  MdmQualityRuleInput,
  MdmQualityScanResult
} from './governance.types'

export * from './governance.types'

const { supabase, responseHandle } = useSupabase()
const readOptions = {
  breakReturn: true,
  showErrorMessage: false,
  errorMessage: 'MDM 治理数据加载失败，请重试'
}
const writeOptions = {
  breakReturn: true,
  showErrorMessage: true,
  showMessage: true,
  message: '操作已完成',
  errorMessage: 'MDM 治理操作失败，请检查权限与数据后重试'
}

const pageResult = <T>(
  data: T[] | null,
  total: number | undefined,
  query: MdmGovernancePageQuery
) => ({ data: data ?? [], total: total ?? 0, current: query.current, size: query.size })

export async function fetchMdmGovernanceOverview(): Promise<MdmGovernanceOverview> {
  const { data } = await responseHandle<MdmGovernanceOverview>(
    () => supabase.rpc('mdm_get_governance_control_overview_secure'),
    readOptions
  )
  return (
    data ?? {
      stewards: 0,
      activeRules: 0,
      openIssues: 0,
      overdueIssues: 0,
      pendingChanges: 0,
      pendingMatches: 0,
      pendingDeliveries: 0,
      deadLetters: 0,
      generatedAt: new Date(0).toISOString()
    }
  )
}

export async function fetchMdmQualityIssues(query: MdmGovernancePageQuery) {
  const { from, to } = buildSupabasePageRange(query)
  let request = supabase
    .from('mdm_quality_issue')
    .select('*', { count: 'exact' })
    .order('due_at')
    .order('severity', { ascending: false })
    .order('id')
  if (query.keyword) {
    request = request.or(buildOrIlikeFilter(['source_code', 'source_name'], query.keyword))
  }
  if (query.state) request = request.eq('state', query.state)
  if (query.severity) request = request.eq('severity', query.severity)
  const { data, total } = await responseHandle<MdmQualityIssue[]>(
    () => request.range(from, to),
    readOptions
  )
  return pageResult(data, total, query)
}

export async function fetchMdmChangeRequests(query: MdmGovernancePageQuery) {
  const { from, to } = buildSupabasePageRange(query)
  let request = supabase
    .from('mdm_change_request')
    .select('*', { count: 'exact' })
    .order('create_time', { ascending: false })
    .order('id')
  if (query.keyword) {
    request = request.or(
      buildOrIlikeFilter(['request_no', 'title', 'source_type', 'requester_email'], query.keyword)
    )
  }
  if (query.state) request = request.eq('state', query.state)
  const { data, total } = await responseHandle<MdmChangeRequest[]>(
    () => request.range(from, to),
    readOptions
  )
  return pageResult(data, total, query)
}

export async function fetchMdmMatchCandidates(query: MdmGovernancePageQuery) {
  const { from, to } = buildSupabasePageRange(query)
  let request = supabase
    .from('mdm_match_candidate')
    .select('*', { count: 'exact' })
    .order('match_score', { ascending: false })
    .order('create_time')
    .order('id')
  if (query.keyword) {
    const keyword = query.keyword.trim()
    if (/^[0-9a-f-]{36}$/i.test(keyword)) {
      request = request.or(`left_record_id.eq.${keyword},right_record_id.eq.${keyword}`)
    }
  }
  if (query.state) request = request.eq('state', query.state)
  const { data, total } = await responseHandle<MdmMatchCandidate[]>(
    () => request.range(from, to),
    readOptions
  )
  return pageResult(data, total, query)
}

export async function fetchMdmOutboxDeliveries(query: MdmGovernancePageQuery) {
  const { from, to } = buildSupabasePageRange(query)
  let request = supabase
    .from('mdm_outbox_delivery')
    .select(
      '*,event:mdm_outbox_event!mdm_outbox_delivery_event_fk(event_type,aggregate_type,aggregate_id,event_version,occurred_at),consumer:mdm_outbox_consumer!mdm_outbox_delivery_consumer_fk(consumer_key,consumer_name,contract_version)',
      { count: 'exact' }
    )
    .order('create_time', { ascending: false })
    .order('id')
  if (query.state) request = request.eq('status', query.state)
  const { data, total } = await responseHandle<MdmOutboxDelivery[]>(
    () => request.range(from, to),
    readOptions
  )
  return pageResult(data, total, query)
}

export async function runMdmQualityScan(): Promise<MdmQualityScanResult> {
  const { data } = await responseHandle<MdmQualityScanResult>(
    () => supabase.rpc('mdm_sync_quality_issues_secure'),
    { ...writeOptions, message: '质量检测已完成' }
  )
  if (!data) throw new Error('质量检测未返回结果')
  return data
}

export async function transitionMdmQualityIssue(
  issueId: string,
  action: 'start' | 'submit_resolution' | 'verify' | 'waive' | 'reopen',
  comment?: string
): Promise<void> {
  await responseHandle(
    () =>
      supabase.rpc('mdm_transition_quality_issue_secure', {
        p_issue_id: issueId,
        p_action: action,
        p_comment: normalizeNullableText(comment)
      }),
    { ...writeOptions, message: '质量问题状态已更新' }
  )
}

export async function createMdmChangeRequest(input: MdmChangeRequestInput): Promise<string> {
  const { data } = await responseHandle<string>(
    () =>
      supabase.rpc('mdm_create_change_request_secure', {
        p_domain_key: input.domainKey,
        p_source_type: input.sourceType,
        p_source_record_id: input.sourceRecordId,
        p_operation: input.operation,
        p_title: input.title,
        p_reason: input.reason,
        p_before_data: input.beforeData,
        p_proposed_data: input.proposedData,
        p_effective_at: input.effectiveAt
      }),
    { ...writeOptions, message: '主数据变更草稿已创建' }
  )
  if (!data) throw new Error('变更申请未返回编号')
  return data
}

export async function transitionMdmChangeRequest(
  requestId: string,
  action: 'submit' | 'cancel' | 'approve' | 'reject' | 'publish',
  comment?: string
): Promise<void> {
  await responseHandle(
    () =>
      supabase.rpc('mdm_transition_change_request_secure', {
        p_request_id: requestId,
        p_action: action,
        p_comment: normalizeNullableText(comment)
      }),
    { ...writeOptions, message: '变更申请状态已更新' }
  )
}

export async function scanMdmBusinessPartnerMatches(): Promise<MdmMatchScanResult> {
  const { data } = await responseHandle<MdmMatchScanResult>(
    () => supabase.rpc('mdm_scan_business_partner_matches_secure'),
    { ...writeOptions, message: '往来主体匹配扫描已完成' }
  )
  if (!data) throw new Error('匹配扫描未返回结果')
  return data
}

export async function reviewMdmMatchCandidate(
  candidateId: string,
  decision: 'accept' | 'reject',
  winnerRecordId: string | null,
  comment: string
): Promise<void> {
  await responseHandle(
    () =>
      supabase.rpc('mdm_review_match_candidate_secure', {
        p_candidate_id: candidateId,
        p_decision: decision,
        p_winner_record_id: winnerRecordId,
        p_comment: comment
      }),
    { ...writeOptions, message: decision === 'accept' ? '黄金记录已生成' : '候选匹配已驳回' }
  )
}

export async function replayMdmOutboxDelivery(deliveryId: string, reason: string): Promise<void> {
  await responseHandle(
    () =>
      supabase.rpc('mdm_replay_outbox_delivery_secure', {
        p_delivery_id: deliveryId,
        p_reason: reason
      }),
    { ...writeOptions, message: '死信事件已进入重试队列' }
  )
}

export async function saveMdmDataSteward(input: MdmDataStewardInput): Promise<void> {
  await responseHandle(
    () =>
      supabase.rpc('mdm_upsert_data_steward_secure', {
        p_domain_key: input.domainKey,
        p_source_type: input.sourceType,
        p_steward_user_id: input.stewardUserId,
        p_escalation_user_id: input.escalationUserId,
        p_sla_hours: input.slaHours,
        p_enabled: input.enabled
      }),
    { ...writeOptions, message: '数据责任人配置已保存' }
  )
}

export async function createMdmQualityRuleVersion(input: MdmQualityRuleInput): Promise<void> {
  await responseHandle(
    () =>
      supabase.rpc('mdm_create_quality_rule_version_secure', {
        p_rule_code: input.ruleCode,
        p_rule_name: input.ruleName,
        p_domain_key: input.domainKey,
        p_source_type: input.sourceType,
        p_severity: input.severity,
        p_threshold: input.threshold,
        p_sla_hours: input.slaHours,
        p_definition: input.definition,
        p_effective_from: input.effectiveFrom
      }),
    { ...writeOptions, message: '质量规则新版本已发布' }
  )
}

export async function saveMdmOutboxConsumer(input: MdmOutboxConsumerInput): Promise<void> {
  await responseHandle(
    () =>
      supabase.rpc('mdm_upsert_outbox_consumer_secure', {
        p_consumer_key: input.consumerKey,
        p_consumer_name: input.consumerName,
        p_event_types: input.eventTypes,
        p_contract_version: input.contractVersion,
        p_visibility_timeout_seconds: input.visibilityTimeoutSeconds,
        p_max_attempts: input.maxAttempts,
        p_enabled: input.enabled,
        p_replay_since: input.replaySince
      }),
    { ...writeOptions, message: '下游消费者配置已保存' }
  )
}

export interface MdmGovernanceUserOption {
  id: string
  userName: string
  userEmail: string
}

export async function fetchMdmGovernanceUsers(keyword = ''): Promise<MdmGovernanceUserOption[]> {
  return loadAllDocumentPages<
    MdmGovernanceUserOption,
    { keyword: string; from?: number; to?: number }
  >(
    ({ keyword: search, from = 0, to = 499 }) =>
      responseHandle<MdmGovernanceUserOption[]>(() => {
        let request = supabase
          .from('sys_user')
          .select('id,user_name,user_email', { count: 'exact' })
          .eq('status', '1')
          .is('deleted_at', null)
          .order('user_name')
          .order('id')
          .range(from, to)
        if (search) request = request.or(buildOrIlikeFilter(['user_name', 'user_email'], search))
        return request
      }, readOptions),
    { keyword }
  )
}
